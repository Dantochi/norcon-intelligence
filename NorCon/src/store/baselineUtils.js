// baselineUtils.js — snapshot builder and baseline helpers

// Build a point-in-time snapshot of the project baseline from L2 sheets
export function buildSnapshot(sheets) {
  const charter      = sheets["01"]?.data?.charter    || {};
  const activities   = sheets["03"]?.data?.activities || [];
  const milestones   = sheets["03"]?.data?.milestones || [];
  const costData     = sheets["03"]?.data?.costData   || {};
  const risks        = sheets["05"]?.data?.risks      || [];
  const deliverables = sheets["07"]?.data?.deliverables || [];

  return {
    charter:      JSON.parse(JSON.stringify(charter)),
    activities:   JSON.parse(JSON.stringify(activities)),
    milestones:   JSON.parse(JSON.stringify(milestones)),
    costData:     JSON.parse(JSON.stringify(costData)),
    risks:        JSON.parse(JSON.stringify(risks)),
    deliverables: JSON.parse(JSON.stringify(deliverables)),
    // charter.benefits captured inside charter above; also explicit for direct access
    benefits:     JSON.parse(JSON.stringify(charter.benefits || [])),
    budget:       charter.budget || "",
    capturedAt:   new Date().toISOString(),
  };
}

// Check whether the four enforced sheets are all locked
export function isBaselineReady(sheets) {
  return ["01","02","03","04"].every(id => sheets[id]?.locked);
}

// Safe date parse — returns null instead of Invalid Date so callers can guard
export function safeDate(value) {
  if (!value || value === "" || value === "mm/dd/yyyy") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Derive current phase from activity/milestone completion.
// Reads _complete (boolean). Coerces _state-only records for backward compatibility.
// Guards against Invalid Date and undefined fields — robust to partial data.
export function deriveCurrentPhase(activities, milestones) {
  const PHASE_ORDER = ["Concept","Definition","Development","Execution","Handover & Closeout"];
  const all = [...(activities||[]), ...(milestones||[])];
  if (!all.length) return "Concept";

  // Coerce: if _complete is undefined, fall back to _state field
  const isComplete = (item) => {
    if (typeof item._complete === "boolean") return item._complete;
    return item._state === "complete";
  };

  for (const phase of PHASE_ORDER) {
    const phaseItems = all.filter(i => i.phase === phase);
    if (!phaseItems.length) continue;
    if (phaseItems.some(i => !isComplete(i))) return phase;
  }
  return PHASE_ORDER[PHASE_ORDER.length - 1];
}

// Compute project-wide date range safely — used by Gantt and Dashboard.
// Returns null if no valid dates found, preventing NaN cascade.
export function computeDateRange(activities, milestones) {
  const allItems = [...(activities||[]), ...(milestones||[])];
  const starts = allItems.map(i => safeDate(i.startDate || i.targetDate)).filter(Boolean);
  const ends   = allItems.map(i => safeDate(i.targetDate || i.startDate)).filter(Boolean);

  if (!starts.length || !ends.length) return null;

  return {
    start:     new Date(Math.min(...starts.map(d => d.getTime()))),
    end:       new Date(Math.max(...ends.map(d => d.getTime()))),
    totalDays: Math.max(1, (Math.max(...ends.map(d => d.getTime())) - Math.min(...starts.map(d => d.getTime()))) / 86400000),
  };
}

// Calculate a single bar's position and width as percentages of the date range.
// Returns null if dates are invalid — Gantt should skip rendering that bar.
export function computeBarPosition(item, range) {
  if (!range) return null;
  const start = safeDate(item.startDate || item.targetDate);
  const end   = safeDate(item.targetDate || item.startDate);
  if (!start || !end) return null;

  const left  = Math.max(0, (start.getTime() - range.start.getTime()) / 86400000 / range.totalDays * 100);
  const width = Math.max(0.5, (end.getTime() - start.getTime()) / 86400000 / range.totalDays * 100);
  return { left, width };
}
