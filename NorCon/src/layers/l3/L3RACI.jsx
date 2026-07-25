const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const RACI_COLORS = { R:C.risk, A:C.milestone, C:"#3a9ce0", I:"#9c6ee0" };

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });
}

export default function L3RACI({ raciData, teamMembers, member, activities, milestones, onMarkComplete, sustainConfig, setSustainPrompt }) {
  const rows    = [...(raciData.raciRows||[]), ...(raciData.customRows||[])];
  const members = teamMembers.filter(m => m.name && m.role);
  const loginCode = member?.loginCode;

  // Build a lookup for quick access to activity/milestone data by taskId
  const itemLookup = {};
  activities.forEach(a => { itemLookup[a._id] = { ...a, itemType:"activity" }; });
  milestones.forEach(m => { itemLookup[m._id] = { ...m, itemType:"milestone" }; });

  // Sort rows by target date (mirrors Gantt execution order)
  // Rows that have no matching activity/milestone fall to the bottom
  const sortedRows = [...rows].sort((a, b) => {
    const ia = itemLookup[a.taskId];
    const ib = itemLookup[b.taskId];
    const da = ia?.targetDate ? new Date(ia.targetDate).getTime() : Infinity;
    const db = ib?.targetDate ? new Date(ib.targetDate).getTime() : Infinity;
    if (da !== db) return da - db;
    // Tie-break: milestones after activities
    if (ia && ib && ia.itemType !== ib.itemType) return ia.itemType === "milestone" ? 1 : -1;
    return 0;
  });

  const isComplete  = (taskId) => itemLookup[taskId]?._complete || false;
  const canComplete = (taskId) => {
    const row = rows.find(r => r.taskId === taskId);
    return row?.assignments?.[loginCode] === "R" || member?.isPM;
  };

  const handleMarkDone = (taskId) => {
    const item  = itemLookup[taskId];
    const itype = item?.itemType || "activity";
    const sustainEnabled = sustainConfig && Object.values(sustainConfig.enabled || {}).some(Boolean);
    if (sustainEnabled && setSustainPrompt) {
      setSustainPrompt({ ...(item || { _id: taskId }), itemType: itype });
    } else {
      onMarkComplete(taskId, itype, true);
    }
  };

  return (
    <div style={{ padding:20 }}>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap" }}>
        {[["R","Responsible"],["A","Accountable"],["C","Consulted"],["I","Informed"]].map(([k,v])=>(
          <div key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.dim }}>
            <div style={{ width:22, height:22, borderRadius:4, background:RACI_COLORS[k]+"22", border:`1px solid ${RACI_COLORS[k]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:RACI_COLORS[k] }}>{k}</div>
            {v}
          </div>
        ))}
        <div style={{ fontSize:11, color:C.muted, marginLeft:"auto" }}>
          Sorted by due date · Your assignments highlighted
        </div>
      </div>

      {rows.length === 0 && (
        <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
          RACI matrix not yet populated. Complete Sheet 04 in the Personalisation Layer.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:C.surface2 }}>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:70 }}>ID</th>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:180 }}>Task</th>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:80 }}>Phase</th>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:90 }}>Due Date</th>
                {members.map(m=>(
                  <th key={m.loginCode} style={{ padding:"8px 8px", textAlign:"center", fontSize:9, fontWeight:700, color: m.loginCode===loginCode?C.accentL:C.muted, textTransform:"uppercase", letterSpacing:".3px", borderBottom:`1px solid ${C.border}`, minWidth:70 }}>
                    <div style={{ fontFamily:"monospace", fontSize:9, marginBottom:1 }}>{m.loginCode}</div>
                    <div style={{ fontSize:8, fontWeight:400 }}>{(m.name||"").split(" ")[0]}</div>
                  </th>
                ))}
                <th style={{ padding:"8px 10px", textAlign:"center", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, minWidth:110 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const item    = itemLookup[row.taskId];
                const done    = isComplete(row.taskId);
                const myAssig = row.assignments?.[loginCode];
                const isMine  = !!myAssig;
                const isMile  = item?.itemType === "milestone";
                const isOverdue = !done && item?.targetDate && new Date(item.targetDate) < new Date();

                return (
                  <tr key={row.taskId||i} style={{
                    borderBottom:`1px solid ${C.border}`,
                    background: done ? "rgba(58,224,162,0.04)" : isMine ? "rgba(46,125,82,0.06)" : i%2===0 ? C.surface : "transparent",
                    borderLeft: isMine ? `3px solid ${C.accentL}` : "3px solid transparent",
                  }}>

                    {/* ID */}
                    <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:10, color: isMile ? C.milestone : C.muted }}>
                      {row.taskId}
                    </td>

                    {/* Task name */}
                    <td style={{ padding:"7px 10px", color: done ? C.muted : C.sage, textDecoration: done ? "line-through" : "none" }}>
                      {isMile ? "◆ " : ""}{row.label || "—"}
                    </td>

                    {/* Phase */}
                    <td style={{ padding:"7px 10px", color:C.muted, fontSize:11 }}>{row.phase || "—"}</td>

                    {/* Due Date — read-only from Schedule */}
                    <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:10, color: isOverdue ? C.risk : C.dim }}>
                      {fmtDate(item?.targetDate)}
                    </td>

                    {/* RACI assignment cells — show ✓ across all columns when done */}
                    {members.map(m => {
                      const val = row.assignments?.[m.loginCode] || "";
                      const col = RACI_COLORS[val] || C.muted;
                      return (
                        <td key={m.loginCode} style={{ padding:"5px 8px", textAlign:"center" }}>
                          {val ? (
                            <div style={{ display:"inline-flex", width:24, height:24, borderRadius:4, alignItems:"center", justifyContent:"center", background: col+"22", border:`1px solid ${col}`, fontSize:10, fontWeight:700, color: done ? C.activity : col }}>
                              {done ? "✓" : val}
                            </div>
                          ) : <span style={{ color:C.border }}>—</span>}
                        </td>
                      );
                    })}

                    {/* Action */}
                    <td style={{ padding:"5px 10px", textAlign:"center" }}>
                      {done ? (
                        <button onClick={() => onMarkComplete(row.taskId, item?.itemType || "activity", false)}
                          style={{ padding:"3px 9px", background:"rgba(58,224,162,0.12)", border:`1px solid ${C.activity}`, borderRadius:4, color:C.activity, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          ↩ Undo
                        </button>
                      ) : canComplete(row.taskId) ? (
                        <button onClick={() => handleMarkDone(row.taskId)}
                          style={{ padding:"3px 9px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          ✓ Mark Done
                        </button>
                      ) : (
                        <span style={{ fontSize:10, color:C.muted }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
