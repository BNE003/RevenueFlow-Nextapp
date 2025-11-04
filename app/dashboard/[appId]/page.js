"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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

const MetricCard = ({ label, hint, value, secondary, delta, accent }) => {
  const iconState = trendIcon(delta);
  const deltaColor =
    iconState === "up"
      ? "text-success"
      : iconState === "down"
      ? "text-error"
      : "text-base-content/50";

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/40 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-base-content/50">
          {label}
        </div>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
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
    return data.map((item) => ({
      ...item,
      label: formatDateLabel(item.date),
    }));
  }, [data]);

  const CustomTooltip = ({ label, payload, active }) => {
    if (!active || !payload?.length) return null;
    const displayLabel = label ?? "";
    const entries = payload.map((entry) => ({
      ...entry,
      value:
        entry.dataKey === "revenue"
          ? preciseCurrencyFormatter.format(entry.value || 0)
          : numberFormatter.format(entry.value || 0),
      name: entry.dataKey === "revenue" ? "Revenue" : "Visitors",
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
            dataKey="revenue"
            yAxisId="right"
            fill="var(--chart-revenue)"
            radius={[12, 12, 12, 12]}
            maxBarSize={48}
            name="Revenue"
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
    if (!analytics) return [];

    const { metrics: raw } = analytics;
    return [
      {
        label: "Visitors",
        value: numberFormatter.format(raw.newUsers.total),
        secondary: "",
        hint: "Unique devices in range",
        delta: raw.newUsers.delta,
        accent: "#38bdf8",
      },
      {
        label: "Revenue",
        value: currencyFormatter.format(raw.revenue.total),
        secondary: raw.revenue.count
          ? `${raw.revenue.count} orders`
          : undefined,
        hint: "Total revenue in range",
        delta: raw.revenue.delta,
        accent: "#fb7185",
      },
      {
        label: "Conversion rate",
        value: `${percentFormatter.format(raw.conversionRate)}%`,
        secondary: undefined,
        hint: "Purchases / visitors",
        delta: raw.conversionRateDelta,
        accent: "#fbbf24",
      },
      {
        label: "Revenue / visitor",
        value: preciseCurrencyFormatter.format(raw.revenuePerUser || 0),
        secondary: undefined,
        hint: "Average revenue per user",
        delta: raw.revenuePerUserDelta,
        accent: "#c084fc",
      },
    ];
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
                {metrics.map((metric) => (
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
                    <span className="h-2 w-2 rounded bg-rose-400" />
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
