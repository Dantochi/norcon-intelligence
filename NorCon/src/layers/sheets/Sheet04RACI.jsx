import { useState, useEffect } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8",
  dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};
const RACI_COLORS = { R:C.risk, A:C.milestone, C:"#3a9ce0", I:"#9c6ee0" };
const RACI_OPTS   = ["","R","A","C","I"];

function suggestRaci(role, taskType) {
  const lower = (role||"").toLowerCase();
  if (lower.includes("project manager"))             return "A";
  if (lower.includes("assistant project manager"))   return "C";
  if (lower.includes("sponsor"))                     return "I";
  if (lower.includes("risk") && taskType==="risk")   return "R";
  if (lower.includes("comms") || lower.includes("communications")) return "R";
  if (lower.includes("scheduler"))                   return "R";
  if (lower.includes("controller"))                  return "C";
  return "I";
}

function EditableCell({ value, onChange, disabled }) {
  const [editing, setEditing] = useState(false);
  const [custom,  setCustom]  = useState("");

  if (editing) {
    return (
      <input autoFocus value={custom}
        onChange={e=>setCustom(e.target.value)}
        onBlur={()=>{ onChange(custom||value); setEditing(false); }}
        onKeyDown={e=>{
          if(e.key==="Enter"){ onChange(custom||value); setEditing(false); }
          if(e.key==="Escape") setEditing(false);
        }}
        style={{ width:52, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4,
          color:C.sage, fontSize:11, fontWeight:700, padding:"3px 4px", outline:"none", textAlign:"center" }}/>
    );
  }

  const col = RACI_COLORS[value] || C.muted;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <select value={value||""} disabled={disabled} onChange={e=>onChange(e.target.value)}
        style={{ background:value?col+"22":"transparent", border:`1px solid ${value?col:C.border}`,
          borderRadius:4, color:value?col:C.muted, fontSize:11, fontWeight:700,
          padding:"3px 4px", outline:"none", cursor:disabled?"not-allowed":"pointer",
          width:52, textAlign:"center" }}>
        {RACI_OPTS.map(o=>(
          <option key={o} value={o} style={{ background:C.surface2, color:C.sage }}>{o||"—"}</option>
        ))}
      </select>
      {!disabled && (
        <button onClick={()=>{ setEditing(true); setCustom(value||""); }}
          style={{ fontSize:9, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:0 }}>
          abc
        </button>
      )}
    </div>
  );
}

