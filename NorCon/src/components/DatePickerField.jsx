import { useEffect, useState } from "react";

const CALENDAR_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatYmd(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmd(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function CalendarIcon({ color = "#E5F0E8" }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M7 2.75a.75.75 0 0 1 .75.75V4h8.5V3.5a.75.75 0 0 1 1.5 0V4h1.25A2.25 2.25 0 0 1 21 6.25v11.5A2.25 2.25 0 0 1 18.75 20H5.25A2.25 2.25 0 0 1 3 17.75V6.25A2.25 2.25 0 0 1 5.25 4H6.5V3.5A.75.75 0 0 1 7 2.75Zm-1.25 6.5h13.5v9.5a.75.75 0 0 1-.75.75H5.5a.75.75 0 0 1-.75-.75v-9.5Zm2.5-4.5h8.5V5h-8.5v.75Zm2.25 6.5h1.5v1.5h-1.5v-1.5Zm3.5 0h1.5v1.5h-1.5v-1.5Zm-7 3h1.5v1.5h-1.5v-1.5Zm3.5 0h1.5v1.5h-1.5v-1.5Zm3.5 0h1.5v1.5h-1.5v-1.5Z"
        fill={color}
      />
    </svg>
  );
}

export default function DatePickerField({ value, onChange, disabled = false, style = {} }) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState("days");
  const [viewDate, setViewDate] = useState(() => parseYmd(value) || new Date());
  const [yearWindowStart, setYearWindowStart] = useState(() => Math.floor((parseYmd(value)?.getFullYear() || new Date().getFullYear()) / 10) * 10);

  useEffect(() => {
    if (value) {
      const parsed = parseYmd(value);
      if (parsed) {
        setViewDate(parsed);
        setYearWindowStart(Math.floor(parsed.getFullYear() / 10) * 10);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (!event.target.closest("[data-date-picker-root]")) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedDate = value ? parseYmd(value) : null;
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDate = (date) => {
    if (!date) return;
    onChange?.(formatYmd(date));
    setViewDate(date);
    setOpen(false);
  };

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const years = Array.from({ length: 12 }, (_, index) => yearWindowStart + index);
  const displayValue = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date";

  const renderMonthYearHeader = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <button
        type="button"
        onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
        style={{ background: "none", border: "none", color: "#E5F0E8", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}
      >
        ‹
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => setViewMode("months")}
          style={{ background: "none", border: "none", color: "#E5F0E8", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          {viewDate.toLocaleDateString("en-US", { month: "long" })}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("years")}
          style={{ background: "none", border: "none", color: "#E5F0E8", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          {viewDate.getFullYear()}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
        style={{ background: "none", border: "none", color: "#E5F0E8", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}
      >
        ›
      </button>
    </div>
  );

  return (
    <div data-date-picker-root style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        style={{
          width: "100%",
          background: disabled ? "rgba(24,61,40,0.7)" : "#183D28",
          border: "1px solid #1F4D34",
          borderRadius: 8,
          color: value ? "#E5F0E8" : "#8aac96",
          minHeight: 38,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.8 : 1,
          outline: "none",
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 12,
          boxSizing: "border-box",
          ...style,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayValue}</span>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#3a9962" }}>
          <CalendarIcon color="#3a9962" />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: 270,
            background: "#0f2b1d",
            border: "1px solid #1F4D34",
            borderRadius: 12,
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            zIndex: 500,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 10px 6px",
              borderBottom: "1px solid #1F4D34",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {viewMode === "days" ? renderMonthYearHeader() : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <button
                  type="button"
                  onClick={() => setYearWindowStart(yearWindowStart - 12)}
                  style={{ background: "none", border: "none", color: "#E5F0E8", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}
                >
                  ‹
                </button>
                <div style={{ color: "#E5F0E8", fontWeight: 700, fontSize: 12 }}>
                  {viewMode === "months" ? "Select month" : `${yearWindowStart}–${yearWindowStart + 11}`}
                </div>
                <button
                  type="button"
                  onClick={() => setYearWindowStart(yearWindowStart + 12)}
                  style={{ background: "none", border: "none", color: "#E5F0E8", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: "10px 10px 8px" }}>
            {viewMode === "months" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {months.map((month, index) => {
                  const isSelected = viewDate.getMonth() === index;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        const nextDate = new Date(viewDate.getFullYear(), index, 1);
                        setViewDate(nextDate);
                        setViewMode("days");
                      }}
                      style={{
                        padding: "8px 0",
                        borderRadius: 6,
                        border: isSelected ? "1px solid #2E7D52" : "1px solid transparent",
                        background: isSelected ? "rgba(46,125,82,0.25)" : "transparent",
                        color: isSelected ? "#fff" : "#E5F0E8",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === "years" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {years.map((year) => {
                  const isSelected = viewDate.getFullYear() === year;
                  const isCurrentWindow = year >= yearWindowStart && year <= yearWindowStart + 11;
                  if (!isCurrentWindow) return null;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        const nextDate = new Date(year, viewDate.getMonth(), 1);
                        setViewDate(nextDate);
                        setYearWindowStart(Math.floor(year / 10) * 10);
                        setViewMode("months");
                      }}
                      style={{
                        padding: "8px 0",
                        borderRadius: 6,
                        border: isSelected ? "1px solid #2E7D52" : "1px solid transparent",
                        background: isSelected ? "rgba(46,125,82,0.25)" : "transparent",
                        color: isSelected ? "#fff" : "#E5F0E8",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === "days" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, textAlign: "center" }}>
                  {CALENDAR_DAYS.map((day) => (
                    <div key={day} style={{ fontSize: 10, color: "#5a7a66", fontWeight: 700 }}>{day}</div>
                  ))}

                  {cells.map((date, index) => {
                    if (!date) return <div key={`empty-${index}`} style={{ height: 30 }} />;

                    const isSelected = !!selectedDate && formatYmd(date) === formatYmd(selectedDate);
                    const isToday = formatYmd(date) === formatYmd(new Date());
                    const inCurrentMonth = date.getMonth() === viewDate.getMonth();

                    return (
                      <button
                        key={formatYmd(date)}
                        type="button"
                        onClick={() => selectDate(date)}
                        style={{
                          height: 30,
                          borderRadius: 6,
                          border: isSelected ? "1px solid transparent" : "1px solid transparent",
                          background: isSelected ? "#2E7D52" : "transparent",
                          color: isSelected ? "#fff" : inCurrentMonth ? "#E5F0E8" : "#5a7a66",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: isSelected ? 700 : 400,
                          boxShadow: isToday && !isSelected ? "inset 0 0 0 1px #3a9962" : "none",
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.("");
                      setOpen(false);
                    }}
                    style={{ flex: 1, background: "none", border: "1px solid #1F4D34", borderRadius: 6, color: "#8aac96", padding: "7px 8px", cursor: "pointer", fontSize: 11 }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      onChange?.(formatYmd(today));
                      setViewDate(today);
                      setOpen(false);
                    }}
                    style={{ flex: 1, background: "#2E7D52", border: "none", borderRadius: 6, color: "#fff", padding: "7px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                  >
                    Today
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
