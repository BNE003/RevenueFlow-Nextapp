"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const DEFAULT_WINDOW_SECONDS = 600; // 10 minutes
const MIN_WINDOW_SECONDS = 30;
const MAX_WINDOW_SECONDS = 3600; // 1 hour
const MAX_SESSIONS = 500;

const parseWindowSeconds = (value) => {
  if (!value) return DEFAULT_WINDOW_SECONDS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW_SECONDS;
  return Math.min(
    Math.max(parsed, MIN_WINDOW_SECONDS),
    MAX_WINDOW_SECONDS
  );
};

const isFiniteCoordinate = (input) => {
  const parsed = Number.parseFloat(input);
  return Number.isFinite(parsed) ? parsed : null;
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
        { error: "You must be logged in to view sessions." },
        { status: 401 }
      );
    }

    const appId = params?.appId;
    if (!appId) {
      return NextResponse.json(
        { error: "App id is required." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const windowSeconds = parseWindowSeconds(
      url.searchParams.get("windowSeconds")
    );
    const windowMs = windowSeconds * 1000;
    const sinceIso = new Date(Date.now() - windowMs).toISOString();

    const {
      data: sessionRows,
      error: sessionsError,
    } = await supabase
      .from("active_sessions")
      .select(
        "id, device_id, session_started_at, last_heartbeat, country_code, region, city, latitude, longitude"
      )
      .eq("app_id", appId)
      .gte("last_heartbeat", sinceIso)
      .order("last_heartbeat", { ascending: false })
      .limit(MAX_SESSIONS);

    if (sessionsError) {
      console.error("Failed to fetch active sessions:", sessionsError);
      return NextResponse.json(
        { error: "Failed to load active sessions." },
        { status: 500 }
      );
    }

    const rows = sessionRows ?? [];
    const deviceIds = Array.from(
      new Set(rows.map((row) => row.device_id).filter(Boolean))
    );

    let deviceInfoMap = new Map();
    if (deviceIds.length) {
      const {
        data: devices,
        error: devicesError,
      } = await supabase
        .from("devices")
        .select("id, device_id, name")
        .eq("app_id", appId)
        .in("id", deviceIds);

      if (devicesError) {
        console.error("Failed to fetch session devices:", devicesError);
      } else {
        deviceInfoMap = new Map(
          (devices ?? [])
            .filter((device) => device.id)
            .map((device) => [
              device.id,
              {
                name: device.name || null,
                deviceId: device.device_id || null,
              },
            ])
        );
      }
    }

    const sessions = rows
      .map((row) => {
        const latitude = isFiniteCoordinate(row.latitude);
        const longitude = isFiniteCoordinate(row.longitude);

        if (latitude === null || longitude === null) {
          return null;
        }

        const deviceInfo = deviceInfoMap.get(row.device_id);
        const fallbackName =
          deviceInfo?.name ||
          row.device_name ||
          deviceInfo?.deviceId ||
          (row.device_id ? `Device ${String(row.device_id).slice(-6)}` : null);

        return {
          id: row.id,
          deviceId: row.device_id,
          deviceName: fallbackName || "Unknown device",
          latitude,
          longitude,
          countryCode: row.country_code || null,
          region: row.region || null,
          city: row.city || null,
          lastHeartbeat: row.last_heartbeat,
          sessionStartedAt: row.session_started_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      sessions,
      windowSeconds,
      total: sessions.length,
    });
  } catch (error) {
    console.error("Unexpected error while fetching sessions:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching sessions." },
      { status: 500 }
    );
  }
}
