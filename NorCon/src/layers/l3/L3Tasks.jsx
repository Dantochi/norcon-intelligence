import { useState } from "react";
const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });
}

export default function L3Tasks({ state, activities, milestones, member, raciData, onMarkComplete, sustainConfig, onSustainRecord, setSustainPrompt }) {
  const [filter, setFilter] = useState("all");

  const loginCode = member?.loginCode;
  const raciRows  = [...(raciData?.raciRows || []), ...(raciData?.customRows || [])];

  const getAssignment = (taskId) => raciRows.find(r => r.taskId === taskId)?.assignments?.[loginCode] || null;
  const canEdit       = (taskId) => getAssignment(taskId) === "R" || member?.isPM;
  const isMine        = (taskId) => !!getAssignment(taskId);

  // Merged and sorted by target date — mirrors planned execution order (same as Gantt)
  const allItems = [
    ...activities.map(a => ({ ...a, itemType:"activity" })),
    ...milestones.map(m => ({ ...m, itemType:"milestone" })),
  ].sort((a, b) => {
    const da = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
    const db = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
    if (da !== db) return da - db;
    if (a.itemType !== b.itemType) return a.itemType === "milestone" ? 1 : -1;
    return 0;
  });

  const filtered = allItems.filter(item => {
    if (filter === "mine")       return isMine(item._id);
    if (filter === "incomplete") return !item._complete;
    return true;
  });

  const myCount   = allItems.filter(a => isMine(a._id)).length;
  const doneCount = allItems.filter(a => a._complete).length;

  const statusColor = (item) => {
    if (item._complete)                                             return C.activity;
    if (item.targetDate && new Date(item.targetDate) < new Date()) return C.risk;
    return C.milestone;
  };
  const statusLabel = (item) => {
    if (item._complete)                                             return "Complete";
    if (item.targetDate && new Date(item.targetDate) < new Date()) return "Overdue";
    return "In Progress";
  };

  // Grid: ID | Task | Phase | Due Date | Status | Action
  const COLS = "80px 1fr 90px 100px 110px 140px";

  return (
    <div style={{ padding:20, overflowY:"auto", height:"100%" }}>

      {/* Filters */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[["all","All tasks"], ["mine",`My tasks (${myCount})`], ["incomplete","Incomplete"]].map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:20,
              border:`1px solid ${filter === f ? C.accent : C.border}`,
              background: filter === f ? "rgba(46,125,82,0.15)" : "none",
              color: filter === f ? C.accentL : C.muted,
              fontSize:11, fontWeight:600, cursor:"pointer" }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>
          {doneCount} of {allItems.length} complete
        </div>
      </div>

      {/* Table */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:COLS,
          gap:8, padding:"8px 14px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
          {["ID","Task","Phase","Due Date","Status","Action"].map(h => (
            <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding:32, textAlign:"center", color:C.muted, fontSize:12 }}>No tasks match this filter.</div>
        )}

        {filtered.map((item, i) => {
          const mine       = isMine(item._id);
          const canDo      = canEdit(item._id);
          const assignment = getAssignment(item._id);
          const col        = statusColor(item);
          const label      = statusLabel(item);
          const isMile     = item.itemType === "milestone";
          const isOverdue  = !item._complete && item.targetDate && new Date(item.targetDate) < new Date();

          return (
            <div key={item._id || i} style={{
              display:"grid", gridTemplateColumns:COLS,
              gap:8, padding:"9px 14px", borderBottom:`1px solid ${C.border}`,
              background: mine ? "rgba(46,125,82,0.06)" : "transparent",
              borderLeft: mine ? `3px solid ${C.accentL}` : "3px solid transparent",
              alignItems:"center",
            }}>

              {/* ID */}
              <div style={{ fontFamily:"monospace", fontSize:10, color: isMile ? C.milestone : C.muted }}>
                {item._id}
              </div>

              {/* Task name */}
              <div>
                <div style={{ fontSize:12, color: item._complete ? C.muted : C.sage, textDecoration: item._complete ? "line-through" : "none" }}>
                  {isMile ? "◆ " : ""}{item.name || item.description || "—"}
                </div>
                {mine && assignment && <div style={{ fontSize:9, color:C.accentL, marginTop:1 }}>You ({assignment})</div>}
              </div>

              {/* Phase */}
              <div style={{ fontSize:11, color:C.muted }}>{item.phase || "—"}</div>

              {/* Due Date — read-only, sourced from Schedule */}
              <div style={{ fontSize:11, color: isOverdue ? C.risk : C.dim, fontFamily:"monospace" }}>
                {fmtDate(item.targetDate)}
              </div>

              {/* Status */}
              <div>
                <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                  background: col + "22", color: col, border:`1px solid ${col}55` }}>
                  {label}
                </span>
              </div>

              {/* Action */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {canDo ? (
                  item._complete ? (
                    <button onClick={() => onMarkComplete(item._id, item.itemType, false)}
                      style={{ padding:"4px 10px", background:"rgba(58,224,162,0.15)", border:`1px solid ${C.activity}`,
                        borderRadius:5, color:C.activity, fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ↩ Undo
                    </button>
                  ) : (
                    <button onClick={() => {
                        if (sustainConfig && Object.values(sustainConfig.enabled || {}).some(Boolean)) {
                          setSustainPrompt(item);
                        } else {
                          onMarkComplete(item._id, item.itemType, true);
                        }
                      }}
                      style={{ padding:"4px 10px", background:C.accent, border:"none",
                        borderRadius:5, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ✓ Mark Complete
                    </button>
                  )
                ) : (
                  <span style={{ fontSize:10, color:C.muted }}>View only</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
