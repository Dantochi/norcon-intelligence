import React, { useEffect, useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2", opp:"#9c6ee0" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c}) => <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{c}</div>;

const RISK_CATEGORIES = ["Planning & Coordination","Data & Analysis","Team Dynamics","Stakeholder Management","Financial","Technical","External"];
const RESPONSES_THREAT = ["Avoid","Reduce","Transfer","Accept"];
const RESPONSES_OPP    = ["Exploit","Enhance","Share","Accept"];
const LEVELS           = ["1 - Low","2 - Medium","3 - High"];
const PRIORITIES       = ["High","Medium","Low"];
const ISSUE_STATUSES   = ["Open","In Progress","Resolved","Escalated"];

// RAG is inverted for Opportunities: high score = desirable (green), low = amber/warning
function ragColor(type, l, i) {
  const s = (parseInt(l)||1)*(parseInt(i)||1);
  if (type === "Opportunity") return s>=9?C.activity:s>=4?C.milestone:C.opp;
  return s>=9?C.risk:s>=4?C.milestone:C.activity;
}

function EditableSelect({ value, onChange, options, disabled, placeholder }) {
  const [custom, setCustom] = React.useState(false);
  const [customVal, setCustomVal] = React.useState("");
  if (custom) {
    return <input autoFocus value={customVal} onChange={e=>setCustomVal(e.target.value)}
      onBlur={()=>{ if(customVal.trim()) onChange(customVal.trim()); setCustom(false); }}
      onKeyDown={e=>{ if(e.key==="Enter"){ onChange(customVal.trim()||value); setCustom(false); } if(e.key==="Escape") setCustom(false); }}
      style={{...inp, borderColor:C.accentL}}/>;
  }
  return (
    <select style={inp} value={value||""} disabled={disabled}
      onChange={e=>{ if(e.target.value==="Custom..."){setCustom(true);setCustomVal("");} else onChange(e.target.value); }}>
      <option value="">{placeholder||"Select..."}</option>
      {options.map(o=><option key={o} value={o} style={{background:C.surface2}}>{o}</option>)}
      <option value="Custom...">Custom...</option>
    </select>
  );
}

// L3 guard: protect risks that carry L3 delivery data from L2 deletion
function riskHasL3Data(r) {
  return !!(r.status==="Closed"||r.status==="Materialised"||r.closedDate||r.materialisedDate||(r.actions||[]).length>0||(r.reviewHistory||[]).length>0);
}
function issueHasL3Data(iss) {
  return !!((iss.actionLog||[]).length>0||(iss.resolution||"").trim()||(iss.status&&iss.status!=="Open")||iss.linkedRiskId);
}

function nextRegisterId(items, prefix, startAt = 101) {
  const max = (items || []).reduce((highest, item) => {
    const n = parseInt(String(item?._id || "").replace(`${prefix}-`, ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, startAt - 1);
  return `${prefix}-${String(max + 1).padStart(3,"0")}`;
}

// ── Pending team update approval panel ─────────────────────────────────────
// Shown at the top of Sheet 05 whenever there are team-submitted proposals
// awaiting PM review. Visible regardless of locked state.
function PendingUpdatesPanel({ pendingUpdates, onApprove, onReject }) {
  const [rejectId, setRejectId]     = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const pending = (pendingUpdates||[]).filter(u=>u.status==="pending");
  if (pending.length === 0) return null;

  const typeLabel = { action:"Action item", review:"Score review", status:"Status change" };

  return (
    <div style={{ background:"rgba(224,92,92,0.06)", border:`1px solid ${C.risk}44`, borderRadius:8,
      padding:"14px 16px", marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.risk, marginBottom:10 }}>
        ⏳ {pending.length} pending team update{pending.length>1?"s":""} awaiting your review
      </div>
      {pending.map(u => (
        <div key={u.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6,
          padding:"10px 12px", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"monospace", fontSize:10, color:C.accentL }}>{u.targetId}</span>
            <span style={{ fontSize:9, padding:"1px 7px", borderRadius:12, background:C.milestone+"22",
              color:C.milestone, border:`1px solid ${C.milestone}44` }}>{typeLabel[u.updateType]||u.updateType}</span>
            <span style={{ fontSize:10, color:C.muted }}>{u.date}</span>
            <span style={{ fontSize:10, color:C.dim }}>by {u.submitterName||u.submittedBy}</span>
          </div>
          <div style={{ fontSize:11, color:C.sage, marginBottom:6 }}>{u.description}</div>
          {u.data?.note && <div style={{ fontSize:10, color:C.dim, fontStyle:"italic", marginBottom:6 }}>"{u.data.note}"</div>}
          {rejectId === u.id ? (
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              <input style={{...inp, flex:1, minWidth:160}} value={rejectReason} autoFocus
                onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection…"/>
              <button onClick={()=>{ onReject(u.id, rejectReason); setRejectId(null); setRejectReason(""); }}
                disabled={!rejectReason}
                style={{ padding:"5px 12px", background:rejectReason?C.risk:C.surface2, border:"none",
                  borderRadius:4, color:rejectReason?"#fff":C.muted, fontSize:11, fontWeight:700, cursor:rejectReason?"pointer":"not-allowed" }}>
                Confirm Reject
              </button>
              <button onClick={()=>{setRejectId(null);setRejectReason("");}}
                style={{ padding:"5px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>onApprove(u.id)}
                style={{ padding:"5px 14px", background:C.accent, border:"none", borderRadius:4,
                  color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓ Approve</button>
              <button onClick={()=>setRejectId(u.id)}
                style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.risk}`, borderRadius:4,
                  color:C.risk, fontSize:11, cursor:"pointer" }}>✕ Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Sheet05Risks({ data, locked, loginCodes, onUpdate }) {
  const [activeTab, setActiveTab] = useState("risks");
  const [risks,  setRisks]  = useState(data.risks  || []);
  const [issues, setIssues] = useState(data.issues || []);
  const [pendingUpdates, setPendingUpdates] = useState(data.pendingUpdates || []);
  const [transitions,    setTransitions]    = useState(data.transitions    || []);

  useEffect(() => {
    setRisks(data.risks || []);
    setIssues(data.issues || []);
    setPendingUpdates(data.pendingUpdates || []);
    setTransitions(data.transitions || []);
  }, [data.risks, data.issues, data.pendingUpdates, data.transitions]);

  // Owner options: person names first, fall back to roles
  const PM_ROLES       = ["Project Manager","Project Sponsor","Project Director","Programme Manager","Portfolio Manager","Risk Manager","Change Manager","Quality Manager","Project Support","PMO Analyst"];
  const DELIVERY_ROLES = ["Lead Engineer","Site Manager","Quantity Surveyor","Design Manager","Commercial Manager","Health & Safety Manager","Environmental Manager","Procurement Manager","Logistics Coordinator","Contracts Manager"];
  const namedMembers   = loginCodes.map(lc=>lc.name).filter(Boolean);
  const ownerOptions   = namedMembers.length > 0 ? namedMembers
    : [...new Set([...loginCodes.map(lc=>lc.role).filter(Boolean), ...PM_ROLES, ...DELIVERY_ROLES])];

  // Escalation options: all named project members + standard governance roles.
  // "including others" — covers sponsor, steering, board regardless of loginCodes.
  const escalationOptions = [
    ...new Set([
      ...namedMembers,
      "Project Sponsor",
      "Project Manager",
      "Project Director",
      "Steering Committee",
      "Board",
      "Executive Team",
    ]),
  ].filter(Boolean);

  const save = (r, iss, pu, tr) => {
    const next = { risks:r??risks, issues:iss??issues, pendingUpdates:pu??pendingUpdates, transitions:tr??transitions };
    onUpdate(next, "in-progress");
  };

  // ── Risk helpers ──────────────────────────────────────────────────────────
  const updateRisk = (idx, field, value) => {
    const next = risks.map((r,i) => i===idx ? {...r,[field]:value} : r);
    setRisks(next); save(next, null, null, null);
  };
  const addRisk = () => {
    const next = [...risks, {
      _id:nextRegisterId(risks, "R"),
      type:"Threat", name:"", category:"", cause:"", potentialImpact:"",
      likelihood:"1 - Low", impact:"1 - Low",
      residualLikelihood:"", residualImpact:"",
      response:"Avoid", mitigation:"",
      _suggestedOwner:"", escalationPath:"", nextReviewDate:"",
    }];
    setRisks(next); save(next, null, null, null);
  };
  const removeRisk = (idx) => {
    const next = risks.filter((_,i)=>i!==idx);
    setRisks(next); save(next, null, null, null);
  };

  // ── Issue helpers ─────────────────────────────────────────────────────────
  const updateIssue = (idx, field, value) => {
    const next = issues.map((r,i) => i===idx ? {...r,[field]:value} : r);
    setIssues(next); save(null, next, null, null);
  };
  const addIssue = () => {
    const next = [...issues, {
      _id:nextRegisterId(issues, "I"),
      name:"", description:"", cause:"", impact:"",
      priority:"Medium", owner:"", raisedDate:"", targetResolutionDate:"",
      status:"Open", resolution:"", escalationPath:"",
    }];
    setIssues(next); save(null, next, null, null);
  };
  const removeIssue = (idx) => {
    const next = issues.filter((_,i)=>i!==idx);
    setIssues(next); save(null, next, null, null);
  };

  // ── Pending update approval / rejection ───────────────────────────────────
  const approvePendingUpdate = (updateId) => {
    const update = pendingUpdates.find(u=>u.id===updateId);
    if (!update) return;
    // Apply the proposed data to the target
    let newRisks = risks, newIssues = issues;
    if (update.targetType === "risk") {
      const idx = risks.findIndex(r=>r._id===update.targetId);
      if (idx >= 0) {
        if (update.updateType === "review") {
          const existing = risks[idx];
          const entry = { date:update.date, likelihood:update.data.likelihood, impact:update.data.impact,
            score:(parseInt(update.data.likelihood)||1)*(parseInt(update.data.impact)||1), note:update.data.note };
          newRisks = risks.map((r,i)=>i===idx?{...r,likelihood:update.data.likelihood,
            impact:update.data.impact,lastReviewed:update.date,
            reviewHistory:[...(r.reviewHistory||[]),entry]}:r);
        } else if (update.updateType === "status") {
          newRisks = risks.map((r,i)=>i===idx?{...r,status:update.data.status}:r);
        } else if (update.updateType === "action") {
          newRisks = risks.map((r,i)=>i===idx?{...r,actions:[...(r.actions||[]),update.data]}:r);
        }
      }
    } else if (update.targetType === "issue") {
      const idx = issues.findIndex(iss=>iss._id===update.targetId);
      if (idx >= 0) {
        if (update.updateType === "status") {
          newIssues = issues.map((iss,i)=>i===idx?{...iss,status:update.data.status}:iss);
        } else if (update.updateType === "action") {
          newIssues = issues.map((iss,i)=>i===idx?{...iss,actionLog:[...(iss.actionLog||[]),update.data]}:iss);
        }
      }
    }
    const newPU = pendingUpdates.map(u=>u.id===updateId?{...u,status:"approved"}:u);
    setRisks(newRisks); setIssues(newIssues); setPendingUpdates(newPU);
    save(newRisks, newIssues, newPU, null);
  };

  const rejectPendingUpdate = (updateId, reason) => {
    const newPU = pendingUpdates.map(u=>u.id===updateId?{...u,status:"rejected",rejectionReason:reason}:u);
    setPendingUpdates(newPU); save(null, null, newPU, null);
  };

  const statusColor   = s => ({Open:C.risk,"In Progress":C.milestone,Resolved:C.activity,Escalated:"#9c6ee0"}[s]||C.muted);
  const priorityColor = p => ({High:C.risk,Medium:C.milestone,Low:C.activity}[p]||C.muted);

  return (
    <div style={{ maxWidth:900 }}>

      {/* ── Pending team updates panel (always visible when items exist) ── */}
      <PendingUpdatesPanel
        pendingUpdates={pendingUpdates}
        onApprove={approvePendingUpdate}
        onReject={rejectPendingUpdate}
      />

      {/* ── Transitions log ── */}
      {transitions.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7,
          padding:"10px 14px", marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
            letterSpacing:".4px", marginBottom:8 }}>Risk–Issue Transition Log ({transitions.length})</div>
          {transitions.map((t,i)=>(
            <div key={t.id||i} style={{ display:"flex", gap:10, padding:"4px 0",
              borderBottom:`1px solid ${C.border}22`, fontSize:10, alignItems:"center" }}>
              <span style={{ fontFamily:"monospace", color:C.muted, width:70, flexShrink:0 }}>{t.date}</span>
              <span style={{ color:t.type==="risk_to_issue"?C.milestone:C.opp, fontWeight:700, flexShrink:0 }}>
                {t.type==="risk_to_issue"?"Risk → Issue":"Issue → Risk"}
              </span>
              <span style={{ fontFamily:"monospace", color:C.accentL, flexShrink:0 }}>{t.sourceId}</span>
              <span style={{ color:C.muted, flexShrink:0 }}>→</span>
              <span style={{ fontFamily:"monospace", color:C.accentL, flexShrink:0 }}>{t.targetId}</span>
              <span style={{ color:C.dim, flex:1 }}>{t.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
        {[["risks",`Risk Register (${risks.length})`],["issues",`Issues Register (${issues.length})`]].map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{ padding:"5px 16px", borderRadius:5, border:"none", fontSize:12, fontWeight:600,
              background:activeTab===t?C.accent:"none", color:activeTab===t?"#fff":C.muted, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ RISKS ══ */}
      {activeTab === "risks" && (
        <>
          <div style={{ display:"flex", gap:16, marginBottom:16, flexWrap:"wrap" }}>
            {[[C.activity,"Low / Opportunity high"],[C.milestone,"Medium"],[C.risk,"High threat — escalate"],[C.opp,"Low opportunity — pursue"]].map(([col,label])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.dim }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:col }}/>{label}
              </div>
            ))}
          </div>

          {namedMembers.length === 0 && (
            <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
              padding:"8px 12px", marginBottom:12, fontSize:11, color:C.muted }}>
              ℹ️ Complete Sheet 02 (Team) first to assign risk owners by name.
            </div>
          )}

          {risks.length===0 && <div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>No risks yet. Add one below or extract from a document in Layer 1.</div>}

          {risks.map((r, i) => {
            const score   = (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
            const rag     = ragColor(r.type, r.likelihood, r.impact);
            const residScore = r.residualLikelihood && r.residualImpact
              ? (parseInt(r.residualLikelihood)||1)*(parseInt(r.residualImpact)||1) : null;
            const residRag = residScore !== null ? ragColor(r.type, r.residualLikelihood, r.residualImpact) : null;
            const l3Guard = riskHasL3Data(r);
            const isMat   = r.status === "Materialised";
            const isClosed = r.status === "Closed";
            // Fields are read-only when: sheet locked OR risk was closed/materialised in L3
            const fieldDisabled = locked || isClosed || isMat;
            return (
              <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${isMat?C.opp:rag}`, borderRadius:7, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>{r._id}</span>
                  {/* Type badge */}
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:12,
                    background:(r.type==="Opportunity"?C.opp:C.risk)+"22",
                    color:r.type==="Opportunity"?C.opp:C.risk,
                    border:`1px solid ${r.type==="Opportunity"?C.opp:C.risk}44` }}>
                    {r.type||"Threat"}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:rag+"22", color:rag, border:`1px solid ${rag}` }}>Score: {score}</span>
                  {residScore !== null && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:12,
                      background:residRag+"22", color:residRag, border:`1px solid ${residRag}44` }}>
                      Residual: {residScore}
                    </span>
                  )}
                  {r.category && <span style={{ fontSize:10, color:C.muted }}>{r.category}</span>}
                  {/* L3 activity indicators */}
                  {isMat && <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:12,
                    background:C.opp+"22", color:C.opp, border:`1px solid ${C.opp}44` }}>
                    Materialised → {r.linkedIssueId}
                  </span>}
                  {r.status==="Closed" && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:12,
                    background:C.muted+"22", color:C.muted }}>Closed in L3</span>}
                  {(r.reviewHistory||[]).length>0 && <span style={{ fontSize:9, color:C.accentL }}>{r.reviewHistory.length} review{r.reviewHistory.length>1?"s":""}</span>}
                  {(r.actions||[]).length>0 && <span style={{ fontSize:9, color:C.milestone }}>{r.actions.length} action{r.actions.length>1?"s":""}</span>}

                  {!locked && (
                    isClosed
                      ? <span style={{ marginLeft:"auto", fontSize:10, color:C.muted, fontStyle:"italic" }}>Closed in L3 — reopen in L3 to edit</span>
                      : isMat
                      ? <span style={{ marginLeft:"auto", fontSize:10, color:C.opp, fontStyle:"italic" }}>Materialised → {r.linkedIssueId||"?"} — manage in L3</span>
                      : l3Guard
                      ? <span style={{ marginLeft:"auto", fontSize:10, color:C.muted, fontStyle:"italic" }}>Active in L3 — use L3 to close or delete</span>
                      : <button onClick={()=>removeRisk(i)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:13 }}>✕</button>
                  )}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {/* Type */}
                  <div>
                    <Lbl c="Risk Type"/>
                    <select style={inp} value={r.type||"Threat"} disabled={fieldDisabled} onChange={e=>updateRisk(i,"type",e.target.value)}>
                      {["Threat","Opportunity"].map(t=><option key={t} value={t} style={{background:C.surface2}}>{t}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Category"/><EditableSelect value={r.category||""} disabled={fieldDisabled} onChange={v=>updateRisk(i,"category",v)} options={RISK_CATEGORIES} placeholder="Select..."/></div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Risk Name"/><input style={inp} value={r.name||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"name",e.target.value)} placeholder="Short risk name"/></div>
                  <div><Lbl c="Cause / Trigger"/><input style={inp} value={r.cause||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"cause",e.target.value)} placeholder="What would trigger this?"/></div>
                  <div><Lbl c="Potential Impact"/><input style={inp} value={r.potentialImpact||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"potentialImpact",e.target.value)} placeholder="Consequence if it occurs"/></div>

                  {/* Inherent scores */}
                  <div>
                    <Lbl c="Inherent Likelihood"/>
                    <select style={inp} value={r.likelihood||"1 - Low"} disabled={fieldDisabled} onChange={e=>updateRisk(i,"likelihood",e.target.value)}>
                      {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="Inherent Impact"/>
                    <select style={inp} value={r.impact||"1 - Low"} disabled={fieldDisabled} onChange={e=>updateRisk(i,"impact",e.target.value)}>
                      {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>

                  <div><Lbl c="Response"/>
                    <EditableSelect value={r.response||"Avoid"} disabled={fieldDisabled}
                      onChange={v=>updateRisk(i,"response",v)}
                      options={r.type==="Opportunity"?RESPONSES_OPP:RESPONSES_THREAT}
                      placeholder="Select..."/>
                  </div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Mitigation / Response Strategy"/><input style={inp} value={r.mitigation||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"mitigation",e.target.value)} placeholder="How will this risk be managed?"/></div>

                  {/* Residual scores (after mitigation) */}
                  <div>
                    <Lbl c="Residual Likelihood (post-mitigation)"/>
                    <select style={inp} value={r.residualLikelihood||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"residualLikelihood",e.target.value)}>
                      <option value="">Not assessed</option>
                      {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="Residual Impact (post-mitigation)"/>
                    <select style={inp} value={r.residualImpact||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"residualImpact",e.target.value)}>
                      <option value="">Not assessed</option>
                      {LEVELS.map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>

                  {/* Owner */}
                  <div>
                    <Lbl c={namedMembers.length>0?"Risk Owner (person)":"Risk Owner (role)"}/>
                    <select style={inp} value={r._suggestedOwner||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"_suggestedOwner",e.target.value)}>
                      <option value="">Select owner...</option>
                      {ownerOptions.map(opt=><option key={opt} value={opt} style={{background:C.surface2}}>{opt}</option>)}
                    </select>
                  </div>

                  {/* Escalation path — required on all risks per governance */}
                  <div><Lbl c="Escalation Path (if Red / materialises)"/>
                    <EditableSelect value={r.escalationPath||""} disabled={fieldDisabled}
                      onChange={v=>updateRisk(i,"escalationPath",v)}
                      options={escalationOptions} placeholder="Who to escalate to…"/>
                  </div>

                  {/* Next review date */}
                  <div><Lbl c="Next Review Date"/><input style={inp} type="date" value={r.nextReviewDate||""} disabled={fieldDisabled} onChange={e=>updateRisk(i,"nextReviewDate",e.target.value)}/></div>
                </div>
              </div>
            );
          })}
          {!locked && <button onClick={addRisk} style={{ padding:"7px 14px", background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%" }}>+ Add Risk</button>}
        </>
      )}

      {/* ══ ISSUES ══ */}
      {activeTab === "issues" && (
        <>
          <div style={{ fontSize:12, color:C.dim, marginBottom:14, lineHeight:1.6 }}>
            Issues are risks that have materialised — problems actively affecting the project now.
            A risk raised in this register may transition to an issue in L3 when it materialises,
            and an issue may generate secondary risks. Both remain in their respective registers
            but are linked for governance traceability.
          </div>
          {issues.length===0 && <div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>No issues logged yet.</div>}
          {issues.map((iss, i) => {
            const col     = statusColor(iss.status);
            const pc      = priorityColor(iss.priority);
            const l3Guard = issueHasL3Data(iss);
            // Issue resolved or escalated in L3 becomes read-only in L2 until reopened in L3
            const issueReadOnly = locked || iss.status === "Resolved";
            return (
              <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${col}`, borderRadius:7, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>{iss._id}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:col+"22", color:col, border:`1px solid ${col}` }}>{iss.status||"Open"}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:pc+"22", color:pc, border:`1px solid ${pc}` }}>{iss.priority||"Medium"}</span>
                  {iss.linkedRiskId && <span style={{ fontSize:9, color:C.opp }}>← {iss.linkedRiskId}</span>}
                  {(iss.secondaryRisks||[]).length>0 && (
                    <span style={{ fontSize:9, color:C.milestone }}>→ {iss.secondaryRisks.length} secondary risk{iss.secondaryRisks.length>1?"s":""}</span>
                  )}
                  {(iss.actionLog||[]).length>0 && <span style={{ fontSize:9, color:C.accentL }}>{iss.actionLog.length} action{iss.actionLog.length>1?"s":""}</span>}
                  {!locked && (
                    iss.status === "Resolved"
                      ? <span style={{ marginLeft:"auto", fontSize:10, color:C.activity, fontStyle:"italic" }}>✓ Resolved in L3 — reopen in L3 to edit</span>
                      : l3Guard
                      ? <span style={{ marginLeft:"auto", fontSize:10, color:C.muted, fontStyle:"italic" }}>Active in L3 — use L3 to resolve or delete</span>
                      : <button onClick={()=>removeIssue(i)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:13 }}>✕</button>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Issue Name"/><input style={inp} value={iss.name||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"name",e.target.value)} placeholder="Short issue name"/></div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Description"/><input style={inp} value={iss.description||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"description",e.target.value)} placeholder="What is happening?"/></div>
                  <div><Lbl c="Cause"/><input style={inp} value={iss.cause||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"cause",e.target.value)} placeholder="What triggered this issue?"/></div>
                  <div><Lbl c="Current Impact"/><input style={inp} value={iss.impact||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"impact",e.target.value)} placeholder="How is this affecting the project?"/></div>
                  <div><Lbl c="Priority"/>
                    <select style={inp} value={iss.priority||"Medium"} disabled={issueReadOnly} onChange={e=>updateIssue(i,"priority",e.target.value)}>
                      {PRIORITIES.map(p=><option key={p} value={p} style={{background:C.surface2}}>{p}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Status"/>
                    <select style={inp} value={iss.status||"Open"} disabled={issueReadOnly} onChange={e=>updateIssue(i,"status",e.target.value)}>
                      {ISSUE_STATUSES.map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c={namedMembers.length>0?"Issue Owner (person)":"Issue Owner (role)"}/>
                    <select style={inp} value={iss.owner||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"owner",e.target.value)}>
                      <option value="">Select owner...</option>
                      {ownerOptions.map(opt=><option key={opt} value={opt} style={{background:C.surface2}}>{opt}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Escalation Path"/>
                    <EditableSelect value={iss.escalationPath||""} disabled={issueReadOnly}
                      onChange={v=>updateIssue(i,"escalationPath",v)}
                      options={escalationOptions} placeholder="Who to escalate to…"/>
                  </div>
                  <div><Lbl c="Date Raised"/><input style={inp} type="date" value={iss.raisedDate||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"raisedDate",e.target.value)}/></div>
                  <div><Lbl c="Target Resolution"/><input style={inp} type="date" value={iss.targetResolutionDate||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"targetResolutionDate",e.target.value)}/></div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Resolution / Actions Taken"/><input style={inp} value={iss.resolution||""} disabled={issueReadOnly} onChange={e=>updateIssue(i,"resolution",e.target.value)} placeholder="What has been or will be done?"/></div>
                </div>
              </div>
            );
          })}
          {!locked && <button onClick={addIssue} style={{ padding:"7px 14px", background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%" }}>+ Log Issue</button>}
        </>
      )}
    </div>
  );
}
