import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const ALLOWED_RANGES = [7, 14, 30, 90, 180];
const ALLOWED_ACTIVE_WINDOWS = [7, 6, 5, 4, 3, 2, 1];
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_SESSION_WINDOW_SECONDS = 30;
const ACTIVE_SESSION_WINDOW_MS = ACTIVE_SESSION_WINDOW_SECONDS * 1000;

const getRangeInDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return ALLOWED_RANGES[0];
  return ALLOWED_RANGES.includes(parsed) ? parsed : ALLOWED_RANGES[0];
};

const normaliseDateToUTC = (date) => {
  const cloned = new Date(date);
  cloned.setUTCHours(0, 0, 0, 0);
  return cloned;
};

const getActiveWindowDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return ALLOWED_ACTIVE_WINDOWS[0];
  return ALLOWED_ACTIVE_WINDOWS.includes(parsed)
    ? parsed
    : ALLOWED_ACTIVE_WINDOWS[0];
};

const formatDateKey = (date) => {
  const d = new Date(date);
  const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${day}`;
};

const buildBuckets = (startDate, endDate) => {
  const cursor = new Date(startDate);
  const buckets = [];
  while (cursor <= endDate) {
    buckets.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
};

const aggregatePeriod = (
  purchases = [],
  devices = [],
  bucketDates = null
) => {
  const revenueByDay = bucketDates
    ? Object.fromEntries(bucketDates.map((d) => [d, 0]))
    : null;
  const trialRevenueByDay = bucketDates
    ? Object.fromEntries(bucketDates.map((d) => [d, 0]))
    : null;
  const usersByDay = bucketDates
    ? Object.fromEntries(bucketDates.map((d) => [d, 0]))
    : null;

  let totalRevenue = 0;
  let totalTrialRevenue = 0;
  let paidPurchasesCount = 0;
  let trialPurchasesCount = 0;
  const uniqueDevices = new Set();

  purchases.forEach((purchase) => {
    const price = Number.parseFloat(purchase.price ?? 0);
    if (!Number.isFinite(price)) return;

    const isTrial = Boolean(purchase.is_trial);
    if (!isTrial) {
      totalRevenue += price;
      paidPurchasesCount += 1;
    } else {
      totalTrialRevenue += price;
      trialPurchasesCount += 1;
    }

    const key = bucketDates ? formatDateKey(purchase.created_at) : null;
    if (key && revenueByDay && key in revenueByDay) {
      if (isTrial && trialRevenueByDay) {
        trialRevenueByDay[key] += price;
      } else {
        revenueByDay[key] += price;
      }
    }
  });

  devices.forEach((device) => {
    uniqueDevices.add(device.device_id);
    const key = bucketDates ? formatDateKey(device.created_at) : null;
    if (key && usersByDay && key in usersByDay) {
      usersByDay[key] += 1;
    }
  });

  return {
    totalRevenue: Number.parseFloat(totalRevenue.toFixed(2)),
    totalTrialRevenue: Number.parseFloat(totalTrialRevenue.toFixed(2)),
    paidPurchasesCount,
    trialPurchasesCount,
    totalPurchasesCount: purchases.length,
    newUsersCount: uniqueDevices.size,
    revenueByDay,
    trialRevenueByDay,
    usersByDay,
  };
};

const computeDelta = (current, previous) => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Number.parseFloat(
    (((current - previous) / previous) * 100).toFixed(2)
  );
};

const averageSubscriptionDurationDays = (purchases = []) => {
  const durations = purchases
    .filter((purchase) => {
      if (purchase.is_trial) return false;
      if (!purchase.purchase_date || !purchase.expiration_date) return false;
      const start = new Date(purchase.purchase_date);
      const end = new Date(purchase.expiration_date);
      return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
    })
    .map((purchase) => {
      const start = new Date(purchase.purchase_date).getTime();
      const end = new Date(purchase.expiration_date).getTime();
      return (end - start) / DAY_MS;
    });

  if (!durations.length) {
    return { averageDays: null, sampleSize: 0 };
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  const averageDays = Number.parseFloat((total / durations.length).toFixed(2));
  return { averageDays, sampleSize: durations.length };
};

const uniqueDeviceIds = (purchases = [], predicate = () => true) => {
  const ids = new Set();
  purchases.forEach((purchase) => {
    if (!predicate(purchase)) return;
    if (!purchase.device_id) return;
    ids.add(purchase.device_id);
  });
  return ids;
};

const formatProductLabel = (productId) => {
  if (!productId || typeof productId !== "string") {
    return "Unknown";
  }
  return productId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export async function GET(req, { params }) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to view analytics." },
        { status: 401 }
      );
    }

    const appId = params?.appId;
    if (!appId) {
      return NextResponse.json({ error: "App id is required." }, { status: 400 });
    }

    const url = new URL(req.url);
    const rangeFromQuery = url.searchParams.get("range");
    const rangeDays = getRangeInDays(rangeFromQuery);
    const activeWindowFromQuery = url.searchParams.get("activeWindow");
    const activeWindowDays = getActiveWindowDays(activeWindowFromQuery);

    // We extend the start date to the beginning of the day in UTC to avoid partial bars
    const now = new Date();
    const endDate = normaliseDateToUTC(now);
    const startDate = normaliseDateToUTC(
      new Date(endDate.getTime() - (rangeDays - 1) * DAY_MS)
    );

    const previousEndDate = normaliseDateToUTC(
      new Date(startDate.getTime() - DAY_MS)
    );
    const previousStartDate = normaliseDateToUTC(
      new Date(previousEndDate.getTime() - (rangeDays - 1) * DAY_MS)
    );

    const startIso = startDate.toISOString();
    const endIso = new Date(endDate.getTime() + DAY_MS - 1).toISOString();
    const previousStartIso = previousStartDate.toISOString();
    const previousEndIso = new Date(previousEndDate.getTime() + DAY_MS - 1).toISOString();

    // Ensure the app exists
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("id, app_id, name")
      .eq("app_id", appId)
      .maybeSingle();

    if (appError) {
      console.error("Error fetching app for analytics:", appError);
      return NextResponse.json(
        { error: "Failed to fetch app metadata." },
        { status: 500 }
      );
    }

    if (!app) {
      return NextResponse.json(
        { error: "App was not found." },
        { status: 404 }
      );
    }

    const activeSessionsSinceIso = new Date(
      now.getTime() - ACTIVE_SESSION_WINDOW_MS
    ).toISOString();
    const activeWindowExtendedStartDate = normaliseDateToUTC(
      new Date(startDate.getTime() - (activeWindowDays - 1) * DAY_MS)
    );
    const activeWindowExtendedStartIso = activeWindowExtendedStartDate.toISOString();


    const [
      purchasesResult,
      devicesResult,
      previousPurchasesResult,
      previousDevicesResult,
      activeSessionsResult,
      activeDevicesResult,
      geoSessionsResult,
    ] = await Promise.all([
      supabase
        .from("purchases")
        .select(
          "price, created_at, is_trial, device_id, purchase_date, expiration_date, product_id"
        )
        .eq("app_id", appId)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("devices")
        .select("device_id, created_at")
        .eq("app_id", appId)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("purchases")
        .select(
          "price, created_at, is_trial, device_id, purchase_date, expiration_date, product_id"
        )
        .eq("app_id", appId)
        .gte("created_at", previousStartIso)
        .lte("created_at", previousEndIso),
      supabase
        .from("devices")
        .select("device_id, created_at")
        .eq("app_id", appId)
        .gte("created_at", previousStartIso)
        .lte("created_at", previousEndIso),
      supabase
        .from("active_sessions")
        .select("session_started_at, last_heartbeat")
        .eq("app_id", appId)
        .gte("last_heartbeat", activeSessionsSinceIso),
      supabase
        .from("devices")
        .select("device_id, last_seen_at")
        .eq("app_id", appId)
        .gte("last_seen_at", activeWindowExtendedStartIso)
        .lte("last_seen_at", endIso),
      supabase
        .from("active_sessions")
        .select("country_code")
        .eq("app_id", appId)
        .gte("session_started_at", startIso)
        .lte("session_started_at", endIso),
    ]);

    const purchasesError = purchasesResult.error;
    const devicesError = devicesResult.error;
    const previousPurchasesError = previousPurchasesResult.error;
    const previousDevicesError = previousDevicesResult.error;
    const activeSessionsError = activeSessionsResult.error;
    const activeDevicesError = activeDevicesResult.error;
    const geoSessionsError = geoSessionsResult.error;

    if (
      purchasesError ||
      devicesError ||
      previousPurchasesError ||
      previousDevicesError ||
      activeSessionsError ||
      activeDevicesError ||
      geoSessionsError
    ) {
      console.error("Error fetching analytics data:", {
        purchasesError,
        devicesError,
        previousPurchasesError,
        previousDevicesError,
        activeSessionsError,
        activeDevicesError,
        geoSessionsError,
      });
      return NextResponse.json(
        { error: "Failed to fetch analytics data." },
        { status: 500 }
      );
    }

    const purchases = purchasesResult.data ?? [];
    const devices = devicesResult.data ?? [];
    const previousPurchases = previousPurchasesResult.data ?? [];
    const previousDevices = previousDevicesResult.data ?? [];
    const activeSessionsData = activeSessionsResult.data ?? [];
    const activeSessionsCount = activeSessionsData.length;
    const activeDevices = activeDevicesResult.data ?? [];
    const geoSessions = geoSessionsResult.data ?? [];

    const sessionDurations = activeSessionsData
      .map((session) => {
        if (!session.session_started_at || !session.last_heartbeat) return null;
        const start = new Date(session.session_started_at);
        const end = new Date(session.last_heartbeat);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
          return null;
        if (end <= start) return null;
        return end.getTime() - start.getTime();
      })
      .filter((duration) => Number.isFinite(duration) && duration > 0);
    const averageSessionDurationSeconds = sessionDurations.length
      ? Number.parseFloat(
          (sessionDurations.reduce((sum, ms) => sum + ms, 0) /
            sessionDurations.length /
            1000).toFixed(2)
        )
      : null;

    const trialDeviceIdsCurrent = Array.from(
      uniqueDeviceIds(
        purchases,
        (purchase) => Boolean(purchase.is_trial) === true
      )
    );
    const trialDeviceIdsPrevious = Array.from(
      uniqueDeviceIds(
        previousPurchases,
        (purchase) => Boolean(purchase.is_trial) === true
      )
    );

    const [convertedCurrentResult, convertedPreviousResult] = await Promise.all([
      trialDeviceIdsCurrent.length
        ? supabase
            .from("purchases")
            .select("device_id")
            .eq("app_id", appId)
            .eq("is_trial", false)
            .in("device_id", trialDeviceIdsCurrent)
        : { data: [], error: null },
      trialDeviceIdsPrevious.length
        ? supabase
            .from("purchases")
            .select("device_id")
            .eq("app_id", appId)
            .eq("is_trial", false)
            .in("device_id", trialDeviceIdsPrevious)
        : { data: [], error: null },
    ]);

    const convertedCurrentError = convertedCurrentResult.error;
    const convertedPreviousError = convertedPreviousResult.error;

    if (convertedCurrentError || convertedPreviousError) {
      console.error("Error resolving trial conversion data:", {
        convertedCurrentError,
        convertedPreviousError,
      });
      return NextResponse.json(
        { error: "Failed to compute trial cancellation metrics." },
        { status: 500 }
      );
    }

    const convertedCurrentDevices = new Set(
      (convertedCurrentResult.data ?? [])
        .map((row) => row.device_id)
        .filter(Boolean)
    );
    const convertedPreviousDevices = new Set(
      (convertedPreviousResult.data ?? [])
        .map((row) => row.device_id)
        .filter(Boolean)
    );

    const dateBuckets = buildBuckets(startDate, endDate);
    const {
      totalRevenue,
      totalTrialRevenue,
      paidPurchasesCount,
      trialPurchasesCount,
      newUsersCount,
      revenueByDay,
      trialRevenueByDay,
      usersByDay,
    } = aggregatePeriod(purchases, devices, dateBuckets);

    const {
      totalRevenue: previousRevenue,
      totalTrialRevenue: previousTrialRevenue,
      paidPurchasesCount: previousPaidPurchasesCount,
      trialPurchasesCount: previousTrialPurchasesCount,
      newUsersCount: previousNewUsers,
    } = aggregatePeriod(previousPurchases, previousDevices);

    const { averageDays: averageSubscriptionDays, sampleSize: subscriptionSampleSize } =
      averageSubscriptionDurationDays(purchases);
    const {
      averageDays: previousAverageSubscriptionDays,
      sampleSize: previousSubscriptionSampleSize,
    } = averageSubscriptionDurationDays(previousPurchases);

    const totalCurrentTrials = trialDeviceIdsCurrent.length;
    const totalPreviousTrials = trialDeviceIdsPrevious.length;
    const convertedCurrentCount = convertedCurrentDevices.size;
    const convertedPreviousCount = convertedPreviousDevices.size;
    const cancelledCurrentTrials = totalCurrentTrials - convertedCurrentCount;
    const cancelledPreviousTrials = totalPreviousTrials - convertedPreviousCount;
    const trialCancellationRate =
      totalCurrentTrials > 0
        ? Number.parseFloat(
            ((cancelledCurrentTrials / totalCurrentTrials) * 100).toFixed(2)
          )
        : 0;
    const previousTrialCancellationRate =
      totalPreviousTrials > 0
        ? Number.parseFloat(
            ((cancelledPreviousTrials / totalPreviousTrials) * 100).toFixed(2)
          )
        : 0;
    const averageSubscriptionDelta =
      Number.isFinite(averageSubscriptionDays) &&
      Number.isFinite(previousAverageSubscriptionDays) &&
      previousAverageSubscriptionDays !== 0
        ? computeDelta(averageSubscriptionDays, previousAverageSubscriptionDays)
        : null;

    const paidPurchases = purchases.filter((purchase) => !purchase.is_trial);
    const productCountMap = paidPurchases.reduce((acc, purchase) => {
      const key = purchase.product_id || "unknown";
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map());
    const purchasesByProduct = Array.from(productCountMap.entries())
      .map(([productId, count]) => ({
        productId,
        label: formatProductLabel(productId),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const countryCountMap = geoSessions.reduce((acc, session) => {
      const codeRaw = session?.country_code;
      const code = codeRaw
        ? String(codeRaw).trim().toUpperCase()
        : "UNKNOWN";
      if (!code) return acc;
      acc.set(code, (acc.get(code) || 0) + 1);
      return acc;
    }, new Map());
    const totalCountrySessions = Array.from(countryCountMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const geoCountries = Array.from(countryCountMap.entries())
      .map(([code, count]) => ({
        code,
        count,
        percent:
          totalCountrySessions > 0
            ? Number.parseFloat(((count / totalCountrySessions) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const activeDeviceSnapshots = activeDevices
      .map((device) => {
        if (!device.device_id || !device.last_seen_at) return null;
        const lastSeen = new Date(device.last_seen_at);
        if (!Number.isFinite(lastSeen.getTime())) return null;
        return { deviceId: device.device_id, lastSeenMs: lastSeen.getTime() };
      })
      .filter(Boolean);

    const chart = dateBuckets.map((bucket) => ({
      date: bucket,
      revenue: Number.parseFloat(revenueByDay[bucket]?.toFixed(2) ?? 0),
      trialRevenue: Number.parseFloat(
        trialRevenueByDay?.[bucket]?.toFixed(2) ?? 0
      ),
      newUsers: usersByDay[bucket] ?? 0,
    }));

    const activeUsersSeries = dateBuckets.map((bucket) => {
      const bucketDate = new Date(`${bucket}T00:00:00.000Z`);
      const bucketStartMs = bucketDate.getTime();
      const bucketEndMs = bucketStartMs + DAY_MS - 1;
      const windowStartMs =
        bucketStartMs - (activeWindowDays > 0 ? (activeWindowDays - 1) * DAY_MS : 0);
      const activeIds = new Set();

      activeDeviceSnapshots.forEach((snapshot) => {
        if (
          snapshot.lastSeenMs >= windowStartMs &&
          snapshot.lastSeenMs <= bucketEndMs
        ) {
          activeIds.add(snapshot.deviceId);
        }
      });

      return {
        date: bucket,
        activeUsers: activeIds.size,
      };
    });

    const revenuePerUser =
      newUsersCount > 0 ? Number.parseFloat((totalRevenue / newUsersCount).toFixed(2)) : 0;
    const previousRevenuePerUser =
      previousNewUsers > 0
        ? Number.parseFloat((previousRevenue / previousNewUsers).toFixed(2))
        : 0;
    const conversionRate =
      newUsersCount > 0
        ? Number.parseFloat(
            ((paidPurchasesCount / newUsersCount) * 100).toFixed(2)
          )
        : 0;
    const previousConversionRate =
      previousNewUsers > 0
        ? Number.parseFloat(
            ((previousPaidPurchasesCount / previousNewUsers) * 100).toFixed(2)
          )
        : 0;

    return NextResponse.json({
      app: {
        id: app.id,
        app_id: app.app_id,
        name: app.name,
      },
      range: {
        days: rangeDays,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      metrics: {
        activeSessions: {
          total: activeSessionsCount,
          windowSeconds: ACTIVE_SESSION_WINDOW_SECONDS,
          asOf: now.toISOString(),
          delta: null,
        },
        averageSubscription: {
          days: averageSubscriptionDays,
          previousDays: previousAverageSubscriptionDays,
          sampleSize: subscriptionSampleSize,
          previousSampleSize: previousSubscriptionSampleSize,
          delta: averageSubscriptionDelta,
        },
        trialCancellation: {
          rate: trialCancellationRate,
          previousRate: previousTrialCancellationRate,
          totalTrials: totalCurrentTrials,
          cancelledTrials: cancelledCurrentTrials,
          previousTotalTrials: totalPreviousTrials,
          previousCancelledTrials: cancelledPreviousTrials,
          delta: computeDelta(trialCancellationRate, previousTrialCancellationRate),
        },
        revenue: {
          total: totalRevenue,
          trial: Number.parseFloat(totalTrialRevenue.toFixed(2)),
          currency: "USD",
          count: paidPurchasesCount,
          trialCount: trialPurchasesCount,
          previous: previousRevenue,
          previousTrial: Number.parseFloat(previousTrialRevenue.toFixed(2)),
          previousCount: previousPaidPurchasesCount,
          previousTrialCount: previousTrialPurchasesCount,
          delta: computeDelta(totalRevenue, previousRevenue),
        },
        newUsers: {
          total: newUsersCount,
          previous: previousNewUsers,
          delta: computeDelta(newUsersCount, previousNewUsers),
        },
        session: {
          averageDurationSeconds: averageSessionDurationSeconds,
          sampleSize: sessionDurations.length,
        },
        revenuePerUser,
        revenuePerUserPrevious: previousRevenuePerUser,
        revenuePerUserDelta: computeDelta(revenuePerUser, previousRevenuePerUser),
        conversionRate,
        conversionRatePrevious: previousConversionRate,
        conversionRateDelta: computeDelta(conversionRate, previousConversionRate),
      },
      chart,
      activeUsers: {
        windowDays: activeWindowDays,
        series: activeUsersSeries,
      },
      purchasesByProduct,
      geography: {
        totalSessions: totalCountrySessions,
        countries: geoCountries,
      },
      options: {
        allowedRanges: ALLOWED_RANGES,
        activeWindows: ALLOWED_ACTIVE_WINDOWS,
      },
    });
  } catch (error) {
    console.error("Unexpected analytics error:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching analytics." },
      { status: 500 }
    );
  }
}
