import { useEffect, useMemo, useState } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
  purple:"#9c6ee0",
};
const inp = {
  background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5,
  color:C.sage, fontSize:11, padding:"5px 8px", outline:"none",
  boxSizing:"border-box", fontFamily:"inherit", width:"100%",
};
const Lbl = ({ c, hint }) => (
  <div style={{ marginBottom:3 }}>
    <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{c}</div>
    {hint && <div style={{ fontSize:9, color:C.muted, fontStyle:"italic", marginTop:1, lineHeight:1.3 }}>{hint}</div>}
  </div>
);

// ── PIIE framework constants ──────────────────────────────────────────────────
const ANCHOR_QUESTIONS = {
  power:     "If this stakeholder decided to oppose or withdraw today, what would happen to the project?",
  interest:  "How much time and attention does this stakeholder voluntarily invest without being prompted?",
  influence: "Given their current disposition toward this project, how effectively could their reach benefit or threaten it?",
  ease:      "How likely is a productive, cooperative response if you reach out today?",
};

const PIIE_BANDS = {
  power:    [[9,"Very High","Can stop, fund, or fundamentally redirect the project"],[7,"High","Can significantly affect scope, timeline, or resources"],[5,"Medium","Can influence specific decisions or workstreams"],[3,"Low","Can slow progress but cannot stop the project"],[1,"Minimal","No meaningful formal authority"]],
  interest: [[9,"Very High","Actively monitoring, asking questions unprompted — personal stake in outcome"],[7,"High","Engaged when consulted, reads updates, attends key events voluntarily"],[5,"Medium","Generally aware, responds when contacted but does not initiate"],[3,"Low","Aware but largely indifferent"],[1,"Minimal","Unaware or does not consider themselves affected"]],
  influence:[[9,"Very High","National or sector-wide voice. Broadly supportive of the project"],[7,"High","Significant within specific industry or community"],[5,"Medium","Recognised within a particular organisation or professional network"],[3,"Low","Some peer-level influence, limited reach"],[1,"Minimal","Little to no external influence, or high reach but opposed"]],
  ease:     [[9,"Very High","Proactively available, existing relationship, highly receptive"],[7,"High","Responds reliably, minor logistical barriers, willing to engage"],[5,"Medium","Reachable but requires effort, some friction"],[3,"Low","Difficult to reach — geographic/cultural distance, unknown to team"],[1,"Very Low","Significant barriers — language, distance, gatekeepers, or hostility"]],
};

const EIGHT_SEGMENTS = [
  { power:"H", interest:"H", influence:"H", tag:"Champion",             apm:"Lead",               color:"#e0a23a" },
  { power:"H", interest:"H", influence:"L", tag:"Key Decision Maker",   apm:"Own",                color:"#e05c5c" },
  { power:"H", interest:"L", influence:"H", tag:"Silent Authority",      apm:"Endorse",            color:"#9c6ee0" },
  { power:"H", interest:"L", influence:"L", tag:"Gatekeeper",            apm:"Endorse / Follow",   color:"#5a7a66" },
  { power:"L", interest:"H", influence:"H", tag:"Amplifier",             apm:"Contribute",         color:"#3a9ce0" },
  { power:"L", interest:"H", influence:"L", tag:"Active Supporter",      apm:"Follow",             color:"#3ae0a2" },
  { power:"L", interest:"L", influence:"H", tag:"Peripheral Influencer", apm:"Observe / Contribute", color:"#8aac96" },
  { power:"L", interest:"L", influence:"L", tag:"Monitor",               apm:"Observe",            color:"#5a7a66" },
];

const APM_FREQ = {
  "Lead":               { high:"Weekly",    low:"Monthly"    },
  "Own":                { high:"Bi-weekly", low:"Monthly"    },
  "Contribute":         { high:"Monthly",   low:"Quarterly"  },
  "Endorse":            { high:"Milestone", low:"Milestone"  },
  "Endorse / Follow":   { high:"Monthly",   low:"Quarterly"  },
  "Follow":             { high:"Monthly",   low:"Quarterly"  },
  "Observe / Contribute":{ high:"Quarterly",low:"Quarterly"  },
  "Observe":            { high:"None",      low:"None"       },
};

