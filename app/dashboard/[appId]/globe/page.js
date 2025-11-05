"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MapboxGlobe from "@/components/MapboxGlobe";

const WINDOW_OPTIONS = [
  { value: 300, label: "Last 5 minutes" },
  { value: 600, label: "Last 10 minutes" },
  { value: 900, label: "Last 15 minutes" },
  { value: 1800, label: "Last 30 minutes" },
];

const formatTimeAgo = (isoDate) => {
  if (!isoDate) return "Unknown";
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatTimestamp = (isoDate) => {
  if (!isoDate) return "Unknown";
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    month: "short",
    day: "numeric",
  });
};

const buildLocationLabel = ({ city, region, countryCode }) => {
  return [city, region, countryCode].filter(Boolean).join(", ") || "Unknown";
};

const getWindowLabel = (seconds) => {
  const option = WINDOW_OPTIONS.find((entry) => entry.value === seconds);
  return option?.label ?? `Last ${Math.round(seconds / 60)} minutes`;
};

export default function GlobePage() {
  const router = useRouter();
  const params = useParams();
  const appId = params?.appId ? String(params.appId) : null;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowSeconds, setWindowSeconds] = useState(WINDOW_OPTIONS[1].value);
  const hasLoadedOnceRef = useRef(false);

  const totalSessions = sessions.length;

  const fetchSessions = useCallback(async () => {
    if (!appId) return;
    setIsLoading((previous) => previous || !hasLoadedOnceRef.current);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `/api/apps/${encodeURIComponent(
          appId
        )}/sessions?windowSeconds=${windowSeconds}`,
        {
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        throw new Error(problem?.error || "Failed to load sessions.");
      }
      const payload = await response.json();
      setSessions(payload.sessions || []);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load sessions.");
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [appId, windowSeconds, hasLoadedOnceRef]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleWindowChange = (event) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(value)) return;
    setWindowSeconds(value);
  };

  const handleRefresh = () => {
    fetchSessions();
  };

  const windowLabel = useMemo(
    () => getWindowLabel(windowSeconds),
    [windowSeconds]
  );

  return (
    <main className="min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${appId}`)}
              className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200/50 px-3 py-1.5 text-sm text-base-content/70 transition hover:text-base-content"
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
              Back to analytics
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-200/60 px-4 py-1.5 text-sm font-semibold text-base-content">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12a10 10 0 0 1 18-6" />
                <path d="M6 12a6 6 0 0 1 11.8-2" />
                <path d="M10 12a2 2 0 0 1 3.7-.7" />
              </svg>
              Live sessions globe
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={windowSeconds}
                onChange={handleWindowChange}
                className="block appearance-none rounded-full border border-base-300 bg-base-100 px-4 pr-10 py-1.5 text-sm font-medium text-base-content shadow-sm focus:border-primary focus:outline-none focus:ring-0"
              >
                {WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-4 py-1.5 text-sm font-medium text-base-content transition hover:border-primary hover:text-primary"
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-base-300 bg-base-200/30 p-6 shadow-lg backdrop-blur-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-base-content">
                  Live globe view
                </h2>
                <p className="text-sm text-base-content/60">
                  Showing active sessions observed in {windowLabel.toLowerCase()}.
                </p>
              </div>
              <div className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs font-medium text-base-content/70">
                {`${totalSessions} active session${
                  totalSessions === 1 ? "" : "s"
                }`}
              </div>
            </div>
            <div className="h-[520px] w-full overflow-hidden rounded-2xl md:h-[620px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center gap-3 text-base-content/70">
                  <span className="loading loading-spinner loading-md" />
                  Loading globe…
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="rounded-full bg-error/10 p-3 text-error">
                    <svg
                      width="28"
                      height="28"
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
                  <p className="text-sm text-base-content/70">{error}</p>
                </div>
              ) : totalSessions ? (
                <MapboxGlobe sessions={sessions} accessToken={mapboxToken} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-base-content/60">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h4" />
                    <path d="M18 12h4" />
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <path d="M12 12 4.93 7.07" />
                    <path d="m12 12 7.07-4.93" />
                    <path d="m12 12 7.07 4.93" />
                    <path d="m12 12-7.07 4.93" />
                  </svg>
                  <div className="text-sm font-medium">No active sessions</div>
                  <p className="text-xs text-base-content/50">
                    We didn&apos;t detect any sessions within {windowLabel.toLowerCase()}.
                  </p>
                </div>
              )}
            </div>
          </div>
          <aside className="rounded-3xl border border-base-300 bg-base-200/30 p-6 shadow-lg backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-base-content">
                Session activity
              </h2>
              <span className="rounded-full border border-base-300 bg-base-100 px-3 py-0.5 text-xs text-base-content/60">
                Updates every 30 sec
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: "580px" }}>
              {isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-base-300/60 bg-base-100/70 px-4 py-3 text-sm text-base-content/70">
                  <span className="loading loading-spinner loading-xs" />
                  Loading active sessions…
                </div>
              ) : totalSessions ? (
                sessions.map((session) => (
                  <div
                    key={session.id || `${session.deviceId}-${session.lastHeartbeat}`}
                    className="flex flex-col gap-2 rounded-2xl border border-base-300/60 bg-base-100/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-base-content">
                          {session.deviceName || "Unknown device"}
                        </div>
                        <div className="text-xs text-base-content/60">
                          {buildLocationLabel(session)}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Live
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 21a8 8 0 0 0 6.29-12.91" />
                          <path d="M5.51 5.51A8 8 0 0 0 11 21" />
                          <path d="m16 16-2-2 0 0" />
                          <path d="M12 12 4 4" />
                        </svg>
                        {formatTimeAgo(session.lastHeartbeat)} heartbeat
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 6v12" />
                          <path d="m8 14 4 4 4-4" />
                          <path d="M16 10 12 6 8 10" />
                        </svg>
                        Started {formatTimestamp(session.sessionStartedAt)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-base-300/80 bg-base-100/50 px-4 py-6 text-center text-sm text-base-content/60">
                  When users open your app, their sessions will appear here with live location.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
