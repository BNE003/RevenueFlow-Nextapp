import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const ALLOWED_RANGES = [7, 14, 30, 90, 180];
const DAY_MS = 24 * 60 * 60 * 1000;

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

const aggregatePeriod = (purchases = [], devices = [], bucketDates = null) => {
  const revenueByDay = bucketDates
    ? Object.fromEntries(bucketDates.map((d) => [d, 0]))
    : null;
  const usersByDay = bucketDates
    ? Object.fromEntries(bucketDates.map((d) => [d, 0]))
    : null;

  let totalRevenue = 0;
  const uniqueDevices = new Set();

  purchases.forEach((purchase) => {
    const price = Number.parseFloat(purchase.price ?? 0);
    if (!Number.isFinite(price)) return;
    totalRevenue += price;

    const key = bucketDates ? formatDateKey(purchase.created_at) : null;
    if (key && revenueByDay && key in revenueByDay) {
      revenueByDay[key] += price;
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
    purchasesCount: purchases.length,
    newUsersCount: uniqueDevices.size,
    revenueByDay,
    usersByDay,
  };
};

const computeDelta = (current, previous) => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Number.parseFloat(
    (((current - previous) / previous) * 100).toFixed(2)
  );
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

    const [
      purchasesResult,
      devicesResult,
      previousPurchasesResult,
      previousDevicesResult,
    ] = await Promise.all([
      supabase
        .from("purchases")
        .select("price, created_at")
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
        .select("price, created_at")
        .eq("app_id", appId)
        .gte("created_at", previousStartIso)
        .lte("created_at", previousEndIso),
      supabase
        .from("devices")
        .select("device_id, created_at")
        .eq("app_id", appId)
        .gte("created_at", previousStartIso)
        .lte("created_at", previousEndIso),
    ]);

    const purchasesError = purchasesResult.error;
    const devicesError = devicesResult.error;
    const previousPurchasesError = previousPurchasesResult.error;
    const previousDevicesError = previousDevicesResult.error;

    if (purchasesError || devicesError || previousPurchasesError || previousDevicesError) {
      console.error("Error fetching analytics data:", {
        purchasesError,
        devicesError,
        previousPurchasesError,
        previousDevicesError,
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

    const dateBuckets = buildBuckets(startDate, endDate);
    const {
      totalRevenue,
      purchasesCount,
      newUsersCount,
      revenueByDay,
      usersByDay,
    } = aggregatePeriod(purchases, devices, dateBuckets);

    const {
      totalRevenue: previousRevenue,
      purchasesCount: previousPurchasesCount,
      newUsersCount: previousNewUsers,
    } = aggregatePeriod(previousPurchases, previousDevices);

    const chart = dateBuckets.map((bucket) => ({
      date: bucket,
      revenue: Number.parseFloat(revenueByDay[bucket]?.toFixed(2) ?? 0),
      newUsers: usersByDay[bucket] ?? 0,
    }));

    const revenuePerUser =
      newUsersCount > 0 ? Number.parseFloat((totalRevenue / newUsersCount).toFixed(2)) : 0;
    const previousRevenuePerUser =
      previousNewUsers > 0
        ? Number.parseFloat((previousRevenue / previousNewUsers).toFixed(2))
        : 0;
    const conversionRate =
      newUsersCount > 0
        ? Number.parseFloat(((purchasesCount / newUsersCount) * 100).toFixed(2))
        : 0;
    const previousConversionRate =
      previousNewUsers > 0
        ? Number.parseFloat(
            ((previousPurchasesCount / previousNewUsers) * 100).toFixed(2)
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
        revenue: {
          total: totalRevenue,
          currency: "USD",
          count: purchasesCount,
          previous: previousRevenue,
          delta: computeDelta(totalRevenue, previousRevenue),
        },
        newUsers: {
          total: newUsersCount,
          previous: previousNewUsers,
          delta: computeDelta(newUsersCount, previousNewUsers),
        },
        revenuePerUser,
        revenuePerUserPrevious: previousRevenuePerUser,
        revenuePerUserDelta: computeDelta(revenuePerUser, previousRevenuePerUser),
        conversionRate,
        conversionRatePrevious: previousConversionRate,
        conversionRateDelta: computeDelta(conversionRate, previousConversionRate),
      },
      chart,
      options: {
        allowedRanges: ALLOWED_RANGES,
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
