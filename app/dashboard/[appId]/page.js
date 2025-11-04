"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useParams, useRouter } from "next/navigation";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const DEFAULT_RANGE_LABELS = {
  7: "Last 7 days",
  14: "Last 14 days",
  30: "Last 30 days",
  90: "Last 90 days",
  180: "Last 180 days",
};

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const preciseCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const formatDateLabel = (isoDate) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  }).format(new Date(isoDate));

const formatDurationFromDays = (days) => {
  if (days === null || days === undefined) return "—";
  if (days >= 1) {
    const rounded = Number.parseFloat(days.toFixed(1));
    return `${rounded} day${rounded === 1 ? "" : "s"}`;
  }
  const hours = days * 24;
  if (hours >= 1) {
    const rounded = Number.parseFloat(hours.toFixed(1));
    return `${rounded} hr${Math.abs(rounded - 1) < 0.01 ? "" : "s"}`;
  }
  const minutes = hours * 60;
  if (minutes >= 1) {
    const rounded = Math.round(minutes);
    return `${rounded} min`;
  }
  const seconds = minutes * 60;
  const roundedSeconds = Math.max(1, Math.round(seconds));
  return `${roundedSeconds} sec`;
};

const PaidBarShape = (props) => {
  const { payload } = props;
  const hasTrial = (payload?.trialRevenue ?? 0) > 0;
  const radius = hasTrial ? [12, 12, 0, 0] : [12, 12, 12, 12];
  return <Rectangle {...props} radius={radius} />;
};

const TrialBarShape = (props) => {
  const { payload } = props;
  const hasPaid = (payload?.paidRevenue ?? 0) > 0;
  const radius = hasPaid ? [0, 0, 12, 12] : [12, 12, 12, 12];
  return <Rectangle {...props} radius={radius} />;
};

const trendIcon = (delta) => {
  if (delta === null || delta === undefined) return "neutral";
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
};

