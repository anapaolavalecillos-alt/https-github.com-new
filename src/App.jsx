import { useEffect, useMemo, useState } from "react";
import { itinerary as seedItinerary } from "./data/itinerary";
import MapPanel from "./components/MapPanel";

const STORAGE_KEY = "japan-trip-planner-state-v8";

const SECTION_ORDER = ["Morning", "Afternoon", "Evening"];
const TYPE_OPTIONS = [
  "Transit",
  "Hotel",
  "Walk",
  "Food",
  "Dinner",
  "Attraction",
  "Shopping",
  "Cafe",
  "Sightseeing",
  "Culture",
  "Event",
  "Planned",
];

const fieldStyle = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  background: "white",
};

function makeId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDays(sourceDays) {
  return (sourceDays || []).map((day) => ({
    ...day,
    hotel: day.hotel || "",
    hotelMapPointQuery: day.hotelMapPointQuery || day.hotelMapPointLabel || "",
    hotelMapPointLabel: day.hotelMapPointLabel || "",
    hotelMapPointLat:
      typeof day.hotelMapPointLat === "number" ? day.hotelMapPointLat : undefined,
    hotelMapPointLon:
      typeof day.hotelMapPointLon === "number" ? day.hotelMapPointLon : undefined,
    activities: (day.activities || []).map((activity, index) => ({
      ...activity,
      id: activity.id || `${day.day}-${index}-${Math.random().toString(16).slice(2)}`,
      mapPointQuery: activity.mapPointQuery || activity.mapPointLabel || "",
      mapPointLabel: activity.mapPointLabel || "",
      mapPointLat:
        typeof activity.mapPointLat === "number" ? activity.mapPointLat : undefined,
      mapPointLon:
        typeof activity.mapPointLon === "number" ? activity.mapPointLon : undefined,
    })),
  }));
}

function loadInitialState() {
  const fallback = {
    days: normalizeDays(seedItinerary),
    mode: "overview",
    selectedDayId: seedItinerary[0]?.day || 1,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) return fallback;

    return {
      days: normalizeDays(parsed.days),
      mode: parsed.mode === "day" ? "day" : "overview",
      selectedDayId: Number(parsed.selectedDayId) || seedItinerary[0]?.day || 1,
    };
  } catch {
    return fallback;
  }
}

function getDayText(day) {
  return [
    day.title,
    day.city,
    day.area,
    day.hotel,
    day.date,
    ...day.activities.flatMap((a) => [a.name, a.type, a.neighborhood, a.notes]),
  ]
    .join(" ")
    .toLowerCase();
}

function StatRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        alignItems: "center",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "14px 16px",
      }}
    >
      <span style={{ opacity: 0.8 }}>{label}</span>
      <strong style={{ fontSize: "18px" }}>{value}</strong>
    </div>
  );
}

function DayCard({ day, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        borderRadius: "18px",
        padding: "16px",
        background: active
          ? "linear-gradient(135deg, #111827 0%, #374151 100%)"
          : "white",
        color: active ? "white" : "#111827",
        boxShadow: active
          ? "0 18px 30px rgba(17,24,39,0.22)"
          : "0 8px 20px rgba(15, 23, 42, 0.06)",
        border: active ? "1px solid transparent" : "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: day.color || "#dbeafe",
          color: "#111827",
          borderRadius: "999px",
          padding: "5px 10px",
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "10px",
        }}
      >
        Day {day.day}
      </div>
      <div style={{ fontWeight: 800, fontSize: "18px", marginBottom: "4px" }}>
        {day.date} · {day.city}
      </div>
      <div style={{ fontSize: "14px", opacity: 0.86 }}>{day.area}</div>
    </button>
  );
}