const STATUSES = ["Identified","Engaged","Not Engaging","Disengaged"];
const STATUS_COLORS = { Identified:C.muted, Engaged:C.activity, "Not Engaging":C.milestone, Disengaged:C.risk };
const CATEGORIES = ["Professional Body","Education","Industry Partner","Community","Funder","Regulator","Media","End User","Government","Other"];
const FORMATS    = ["Email","Meeting","Video Call","Presentation","Report","Newsletter","Social Media","Letter","Site Visit"];

// ── Derived PIIE tag from scores ──────────────────────────────────────────────
function deriveTag(power, interest, influence) {
  const pH = (parseInt(power)||5)    >= 6;
  const iH = (parseInt(interest)||5) >= 6;
  const nH = (parseInt(influence)||5)>= 6;
  const seg = EIGHT_SEGMENTS.find(s =>
    s.power    === (pH?"H":"L") &&
    s.interest === (iH?"H":"L") &&
    s.influence=== (nH?"H":"L")
  );
  return seg || EIGHT_SEGMENTS[7];
}

// ── Priority score ────────────────────────────────────────────────────────────
function priorityScore(p, i, inf) {
  return ((parseInt(p)||5)*0.40 + (parseInt(i)||5)*0.35 + (parseInt(inf)||5)*0.25).toFixed(1);
}

function normaliseStakeholders(stakeholders = []) {
  return stakeholders.map(s => ({
    power:5, interest:5, influence:5, ease:5, status:"Identified",
    scoreHistory:[], statusHistory:[], ...s,
  }));
}