export default function Sheet04RACI({ data, locked, loginCodes, allSheets, onUpdate }) {
  const scheduleData = allSheets?.["03"]?.data || {};
  const activities   = scheduleData.activities || [];
  const milestones   = scheduleData.milestones || [];

  // All named+roled team members available as potential columns
  const allMembers = loginCodes.filter(lc => lc.name && lc.role);

  // ── Column visibility state ────────────────────────────────────────────────
  // Persisted in data.activeColumns as an array of loginCodes.
  // Default: all members visible. PM can toggle any in or out.
  const [activeColumns, setActiveColumns] = useState(() =>
    data.activeColumns || allMembers.map(m => m.loginCode)
  );

  // Sync when new members are added externally (e.g. via wizard or Team sheet)
  useEffect(() => {
    const newCodes = allMembers.map(m => m.loginCode).filter(c => !activeColumns.includes(c));
    if (newCodes.length > 0) {
      setActiveColumns(prev => [...prev, ...newCodes]);
    }
  }, [allMembers.length]);

  // Members currently shown as matrix columns
  const visibleMembers = allMembers.filter(m => activeColumns.includes(m.loginCode));

  const toggleColumn = (loginCode) => {
    const next = activeColumns.includes(loginCode)
      ? activeColumns.filter(c => c !== loginCode)
      : [...activeColumns, loginCode];
    setActiveColumns(next);
    onUpdate({ raciRows:matrix, customRows, activeColumns:next }, "in-progress");
  };

  // ── Matrix build ───────────────────────────────────────────────────────────
  const buildAutoMatrix = () => {
    const allTasks = [
      ...activities.map(a => ({ id:a._id, label:a.name||a._id, phase:a.phase, type:"activity", suggestedResponsible:a.responsible })),
      ...milestones.map(m => ({ id:m._id, label:m.name||m._id, phase:m.phase, type:"milestone", suggestedResponsible:"Project Manager" })),
    ];
    return allTasks.map(task => {
      const assignments = {};
      allMembers.forEach(m => {
        if (m.role === "Project Manager") {
          assignments[m.loginCode] = task.type === "milestone" ? "A" : "C";
        } else if (task.suggestedResponsible && (m.role === task.suggestedResponsible || m.deliveryRole === task.suggestedResponsible)) {
          assignments[m.loginCode] = "R";
        } else {
          assignments[m.loginCode] = suggestRaci(m.role, task.type);
        }
      });
      return { taskId:task.id, label:task.label, phase:task.phase, type:task.type, assignments };
    });
  };

  const [matrix,     setMatrix]     = useState(() => data.raciRows?.length > 0 ? data.raciRows : buildAutoMatrix());
  const [customRows, setCustomRows] = useState(data.customRows || []);

  useEffect(() => {
    setActiveColumns(data.activeColumns || allMembers.map(m => m.loginCode));
    setMatrix(data.raciRows?.length > 0 ? data.raciRows : buildAutoMatrix());
    setCustomRows(data.customRows || []);
  }, [data.activeColumns, data.raciRows, data.customRows, activities.length, milestones.length, allMembers.length]);

  const save = (mat, cust, cols) => {
    onUpdate({ raciRows:mat, customRows:cust, activeColumns:cols??activeColumns }, "in-progress");
  };

  // Auto-sync when schedule data arrives but matrix is still empty
  const scheduleKey = `${activities.length}_${milestones.length}_${allMembers.map(m=>m.name).join(",")}`;
  useEffect(() => {
    const built = buildAutoMatrix();
    if (built.length > 0 && matrix.length === 0) {
      setMatrix(built);
      save(built, customRows);
    }
  }, [scheduleKey]);

  const setCell = (rowIdx, code, value) => {
    const isCustom = rowIdx >= matrix.length;
    if (isCustom) {
      const next = customRows.map((r,i) => i===(rowIdx-matrix.length) ? {...r,assignments:{...r.assignments,[code]:value}} : r);
      setCustomRows(next); save(matrix, next);
    } else {
      const next = matrix.map((r,i) => i===rowIdx ? {...r,assignments:{...r.assignments,[code]:value}} : r);
      setMatrix(next); save(next, customRows);
    }
  };

  const updateRowField = (rowIdx, field, value) => {
    const isCustom = rowIdx >= matrix.length;
    if (isCustom) {
      const next = customRows.map((r,i) => i===(rowIdx-matrix.length) ? {...r,[field]:value} : r);
      setCustomRows(next); save(matrix, next);
    } else {
      const next = matrix.map((r,i) => i===rowIdx ? {...r,[field]:value} : r);
      setMatrix(next); save(next, customRows);
    }
  };

  const addRow = () => {
    const next = [...customRows, { taskId:`TASK-${Date.now()}`, label:"", phase:"", type:"activity", assignments:{} }];
    setCustomRows(next); save(matrix, next);
  };

  const removeRow = (rowIdx) => {
    const isCustom = rowIdx >= matrix.length;
    if (isCustom) {
      const next = customRows.filter((_,i) => i !== (rowIdx-matrix.length));
      setCustomRows(next); save(matrix, next);
    } else {
      const next = matrix.filter((_,i) => i !== rowIdx);
      setMatrix(next); save(next, customRows);
    }
  };

  const regenMatrix = () => {
    const fresh = buildAutoMatrix();
    setMatrix(fresh);
    save(fresh, customRows);
  };

  const allRows = [...matrix, ...customRows];

  return (
    <div style={{ maxWidth:"100%" }}>

      {/* ── Column manager ────────────────────────────────────────────────── */}
      {allMembers.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7,
          padding:"10px 14px", marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
            letterSpacing:".4px", marginBottom:8 }}>
            Visible Columns — {visibleMembers.length} of {allMembers.length} team members shown
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {allMembers.map(m => {
              const active = activeColumns.includes(m.loginCode);
              return (
                <button key={m.loginCode}
                  onClick={()=>{ if(!locked) toggleColumn(m.loginCode); }}
                  disabled={locked}
                  style={{
                    padding:"5px 10px", borderRadius:16, fontSize:11,
                    border:`1.5px solid ${active ? C.accentL : C.border}`,
                    background: active ? C.accentL+"22" : "none",
                    color: active ? C.accentL : C.muted,
                    cursor: locked ? "not-allowed" : "pointer",
                    display:"flex", alignItems:"center", gap:5, transition:"all .15s",
                  }}>
                  <span style={{ fontFamily:"monospace", fontSize:9 }}>{m.loginCode}</span>
                  <span>{(m.name||"").split(" ")[0] || m.role}</span>
                  <span style={{ fontSize:10, opacity:0.6 }}>{active ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>
          {visibleMembers.length === 0 && (
            <div style={{ fontSize:11, color:C.risk, marginTop:6 }}>
              No columns selected — select at least one team member to show in the matrix.
            </div>
          )}
        </div>
      )}

      {/* ── Legend + controls ─────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14, flexWrap:"wrap" }}>
        {[["R","Responsible"],["A","Accountable"],["C","Consulted"],["I","Informed"]].map(([k,v]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.dim }}>
            <div style={{ width:22, height:22, borderRadius:4, background:RACI_COLORS[k]+"22",
              border:`1px solid ${RACI_COLORS[k]}`, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:10, fontWeight:700, color:RACI_COLORS[k] }}>
              {k}
            </div>
            {v}
          </div>
        ))}
        {!locked && (
          <button onClick={regenMatrix}
            style={{ marginLeft:"auto", padding:"5px 12px", background:"none",
              border:`1px solid ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer" }}>
            ↺ Re-sync from Schedule
          </button>
        )}
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {allMembers.length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7,
          padding:"12px 16px", marginBottom:12, fontSize:12, color:C.muted }}>
          ⚠️ Complete the Team sheet to populate team member columns.
        </div>
      )}
      {allRows.length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7,
          padding:"12px 16px", marginBottom:12, fontSize:12, color:C.muted }}>
          ⚠️ Complete the Schedule sheet to auto-populate activity rows, or add rows manually below.
        </div>
      )}

      {/* ── Matrix table ──────────────────────────────────────────────────── */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:C.surface2 }}>
              <th style={{ ...thStyle, minWidth:70 }}>ID</th>
              <th style={{ ...thStyle, minWidth:180 }}>Task / Activity</th>
              <th style={{ ...thStyle, minWidth:80 }}>Phase</th>
              {visibleMembers.map(m => (
                <th key={m.loginCode} style={{ ...thStyle, minWidth:68 }}>
                  <div style={{ color:C.accentL, fontFamily:"monospace", fontSize:9, marginBottom:2 }}>{m.loginCode}</div>
                  <div style={{ fontSize:9, color:C.dim, fontWeight:400, whiteSpace:"nowrap",
                    overflow:"hidden", textOverflow:"ellipsis", maxWidth:64 }}>
                    {(m.name||"").split(" ")[0]}
                  </div>
                  <div style={{ fontSize:8, color:C.muted, fontWeight:400 }}>
                    {(m.role||"").replace("Project ","")}
                  </div>
                </th>
              ))}
              {!locked && <th style={{ ...thStyle, width:28 }}></th>}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, rowIdx) => (
              <tr key={row.taskId||rowIdx}
                style={{ borderBottom:`1px solid ${C.border}`, background:rowIdx%2===0?C.surface:"transparent" }}>
                <td style={{ padding:"5px 10px" }}>
                  <input value={row.taskId||""} disabled={locked}
                    onChange={e=>updateRowField(rowIdx,"taskId",e.target.value)}
                    style={{ background:"transparent", border:"none", color:C.muted,
                      fontSize:10, fontFamily:"monospace", outline:"none", width:64 }}/>
                </td>
                <td style={{ padding:"5px 10px" }}>
                  <input value={row.label||""} disabled={locked}
                    onChange={e=>updateRowField(rowIdx,"label",e.target.value)}
                    style={{ background:"transparent", border:"none", color:C.sage,
                      fontSize:12, outline:"none", width:"100%", fontFamily:"inherit" }}
                    placeholder="Enter task..."/>
                </td>
                <td style={{ padding:"5px 10px" }}>
                  <input value={row.phase||""} disabled={locked}
                    onChange={e=>updateRowField(rowIdx,"phase",e.target.value)}
                    style={{ background:"transparent", border:"none", color:C.dim,
                      fontSize:11, outline:"none", width:90, fontFamily:"inherit" }}
                    placeholder="Phase..."/>
                </td>
                {visibleMembers.map(m => (
                  <td key={m.loginCode} style={{ padding:"4px 6px", textAlign:"center" }}>
                    <EditableCell
                      value={row.assignments?.[m.loginCode]||""}
                      disabled={locked}
                      onChange={v=>setCell(rowIdx,m.loginCode,v)}/>
                  </td>
                ))}
                {!locked && (
                  <td style={{ padding:"4px 6px", textAlign:"center" }}>
                    <button onClick={()=>removeRow(rowIdx)}
                      style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:13 }}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked && (
        <button onClick={addRow}
          style={{ padding:"7px 14px", background:"none", border:`1px dashed ${C.border}`,
            borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:8 }}>
          + Add Row
        </button>
      )}
    </div>
  );
}

const thStyle = {
  padding:"7px 8px", textAlign:"center", fontWeight:700, fontSize:9,
  color:"#5a7a66", textTransform:"uppercase", letterSpacing:".3px",
  borderBottom:"1px solid #1F4D34",
};