function PlaceAutocomplete({
  label,
  value,
  onQueryChange,
  onPick,
  placeholder,
  helperText,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!open) return;

    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=jp&accept-language=en&q=${encodeURIComponent(
          q
        )}`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Accept-Language": "en",
          },
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();
        if (controller.signal.aborted) return;

        setSuggestions(
          data.map((item) => ({
            label: item.display_name,
            address: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
            type: item.type || "place",
          }))
        );
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontWeight: 700, marginBottom: "8px" }}>{label}</div>
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            const first = suggestions[0];
            onQueryChange(first.label);
            onPick(first);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        style={{ ...fieldStyle, width: "100%" }}
      />
      {helperText ? (
        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
          {helperText}
        </div>
      ) : null}

      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 8px)",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
            zIndex: 30,
            overflow: "hidden",
            maxHeight: "280px",
          }}
        >
          {loading ? (
            <div style={{ padding: "12px 14px", color: "#6b7280" }}>Searching...</div>
          ) : null}

          {!loading && suggestions.length === 0 && value.trim().length >= 2 ? (
            <div style={{ padding: "12px 14px", color: "#6b7280" }}>No results yet.</div>
          ) : null}

          {suggestions.map((item) => (
            <button
              key={`${item.label}-${item.lat}-${item.lon}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onQueryChange(item.label);
                onPick(item);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "white",
                padding: "12px 14px",
                cursor: "pointer",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontWeight: 700 }}>{item.label}</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                {item.type}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActivityCard({
  activity,
  count,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "start",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            fontSize: "12px",
            color: "#475569",
            fontWeight: 700,
          }}
        >
          Item {count}
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            style={smallButton(!canMoveUp ? "#e5e7eb" : "#eef2ff")}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            style={smallButton(!canMoveDown ? "#e5e7eb" : "#eef2ff")}
          >
            ↓
          </button>
          <button type="button" onClick={onDelete} style={smallButton("#fee2e2")}>
            Remove
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "110px 130px 1fr",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <input
          value={activity.time}
          onChange={(e) => onChange({ time: e.target.value })}
          placeholder="Time"
          style={fieldStyle}
        />
        <select
          value={activity.section}
          onChange={(e) => onChange({ section: e.target.value })}
          style={fieldStyle}
        >
          {SECTION_ORDER.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
        <select
          value={activity.type}
          onChange={(e) => onChange({ type: e.target.value })}
          style={fieldStyle}
        >
          {TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <input
          value={activity.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Activity name"
          style={fieldStyle}
        />
        <input
          value={activity.neighborhood}
          onChange={(e) => onChange({ neighborhood: e.target.value })}
          placeholder="Neighborhood"
          style={fieldStyle}
        />
      </div>

      <textarea
        value={activity.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Notes"
        rows={3}
        style={{
          ...fieldStyle,
          width: "100%",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <div style={{ marginTop: "12px" }}>
        <PlaceAutocomplete
          label="Map point"
          value={activity.mapPointQuery || activity.mapPointLabel || ""}
          onQueryChange={(next) =>
            onChange({
              mapPointQuery: next,
              mapPointLabel: "",
              mapPointLat: undefined,
              mapPointLon: undefined,
            })
          }
          onPick={(place) =>
            onChange({
              mapPointQuery: place.label,
              mapPointLabel: place.label,
              mapPointLat: place.lat,
              mapPointLon: place.lon,
            })
          }
          placeholder="Search the exact place for this activity"
          helperText="Pick the exact pin location for this activity."
        />
      </div>
    </div>
  );
}

function SmartAreaPlanner({ days, onJumpToDay }) {
  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function haversineKm(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function parsePoint(lat, lon) {
    const latNum = typeof lat === "string" ? Number(lat) : lat;
    const lonNum = typeof lon === "string" ? Number(lon) : lon;
    return Number.isFinite(latNum) && Number.isFinite(lonNum)
      ? [latNum, lonNum]
      : null;
  }

  const AREA_HINTS = {
    shinjuku: [35.6938, 139.7034],
    shibuya: [35.658, 139.7016],
    harajuku: [35.6702, 139.7027],
    meiji: [35.6764, 139.6993],
    omotesando: [35.6655, 139.7121],
    ginza: [35.6717, 139.765],
    toyosu: [35.6544, 139.7956],
    tsukiji: [35.6655, 139.7708],
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
  };

  function pointFromText(text) {
    const normalized = normalizeText(text);
    for (const [key, point] of Object.entries(AREA_HINTS)) {
      if (normalized.includes(key)) return point;
    }
    return null;
  }

  function getDayAnchor(day) {
    const explicitPoints = [];

    const hotelPoint = parsePoint(day.hotelMapPointLat, day.hotelMapPointLon);
    if (hotelPoint) explicitPoints.push(hotelPoint);

    (day.activities || []).forEach((activity) => {
      const p = parsePoint(activity.mapPointLat, activity.mapPointLon);
      if (p) explicitPoints.push(p);
    });

    if (explicitPoints.length) {
      const avg = explicitPoints.reduce(
        (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
        [0, 0]
      );
      return [avg[0] / explicitPoints.length, avg[1] / explicitPoints.length];
    }

    const textFallbacks = [
      `${day.area} ${day.city}`,
      day.area,
      day.city,
      day.hotel,
      ...(day.activities || []).flatMap((a) => [a.name, a.neighborhood]),
    ];

    for (const candidate of textFallbacks) {
      const p = pointFromText(candidate);
      if (p) return p;
    }

    return [35.6895, 139.6917];
  }

  function collectDayTerms(day) {
    return [
      day.city,
      day.area,
      day.title,
      day.hotel,
      ...(day.activities || []).flatMap((a) => [
        a.name,
        a.neighborhood,
        a.type,
        a.notes,
      ]),
    ]
      .map(normalizeText)
      .filter(Boolean);
  }

  function scorePlaceForDay(place, day) {
    const placeText = normalizeText(`${place.label} ${place.address || ""}`);
    const anchor = getDayAnchor(day);
    const placePoint = [place.lat, place.lon];
    const distanceKm = haversineKm(placePoint, anchor);

    const terms = collectDayTerms(day);
    const exactMatch = terms.find(
      (term) => term.length > 2 && placeText.includes(term)
    );

    const activityMatch = (day.activities || []).find((activity) => {
      return (
        placeText.includes(normalizeText(activity.neighborhood)) ||
        placeText.includes(normalizeText(activity.name))
      );
    });

    const cityMatch = placeText.includes(normalizeText(day.city));
    const areaMatch = placeText.includes(normalizeText(day.area));

    const proximityBonus = Math.max(0, 6 - distanceKm) * 0.8;
    const textBonus = areaMatch ? 4 : cityMatch ? 2 : exactMatch ? 1.5 : 0;
    const activityBonus = activityMatch ? 4.5 : 0;

    const score = distanceKm - proximityBonus - textBonus - activityBonus;

    let reason = "";
    if (activityMatch) {
      reason = `Best added to ${day.date} because it is near ${activityMatch.neighborhood || activityMatch.name}.`;
    } else if (areaMatch) {
      reason = `Fits naturally into ${day.date} because it matches your ${day.area} plan.`;
    } else if (cityMatch) {
      reason = `Best added to ${day.date} because it is in ${day.city} and stays close to your existing route.`;
    } else if (exactMatch) {
      reason = `Best added to ${day.date} because it matches ${exactMatch}.`;
    } else {
      reason = `Best added to ${day.date} because it is the closest fit geographically.`;
    }

    return { day, score, distanceKm, reason };
  }

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=jp&accept-language=en&q=${encodeURIComponent(
          q
        )}`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Accept-Language": "en",
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (controller.signal.aborted) return;

        setSuggestions(
          data.map((item) => ({
            label: item.display_name,
            address: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
          }))
        );
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const ranked = useMemo(() => {
    if (!selectedPlace) return [];
    return [...days]
      .map((day) => scorePlaceForDay(selectedPlace, day))
      .sort((a, b) => a.score - b.score);
  }, [days, selectedPlace]);

  const best = ranked[0];
  const alternatives = ranked.slice(1, 4);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.9)",
        borderRadius: "24px",
        padding: "18px",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
        marginTop: "18px",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Smart area planning</h3>
      <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
        Search a place and the app will suggest the best day based on geography and your existing route.
      </p>

      <div style={{ position: "relative" }}>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              e.preventDefault();
              const first = suggestions[0];
              setQuery(first.label);
              setSelectedPlace(first);
              setOpen(false);
            }
          }}
          placeholder="Search or paste a location..."
          style={{
            ...fieldStyle,
            width: "100%",
          }}
        />

        {open && suggestions.length > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "calc(100% + 8px)",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
              zIndex: 30,
              overflow: "hidden",
            }}
          >
            {suggestions.map((item) => (
              <button
                key={`${item.label}-${item.lat}-${item.lon}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(item.label);
                  setSelectedPlace(item);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "white",
                  padding: "12px 14px",
                  cursor: "pointer",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.label}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {best ? (
        <div
          style={{
            marginTop: "16px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "16px",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: "8px" }}>
            Best match: {best.day.date} · {best.day.city}
          </div>
          <div style={{ color: "#374151", lineHeight: 1.5 }}>
            {best.reason}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
            <button
              type="button"
              onClick={() => onJumpToDay(best.day.day)}
              style={{
                border: "none",
                padding: "10px 14px",
                borderRadius: "12px",
                cursor: "pointer",
                background: "#111827",
                color: "white",
                fontWeight: 700,
              }}
            >
              Open recommended day
            </button>
          </div>
        </div>
      ) : null}

      {alternatives.length ? (
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px" }}>Other close fits</div>
          <div style={{ display: "grid", gap: "8px" }}>
            {alternatives.map((item) => (
              <button
                key={item.day.day}
                type="button"
                onClick={() => onJumpToDay(item.day.day)}
                style={{
                  textAlign: "left",
                  border: "1px solid #e5e7eb",
                  background: "white",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {item.day.date} · {item.day.city}
                </div>
                <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
                  {item.reason}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function smallButton(bg) {
  return {
    border: "none",
    padding: "10px 12px",
    borderRadius: "12px",
    cursor: "pointer",
    background: bg,
    color: "#111827",
    fontWeight: 700,
    fontSize: "13px",
  };
}

export default function App() {
  const initial = loadInitialState();
  const [days, setDays] = useState(() => initial.days);
  const [mode, setMode] = useState(initial.mode);
  const [selectedDayId, setSelectedDayId] = useState(initial.selectedDayId);
  const [query, setQuery] = useState("");
  const [newActivity, setNewActivity] = useState({
    time: "",
    section: "Afternoon",
    name: "",
    type: "Planned",
    neighborhood: "",
    notes: "",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode, selectedDayId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        days,
        mode,
        selectedDayId,
      })
    );
  }, [days, mode, selectedDayId]);

  const filteredDays = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return days;
    return days.filter((day) => getDayText(day).includes(q));
  }, [query, days]);

  const selectedDay =
    filteredDays.find((d) => d.day === selectedDayId) || filteredDays[0] || days[0];

  const overviewStats = useMemo(() => {
    return {
      days: days.length,
      tokyo: days.filter((d) => d.city === "Tokyo").length,
      kyoto: days.filter((d) => d.city === "Kyoto").length,
      activities: days.reduce((sum, d) => sum + d.activities.length, 0),
    };
  }, [days]);

  function updateDay(dayId, updater) {
    setDays((prev) => prev.map((day) => (day.day === dayId ? updater(day) : day)));
  }

  function updateActivity(dayId, activityId, patch) {
    updateDay(dayId, (day) => ({
      ...day,
      activities: day.activities.map((activity) =>
        activity.id === activityId ? { ...activity, ...patch } : activity
      ),
    }));
  }

  function removeActivity(dayId, activityId) {
    updateDay(dayId, (day) => ({
      ...day,
      activities: day.activities.filter((activity) => activity.id !== activityId),
    }));
  }

  function moveActivity(dayId, activityId, direction) {
    updateDay(dayId, (day) => {
      const index = day.activities.findIndex((activity) => activity.id === activityId);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= day.activities.length) return day;

      const next = [...day.activities];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...day, activities: next };
    });
  }

  function addActivityToDay(dayId, activity) {
    if (!activity.name.trim()) return;

    updateDay(dayId, (day) => ({
      ...day,
      activities: [
        ...day.activities,
        {
          id: makeId(),
          ...activity,
          mapPointQuery: "",
          mapPointLabel: "",
          mapPointLat: undefined,
          mapPointLon: undefined,
        },
      ],
    }));

    setNewActivity({
      time: "",
      section: "Afternoon",
      name: "",
      type: "Planned",
      neighborhood: "",
      notes: "",
    });
  }

  const groupedActivities = useMemo(() => {
    const map = {};
    SECTION_ORDER.forEach((section) => {
      map[section] = selectedDay.activities
        .map((activity, index) => ({ activity, index }))
        .filter(({ activity }) => activity.section === section);
    });
    return map;
  }, [selectedDay]);

  const visibleDays = query.trim() ? filteredDays : days;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #ffffff 0%, #f4f7fb 45%, #eef2ff 100%)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: "20px",
        color: "#111827",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font: inherit; }
        @media (max-width: 980px) {
          .layout, .hero, .detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          className="hero"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.9fr",
            gap: "18px",
            alignItems: "stretch",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.7)",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "#dbeafe",
                  color: "#1e3a8a",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Japan 2026
              </span>
              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "#ecfeff",
                  color: "#155e75",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Trip Planner
              </span>
            </div>

            <h1 style={{ margin: "0 0 10px", fontSize: "44px", lineHeight: 1.05 }}>
              Japan 2026 Trip Planner 🇯🇵
            </h1>

            <p style={{ margin: 0, color: "#4b5563", fontSize: "16px", lineHeight: 1.6 }}>
              A travel dashboard for your Tokyo, Kyoto, Osaka, and Studio Ghibli days.
            </p>

            <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
              <button
                onClick={() => setMode("overview")}
                style={{
                  border: "none",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: mode === "overview" ? "#111827" : "#eef2ff",
                  color: mode === "overview" ? "white" : "#111827",
                  fontWeight: 700,
                }}
              >
                Overview
              </button>
              <button
                onClick={() => setMode("day")}
                style={{
                  border: "none",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: mode === "day" ? "#111827" : "#eef2ff",
                  color: mode === "day" ? "white" : "#111827",
                  fontWeight: 700,
                }}
              >
                Day view
              </button>
            </div>
          </div>

          <div
            style={{
              background: "rgba(17,24,39,0.96)",
              color: "white",
              borderRadius: "24px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div style={{ fontSize: "13px", opacity: 0.75, marginBottom: "8px" }}>
              Trip at a glance
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              <StatRow label="Days" value={overviewStats.days} />
              <StatRow label="Tokyo days" value={overviewStats.tokyo} />
              <StatRow label="Kyoto days" value={overviewStats.kyoto} />
              <StatRow label="Total stops" value={overviewStats.activities} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a day, place, or activity..."
            style={{
              width: "100%",
              maxWidth: "560px",
              padding: "14px 16px",
              borderRadius: "16px",
              border: "1px solid #d1d5db",
              fontSize: "16px",
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
            }}
          />
        </div>

        {mode === "overview" ? (
          <div className="layout" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "24px",
                padding: "20px",
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(255,255,255,0.7)",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "14px" }}>All Trip Days</h2>
              <div style={{ display: "grid", gap: "14px" }}>
                {visibleDays.map((day) => (
                  <DayCard
                    key={day.day}
                    day={day}
                    active={selectedDay.day === day.day}
                    onClick={() => {
                      setSelectedDayId(day.day);
                      setMode("day");
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "24px",
                padding: "20px",
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(255,255,255,0.7)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Journey Flow</h2>
              <p style={{ color: "#4b5563", marginTop: "-4px" }}>
                Drag and zoom just like a normal map.
              </p>

              <MapPanel
                days={days}
                selectedDay={selectedDay}
                overview={true}
                height={380}
              />

              <SmartAreaPlanner
                days={days}
                onJumpToDay={(dayId) => {
                  setSelectedDayId(dayId);
                  setMode("day");
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="layout detail-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "360px 1fr",
              gap: "20px",
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "24px",
                padding: "18px",
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(255,255,255,0.7)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Trip Days</h2>
              {visibleDays.map((day) => (
                <DayCard
                  key={day.day}
                  day={day}
                  active={selectedDay.day === day.day}
                  onClick={() => setSelectedDayId(day.day)}
                />
              ))}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "24px",
                padding: "22px",
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(255,255,255,0.7)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        background: selectedDay.color || "#dbeafe",
                        color: "#1e3a8a",
                        borderRadius: "999px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      Day {selectedDay.day}
                    </span>
                    <span
                      style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        borderRadius: "999px",
                        padding: "6px 12px",
                        fontSize: "12px",
                      }}
                    >
                      {selectedDay.date}
                    </span>
                    <span
                      style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        borderRadius: "999px",
                        padding: "6px 12px",
                        fontSize: "12px",
                      }}
                    >
                      {selectedDay.city} · {selectedDay.area}
                    </span>
                  </div>

                  <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
                    {selectedDay.title}
                  </h2>
                  <p style={{ color: "#666", marginTop: 0 }}>
                    Hotel: <strong>{selectedDay.hotel || "Not set"}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMode("overview")}
                  style={{
                    border: "none",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    background: "#eef2ff",
                    color: "#111827",
                    fontWeight: 700,
                  }}
                >
                  Back to overview
                </button>
              </div>

              <div
                style={{
                  marginBottom: "18px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  padding: "16px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Hotel for this day</h3>
                <input
                  value={selectedDay.hotel || ""}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((day) =>
                        day.day === selectedDay.day
                          ? { ...day, hotel: e.target.value }
                          : day
                      )
                    )
                  }
                  placeholder="Enter hotel name"
                  style={{
                    ...fieldStyle,
                    width: "100%",
                    maxWidth: "520px",
                  }}
                />

                <div style={{ marginTop: "14px" }}>
                  <PlaceAutocomplete
                    label="Hotel map point"
                    value={selectedDay.hotelMapPointQuery || selectedDay.hotelMapPointLabel || ""}
                    onQueryChange={(next) =>
                      setDays((prev) =>
                        prev.map((day) =>
                          day.day === selectedDay.day
                            ? {
                                ...day,
                                hotelMapPointQuery: next,
                                hotelMapPointLabel: "",
                                hotelMapPointLat: undefined,
                                hotelMapPointLon: undefined,
                              }
                            : day
                        )
                      )
                    }
                    onPick={(place) =>
                      setDays((prev) =>
                        prev.map((day) =>
                          day.day === selectedDay.day
                            ? {
                                ...day,
                                hotelMapPointQuery: place.label,
                                hotelMapPointLabel: place.label,
                                hotelMapPointLat: place.lat,
                                hotelMapPointLon: place.lon,
                              }
                            : day
                        )
                      )
                    }
                    placeholder="Search the hotel location"
                    helperText="Pick the exact pin for this day's hotel."
                  />
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <h3 style={{ marginTop: 0 }}>Map with every activity</h3>
                <MapPanel
                  days={[selectedDay]}
                  selectedDay={selectedDay}
                  overview={false}
                  height={420}
                />
              </div>

              <div style={{ display: "grid", gap: "18px" }}>
                {SECTION_ORDER.map((section) => (
                  <div key={section}>
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "10px",
                        color: "#111827",
                      }}
                    >
                      {section}
                    </div>

                    <div style={{ display: "grid", gap: "12px" }}>
                      {groupedActivities[section].map(({ activity, index }) => (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          count={index + 1}
                          canMoveUp={index > 0}
                          canMoveDown={index < selectedDay.activities.length - 1}
                          onChange={(patch) =>
                            updateActivity(selectedDay.day, activity.id, patch)
                          }
                          onDelete={() => removeActivity(selectedDay.day, activity.id)}
                          onMoveUp={() => moveActivity(selectedDay.day, activity.id, -1)}
                          onMoveDown={() => moveActivity(selectedDay.day, activity.id, 1)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "18px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  padding: "16px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Add activity</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 130px 1fr",
                      gap: "10px",
                    }}
                  >
                    <input
                      value={newActivity.time}
                      onChange={(e) =>
                        setNewActivity((prev) => ({ ...prev, time: e.target.value }))
                      }
                      placeholder="Time"
                      style={fieldStyle}
                    />
                    <select
                      value={newActivity.section}
                      onChange={(e) =>
                        setNewActivity((prev) => ({ ...prev, section: e.target.value }))
                      }
                      style={fieldStyle}
                    >
                      {SECTION_ORDER.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newActivity.type}
                      onChange={(e) =>
                        setNewActivity((prev) => ({ ...prev, type: e.target.value }))
                      }
                      style={fieldStyle}
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    <input
                      value={newActivity.name}
                      onChange={(e) =>
                        setNewActivity((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Activity name"
                      style={fieldStyle}
                    />
                    <input
                      value={newActivity.neighborhood}
                      onChange={(e) =>
                        setNewActivity((prev) => ({
                          ...prev,
                          neighborhood: e.target.value,
                        }))
                      }
                      placeholder="Neighborhood"
                      style={fieldStyle}
                    />
                  </div>

                  <textarea
                    value={newActivity.notes}
                    onChange={(e) =>
                      setNewActivity((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Notes"
                    rows={3}
                    style={{
                      ...fieldStyle,
                      width: "100%",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => addActivityToDay(selectedDay.day, newActivity)}
                    style={{
                      border: "none",
                      padding: "12px 16px",
                      borderRadius: "14px",
                      cursor: "pointer",
                      background: "#111827",
                      color: "white",
                      fontWeight: 700,
                      width: "fit-content",
                    }}
                  >
                    Add activity to this day
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}