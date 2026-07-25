import { useState, useMemo, useCallback } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const TABS = [
  { id:"overview",  label:"Benefits & Objectives", icon:"🎯" },
  { id:"tracker",   label:"KD Tracker",            icon:"📊" },
  { id:"knowledge", label:"Lessons Learned",       icon:"📚" },
];

// ── Shared utilities ─────────────────────────────────────────────────────────
function ragColor(pct) {
  if (pct === null || pct === undefined) return C.muted;
  if (pct >= 85)  return C.activity;
  if (pct >= 50)  return C.milestone;
  return C.risk;
}

function kpiPct(kpi) {
  if (!kpi.target || kpi.actual === undefined || kpi.actual === "") return null;
  const t = parseFloat(kpi.target);
  const a = parseFloat(kpi.actual);
  if (isNaN(t) || isNaN(a) || t === 0) return null;
  return Math.min(100, Math.round((a / t) * 100));
}

function Badge({ label, color }) {
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:12,
      background: color + "22", color, border:`1px solid ${color}44`, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
      letterSpacing:".5px", borderBottom:`1px solid ${C.border}`, paddingBottom:6, marginBottom:12 }}>
      {title}
    </div>
  );
}

// ── BRI: average KPI achievement across all deliverables under a benefit ──────
function calcBRI(benefit, deliverables) {
  const objIds  = (benefit.objectives || []).map(o => o._id);
  const linked  = deliverables.filter(d => objIds.includes(d.linkedObjectiveId));
  const allKpis = linked.flatMap(d => d.kpis || []);
  const scored  = allKpis.map(kpiPct).filter(p => p !== null);
  if (!scored.length) return null;
  return Math.round(scored.reduce((s, p) => s + p, 0) / scored.length);
}

