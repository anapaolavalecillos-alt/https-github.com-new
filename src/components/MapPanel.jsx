import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SECTION_COLORS = {
  hotel: "#111827",
  Morning: "#2563eb",
  Afternoon: "#7c3aed",
  Evening: "#f59e0b",
  overview: "#0f766e",
};

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const LOCATION_POINTS = {
  tokyo: [35.6895, 139.6917],
  shinjuku: [35.6938, 139.7034],
  shibuya: [35.658, 139.7016],
  harajuku: [35.6702, 139.7027],
  meiji: [35.6764, 139.6993],
  ginza: [35.6717, 139.765],
  toyosu: [35.6544, 139.7956],
  tsukiji: [35.6655, 139.7708],
  omotesando: [35.6655, 139.7121],
  kyoto: [35.0116, 135.7681],
  arashiyama: [35.0094, 135.6664],
  gion: [35.0037, 135.7818],
  higashiyama: [34.9949, 135.785],
  fushimi: [34.9671, 135.7727],
  shijo: [35.0038, 135.7603],
  nishiki: [35.0048, 135.7648],
  osaka: [34.6937, 135.5023],
  namba: [34.665, 135.503],
  dotonbori: [34.6687, 135.5013],
  setagaya: [35.646, 139.653],
  shimokitazawa: [35.6618, 139.6685],
  mitaka: [35.683, 139.5602],
  kichijoji: [35.7035, 139.5794],
  airport: [35.5494, 139.7798],
  haneda: [35.5494, 139.7798],
  narita: [35.7719, 140.3929],
};

function pointFromFields(lat, lon) {
  const latNum = typeof lat === "string" ? Number(lat) : lat;
  const lonNum = typeof lon === "string" ? Number(lon) : lon;

  return Number.isFinite(latNum) && Number.isFinite(lonNum)
    ? [latNum, lonNum]
    : null;
}

function matchPoint(text) {
  const lower = String(text || "").toLowerCase();

  for (const [key, value] of Object.entries(LOCATION_POINTS)) {
    if (lower.includes(key)) return value;
  }

  return null;
}

function dayCenter(day) {
  if (!day) return LOCATION_POINTS.tokyo;

  const hotelPoint = pointFromFields(
    day.hotelMapPointLat,
    day.hotelMapPointLon
  );

  if (hotelPoint) return hotelPoint;

  const candidates = [
    `${day.area} ${day.city}`,
    day.area,
    day.city,
    day.hotel,
    ...(day.activities || []).map(
      (a) => `${a.name} ${a.neighborhood}`
    ),
  ];

  for (const candidate of candidates) {
    const point = matchPoint(candidate);
    if (point) return point;
  }

  return LOCATION_POINTS.tokyo;
}

function activityPoint(activity, day, index) {
  const manual = pointFromFields(
    activity?.mapPointLat,
    activity?.mapPointLon
  );

  if (manual) return manual;

  const candidates = [
    `${activity.name} ${activity.neighborhood}`,
    activity.name,
    activity.neighborhood,
    `${day.area} ${day.city}`,
    day.area,
    day.city,
  ];

  let point = null;

  for (const candidate of candidates) {
    const matched = matchPoint(candidate);
    if (matched) {
      point = matched;
      break;
    }
  }

  if (!point) point = dayCenter(day);

  const sectionAngleOffset = {
    Morning: 0.25,
    Afternoon: 2.25,
    Evening: 4.15,
  };

  const angleBase = sectionAngleOffset[activity.section] ?? 0;
  const ring = Math.floor(index / 3) + 1;
  const angle = angleBase + index * 1.35;
  const spread = 0.0028 * ring;

  return [
    point[0] + Math.sin(angle) * spread,
    point[1] + Math.cos(angle) * spread,
  ];
}

function createPinIcon(
  label,
  color,
  active = false,
  textColor = "#111827"
) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: ${active ? 42 : 34}px;
        height: ${active ? 42 : 34}px;
        border-radius: 999px;
        background: ${color};
        border: 3px solid white;
        display: grid;
        place-items: center;
        color: ${textColor};
        font-weight: 800;
        font-size: 12px;
      ">
        ${label}
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

export default function MapPanel({
  days,
  selectedDay,
  overview = false,
  height = 360,
}) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  const selectedCenter = selectedDay
    ? dayCenter(selectedDay)
    : LOCATION_POINTS.tokyo;

  const fallbackZoom = overview ? 5 : 12;

  const entries = useMemo(() => {
    if (!selectedDay) return [];

    const hotelPoint =
      pointFromFields(
        selectedDay.hotelMapPointLat,
        selectedDay.hotelMapPointLon
      ) || selectedCenter;

    const hotel = {
      id: `hotel-${selectedDay.day}`,
      label: "H",
      title: selectedDay.hotel || "Hotel",
      point: hotelPoint,
      color: SECTION_COLORS.hotel,
      active: true,
      textColor: "#ffffff",
    };

    const activities = (selectedDay.activities || []).map(
      (activity, index) => ({
        id: activity.id || `activity-${index}`,
        label: String(index + 1),
        title: activity.name,
        point: activityPoint(activity, selectedDay, index),
        color:
          SECTION_COLORS[activity.section] || "#2563eb",
        active: false,
        textColor: "#111827",
      })
    );

    return [hotel, ...activities];
  }, [selectedDay, selectedCenter]);

  const route = useMemo(() => {
    return entries.map((entry) => entry.point);
  }, [entries]);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current).setView(
      selectedCenter,
      fallbackZoom
    );

    L.tileLayer(TILE_URL, {
      attribution:
        "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;

    if (!map || !markersLayer || !routeLayer) return;

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    if (route.length > 1) {
      L.polyline(route, {
        color: "#7c3aed",
        weight: 4,
        opacity: 0.45,
      }).addTo(routeLayer);
    }

    const boundsPoints = [];

    entries.forEach((entry) => {
      const marker = L.marker(entry.point, {
        icon: createPinIcon(
          entry.label,
          entry.color,
          entry.active,
          entry.textColor
        ),
      }).addTo(markersLayer);

      marker.bindTooltip(entry.title);

      boundsPoints.push(entry.point);
    });

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], fallbackZoom);
    } else if (boundsPoints.length > 1) {
      map.fitBounds(
        L.latLngBounds(boundsPoints).pad(0.2)
      );
    }
  }, [entries, route, fallbackZoom]);

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid #dbeafe",
        background: "white",
      }}
    >
      <div
        ref={mapElRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}