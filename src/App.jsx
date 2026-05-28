import { useEffect, useMemo, useRef, useState } from "react";
import { itinerary as seedItinerary } from "./data/itinerary";
import MapPanel from "./components/MapPanel";
import { supabase } from "./lib/supabase";

const TRIP_ID = "japan-2026";
const LOCAL_STORAGE_KEY = "japan-trip-planner-local-fallback-v1";

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
  width: "100%",
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
      typeof day.hotelMapPointLat === "number"
        ? day.hotelMapPointLat
        : undefined,
    hotelMapPointLon:
      typeof day.hotelMapPointLon === "number"
        ? day.hotelMapPointLon
        : undefined,
    activities: (day.activities || []).map((activity, index) => ({
      ...activity,
      id:
        activity.id ||
        `${day.day}-${index}-${Math.random().toString(16).slice(2)}`,
      mapPointQuery: activity.mapPointQuery || activity.mapPointLabel || "",
      mapPointLabel: activity.mapPointLabel || "",
      mapPointLat:
        typeof activity.mapPointLat === "number"
          ? activity.mapPointLat
          : undefined,
      mapPointLon:
        typeof activity.mapPointLon === "number"
          ? activity.mapPointLon
          : undefined,
    })),
  }));
}

function initialState() {
  return {
    days: normalizeDays(seedItinerary),
    selectedDayId: seedItinerary[0]?.day || 1,
    view: "overview",
  };
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
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
        style={fieldStyle}
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
            <div style={{ padding: "12px 14px", color: "#6b7280" }}>
              Searching...
            </div>
          ) : null}

          {!loading && suggestions.length === 0 && value.trim().length >= 2 ? (
            <div style={{ padding: "12px 14px", color: "#6b7280" }}>
              No results yet.
            </div>
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
  isMobile,
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
          gridTemplateColumns: isMobile ? "1fr" : "110px 130px 1fr",
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
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
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

function mobileNavButton(active) {
  return {
    border: "none",
    padding: "10px 12px",
    borderRadius: "14px",
    cursor: "pointer",
    background: active ? "#111827" : "#eef2ff",
    color: active ? "white" : "#111827",
    fontWeight: 800,
    width: "100%",
  };
}

export default function App() {
  const isMobile = useIsMobile();
  const [days, setDays] = useState(() => normalizeDays(seedItinerary));
  const [selectedDayId, setSelectedDayId] = useState(seedItinerary[0]?.day || 1);
  const [view, setView] = useState("overview");
  const [query, setQuery] = useState("");
  const [newActivity, setNewActivity] = useState({
    time: "",
    section: "Afternoon",
    name: "",
    type: "Planned",
    neighborhood: "",
    notes: "",
  });

  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const lastSavedHashRef = useRef("");
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (isMobile) setView("overview");
  }, [isMobile]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, selectedDayId]);

  useEffect(() => {
    if (!supabase) {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.days) {
            setDays(normalizeDays(parsed.days));
            setSelectedDayId(Number(parsed.selectedDayId) || seedItinerary[0]?.day || 1);
            setView(parsed.view === "day" ? "day" : "overview");
          }
        } catch {
          // ignore local fallback errors
        }
      }
      setReady(true);
      setSyncStatus("offline");
      setSyncError("Supabase is not configured yet.");
      return;
    }

    let mounted = true;

    async function loadTrip() {
      setSyncStatus("loading");

      const { data, error } = await supabase
        .from("trip_states")
        .select("id,payload,updated_at")
        .eq("id", TRIP_ID)
        .maybeSingle();

      if (!mounted) return;

      if (error && error.code !== "PGRST116") {
        setSyncError(error.message || "Could not load trip.");
        setDays(normalizeDays(seedItinerary));
        setReady(true);
        setSyncStatus("error");
        return;
      }

      const payload = data?.payload;
      if (!payload) {
        const initialPayload = {
          days: normalizeDays(seedItinerary),
          selectedDayId: seedItinerary[0]?.day || 1,
          view: "overview",
        };

        await supabase.from("trip_states").upsert(
          {
            id: TRIP_ID,
            payload: initialPayload,
          },
          { onConflict: "id" }
        );

        if (!mounted) return;

        setDays(initialPayload.days);
        setSelectedDayId(initialPayload.selectedDayId);
        setView(initialPayload.view || "overview");
        lastSavedHashRef.current = JSON.stringify(initialPayload);
        setReady(true);
        setSyncStatus("live");
        setLastSyncedAt(new Date().toISOString());
        return;
      }

      const nextDays = normalizeDays(payload.days || seedItinerary);
      const nextSelectedDayId = Number(payload.selectedDayId) || nextDays[0]?.day || 1;
      const nextView = payload.view === "day" ? "day" : "overview";
      const nextHash = JSON.stringify({
        days: nextDays,
        selectedDayId: nextSelectedDayId,
        view: nextView,
      });

      setDays(nextDays);
      setSelectedDayId(nextSelectedDayId);
      setView(nextView);
      lastSavedHashRef.current = nextHash;
      setReady(true);
      setSyncStatus("live");
      setLastSyncedAt(data.updated_at || new Date().toISOString());
    }

    loadTrip();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase || !ready) return;

    const channel = supabase
      .channel(`trip_states_${TRIP_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_states",
          filter: `id=eq.${TRIP_ID}`,
        },
        (payload) => {
          const incoming = payload.new?.payload;
          if (!incoming) return;

          const nextDays = normalizeDays(incoming.days || seedItinerary);
          const nextSelectedDayId = Number(incoming.selectedDayId) || nextDays[0]?.day || 1;
          const nextView = incoming.view === "day" ? "day" : "overview";

          lastSavedHashRef.current = JSON.stringify({
            days: nextDays,
            selectedDayId: nextSelectedDayId,
            view: nextView,
          });

          setDays(nextDays);
          setSelectedDayId(nextSelectedDayId);
          setView(nextView);
          setLastSyncedAt(new Date().toISOString());
          setSyncStatus("live");
          setSyncError("");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const payload = { days, selectedDayId, view };
    const hash = JSON.stringify(payload);

    if (hash === lastSavedHashRef.current) return;

    if (!supabase) {
      localStorage.setItem(LOCAL_STORAGE_KEY, hash);
      return;
    }

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        lastSavedHashRef.current = hash;
        const { error } = await supabase.from("trip_states").upsert(
          {
            id: TRIP_ID,
            payload,
          },
          { onConflict: "id" }
        );

        if (error) {
          setSyncError(error.message || "Could not save trip.");
          lastSavedHashRef.current = "";
          setSyncStatus("error");
        } else {
          setSyncError("");
          setSyncStatus("live");
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (err) {
        setSyncError(err?.message || "Could not save trip.");
        lastSavedHashRef.current = "";
        setSyncStatus("error");
      }
    }, 450);

    return () => clearTimeout(saveTimerRef.current);
  }, [days, selectedDayId, view, ready]);

  const filteredDays = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return days;
    return days.filter((day) => getDayText(day).includes(q));
  }, [query, days]);

  const selectedDay =
    filteredDays.find((d) => d.day === selectedDayId) ||
    filteredDays[0] ||
    days[0];

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

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #ffffff 0%, #f4f7fb 45%, #eef2ff 100%)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: isMobile ? "12px" : "20px",
        paddingBottom: isMobile ? "92px" : "20px",
        color: "#111827",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font: inherit; }
        input, textarea, select { font: inherit; }
        @media (max-width: 900px) {
          .desktop-grid, .hero-grid, .detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          className="hero-grid"
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
              padding: isMobile ? "18px" : "24px",
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
              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background:
                    syncStatus === "live"
                      ? "#dcfce7"
                      : syncStatus === "loading"
                      ? "#fef3c7"
                      : "#fee2e2",
                  color: "#111827",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {syncStatus === "live"
                  ? "Synced"
                  : syncStatus === "loading"
                  ? "Loading..."
                  : "Offline / Error"}
              </span>
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: isMobile ? "32px" : "44px",
                lineHeight: 1.05,
              }}
            >
              Japan 2026 Trip Planner 🇯🇵
            </h1>

            <p
              style={{
                margin: 0,
                color: "#4b5563",
                fontSize: isMobile ? "14px" : "16px",
                lineHeight: 1.6,
              }}
            >
              A shared family trip planner that stays synced across devices.
            </p>

            <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
              <button
                onClick={() => setView("overview")}
                style={{
                  border: "none",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: view === "overview" ? "#111827" : "#eef2ff",
                  color: view === "overview" ? "white" : "#111827",
                  fontWeight: 700,
                }}
              >
                Overview
              </button>
              <button
                onClick={() => setView("day")}
                style={{
                  border: "none",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: view === "day" ? "#111827" : "#eef2ff",
                  color: view === "day" ? "white" : "#111827",
                  fontWeight: 700,
                }}
              >
                Day view
              </button>
            </div>

            {syncError ? (
              <div style={{ marginTop: "14px", color: "#b91c1c", fontSize: "13px" }}>
                {syncError}
              </div>
            ) : null}

            {lastSyncedAt ? (
              <div style={{ marginTop: "10px", color: "#6b7280", fontSize: "12px" }}>
                Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
              </div>
            ) : null}
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

        {view === "overview" ? (
          <div
            className="desktop-grid"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr",
              gap: "20px",
            }}
          >
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
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                }}
              >
                {visibleDays.map((day) => (
                  <DayCard
                    key={day.day}
                    day={day}
                    active={selectedDay.day === day.day}
                    onClick={() => {
                      setSelectedDayId(day.day);
                      setView("day");
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

              <div id="trip-map">
                <MapPanel
                  days={days}
                  selectedDay={selectedDay}
                  overview={true}
                  height={isMobile ? 320 : 380}
                  onSelectDay={(dayId) => {
                    setSelectedDayId(dayId);
                    setView("day");
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="detail-grid"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "360px 1fr",
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
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "1fr",
                }}
              >
                {visibleDays.map((day) => (
                  <DayCard
                    key={day.day}
                    day={day}
                    active={selectedDay.day === day.day}
                    onClick={() => setSelectedDayId(day.day)}
                  />
                ))}
              </div>
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
                  onClick={() => setView("overview")}
                  style={{
                    border: "none",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    background: "#eef2ff",
                    color: "#111827",
                    fontWeight: 700,
                    height: "fit-content",
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
                    maxWidth: "520px",
                  }}
                />

                <div style={{ marginTop: "14px" }}>
                  <PlaceAutocomplete
                    label="Hotel map point"
                    value={
                      selectedDay.hotelMapPointQuery ||
                      selectedDay.hotelMapPointLabel ||
                      ""
                    }
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

              <div style={{ marginBottom: "18px" }} id="day-map">
                <h3 style={{ marginTop: 0 }}>Map with every activity</h3>
                <MapPanel
                  days={[selectedDay]}
                  selectedDay={selectedDay}
                  overview={false}
                  height={isMobile ? 320 : 420}
                  onSelectDay={(dayId) => setSelectedDayId(dayId)}
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
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div
                id="add-activity"
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
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "110px 130px 1fr",
                      gap: "10px",
                    }}
                  >
                    <input
                      value={newActivity.time}
                      onChange={(e) =>
                        setNewActivity((prev) => ({
                          ...prev,
                          time: e.target.value,
                        }))
                      }
                      placeholder="Time"
                      style={fieldStyle}
                    />
                    <select
                      value={newActivity.section}
                      onChange={(e) =>
                        setNewActivity((prev) => ({
                          ...prev,
                          section: e.target.value,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {SECTION_ORDER.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                    {!isMobile ? (
                      <select
                        value={newActivity.type}
                        onChange={(e) =>
                          setNewActivity((prev) => ({
                            ...prev,
                            type: e.target.value,
                          }))
                        }
                        style={fieldStyle}
                      >
                        {TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    <input
                      value={newActivity.name}
                      onChange={(e) =>
                        setNewActivity((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
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

                  {isMobile ? (
                    <select
                      value={newActivity.type}
                      onChange={(e) =>
                        setNewActivity((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <textarea
                    value={newActivity.notes}
                    onChange={(e) =>
                      setNewActivity((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Notes"
                    rows={3}
                    style={{
                      ...fieldStyle,
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

      {isMobile ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setView("overview")}
              style={mobileNavButton(view === "overview")}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setView("day")}
              style={mobileNavButton(view === "day")}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => scrollToId("trip-map")}
              style={mobileNavButton(false)}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => scrollToId("add-activity")}
              style={mobileNavButton(false)}
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}