// ── Overview: full value chain read-only ─────────────────────────────────────
function BenefitsOverview({ benefits, deliverables }) {
  const delByObj = useMemo(() => {
    const map = {};
    deliverables.forEach(d => {
      if (!d.linkedObjectiveId) return;
      if (!map[d.linkedObjectiveId]) map[d.linkedObjectiveId] = [];
      map[d.linkedObjectiveId].push(d);
    });
    return map;
  }, [deliverables]);

  const unlinked = useMemo(() =>
    deliverables.filter(d => !d.linkedObjectiveId || d.linkedObjectiveId === ""),
  [deliverables]);

  if (!benefits.length) {
    return (
      <div style={{ padding:"48px 20px", textAlign:"center", color:C.muted, fontSize:13 }}>
        No benefits defined yet.{" "}
        <span style={{ color:C.accentL }}>Go to L2 → Sheet 01 (Charter)</span>{" "}
        to define project benefits and objectives.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:12, color:C.dim, marginBottom:16, lineHeight:1.6 }}>
        Full value chain: Benefits → Objectives → Deliverables → KPIs.
        The BRI (Benefit Realisation Index) is the average KPI achievement across all linked deliverables.
      </div>

      {benefits.map(b => {
        const bri = calcBRI(b, deliverables);
        const briCol = ragColor(bri);

        return (
          <div key={b._id} style={{ background:C.surface, border:`1px solid ${C.border}`,
            borderLeft:`4px solid ${C.milestone}`, borderRadius:8, padding:"14px 16px", marginBottom:16 }}>

            {/* Benefit header */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:5 }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:C.milestone, fontWeight:700 }}>{b._id}</span>
                  <Badge label={b.category || "Strategic"} color={C.milestone}/>
                  {bri !== null && <Badge label={`BRI ${bri}%`} color={briCol}/>}
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:C.sage, marginBottom:4 }}>{b.name || "Unnamed benefit"}</div>
                {b.description && <div style={{ fontSize:12, color:C.dim, lineHeight:1.5 }}>{b.description}</div>}
              </div>
              <div style={{ flexShrink:0, textAlign:"right", fontSize:11, color:C.muted, lineHeight:1.8 }}>
                {b.owner     && <div>Owner: {b.owner}</div>}
                {b.targetDate && <div>Target: {b.targetDate}</div>}
              </div>
            </div>

            {/* BRI bar */}
            {bri !== null && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginBottom:3 }}>
                  <span>Benefit Realisation Index</span><span>{bri}%</span>
                </div>
                <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${bri}%`, height:"100%", background:briCol, borderRadius:3, transition:"width .4s" }}/>
                </div>
              </div>
            )}

            {/* Objectives */}
            {!(b.objectives || []).length
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No objectives defined for this benefit.</div>
              : (b.objectives || []).map(o => {
                  const oDels = delByObj[o._id] || [];
                  const oPcts = oDels.flatMap(d => (d.kpis||[]).map(kpiPct)).filter(p => p !== null);
                  const oPct  = oPcts.length ? Math.round(oPcts.reduce((s,p)=>s+p,0)/oPcts.length) : null;

                  return (
                    <div key={o._id} style={{ background:C.surface2, border:`1px solid ${C.border}`,
                      borderLeft:`3px solid ${C.accentL}`, borderRadius:6, padding:"10px 12px", marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                        <span style={{ fontFamily:"monospace", fontSize:10, color:C.accentL }}>{o._id}</span>
                        {o.targetDate && <span style={{ fontSize:10, color:C.muted }}>Due: {o.targetDate}</span>}
                        {oPct !== null && <Badge label={`${oPct}%`} color={ragColor(oPct)}/>}
                      </div>
                      <div style={{ fontSize:13, color:C.sage, marginBottom:3 }}>{o.objective || "—"}</div>
                      {o.successCriterion && <div style={{ fontSize:11, color:C.dim }}>Success criterion: {o.successCriterion}</div>}

                      {/* Deliverables under this objective */}
                      {oDels.length > 0 && (
                        <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}33` }}>
                          <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
                            letterSpacing:".4px", marginBottom:6 }}>Deliverables</div>
                          {oDels.map(d => {
                            const dPcts  = (d.kpis||[]).map(kpiPct).filter(p=>p!==null);
                            const dPct   = dPcts.length ? Math.round(dPcts.reduce((s,p)=>s+p,0)/dPcts.length) : null;
                            return (
                              <div key={d._id} style={{ display:"flex", alignItems:"center", gap:8,
                                padding:"4px 0", borderBottom:`1px solid ${C.border}22` }}>
                                <span style={{ fontFamily:"monospace", fontSize:10, color:C.accentL }}>{d._id}</span>
                                <span style={{ fontSize:11, color:C.dim, flex:1 }}>{d.name || "—"}</span>
                                <span style={{ fontSize:10, color:C.muted }}>{(d.kpis||[]).length} KPI{(d.kpis||[]).length!==1?"s":""}</span>
                                {dPct !== null && <Badge label={`${dPct}%`} color={ragColor(dPct)}/>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {oDels.length === 0 && (
                        <div style={{ marginTop:6, fontSize:11, color:C.muted, fontStyle:"italic" }}>
                          No deliverables linked to this objective yet. Link them in L2 → Sheet 07.
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </div>
        );
      })}

      {/* Unlinked deliverables */}
      {unlinked.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 16px", marginTop:8 }}>
          <SectionHeader title={`Deliverables not yet linked to an objective (${unlinked.length})`}/>
          {unlinked.map(d => (
            <div key={d._id} style={{ display:"flex", gap:8, padding:"4px 0", borderBottom:`1px solid ${C.border}22`, alignItems:"center" }}>
              <span style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{d._id}</span>
              <span style={{ fontSize:12, color:C.dim, flex:1 }}>{d.name||"—"}</span>
              <span style={{ fontSize:10, color:C.muted }}>Link in L2 → Sheet 07</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KD Tracker ────────────────────────────────────────────────────────────────
function KDTracker({ deliverables, benefits, canEdit, onUpdateActual }) {
  const objLookup = useMemo(() => {
    const map = {};
    benefits.forEach(b => {
      (b.objectives||[]).forEach(o => {
        map[o._id] = { benefitId:b._id, benefitName:b.name, objText:o.objective };
      });
    });
    return map;
  }, [benefits]);

  if (!deliverables.length) {
    return (
      <div style={{ padding:"48px 20px", textAlign:"center", color:C.muted, fontSize:13 }}>
        No deliverables configured.{" "}
        <span style={{ color:C.accentL }}>Go to L2 → Sheet 07 (KD Tracker)</span>{" "}
        to define deliverables and their KPIs.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:12, color:C.dim, marginBottom:16, lineHeight:1.6 }}>
        Log actual values against KPI targets. Achievement % is calculated automatically. RAG status updates in real time.
      </div>

      {deliverables.map((d, di) => {
        const obj     = objLookup[d.linkedObjectiveId];
        const kpis    = d.kpis || [];
        const pcts    = kpis.map(kpiPct).filter(p => p !== null);
        const overall = pcts.length ? Math.round(pcts.reduce((s,p)=>s+p,0)/pcts.length) : null;
        const overCol = ragColor(overall);

        return (
          <div key={d._id} style={{ background:C.surface, border:`1px solid ${C.border}`,
            borderLeft:`3px solid ${overCol}`, borderRadius:8, padding:"14px 16px", marginBottom:12 }}>

            {/* Deliverable header */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, fontWeight:700 }}>{d._id}</span>
                  {overall !== null && <Badge label={`${overall}%`} color={overCol}/>}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:C.sage }}>{d.name || "—"}</div>
                {obj && (
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                    {obj.benefitId} → {obj.objText || "Objective"}
                  </div>
                )}
              </div>
              {d.deadlineV1 && (
                <div style={{ fontSize:11, color:C.muted, flexShrink:0 }}>Due: {d.deadlineV1}</div>
              )}
            </div>

            {/* KPI rows */}
            {!kpis.length
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No KPIs defined. Add them in L2 → Sheet 07.</div>
              : (
                <div style={{ background:C.surface2, borderRadius:6, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                  {/* Header row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1.8fr 90px 90px 110px 90px 110px 100px",
                    padding:"6px 12px", borderBottom:`1px solid ${C.border}` }}>
                    {["KPI","Baseline","Target","Actual","Achievement","Frequency","Owner"].map(h => (
                      <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
                    ))}
                  </div>
                  {/* Data rows */}
                  {kpis.map((k, ki) => {
                    const pct = kpiPct(k);
                    const col = ragColor(pct);
                    return (
                      <div key={k._id} style={{ display:"grid", gridTemplateColumns:"1.8fr 90px 90px 110px 90px 110px 100px",
                        padding:"8px 12px", borderBottom:`1px solid ${C.border}22`, alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:11, color:C.sage }}>{k.name || "—"}</div>
                          {k.dataSource && <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>Source: {k.dataSource}</div>}
                        </div>
                        <div style={{ fontSize:11, color:C.muted }}>
                          {k.baseline !== "" && k.baseline !== undefined ? `${k.baseline}${k.unit||""}` : "—"}
                        </div>
                        <div style={{ fontSize:11, color:C.dim }}>
                          {k.target ? `${k.target}${k.unit||""}` : "—"}
                        </div>
                        <div>
                          {canEdit
                            ? <input
                                value={k.actual || ""}
                                placeholder="Enter"
                                onChange={e => onUpdateActual(di, ki, e.target.value)}
                                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4,
                                  color:C.sage, fontSize:11, padding:"4px 7px", outline:"none",
                                  fontFamily:"inherit", width:80, boxSizing:"border-box" }}
                              />
                            : <span style={{ fontSize:11, color:C.dim }}>
                                {k.actual !== undefined && k.actual !== "" ? `${k.actual}${k.unit||""}` : "—"}
                              </span>
                          }
                        </div>
                        <div>
                          {pct !== null
                            ? <Badge label={`${pct}%`} color={col}/>
                            : <span style={{ fontSize:11, color:C.muted }}>—</span>
                          }
                        </div>
                        <div style={{ fontSize:10, color:C.muted }}>{k.measurementFrequency || "—"}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{k.owner || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        );
      })}
    </div>
  );
}

// ── Lessons Learned (NBRF v1 §22) ────────────────────────────────────────────
function LessonsLearned({ benefits, canEdit, onUpdateLesson }) {
  if (!benefits.length) {
    return (
      <div style={{ padding:"48px 20px", textAlign:"center", color:C.muted, fontSize:13 }}>
        No benefits defined. Define benefits in L2 → Sheet 01 (Charter) first.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:12, color:C.dim, marginBottom:16, lineHeight:1.6 }}>
        Record lessons learned per benefit. These are captured for knowledge transfer at project closure
        and carried forward to future projects — aligned to NBRVTF and NBRF v1 §22.
      </div>
      {benefits.map((b, bi) => (
        <div key={b._id} style={{ background:C.surface, border:`1px solid ${C.border}`,
          borderLeft:`4px solid ${C.accentL}`, borderRadius:8, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:C.milestone, fontWeight:700 }}>{b._id}</span>
            <span style={{ fontSize:13, fontWeight:600, color:C.sage }}>{b.name || "—"}</span>
            {b.category && <Badge label={b.category} color={C.accentL}/>}
          </div>

          <div style={{ marginBottom: b.sustainmentPlan ? 10 : 0 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
              letterSpacing:".4px", marginBottom:5 }}>Lessons Learned & Knowledge Assets</div>
            {canEdit
              ? <textarea
                  value={b.lessonsLearned || ""}
                  placeholder="What worked well? What would you do differently? What should future projects know about realising this benefit?"
                  onChange={e => onUpdateLesson(bi, e.target.value)}
                  style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5,
                    color:C.sage, fontSize:12, padding:"8px 10px", outline:"none", fontFamily:"inherit",
                    boxSizing:"border-box", resize:"vertical", minHeight:80, lineHeight:1.5 }}
                />
              : <div style={{ fontSize:12, color: b.lessonsLearned ? C.dim : C.muted, lineHeight:1.6,
                  fontStyle: b.lessonsLearned ? "normal" : "italic", whiteSpace:"pre-wrap" }}>
                  {b.lessonsLearned || "No lessons recorded yet."}
                </div>
            }
          </div>

          {b.sustainmentPlan && (
            <div style={{ padding:"8px 10px", background:C.surface2, borderRadius:5, fontSize:11, color:C.dim, marginTop:8 }}>
              <span style={{ color:C.muted, fontWeight:700 }}>Sustainment plan: </span>{b.sustainmentPlan}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function L3Benefits({ state, deliverables, member, onStateChange }) {
  const [activeTab, setActiveTab] = useState("overview");

  const canEdit = member?.isPM;
  const charter = state?.l2?.sheets?.["01"]?.data?.charter || {};
  const benefits = charter.benefits || [];

  // ── Update a KPI actual value in sheet 07 ────────────────────────────────
  const onUpdateActual = useCallback((di, ki, val) => {
    onStateChange(prev => {
      const d07  = prev.l2.sheets["07"]?.data || {};
      const dels = (d07.deliverables || []).map((d, i) => {
        if (i !== di) return d;
        const kpis = (d.kpis || []).map((k, j) => j === ki ? { ...k, actual: val } : k);
        return { ...d, kpis };
      });
      return {
        ...prev,
        l2: {
          ...prev.l2,
          sheets: {
            ...prev.l2.sheets,
            "07": { ...prev.l2.sheets["07"], data: { ...d07, deliverables: dels } },
          },
        },
      };
    });
  }, [onStateChange]);

  // ── Update lessons learned on a benefit — stored back in charter ─────────
  const onUpdateLesson = useCallback((bi, val) => {
    onStateChange(prev => {
      const d01    = prev.l2.sheets["01"]?.data || {};
      const ch     = d01.charter || {};
      const bens   = (ch.benefits || []).map((b, i) => i === bi ? { ...b, lessonsLearned: val } : b);
      return {
        ...prev,
        l2: {
          ...prev.l2,
          sheets: {
            ...prev.l2.sheets,
            "01": { ...prev.l2.sheets["01"], data: { ...d01, charter: { ...ch, benefits: bens } } },
          },
        },
      };
    });
  }, [onStateChange]);

  // ── Summary counts for sub-nav pills ─────────────────────────────────────
  const totalKpis    = deliverables.reduce((s, d) => s + (d.kpis||[]).length, 0);
  const scoredKpis   = deliverables.reduce((s, d) => s + (d.kpis||[]).filter(k => kpiPct(k) !== null).length, 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* Sub-nav */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", padding:"0 20px", flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"0 14px", height:38,
              fontSize:11, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab === t.id ? C.accentL : "transparent"}`,
              color: activeTab === t.id ? C.sage : C.muted,
              cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center", fontSize:10, color:C.muted }}>
          <span>{benefits.length} benefit{benefits.length !== 1 ? "s" : ""}</span>
          <span>{deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""}</span>
          <span>{scoredKpis}/{totalKpis} KPIs tracked</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
        {activeTab === "overview" && (
          <BenefitsOverview benefits={benefits} deliverables={deliverables} />
        )}
        {activeTab === "tracker" && (
          <KDTracker
            deliverables={deliverables}
            benefits={benefits}
            canEdit={canEdit}
            onUpdateActual={onUpdateActual}
          />
        )}
        {activeTab === "knowledge" && (
          <LessonsLearned
            benefits={benefits}
            canEdit={canEdit}
            onUpdateLesson={onUpdateLesson}
          />
        )}
      </div>
    </div>
  );
}