function nextStakeholderId(stakeholders) {
  const max = (stakeholders || []).reduce((highest, item) => {
    const n = parseInt(String(item?._id || "").replace("SH-", ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `SH-${String(max + 1).padStart(3,"0")}`;
}

// ── Derived frequency from APM level + ease ───────────────────────────────────
function derivedFrequency(apmLevel, ease) {
  const f = APM_FREQ[apmLevel];
  if (!f) return "";
  return (parseInt(ease)||5) >= 6 ? f.high : f.low;
}

// ── Band label for a score ────────────────────────────────────────────────────
function bandLabel(dim, score) {
  const bands = PIIE_BANDS[dim];
  for (const [min, label] of bands) {
    if ((parseInt(score)||5) >= min) return label;
  }
  return "Minimal";
}

// ── Slider with anchor question ───────────────────────────────────────────────
function PIIESlider({ dim, label, value, onChange, disabled }) {
  const [showHint, setShowHint] = useState(false);
  const band = bandLabel(dim, value);
  const dimColors = { power:C.risk, interest:C.milestone, influence:C.purple, ease:C.accentL };
  const col = dimColors[dim];
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{label}</div>
        <span style={{ fontSize:10, fontWeight:700, color:col }}>{value}/10</span>
        <span style={{ fontSize:9, padding:"1px 5px", borderRadius:8, background:col+"22", color:col, border:`1px solid ${col}44` }}>{band}</span>
        <button onClick={e=>{e.stopPropagation();setShowHint(h=>!h);}}
          style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:10 }}>
          {showHint ? "▲" : "?"}
        </button>
      </div>
      {showHint && (
        <div style={{ fontSize:9, color:C.dim, fontStyle:"italic", marginBottom:4, padding:"4px 6px",
          background:C.surface2, borderRadius:4, lineHeight:1.4 }}>
          {ANCHOR_QUESTIONS[dim]}
        </div>
      )}
      <input type="range" min="1" max="10" value={value||5} disabled={disabled}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ width:"100%", accentColor:col, cursor:disabled?"not-allowed":"pointer" }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sheet08 component
// ─────────────────────────────────────────────────────────────────────────────
export default function Sheet08Stakeholders({ data, locked, loginCodes, onUpdate }) {
  const [stakeholders, setStakeholders] = useState(() => normaliseStakeholders(data.stakeholders || []));
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // { idx, newStatus }
  const [statusReason, setStatusReason] = useState("");

  useEffect(() => {
    setStakeholders(normaliseStakeholders(data.stakeholders || []));
  }, [data.stakeholders]);

  const teamRoles = [...new Set([
    ...(loginCodes||[]).map(m=>m.name).filter(Boolean),
    "Project Manager","Project Sponsor",
  ])];

  const persist = (next) => {
    setStakeholders(next);
    const comms = next.filter(s => s.status === "Engaged").map(s => ({
      stakeholderName:s.name||"", category:s.category||"", contact:s.contact||"",
      format:s.commsFormat||"", frequency:s.commsFreq||derivedFrequency(deriveTag(s.power,s.interest,s.influence).apm, s.ease),
      keyContent:s.commsContent||"", nextDate:s.commsNextDate||"",
      status:"Active", owner:s.commsOwner||"",
      priorityScore:parseFloat(priorityScore(s.power,s.interest,s.influence)),
    }));
    onUpdate({ stakeholders:next, comms }, "in-progress");
  };

  const updateSH = (idx, field, value) => {
    persist(stakeholders.map((s,i) => {
      if (i !== idx) return s;
      const updated = { ...s, [field]:value };
      // Keep commPlan.nextContactDate in sync with commsNextDate
      if (field === "commsNextDate") {
        updated.commPlan = { ...(s.commPlan||{}), nextContactDate:value };
      }
      return updated;
    }));
  };

  // ── Status change with modal ──────────────────────────────────────────────
  const requestStatusChange = (idx, newStatus) => {
    setStatusModal({ idx, newStatus });
    setStatusReason("");
  };

  const confirmStatusChange = () => {
    if (!statusModal) return;
    const { idx, newStatus } = statusModal;
    const s    = stakeholders[idx];
    const today = new Date().toISOString().slice(0,10);
    const entry = { status:newStatus, date:today, by:loginCodes?.[0]?.loginCode||"PM", reason:statusReason };

    let commPlan = { ...(s.commPlan||{}) };
    if (newStatus === "Not Engaging" || newStatus === "Disengaged") {
      commPlan = { ...commPlan, suspended:true, suspendedDate:today };
    } else if (newStatus === "Engaged") {
      const seg  = deriveTag(s.power, s.interest, s.influence);
      const freq = derivedFrequency(seg.apm, s.ease);
      const wasLapsed = s.commPlan?.nextContactDate && new Date(s.commPlan.nextContactDate) < new Date();
      const nextDate  = wasLapsed
        ? new Date(Date.now() + 30*86400000).toISOString().slice(0,10)
        : (s.commPlan?.nextContactDate || "");
      commPlan = { ...commPlan, suspended:false, suspendedDate:null, frequency:freq, nextContactDate:nextDate };
    }

    persist(stakeholders.map((sh,i) => i === idx ? {
      ...sh,
      status:        newStatus,
      commPlan,
      statusHistory: [...(sh.statusHistory||[]), entry],
    } : sh));

    setStatusModal(null);
    setStatusReason("");
  };

  // ── Score review ──────────────────────────────────────────────────────────
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote]   = useState("");

  const submitReview = () => {
    if (!reviewModal) return;
    const { idx, p, i, inf, e } = reviewModal;
    const today = new Date().toISOString().slice(0,10);
    const entry = { date:today, by:loginCodes?.[0]?.loginCode||"PM",
      power:p, interest:i, influence:inf, ease:e, note:reviewNote };
    persist(stakeholders.map((s,si) => si===idx ? {
      ...s, power:p, interest:i, influence:inf, ease:e,
      scoreHistory:[...(s.scoreHistory||[]), entry],
    } : s));
    setReviewModal(null); setReviewNote("");
  };

  const addStakeholder = () => {
    const today = new Date().toISOString().slice(0,10);
    const id    = nextStakeholderId(stakeholders);
    const next  = [...stakeholders, {
      _id:id, name:"", category:"", contact:"",
      power:5, interest:5, influence:5, ease:5,
      status:"Identified", engagementStrategy:"",
      scoreHistory:[{ date:today, by:loginCodes?.[0]?.loginCode||"PM",
        power:5,interest:5,influence:5,ease:5, note:"Initial assessment" }],
      statusHistory:[{ status:"Identified", date:today, by:loginCodes?.[0]?.loginCode||"PM", reason:"" }],
      commPlan:{ suspended:false, suspendedDate:null, frequency:"", nextContactDate:"", channel:"", purpose:"", keyMessages:"" },
      sentiment:"Neutral", sentimentHistory:[],
      strategyTemplate:"", strategyFinal:"",
      commsFormat:"", commsFreq:"", commsContent:"", commsNextDate:"", commsOwner:"",
    }];
    persist(next);
  };

  const removeStakeholder = (idx) => persist(stakeholders.filter((_,i) => i!==idx));

  // ── Sort by priority score descending ─────────────────────────────────────
  const sorted = useMemo(() =>
    [...stakeholders].map((s,i)=>({...s,_origIdx:i}))
      .sort((a,b) => parseFloat(priorityScore(b.power,b.interest,b.influence)) - parseFloat(priorityScore(a.power,a.interest,a.influence))),
  [stakeholders]);

  return (
    <div style={{ maxWidth:960 }}>

      {/* Header summary */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        {Object.entries(STATUS_COLORS).map(([status,col])=>{
          const count = stakeholders.filter(s=>s.status===status).length;
          return count > 0 ? (
            <div key={status} style={{ fontSize:10, padding:"3px 10px", borderRadius:12,
              background:col+"22", color:col, border:`1px solid ${col}44` }}>
              {count} {status}
            </div>
          ) : null;
        })}
        <div style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>
          Scoring: Priority = (Power×0.4) + (Interest×0.35) + (Influence×0.25)
        </div>
      </div>

      {stakeholders.length===0 && (
        <div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>
          No stakeholders yet. Add one below or extract from a document in Layer 1.
        </div>
      )}

      {sorted.map((s) => {
        const idx   = s._origIdx;
        const seg   = deriveTag(s.power, s.interest, s.influence);
        const score = priorityScore(s.power, s.interest, s.influence);
        const isOpen= expandedIdx === idx;
        const scol  = STATUS_COLORS[s.status] || C.muted;

        return (
          <div key={s._id||idx} style={{ background:C.surface, border:`1px solid ${C.border}`,
            borderLeft:`3px solid ${seg.color}`, borderRadius:8, marginBottom:10, overflow:"hidden" }}>

            {/* Collapsed header */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
              cursor:"pointer" }} onClick={() => setExpandedIdx(isOpen ? null : idx)}>
              <span style={{ fontFamily:"monospace", fontSize:11, color:C.purple }}>{s._id}</span>
              <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:12,
                background:seg.color+"22", color:seg.color, border:`1px solid ${seg.color}44` }}>
                {seg.tag}
              </span>
              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:12,
                background:seg.color+"11", color:seg.color, border:`1px solid ${seg.color}22` }}>
                {seg.apm}
              </span>
              <span style={{ fontSize:12, color:C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {s.name||<span style={{color:C.muted,fontStyle:"italic"}}>Unnamed stakeholder</span>}
              </span>
              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:12,
                background:scol+"22", color:scol, border:`1px solid ${scol}44` }}>
                {s.status}
              </span>
              <span style={{ fontSize:12, fontWeight:700, color:seg.color }}>{score}</span>
              {!locked && <button onClick={e=>{e.stopPropagation();removeStakeholder(idx);}}
                style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button>}
              <span style={{ color:C.muted, fontSize:11 }}>{isOpen?"▲":"▼"}</span>
            </div>

            {isOpen && (
              <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>

                {/* Basic details */}
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 2fr", gap:10, marginBottom:12 }}>
                  <div><Lbl c="Name"/><input style={inp} value={s.name||""} disabled={locked} onChange={e=>updateSH(idx,"name",e.target.value)} placeholder="Stakeholder or organisation name"/></div>
                  <div><Lbl c="Category"/>
                    <select style={inp} value={s.category||""} disabled={locked} onChange={e=>updateSH(idx,"category",e.target.value)}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c=><option key={c} value={c} style={{background:C.surface2}}>{c}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Contact / Email"/><input style={inp} value={s.contact||""} disabled={locked} onChange={e=>updateSH(idx,"contact",e.target.value)} placeholder="Email or contact detail"/></div>
                </div>

                {/* Status */}
                <div style={{ marginBottom:12 }}>
                  <Lbl c="Engagement Status"/>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {STATUSES.map(st => {
                      const col = STATUS_COLORS[st];
                      const active = s.status === st;
                      return (
                        <button key={st} onClick={() => !locked && s.status !== st && requestStatusChange(idx, st)}
                          disabled={locked || s.status === st}
                          style={{ padding:"4px 12px", borderRadius:12, border:`1px solid ${active?col:C.border}`,
                            background:active?col+"22":"none", color:active?col:C.muted,
                            fontSize:10, fontWeight:active?700:400, cursor:locked||active?"default":"pointer" }}>
                          {st}
                        </button>
                      );
                    })}
                  </div>
                  {(s.statusHistory||[]).length > 0 && (
                    <div style={{ marginTop:6 }}>
                      {s.statusHistory.slice(-3).map((h,hi) => (
                        <div key={hi} style={{ fontSize:9, color:C.muted, display:"flex", gap:8, padding:"2px 0" }}>
                          <span style={{ fontFamily:"monospace" }}>{h.date}</span>
                          <span style={{ color:STATUS_COLORS[h.status]||C.muted }}>{h.status}</span>
                          {h.reason && <span>— {h.reason}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PIIE Sliders */}
                <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                    letterSpacing:".5px", marginBottom:10 }}>
                    PIIE Identification Scoring — click ? for guidance
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
                    <PIIESlider dim="power"     label="Power"     value={s.power||5}    onChange={v=>updateSH(idx,"power",v)}    disabled={locked}/>
                    <PIIESlider dim="interest"  label="Interest"  value={s.interest||5} onChange={v=>updateSH(idx,"interest",v)} disabled={locked}/>
                    <PIIESlider dim="influence" label="Influence" value={s.influence||5} onChange={v=>updateSH(idx,"influence",v)} disabled={locked}/>
                    <PIIESlider dim="ease"      label="Ease"      value={s.ease||5}     onChange={v=>updateSH(idx,"ease",v)}      disabled={locked}/>
                  </div>

                  {/* Derived outputs */}
                  <div style={{ display:"flex", gap:10, marginTop:10, flexWrap:"wrap", alignItems:"center" }}>
                    <span style={{ fontSize:10, color:C.muted }}>Priority Score:</span>
                    <span style={{ fontSize:16, fontWeight:700, color:seg.color }}>{score}</span>
                    <span style={{ fontSize:9, padding:"2px 8px", borderRadius:10, background:seg.color+"22", color:seg.color, border:`1px solid ${seg.color}44` }}>{seg.tag}</span>
                    <span style={{ fontSize:9, padding:"2px 8px", borderRadius:10, background:C.surface, color:seg.color, border:`1px solid ${seg.color}33` }}>APM: {seg.apm}</span>
                    {derivedFrequency(seg.apm, s.ease) !== "None" && derivedFrequency(seg.apm, s.ease) !== "" && (
                      <span style={{ fontSize:9, color:C.muted }}>Suggested frequency: {derivedFrequency(seg.apm, s.ease)}</span>
                    )}
                    {!locked && (
                      <button onClick={() => setReviewModal({ idx, p:s.power||5, i:s.interest||5, inf:s.influence||5, e:s.ease||5 })}
                        style={{ marginLeft:"auto", padding:"3px 10px", background:"none", border:`1px solid ${C.border}`,
                          borderRadius:5, color:C.dim, fontSize:10, cursor:"pointer" }}>
                        Log Score Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Engagement strategy */}
                <div style={{ marginBottom:12 }}>
                  <Lbl c="Engagement Strategy" hint={`${seg.tag} → ${seg.apm} level. Ease score adjusts mechanism.`}/>
                  <textarea value={s.engagementStrategy||""} disabled={locked}
                    onChange={e=>updateSH(idx,"engagementStrategy",e.target.value)}
                    placeholder={`Describe how you will engage this stakeholder (${seg.apm} level — ${(parseInt(s.ease)||5)>=6?"direct, frequent contact":"targeted moments, asynchronous channels"})`}
                    style={{ ...inp, resize:"vertical", minHeight:56, lineHeight:1.5 }}/>
                </div>

                {/* Communications setup — only shown when Engaged */}
                {s.status === "Engaged" && (
                  <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase",
                      letterSpacing:".5px", marginBottom:10 }}>
                      Communication Plan Setup
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:8 }}>
                      <div><Lbl c="Channel / Format"/>
                        <select style={inp} value={s.commsFormat||""} disabled={locked} onChange={e=>updateSH(idx,"commsFormat",e.target.value)}>
                          <option value="">Select…</option>
                          {FORMATS.map(f=><option key={f} value={f} style={{background:C.surface2}}>{f}</option>)}
                        </select>
                      </div>
                      <div><Lbl c={`Frequency (suggested: ${derivedFrequency(seg.apm,s.ease)||"—"})`}/>
                        <input style={inp} value={s.commsFreq||""} disabled={locked}
                          onChange={e=>updateSH(idx,"commsFreq",e.target.value)}
                          placeholder={derivedFrequency(seg.apm,s.ease)||"Set frequency"}/>
                      </div>
                      <div><Lbl c="Next Contact Date"/>
                        <input type="date" style={inp} value={s.commsNextDate||""} disabled={locked}
                          onChange={e=>updateSH(idx,"commsNextDate",e.target.value)}/>
                      </div>
                      <div><Lbl c="Communications Owner"/>
                        <select style={inp} value={s.commsOwner||""} disabled={locked}
                          onChange={e=>updateSH(idx,"commsOwner",e.target.value)}>
                          <option value="">Select…</option>
                          {teamRoles.map(r=><option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <div><Lbl c="Key Messages / Purpose"/>
                      <input style={inp} value={s.commsContent||""} disabled={locked}
                        onChange={e=>updateSH(idx,"commsContent",e.target.value)}
                        placeholder="What will be communicated and why?"/>
                    </div>
                  </div>
                )}

                {/* Score history */}
                {(s.scoreHistory||[]).length > 1 && (
                  <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
                      letterSpacing:".4px", marginBottom:6 }}>Score Review History</div>
                    {s.scoreHistory.slice(-4).map((h,hi)=>(
                      <div key={hi} style={{ display:"flex", gap:10, fontSize:9, color:C.muted, padding:"2px 0" }}>
                        <span style={{ fontFamily:"monospace" }}>{h.date}</span>
                        <span>P:{h.power} I:{h.interest} Inf:{h.influence} E:{h.ease}</span>
                        {h.note && <span style={{ color:C.dim }}>— {h.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!locked && (
        <button onClick={addStakeholder}
          style={{ padding:"8px 14px", background:"none", border:`1px dashed ${C.border}`,
            borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:4 }}>
          + Add Stakeholder
        </button>
      )}

      {/* Status change modal */}
      {statusModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
            padding:"20px 24px", width:"100%", maxWidth:460 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:6 }}>
              Change status to <span style={{ color:STATUS_COLORS[statusModal.newStatus] }}>{statusModal.newStatus}</span>
            </div>
            {(statusModal.newStatus === "Not Engaging" || statusModal.newStatus === "Disengaged") && (
              <div style={{ fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.5 }}>
                The communication plan will be suspended. All history is preserved and the stakeholder will be removed from the L3 Stakeholders operational view.
              </div>
            )}
            {statusModal.newStatus === "Engaged" && (
              <div style={{ fontSize:11, color:C.activity, marginBottom:10, lineHeight:1.5 }}>
                This stakeholder will appear in the L3 Stakeholders operational view. Communication plan will activate.
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <Lbl c="Reason (optional)"/>
              <input style={inp} value={statusReason} onChange={e=>setStatusReason(e.target.value)}
                placeholder="Brief reason for this status change…"/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setStatusModal(null)}
                style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
              <button onClick={confirmStatusChange}
                style={{ flex:2, padding:"8px", background:C.accent, border:"none",
                  borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score review modal */}
      {reviewModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
            padding:"20px 24px", width:"100%", maxWidth:520 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:12 }}>Log Score Review</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:12 }}>
              {[["power","Power",C.risk],["i","Interest",C.milestone],["inf","Influence",C.purple],["e","Ease",C.accentL]].map(([key,label,col])=>(
                <div key={key}>
                  <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", marginBottom:3 }}>
                    {label}: <span style={{ color:col }}>{reviewModal[key]}</span>
                  </div>
                  <input type="range" min="1" max="10" value={reviewModal[key]}
                    onChange={e=>setReviewModal(r=>({...r,[key]:parseInt(e.target.value)}))}
                    style={{ width:"100%", accentColor:col }}/>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <Lbl c="What changed and why?"/>
              <input style={inp} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
                placeholder="e.g. Interest increased after milestone presentation"/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setReviewModal(null)}
                style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
              <button onClick={submitReview}
                style={{ flex:2, padding:"8px", background:C.accent, border:"none",
                  borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
