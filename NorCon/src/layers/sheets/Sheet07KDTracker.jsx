import { useEffect, useMemo, useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({ c }) => <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{c}</div>;

function nextNumberedId(arr, prefix, width = 3) {
  const max = (arr || []).reduce((highest, item) => {
    const n = parseInt(String(item?._id || "").replace(prefix, ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width,"0")}`;
}
function makeDelId(arr) { return nextNumberedId(arr, "D-"); }
function makeKpiId(delId, arr) { return nextNumberedId(arr, `${delId}-KPI`, 2); }
function blankKpi(delId, arr) {
  return { _id: makeKpiId(delId, arr), name:"", baseline:"", target:"", unit:"", measurementFrequency:"Monthly", dataSource:"", owner:"" };
}
function blankDeliverable(arr) {
  return { _id: makeDelId(arr), name:"", linkedObjectiveId:"", notes:"", deadlineV1:"", kpis:[] };
}
function normaliseDeliverables(deliverables = []) {
  return deliverables.map(d => ({
    ...d,
    kpis: d.kpis && d.kpis.length > 0
      ? d.kpis
      : d.kpi
        ? [{ _id: `${d._id}-KPI01`, name: d.kpi, baseline:"", target:d.target||"", unit:"", measurementFrequency:"Monthly", dataSource:"", owner:"" }]
        : [],
    linkedObjectiveId: d.linkedObjectiveId || "",
  }));
}

// Flatten benefits → objectives into a lookup for the dropdown
function buildObjectiveLookup(charter) {
  const list = [];
  const benefits = charter?.benefits || [];
  benefits.forEach(b => {
    (b.objectives || []).forEach(o => {
      list.push({ value: o._id, label: `[${b._id}] ${b.name ? b.name + " → " : ""}${o.objective || o._id}` });
    });
  });
  return list;
}

export default function Sheet07KDTracker({ data, locked, allSheets, onUpdate }) {
  const charter = allSheets?.["01"]?.data?.charter || {};
  const objectiveLookup = useMemo(() => buildObjectiveLookup(charter), [charter]);

  const [deliverables, setDeliverables] = useState(() => {
    if (data.deliverables && data.deliverables.length > 0) {
      // Migrate old deliverables: convert kpi string → kpis array if needed
      return data.deliverables.map(d => ({
        ...d,
        kpis: d.kpis && d.kpis.length > 0
          ? d.kpis
          : d.kpi
            ? [{ _id: `${d._id}-KPI01`, name: d.kpi, baseline:"", target: d.target||"", unit:"", measurementFrequency:"Monthly", dataSource:"", owner:"" }]
            : [],
        linkedObjectiveId: d.linkedObjectiveId || "",
      }));
    }
    return [];
  });

  useEffect(() => {
    setDeliverables(normaliseDeliverables(data.deliverables || []));
  }, [data.deliverables]);

  const persist = (next) => {
    setDeliverables(next);
    onUpdate({ deliverables: next }, "in-progress");
  };

  // ── Deliverable CRUD ──────────────────────────────────────────────────────
  const addDeliverable = () => persist([...deliverables, blankDeliverable(deliverables)]);
  const removeDeliverable = (i) => persist(deliverables.filter((_, idx) => idx !== i));
  const updateDeliverable = (i, field, val) => persist(deliverables.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  // ── KPI CRUD (nested inside deliverable) ──────────────────────────────────
  const addKpi = (di) => {
    persist(deliverables.map((d, i) => {
      if (i !== di) return d;
      return { ...d, kpis: [...d.kpis, blankKpi(d._id, d.kpis)] };
    }));
  };
  const removeKpi = (di, ki) => {
    persist(deliverables.map((d, i) => {
      if (i !== di) return d;
      return { ...d, kpis: d.kpis.filter((_, j) => j !== ki) };
    }));
  };
  const updateKpi = (di, ki, field, val) => {
    persist(deliverables.map((d, i) => {
      if (i !== di) return d;
      return { ...d, kpis: d.kpis.map((k, j) => j === ki ? { ...k, [field]: val } : k) };
    }));
  };

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ fontSize:12, color:C.dim, marginBottom:16, lineHeight:1.6 }}>
        Define deliverables and their KPIs here. Link each deliverable to an objective from the Charter. Actual achievement values are recorded in L3 → Benefits & Value.
      </div>

      {deliverables.length === 0 && (
        <div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>No deliverables yet. Add one below.</div>
      )}

      {deliverables.map((d, di) => (
        <div key={d._id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accentL}`, borderRadius:8, padding:"14px 16px", marginBottom:12 }}>

          {/* Deliverable header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, fontWeight:700 }}>{d._id}</span>
            {!locked && (
              <button onClick={() => removeDeliverable(di)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:13 }}>✕</button>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Lbl c="Deliverable Name"/>
              <input style={inp} value={d.name||""} disabled={locked} onChange={e => updateDeliverable(di, "name", e.target.value)} placeholder="What will be produced?"/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <Lbl c="Linked Objective"/>
              {objectiveLookup.length > 0
                ? (
                  <select style={inp} value={d.linkedObjectiveId||""} disabled={locked} onChange={e => updateDeliverable(di, "linkedObjectiveId", e.target.value)}>
                    <option value="">— Not linked to an objective —</option>
                    {objectiveLookup.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ ...inp, color:C.muted, fontSize:11 }}>Define benefits and objectives in Sheet 01 (Charter) first.</div>
                )
              }
            </div>
            <div>
              <Lbl c="Deadline"/>
              <input style={inp} type="date" value={d.deadlineV1||""} disabled={locked} onChange={e => updateDeliverable(di, "deadlineV1", e.target.value)}/>
            </div>
            <div>
              <Lbl c="Notes"/>
              <input style={inp} value={d.notes||""} disabled={locked} onChange={e => updateDeliverable(di, "notes", e.target.value)} placeholder="Any notes"/>
            </div>
          </div>

          {/* KPIs nested inside deliverable */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:10 }}>
              KPIs — how this deliverable will be measured
            </div>

            {d.kpis.length === 0 && (
              <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:8 }}>No KPIs defined for this deliverable.</div>
            )}

            {d.kpis.map((k, ki) => (
              <div key={k._id} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:C.dim }}>{k._id}</span>
                  {!locked && (
                    <button onClick={() => removeKpi(di, ki)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 80px", gap:8 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <Lbl c="KPI Name / Metric"/>
                    <input style={inp} value={k.name||""} disabled={locked} onChange={e => updateKpi(di, ki, "name", e.target.value)} placeholder="e.g. Number of participants, % completion rate"/>
                  </div>
                  <div>
                    <Lbl c="Baseline"/>
                    <input style={inp} value={k.baseline||""} disabled={locked} onChange={e => updateKpi(di, ki, "baseline", e.target.value)} placeholder="Starting value"/>
                  </div>
                  <div>
                    <Lbl c="Target"/>
                    <input style={inp} value={k.target||""} disabled={locked} onChange={e => updateKpi(di, ki, "target", e.target.value)} placeholder="e.g. 100"/>
                  </div>
                  <div>
                    <Lbl c="Unit"/>
                    <input style={inp} value={k.unit||""} disabled={locked} onChange={e => updateKpi(di, ki, "unit", e.target.value)} placeholder="%, #, £"/>
                  </div>
                  <div>
                    <Lbl c="Frequency"/>
                    <select style={inp} value={k.measurementFrequency||"Monthly"} disabled={locked} onChange={e => updateKpi(di, ki, "measurementFrequency", e.target.value)}>
                      {["Weekly","Monthly","Quarterly","Per Milestone","At Closure"].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="Data Source"/>
                    <input style={inp} value={k.dataSource||""} disabled={locked} onChange={e => updateKpi(di, ki, "dataSource", e.target.value)} placeholder="e.g. Survey, attendance log"/>
                  </div>
                  <div style={{ gridColumn:"span 2" }}>
                    <Lbl c="KPI Owner"/>
                    <input style={inp} value={k.owner||""} disabled={locked} onChange={e => updateKpi(di, ki, "owner", e.target.value)} placeholder="Who measures and reports this?"/>
                  </div>
                </div>
              </div>
            ))}

            {!locked && (
              <button onClick={() => addKpi(di)} style={{ padding:"5px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer", width:"100%", marginTop:4 }}>
                + Add KPI to {d.name || d._id}
              </button>
            )}
          </div>
        </div>
      ))}

      {!locked && (
        <button onClick={addDeliverable} style={{ padding:"7px 14px", background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:4 }}>
          + Add Deliverable
        </button>
      )}

      <div style={{ marginTop:16, padding:"10px 14px", background:C.surface2, borderRadius:6, fontSize:11, color:C.muted }}>
        💡 Actual values and KPI achievement tracking are available in L3 → Benefits &amp; Value.
      </div>
    </div>
  );
}
