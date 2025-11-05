"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const PLACEHOLDER_AVATAR = "/globe-user-placeholder.svg";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

const buildLocationLabel = ({ city, region, countryCode }) => {
  const parts = [city, region, countryCode]
    .map((part) => (part ? String(part).trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
};

const fitMapToSessions = (map, sessions) => {
  if (!map || !sessions?.length) return;

  if (sessions.length === 1) {
    const [session] = sessions;
    map.easeTo({
      center: [session.longitude, session.latitude],
      zoom: 3.5,
      pitch: 30,
      duration: 1500,
    });
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  sessions.forEach((session) => {
    bounds.extend([session.longitude, session.latitude]);
  });

  map.fitBounds(bounds, {
    padding: 100,
    duration: 1500,
    maxZoom: 4.5,
  });
};

const createMarkerElement = (session) => {
  const marker = document.createElement("div");
  marker.className = "globe-session-marker";
  marker.style.position = "relative";
  marker.style.width = "52px";
  marker.style.height = "52px";
  marker.style.borderRadius = "9999px";
  marker.style.background =
    "linear-gradient(135deg, rgba(56,189,248,0.92), rgba(99,102,241,0.92))";
  marker.style.boxShadow = "0 14px 28px rgba(15,23,42,0.4)";
  marker.style.border = "2px solid rgba(15,23,42,0.5)";
  marker.style.backdropFilter = "blur(4px)";
  marker.style.display = "flex";
  marker.style.alignItems = "center";
  marker.style.justifyContent = "center";
  marker.style.transition = "transform 150ms ease";
  marker.style.transformOrigin = "bottom center";
  marker.style.cursor = "pointer";

  const pulse = document.createElement("span");
  pulse.style.position = "absolute";
  pulse.style.width = "64px";
  pulse.style.height = "64px";
  pulse.style.borderRadius = "9999px";
  pulse.style.boxShadow = "0 0 0 0 rgba(56,189,248,0.3)";
  pulse.style.animation = "globe-marker-pulse 3s infinite";
  pulse.style.pointerEvents = "none";

  const imageWrapper = document.createElement("div");
  imageWrapper.style.width = "40px";
  imageWrapper.style.height = "40px";
  imageWrapper.style.borderRadius = "9999px";
  imageWrapper.style.overflow = "hidden";
  imageWrapper.style.border = "2px solid rgba(255,255,255,0.85)";
  imageWrapper.style.boxShadow = "0 4px 12px rgba(15,23,42,0.4)";
  imageWrapper.style.background = "rgba(15,23,42,0.35)";

  const image = document.createElement("img");
  image.src = PLACEHOLDER_AVATAR;
  image.alt = session.deviceName || "Active session";
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "cover";
  image.style.display = "block";
  image.draggable = false;
  imageWrapper.appendChild(image);

  const pointer = document.createElement("div");
  pointer.style.position = "absolute";
  pointer.style.left = "50%";
  pointer.style.bottom = "-12px";
  pointer.style.transform = "translateX(-50%)";
  pointer.style.width = "0";
  pointer.style.height = "0";
  pointer.style.borderLeft = "8px solid transparent";
  pointer.style.borderRight = "8px solid transparent";
  pointer.style.borderTop = "12px solid rgba(76,106,255,0.95)";
  pointer.style.filter = "drop-shadow(0 6px 12px rgba(15,23,42,0.45))";

  const label = document.createElement("span");
  label.textContent = session.deviceName || "Unknown device";
  label.style.position = "absolute";
  label.style.bottom = "-34px";
  label.style.left = "50%";
  label.style.transform = "translateX(-50%)";
  label.style.padding = "3px 8px";
  label.style.borderRadius = "9999px";
  label.style.background = "rgba(15,23,42,0.85)";
  label.style.border = "1px solid rgba(100,116,139,0.35)";
  label.style.color = "rgba(248,250,252,0.95)";
  label.style.fontSize = "10px";
  label.style.fontWeight = "600";
  label.style.whiteSpace = "nowrap";
  label.style.maxWidth = "160px";
  label.style.overflow = "hidden";
  label.style.textOverflow = "ellipsis";
  label.style.boxShadow = "0 6px 20px rgba(15,23,42,0.3)";
  label.style.pointerEvents = "none";

  marker.addEventListener("mouseenter", () => {
    marker.style.transform = "scale(1.06)";
  });
  marker.addEventListener("mouseleave", () => {
    marker.style.transform = "scale(1)";
  });

  marker.appendChild(pulse);
  marker.appendChild(imageWrapper);
  marker.appendChild(pointer);
  marker.appendChild(label);
  return marker;
};

export default function MapboxGlobe({ sessions, accessToken }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const hasToken = useMemo(
    () => typeof accessToken === "string" && accessToken.length > 0,
    [accessToken]
  );

  useEffect(() => {
    if (!hasToken) return;
    if (typeof window === "undefined") return;
    if (mapRef.current) return;
    if (!containerRef.current) return;

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 20],
      zoom: 1.4,
      projection: "globe",
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("style.load", () => {
      map.setFog({
        range: [0.8, 8],
        color: "rgba(11, 36, 64, 0.8)",
        "horizon-blend": 0.1,
      });
    });

    const handleResize = () => {
      map.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, hasToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!sessions?.length) return;

    sessions.forEach((session) => {
      if (
        !Number.isFinite(session.longitude) ||
        !Number.isFinite(session.latitude)
      ) {
        return;
      }

      const markerEl = createMarkerElement(session);
      const popupContent = `
        <div style="min-width:220px;padding:12px;border-radius:16px;background:rgba(15,23,42,0.92);border:1px solid rgba(148,163,184,0.25);box-shadow:0 12px 30px rgba(15,23,42,0.35);">
          <div style="font-weight:600;font-size:14px;color:#f8fafc;margin-bottom:4px;">
            ${escapeHtml(session.deviceName || "Unknown device")}
          </div>
          <div style="font-size:12px;color:rgba(226,232,240,0.9);margin-bottom:8px;">
            ${escapeHtml(buildLocationLabel(session))}
          </div>
          <div style="font-size:11px;color:rgba(148,163,184,0.9);display:flex;align-items:center;gap:6px;">
            <span style="display:inline-flex;width:8px;height:8px;border-radius:9999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,0.2);"></span>
            Active ${escapeHtml(formatTimeAgo(session.lastHeartbeat))}
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker({
        element: markerEl,
        anchor: "bottom",
        offset: [0, 0],
      })
        .setLngLat([session.longitude, session.latitude])
        .setPopup(
          new mapboxgl.Popup({
            offset: 16,
            closeButton: false,
            maxWidth: "260px",
          }).setHTML(popupContent)
        )
        .addTo(map);

      markersRef.current.push(marker);
    });

    fitMapToSessions(map, sessions);
  }, [sessions]);

  if (!hasToken) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-base-300 bg-base-200/50 text-sm text-base-content/70">
        Mapbox access token is missing. Set the `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: "rgba(15,23,42,0.85)" }}
    />
  );
}