const RangeSelector = ({ value, options, onChange }) => {
  if (!options?.length) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200/40 p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-sm transition md:px-4 ${
              isActive
                ? "bg-base-100 text-base-content shadow font-semibold"
                : "text-base-content/70 hover:text-base-content"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

const MetricCard = ({
  label,
  hint,
  value,
  secondary,
  delta,
  accent,
  live = false,
}) => {
  const iconState = trendIcon(delta);
  const deltaColor =
    iconState === "up"
      ? "text-success"
      : iconState === "down"
      ? "text-error"
      : "text-base-content/50";
  const accentColor = accent || "#38bdf8";

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/40 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-base-content/50">
          {label}
        </div>
        {live ? (
          <span className="relative inline-flex h-3 w-3 items-center justify-center">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </span>
        ) : (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold leading-none">{value}</span>
        {secondary ? (
          <span className="text-sm text-base-content/60">{secondary}</span>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-base-content/60">{hint}</div>
      <div
        className={`mt-3 flex items-center gap-1 text-xs font-medium ${deltaColor}`}
      >
        {iconState === "up" ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M8 3l5 5H9v5H7V8H3l5-5z" fill="currentColor" />
          </svg>
        ) : iconState === "down" ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M8 13l-5-5h4V3h2v5h4l-5 5z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" fill="currentColor" />
          </svg>
        )}
        <span>
          {delta === null || delta === undefined
            ? "No change"
            : `${delta > 0 ? "+" : ""}${percentFormatter.format(delta)}%`}
        </span>
      </div>
    </div>
  );
};

const CombinedChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data?.length) return [];
    return data.map((item) => {
      const trial = item.trialRevenue ?? 0;
      const paid = item.revenue ?? 0;
      return {
        ...item,
        label: formatDateLabel(item.date),
        paidRevenue: paid,
        trialRevenue: trial,
        revenueTotal: paid + trial,
      };
    });
  }, [data]);

  const CustomTooltip = ({ label, payload, active }) => {
    if (!active || !payload?.length) return null;
    const displayLabel = label ?? "";
    const entries = payload.map((entry) => ({
      ...entry,
      value:
        entry.dataKey === "paidRevenue" || entry.dataKey === "trialRevenue"
          ? preciseCurrencyFormatter.format(entry.value || 0)
          : numberFormatter.format(entry.value || 0),
      name:
        entry.dataKey === "paidRevenue"
          ? "Revenue"
          : entry.dataKey === "trialRevenue"
          ? "Trial revenue"
          : "Visitors",
    }));

    return (
      <ChartTooltipContent
        label={displayLabel}
        payload={entries}
        indicator="dot"
      />
    );
  };

  if (!chartData.length) {
    return (
      <div className="flex h-64 items-center justify-center text-base-content/60">
        No data for the selected range.
      </div>
    );
  }

  return (
    <ChartContainer
      className="mt-8 h-[360px] w-full border-base-300/60 bg-base-200/10 p-0"
      config={{
        revenue: "#fb7185",
        trial: "#fbcfe8",
        users: "#38bdf8",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 30, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid
            stroke="rgba(226,232,240,0.12)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            stroke="rgba(148,163,184,0.6)"
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            stroke="rgba(148,163,184,0.6)"
          />
          <YAxis
            yAxisId="right"
            axisLine={false}
            tickLine={false}
            orientation="right"
            tickMargin={8}
            stroke="rgba(148,163,184,0.4)"
          />
          <ChartTooltip
            cursor={{ stroke: "rgba(148,163,184,0.2)", strokeWidth: 1 }}
            content={<CustomTooltip />}
          />
          <Bar
            dataKey="trialRevenue"
            stackId="revenue"
            yAxisId="right"
            fill="var(--chart-trial)"
            maxBarSize={48}
            name="Trial revenue"
            shape={<TrialBarShape />}
          />
          <Bar
            dataKey="paidRevenue"
            stackId="revenue"
            yAxisId="right"
            fill="var(--chart-revenue)"
            maxBarSize={48}
            name="Revenue"
            shape={<PaidBarShape />}
          />
          <Line
            type="monotone"
            dataKey="newUsers"
            yAxisId="left"
            stroke="var(--chart-users)"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, stroke: "#0f172a", fill: "var(--chart-users)" }}
            activeDot={{ r: 6 }}
            name="Visitors"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default function AppAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params?.appId;

  const [range, setRange] = useState(7);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!appId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/apps/${encodeURIComponent(appId)}/analytics?range=${range}`
      );
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        throw new Error(problem?.error || "Failed to fetch analytics.");
      }
      const payload = await response.json();
      setAnalytics(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [appId, range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const rangeOptions = useMemo(() => {
    const allowed = analytics?.options?.allowedRanges || [7, 14, 30, 90];
    return allowed.map((value) => ({
      value,
      label: DEFAULT_RANGE_LABELS[value] || `Last ${value} days`,
    }));
  }, [analytics]);

  const handleRangeChange = (nextRange) => {
    if (nextRange === range) return;
    setRange(nextRange);
  };

  const metrics = useMemo(() => {
    if (!analytics) return { primary: [], secondary: [] };

    const { metrics: raw } = analytics;
    const paidOrdersLabel = raw.revenue.count
      ? `${raw.revenue.count} paid`
      : null;
    const trialOrdersLabel = raw.revenue.trialCount
      ? `${raw.revenue.trialCount} trial`
      : null;
    const revenueOrdersText =
      [paidOrdersLabel, trialOrdersLabel].filter(Boolean).join(" • ") ||
      undefined;
    const revenueHint =
      raw.revenue.trial > 0
        ? `Paid revenue (trial ${preciseCurrencyFormatter.format(
            raw.revenue.trial
          )})`
        : "Paid revenue (no trials this range)";
    const activeSessions = raw.activeSessions ?? {};
    const activeSessionsHint = activeSessions.windowSeconds
      ? `Heartbeat within last ${activeSessions.windowSeconds} sec`
      : "Sessions reporting recently";
    const averageSubscription = raw.averageSubscription ?? {};
    const averageSubscriptionValue = formatDurationFromDays(
      averageSubscription.days
    );
    const averageSubscriptionHint =
      averageSubscription.sampleSize > 0
        ? "Average between purchase and expiration"
        : "No subscription durations recorded this range";
    const trialCancellation = raw.trialCancellation ?? {};
    const trialCancellationHint =
      trialCancellation.totalTrials > 0
        ? "Trials started this range without a paid conversion yet"
        : "No trials started in this range";
    const trialCancellationSecondary =
      trialCancellation.totalTrials > 0
        ? `${trialCancellation.cancelledTrials}/${trialCancellation.totalTrials} trials`
        : undefined;

    const primaryMetrics = [
      {
        label: "Active sessions",
        value: numberFormatter.format(activeSessions.total ?? 0),
        secondary: undefined,
        hint: activeSessionsHint,
        delta: activeSessions.delta ?? null,
        accent: "#22c55e",
        live: true,
      },
      {
        label: "Revenue",
        value: currencyFormatter.format(raw.revenue.total),
        secondary: revenueOrdersText,
        hint: revenueHint,
        delta: raw.revenue.delta,
        accent: "#fb7185",
      },
      {
        label: "Conversion rate",
        value: `${percentFormatter.format(raw.conversionRate)}%`,
        secondary: undefined,
        hint: "Paid purchases / visitors",
        delta: raw.conversionRateDelta,
        accent: "#fbbf24",
      },
      {
        label: "Revenue / visitor",
        value: preciseCurrencyFormatter.format(raw.revenuePerUser || 0),
        secondary: undefined,
        hint: "Paid revenue per visitor",
        delta: raw.revenuePerUserDelta,
        accent: "#c084fc",
      },
    ];
    const secondaryMetrics = [
      {
        label: "Avg subscription",
        value: averageSubscriptionValue,
        secondary:
          averageSubscription.sampleSize > 0
            ? `${averageSubscription.sampleSize} subscriptions`
            : undefined,
        hint: averageSubscriptionHint,
        delta: averageSubscription.delta,
        accent: "#14b8a6",
      },
      {
        label: "Trial cancellation",
        value: `${percentFormatter.format(trialCancellation.rate ?? 0)}%`,
        secondary: trialCancellationSecondary,
        hint: trialCancellationHint,
        delta: trialCancellation.delta,
        accent: "#f97316",
      },
    ];

    return { primary: primaryMetrics, secondary: secondaryMetrics };
  }, [analytics]);

  const activeRangeLabel =
    rangeOptions.find((option) => option.value === range)?.label ||
    DEFAULT_RANGE_LABELS[range] ||
    `Last ${range} days`;

  return (
    <main className="min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-sm text-base-content/60 hover:text-base-content transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to apps
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-200/60 px-4 py-1.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M16 18l2 2 4-4" />
                <rect x="2" y="2" width="20" height="14" rx="2" />
                <path d="M12 13h4" />
                <path d="M12 9h8" />
              </svg>
              <span className="text-sm font-semibold">
                {analytics?.app?.name || appId}
              </span>
            </div>

            <div className="rounded-full border border-base-300 bg-base-200/60 px-4 py-1.5 text-sm text-base-content/70">
              {activeRangeLabel}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RangeSelector
              value={range}
              options={rangeOptions}
              onChange={handleRangeChange}
            />
            <div className="rounded-full border border-base-300 bg-base-200/40 px-4 py-1.5 text-sm text-base-content/70">
              Daily
            </div>
            <button
              type="button"
              onClick={fetchAnalytics}
              className="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-4 py-1.5 text-sm font-medium text-base-content hover:border-primary hover:text-primary transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-200/30 p-6 shadow-lg backdrop-blur-sm">
          {isLoading ? (
            <div className="flex h-96 flex-col items-center justify-center gap-4 text-base-content/60">
              <span className="loading loading-spinner loading-lg" />
              <span>Loading analytics…</span>
            </div>
          ) : error ? (
            <div className="flex h-80 flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-error/10 p-4 text-error">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <circle cx="12" cy="16" r="1" />
                </svg>
              </div>
              <div className="text-lg font-semibold">Something went wrong</div>
              <p className="max-w-md text-sm text-base-content/60">{error}</p>
              <button
                type="button"
                onClick={fetchAnalytics}
                className="btn btn-primary btn-sm"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.primary.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-base-content/70">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span>Visitors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded"
                      style={{ backgroundColor: "#fbcfe8" }}
                    />
                    <span>Trial revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded"
                      style={{ backgroundColor: "#fb7185" }}
                    />
                    <span>Revenue</span>
                  </div>
                </div>
                <div className="text-sm text-base-content/50">
                  {analytics?.range?.start
                    ? `${formatDateLabel(analytics.range.start)} → ${formatDateLabel(
                        analytics.range.end
                      )}`
                    : null}
                </div>
              </div>

              <CombinedChart data={analytics?.chart || []} />

              {metrics.secondary.length ? (
                <section className="mt-10 space-y-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-base-content">
                        Retention metrics
                      </h2>
                      <p className="text-sm text-base-content/60">
                        Understand how trials convert and how long subscriptions stay active.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {metrics.secondary.map((metric) => (
                      <MetricCard key={metric.label} {...metric} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
