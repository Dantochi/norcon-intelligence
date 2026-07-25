import { useState, useCallback, useMemo } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2", opp:"#9c6ee0",
};
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"5px 8px", outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };

// RAG is inverted for Opportunities: high score = good (green), low = warning
function ragColor(type, l, i) {
  const s = (parseInt(l)||1)*(parseInt(i)||1);
  if (type === "Opportunity") return s>=9?C.activity:s>=4?C.milestone:C.opp;
  return s>=9?C.risk:s>=4?C.milestone:C.activity;
}
function statusColor(s) { return ({Open:C.risk,"In Progress":C.milestone,Resolved:C.activity,Escalated:"#9c6ee0",Materialised:C.opp,Closed:C.muted}[s]||C.muted); }
function priorityColor(p) { return ({High:C.risk,Medium:C.milestone,Low:C.activity}[p]||C.muted); }
function toISO(d) { try { return d.toISOString().slice(0,10); } catch { return ""; } }
function isOverdue(dateStr) { return dateStr && new Date(dateStr) < new Date(); }

function Badge({ label, color, small }) {
  return <span style={{ fontSize:small?8:9, fontWeight:700, padding:small?"1px 5px":"2px 7px", borderRadius:12, background:color+"22", color, border:`1px solid ${color}44`, whiteSpace:"nowrap" }}>{label}</span>;
}
function Lbl({ c }) {
  return <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{c}</div>;
}

// Owner select: dropdown when team names available, text input fallback
function OwnerSelect({ value, onChange, teamNames, placeholder }) {
  if (!teamNames || teamNames.length === 0)
    return <input style={inp} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Owner"}/>;
  return (
    <select style={inp} value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">— owner —</option>
      {teamNames.map(n=><option key={n} value={n} style={{background:C.surface2}}>{n}</option>)}
    </select>
  );
}

// Escalation select: populated from all project users + standard governance roles.
// Always allows a Custom free-text entry as the last option.
function EscalationSelect({ value, onChange, options }) {
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  if (custom) {
    return (
      <input autoFocus style={{...inp, borderColor:C.risk}} value={customVal}
        onChange={e=>setCustomVal(e.target.value)}
        onBlur={()=>{ if(customVal.trim()) onChange(customVal.trim()); setCustom(false); }}
        onKeyDown={e=>{ if(e.key==="Enter"){ onChange(customVal.trim()||value); setCustom(false); } if(e.key==="Escape") setCustom(false); }}
        placeholder="Type name or role…"/>
    );
  }
  return (
    <select style={inp} value={value||""} onChange={e=>{ if(e.target.value==="__custom__"){setCustom(true);setCustomVal("");} else onChange(e.target.value); }}>
      <option value="">— select —</option>
      {options.map(o=><option key={o} value={o} style={{background:C.surface2}}>{o}</option>)}
      <option value="__custom__">Custom…</option>
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation modal (generic)
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, confirmColor, onConfirm, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
        width:"100%", maxWidth:480, padding:"20px 24px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:4 }}>{title}</div>
        {body && <div style={{ fontSize:11, color:C.muted, marginBottom:14, lineHeight:1.6 }}>{body}</div>}
        {children}
        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          <button onClick={onClose} style={{ flex:1, padding:"8px", background:"none",
            border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm}
            style={{ flex:2, padding:"8px", background:confirmColor||C.accent, border:"none",
              borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {confirmLabel||"Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Propose update modal — used by non-PM team members
// ─────────────────────────────────────────────────────────────────────────────
function ProposeModal({ type, targetId, targetType, member, onSubmit, onClose }) {
  const [note,       setNote]       = useState("");
  const [likelihood, setLikelihood] = useState("1 - Low");
  const [impact,     setImpact]     = useState("1 - Low");
  const [status,     setStatus]     = useState("Open");
  const [actionText, setActionText] = useState("");

  const handleSubmit = () => {
    const base = { id:`PRU-${Date.now()}`, date:toISO(new Date()), submittedBy:member?.loginCode||"", submitterName:member?.name||member?.loginCode||"", targetId, targetType, status:"pending" };
    if (type==="review")  onSubmit({ ...base, updateType:"review",  description:`Proposed rescoring for ${targetId}: ${likelihood} / ${impact}. ${note}`, data:{ likelihood, impact, note } });
    if (type==="status")  onSubmit({ ...base, updateType:"status",  description:`Proposed status change for ${targetId}: → ${status}`, data:{ status } });
    if (type==="action")  onSubmit({ ...base, updateType:"action",  description:`Proposed action on ${targetId}: ${actionText}`, data:{ text:actionText, owner:member?.name||"", date:toISO(new Date()) } });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
        width:"100%", maxWidth:480, padding:"20px 24px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:4 }}>
          Propose {type==="review"?"Score Review":type==="status"?"Status Change":"Action Item"}
        </div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>
          Linked to <span style={{ fontFamily:"monospace", color:C.accentL }}>{targetId}</span>. Your proposal will be sent to the PM for approval.
        </div>
        {type === "review" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <div><Lbl c="Proposed Likelihood"/>
              <select style={inp} value={likelihood} onChange={e=>setLikelihood(e.target.value)}>
                {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
              </select>
            </div>
            <div><Lbl c="Proposed Impact"/>
              <select style={inp} value={impact} onChange={e=>setImpact(e.target.value)}>
                {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"1/-1" }}><Lbl c="Observation / Note"/>
              <input style={inp} value={note} onChange={e=>setNote(e.target.value)} placeholder="What changed and why?"/>
            </div>
          </div>
        )}
        {type === "status" && (
          <div style={{ marginBottom:12 }}>
            <Lbl c="Proposed New Status"/>
            <select style={inp} value={status} onChange={e=>setStatus(e.target.value)}>
              {targetType==="risk"
                ? ["Open","Closed"].map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)
                : ["Open","In Progress","Resolved","Escalated"].map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)}
            </select>
          </div>
        )}
        {type === "action" && (
          <div style={{ marginBottom:12 }}><Lbl c="Action Description"/>
            <input style={inp} value={actionText} onChange={e=>setActionText(e.target.value)} placeholder="What action should be taken?"/>
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
          <button onClick={handleSubmit}
            style={{ flex:2, padding:"8px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Submit Proposal →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CCR pre-fill modal (preserved from batch build)
// ─────────────────────────────────────────────────────────────────────────────
function CCRPrefillModal({ source, item, onConfirm, onClose }) {
  const [desc,   setDesc]   = useState(`${source==="risk"?"Risk":"Issue"} ${item._id}: ${item.name||""}`);
  const [justif, setJustif] = useState(source==="risk"
    ? `Risk response requires change to baseline. Risk: ${item.name||""}. Mitigation: ${item.mitigation||"TBC"}`
    : `Issue requires baseline change. Issue: ${item.name||""}. Impact: ${item.impact||"TBC"}`
  );
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:"100%", maxWidth:520, padding:"20px 24px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:4 }}>Raise Change Request</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:16 }}>
          Linked to {source==="risk"?"Risk":"Issue"} <span style={{ fontFamily:"monospace", color:C.accentL }}>{item._id}</span>
          <span style={{ marginLeft:8 }}>— review the pre-filled details and continue to select impact and priority.</span>
        </div>
        <div style={{ marginBottom:10 }}><Lbl c="Description"/><input style={inp} value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div style={{ marginBottom:16 }}><Lbl c="Justification"/><input style={inp} value={justif} onChange={e=>setJustif(e.target.value)}/></div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"8px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>onConfirm({desc,justif})}
            style={{ flex:2, padding:"8px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Continue — select impact & priority →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk card
// ─────────────────────────────────────────────────────────────────────────────
function RiskCard({ risk, idx, canEdit, canPropose, onUpdate, onRaiseCCR, onClose, onDelete, onMaterialise, onPropose, teamNames, escalationOptions }) {
  const [open,          setOpen]          = useState(false);
  const [showReview,    setShowReview]    = useState(false);
  const [reviewNote,    setReviewNote]    = useState("");
  const [reviewL,       setReviewL]       = useState(risk.likelihood||"1 - Low");
  const [reviewI,       setReviewI]       = useState(risk.impact||"1 - Low");
  const [newAction,     setNewAction]     = useState({ text:"", owner:"", dueDate:"", done:false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMat,    setConfirmMat]    = useState(false);

  const riskType = risk.type || "Threat";
  const rag      = ragColor(riskType, risk.likelihood, risk.impact);
  const score    = (parseInt(risk.likelihood)||1)*(parseInt(risk.impact)||1);
  const residScore = risk.residualLikelihood && risk.residualImpact
    ? (parseInt(risk.residualLikelihood)||1)*(parseInt(risk.residualImpact)||1) : null;
  const residRag = residScore !== null ? ragColor(riskType, risk.residualLikelihood, risk.residualImpact) : null;
  const actions  = risk.actions      || [];
  const history  = risk.reviewHistory || [];
  const isClosed     = risk.status === "Closed";
  const isMaterialised = risk.status === "Materialised";
  const reviewOverdue  = risk.nextReviewDate && isOverdue(risk.nextReviewDate);
  const openActions    = actions.filter(a=>!a.done).length;

  const submitReview = () => {
    if (!reviewNote.trim()) return;
    const entry = { date:toISO(new Date()), likelihood:reviewL, impact:reviewI, score:(parseInt(reviewL)||1)*(parseInt(reviewI)||1), note:reviewNote.trim() };
    onUpdate(idx,"reviewHistory",[...history,entry]);
    onUpdate(idx,"likelihood",reviewL);
    onUpdate(idx,"impact",reviewI);
    onUpdate(idx,"lastReviewed",toISO(new Date()));
    setReviewNote(""); setShowReview(false);
  };

  const closeRisk = () => { onUpdate(idx,"status","Closed"); onUpdate(idx,"closedDate",toISO(new Date())); onClose?.(risk.name||risk._id); };
  const reopenRisk = () => { onUpdate(idx,"status","Open"); onUpdate(idx,"closedDate",""); };

  const addAction = () => {
    if (!newAction.text.trim()) return;
    const next = [...actions,{...newAction,id:`ACT-${String(actions.length+1).padStart(2,"0")}`,done:false}];
    onUpdate(idx,"actions",next);
    setNewAction({text:"",owner:"",dueDate:"",done:false});
  };
  const toggleAction = ai => { onUpdate(idx,"actions",actions.map((a,j)=>j===ai?{...a,done:!a.done}:a)); };
  const removeAction = ai => { onUpdate(idx,"actions",actions.filter((_,j)=>j!==ai)); };

  const borderColor = isMaterialised?C.opp:isClosed?C.muted:rag;

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${borderColor}`,
      borderRadius:8, marginBottom:10, opacity:isClosed?0.65:1 }}>

      {/* Collapsed header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", cursor:"pointer" }}
        onClick={()=>setOpen(o=>!o)}>
        <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted, fontWeight:700 }}>{risk._id}</span>
        {/* Type badge */}
        <span style={{ fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:10,
          background:(riskType==="Opportunity"?C.opp:C.risk)+"22",
          color:riskType==="Opportunity"?C.opp:C.risk,
          border:`1px solid ${riskType==="Opportunity"?C.opp:C.risk}44` }}>
          {riskType}
        </span>
        {isMaterialised
          ? <Badge label={`Materialised → ${risk.linkedIssueId||"?"}`} color={C.opp}/>
          : isClosed ? <Badge label="Closed" color={C.muted}/>
          : <Badge label={`Score: ${score}`} color={rag}/>
        }
        {residScore!==null && <Badge label={`Residual: ${residScore}`} color={residRag} small/>}
        {risk.category && <Badge label={risk.category} color={C.accentL} small/>}
        {reviewOverdue && <Badge label="Review overdue" color={C.risk} small/>}
        <span style={{ fontSize:12, color:isClosed?C.muted:C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{risk.name||"—"}</span>
        {openActions>0 && <Badge label={`${openActions} action${openActions>1?"s":""}`} color={C.milestone} small/>}
        {risk.lastReviewed && <span style={{ fontSize:9, color:C.muted }}>Reviewed {risk.lastReviewed}</span>}
        <span style={{ color:C.muted, fontSize:12 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>

          {/* Details */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, fontSize:11 }}>
            <div><span style={{ color:C.muted }}>Inherent: </span><span style={{ color:C.dim }}>{risk.likelihood||"—"} × {risk.impact||"—"}</span><span style={{ marginLeft:6 }}><Badge label={`${score}`} color={rag} small/></span></div>
            {residScore!==null && <div><span style={{ color:C.muted }}>Residual: </span><span style={{ color:C.dim }}>{risk.residualLikelihood} × {risk.residualImpact}</span><span style={{ marginLeft:6 }}><Badge label={`${residScore}`} color={residRag} small/></span></div>}
            <div><span style={{ color:C.muted }}>Response: </span>{risk.response&&<Badge label={risk.response} color={C.accentL} small/>}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:".3px" }}>Owner</span>
              {canEdit
                ? <OwnerSelect value={risk._suggestedOwner||""} onChange={v=>onUpdate(idx,"_suggestedOwner",v)} teamNames={teamNames} placeholder="— owner —"/>
                : <span style={{ color:C.accentL }}>{risk._suggestedOwner||"—"}</span>
              }
            </div>
            {risk.escalationPath && <div style={{ gridColumn:"1/-1" }}>
              <span style={{ color:C.muted }}>Escalation: </span><span style={{ color:C.risk }}>{risk.escalationPath}</span>
            </div>}
            {canEdit && (
              <div style={{ gridColumn:"1/-1" }}>
                <Lbl c="Escalation Path"/>
                <EscalationSelect value={risk.escalationPath||""} onChange={v=>onUpdate(idx,"escalationPath",v)} options={escalationOptions}/>
              </div>
            )}
            {risk.nextReviewDate && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Next review: </span><span style={{ color:reviewOverdue?C.risk:C.dim }}>{risk.nextReviewDate}{reviewOverdue?" — OVERDUE":""}</span></div>}
            {risk.cause         && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Cause: </span><span style={{ color:C.dim }}>{risk.cause}</span></div>}
            {risk.potentialImpact && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Potential impact: </span><span style={{ color:C.dim }}>{risk.potentialImpact}</span></div>}
            {risk.mitigation    && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Mitigation: </span><span style={{ color:C.dim }}>{risk.mitigation}</span></div>}
            {risk.closedDate    && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Closed: </span><span style={{ color:C.muted }}>{risk.closedDate}</span></div>}
            {risk.materialisedDate && <div style={{ gridColumn:"1/-1" }}><span style={{ color:C.muted }}>Materialised: </span><span style={{ color:C.opp }}>{risk.materialisedDate} → Issue {risk.linkedIssueId}</span></div>}
          </div>

          {/* ── Action Items ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
              Response Actions {actions.length>0&&`(${actions.filter(a=>a.done).length}/${actions.length} done)`}
            </div>
            {actions.map((a,ai)=>(
              <div key={ai} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0",
                borderBottom:`1px solid ${C.border}22`, opacity:a.done?0.55:1 }}>
                <button onClick={()=>toggleAction(ai)}
                  style={{ width:18, height:18, borderRadius:3, border:`1px solid ${a.done?C.activity:C.border}`,
                    background:a.done?C.activity+"22":"none", color:C.activity,
                    cursor:"pointer", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {a.done?"✓":""}
                </button>
                <span style={{ flex:1, fontSize:11, color:a.done?C.muted:C.sage, textDecoration:a.done?"line-through":"none" }}>{a.text}</span>
                {a.owner   && <span style={{ fontSize:9, color:C.accentL }}>{a.owner}</span>}
                {a.dueDate && <span style={{ fontSize:9, color:new Date(a.dueDate)<new Date()&&!a.done?C.risk:C.muted, fontFamily:"monospace" }}>{a.dueDate}</span>}
                {canEdit && <button onClick={()=>removeAction(ai)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</button>}
              </div>
            ))}
            {/* PM: direct add. Non-PM: propose action */}
            {!isClosed && !isMaterialised && (canEdit || canPropose) && (
              canEdit ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px auto", gap:6, marginTop:8 }}>
                  <input style={inp} value={newAction.text}    onChange={e=>setNewAction(p=>({...p,text:e.target.value}))}    placeholder="Action description"/>
                  <OwnerSelect value={newAction.owner} onChange={v=>setNewAction(p=>({...p,owner:v}))} teamNames={teamNames} placeholder="Owner"/>
                  <input style={inp} type="date" value={newAction.dueDate} onChange={e=>setNewAction(p=>({...p,dueDate:e.target.value}))}/>
                  <button onClick={addAction} style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>+ Add</button>
                </div>
              ) : (
                <button onClick={()=>onPropose?.("action", risk)}
                  style={{ marginTop:8, padding:"4px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:4, color:C.dim, fontSize:11, cursor:"pointer" }}>
                  + Propose action (requires PM approval)
                </button>
              )
            )}
          </div>

          {/* ── Review History ── */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>
                Review History ({history.length})
              </div>
              {canEdit && !isClosed && !isMaterialised && (
                <button onClick={()=>setShowReview(r=>!r)}
                  style={{ marginLeft:"auto", padding:"2px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontSize:10, cursor:"pointer" }}>
                  {showReview?"Cancel":"+ Log Review"}
                </button>
              )}
              {canPropose && !canEdit && !isClosed && !isMaterialised && (
                <button onClick={()=>onPropose?.("review", risk)}
                  style={{ marginLeft:"auto", padding:"2px 10px", background:"none", border:`1px dashed ${C.border}`, borderRadius:4, color:C.dim, fontSize:10, cursor:"pointer" }}>
                  + Propose review
                </button>
              )}
            </div>
            {showReview && (
              <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", marginBottom:10, border:`1px solid ${C.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <div><Lbl c="Revised Likelihood"/>
                    <select style={inp} value={reviewL} onChange={e=>setReviewL(e.target.value)}>
                      {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="Revised Impact"/>
                    <select style={inp} value={reviewI} onChange={e=>setReviewI(e.target.value)}>
                      {["1 - Low","2 - Medium","3 - High"].map(l=><option key={l} value={l} style={{background:C.surface2}}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Review Note — what changed and why?"/>
                    <input style={inp} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="e.g. Mitigation implemented — likelihood reduced"/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <span style={{ fontSize:10, color:C.muted, alignSelf:"center" }}>
                    New score: {(parseInt(reviewL)||1)*(parseInt(reviewI)||1)}{" "}
                    <Badge label={String((parseInt(reviewL)||1)*(parseInt(reviewI)||1))} color={ragColor(riskType,reviewL,reviewI)} small/>
                  </span>
                  <button onClick={submitReview} style={{ marginLeft:"auto", padding:"5px 14px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer" }}>Save Review</button>
                </div>
              </div>
            )}
            {history.length===0
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No reviews logged yet.</div>
              : history.map((h,hi)=>(
                <div key={hi} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:`1px solid ${C.border}22`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2 }}>{h.date}</span>
                  <Badge label={`Score: ${h.score}`} color={ragColor(riskType,h.likelihood,h.impact)} small/>
                  <span style={{ fontSize:11, color:C.dim, flex:1 }}>{h.note}</span>
                </div>
              ))
            }
          </div>

          {/* ── Actions: Close / Materialise / CCR / Delete / Propose Status ── */}
          {(canEdit || canPropose) && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              {canEdit && !isClosed && !isMaterialised && (
                <>
                  <button onClick={closeRisk}
                    style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                    ✓ Close Risk
                  </button>
                  {/* Materialise → Create Issue */}
                  {!confirmMat ? (
                    <button onClick={()=>setConfirmMat(true)}
                      style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.opp}`, borderRadius:5, color:C.opp, fontSize:11, cursor:"pointer" }}>
                      ⚡ Materialise → Create Issue
                    </button>
                  ) : (
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, color:C.muted }}>Create a linked issue from this risk?</span>
                      <button onClick={()=>{ setConfirmMat(false); onMaterialise?.(idx, risk); }}
                        style={{ padding:"4px 10px", background:C.opp, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yes</button>
                      <button onClick={()=>setConfirmMat(false)}
                        style={{ padding:"4px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
                    </div>
                  )}
                  <button onClick={()=>onRaiseCCR("risk",risk)}
                    style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.milestone}`, borderRadius:5, color:C.milestone, fontSize:11, cursor:"pointer" }}>
                    ↗ Raise CCR
                  </button>
                </>
              )}
              {canEdit && isClosed && (
                <button onClick={reopenRisk}
                  style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                  ↩ Reopen Risk
                </button>
              )}
              {canPropose && !canEdit && !isClosed && !isMaterialised && (
                <button onClick={()=>onPropose?.("status", risk)}
                  style={{ padding:"5px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer" }}>
                  Propose Status Change
                </button>
              )}
              {/* Delete */}
              {canEdit && (
                <div style={{ marginLeft:"auto" }}>
                  {!confirmDelete ? (
                    <button onClick={()=>setConfirmDelete(true)}
                      style={{ padding:"5px 10px", background:"none", border:`1px solid ${C.risk}44`, borderRadius:5, color:C.risk, fontSize:11, cursor:"pointer", opacity:0.7 }}>
                      🗑 Delete
                    </button>
                  ) : (
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, color:C.muted }}>Remove this risk?</span>
                      <button onClick={()=>{ setConfirmDelete(false); /* caller handles */ }}
                        style={{ padding:"4px 10px", background:C.risk, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                        Yes, delete
                      </button>
                      <button onClick={()=>setConfirmDelete(false)}
                        style={{ padding:"4px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue card
// ─────────────────────────────────────────────────────────────────────────────
function IssueCard({ iss, idx, canEdit, canPropose, onUpdate, onRaiseCCR, onDelete, onCreateSecondaryRisk, onPropose, teamNames, escalationOptions }) {
  const [open,          setOpen]          = useState(false);
  const [newAction,     setNewAction]     = useState({ text:"", owner:"", dueDate:"" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSec,    setConfirmSec]    = useState(false);

  const isResolved = iss.status === "Resolved";
  // Once an issue is resolved it becomes read-only — preserves the audit trail.
  // PM can change status back to re-open it; all other fields freeze.
  const editAllowed = canEdit && !isResolved;

  const sc      = statusColor(iss.status);
  const pc      = priorityColor(iss.priority);
  const actions = iss.actionLog || [];
  const overdue = iss.targetResolutionDate && new Date(iss.targetResolutionDate)<new Date() && iss.status!=="Resolved";

  const addAction = () => {
    if (!newAction.text.trim()) return;
    const entry = { ...newAction, date:toISO(new Date()), id:`AL-${String(actions.length+1).padStart(2,"0")}` };
    onUpdate(idx,"actionLog",[...actions,entry]);
    setNewAction({text:"",owner:"",dueDate:""});
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${sc}`, borderRadius:8, marginBottom:10 }}>
      {/* Collapsed header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted, fontWeight:700 }}>{iss._id}</span>
        <Badge label={iss.status||"Open"} color={sc}/>
        <Badge label={iss.priority||"Medium"} color={pc} small/>
        {overdue && <Badge label="Overdue" color={C.risk} small/>}
        {iss.linkedRiskId && <Badge label={`← ${iss.linkedRiskId}`} color={C.opp} small/>}
        {(iss.secondaryRisks||[]).length>0 && <Badge label={`→ ${iss.secondaryRisks.length} risk${iss.secondaryRisks.length>1?"s":""}`} color={C.milestone} small/>}
        <span style={{ fontSize:12, color:C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{iss.name||"—"}</span>
        {/* Show resolution snippet in collapsed header when resolved */}
        {isResolved && iss.resolution && (
          <span style={{ fontSize:10, color:C.activity, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontStyle:"italic" }}>
            ✓ {iss.resolution}
          </span>
        )}
        {isResolved && <span style={{ fontSize:10, color:C.muted }}>🔒</span>}
        {actions.length>0 && !isResolved && <Badge label={`${actions.length} action${actions.length>1?"s":""}`} color={C.accentL} small/>}
        {iss.targetResolutionDate && !isResolved && <span style={{ fontSize:9, color:overdue?C.risk:C.muted, fontFamily:"monospace" }}>Due {iss.targetResolutionDate}</span>}
        <span style={{ color:C.muted, fontSize:12 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>
          {iss.description && <div style={{ fontSize:12, color:C.dim, marginBottom:8, lineHeight:1.5 }}>{iss.description}</div>}
            {iss.linkedRiskId && (
            <div style={{ background:C.surface2, border:`1px solid ${C.opp}44`, borderRadius:6, padding:"6px 10px", marginBottom:10, fontSize:10, color:C.opp }}>
              ⚡ This issue was created from risk <span style={{ fontFamily:"monospace" }}>{iss.linkedRiskId}</span>
            </div>
          )}
          {isResolved && (
            <div style={{ background:"rgba(58,224,162,0.06)", border:`1px solid ${C.activity}44`, borderRadius:6, padding:"8px 12px", marginBottom:10, fontSize:11, color:C.activity }}>
              ✓ Resolved — this issue is read-only. {canEdit && <span style={{ color:C.dim }}>Change status to reopen.</span>}
            </div>
          )}
          {(iss.secondaryRisks||[]).length>0 && (
            <div style={{ background:C.surface2, border:`1px solid ${C.milestone}44`, borderRadius:6, padding:"6px 10px", marginBottom:10, fontSize:10, color:C.milestone }}>
              This issue generated secondary risks: {iss.secondaryRisks.join(", ")}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, fontSize:11 }}>
            {iss.cause  && <div><span style={{ color:C.muted }}>Cause: </span><span style={{ color:C.dim }}>{iss.cause}</span></div>}
            {iss.impact && <div><span style={{ color:C.muted }}>Impact: </span><span style={{ color:C.dim }}>{iss.impact}</span></div>}
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:".3px" }}>Owner</span>
              {editAllowed
                ? <OwnerSelect value={iss.owner||""} onChange={v=>onUpdate(idx,"owner",v)} teamNames={teamNames} placeholder="— owner —"/>
                : iss.owner?<span style={{ color:C.accentL }}>{iss.owner}</span>:null
              }
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:".3px" }}>Escalation Path</span>
              {editAllowed
                ? <EscalationSelect value={iss.escalationPath||""} onChange={v=>onUpdate(idx,"escalationPath",v)} options={escalationOptions}/>
                : iss.escalationPath?<span style={{ color:C.dim }}>{iss.escalationPath}</span>:null
              }
            </div>
            {iss.raisedDate && <div><span style={{ color:C.muted }}>Raised: </span><span style={{ color:C.muted }}>{iss.raisedDate}</span></div>}
          </div>

          {/* Status — PM can always change status (to reopen resolved issues) */}
          {canEdit && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:8, marginBottom:12 }}>
              <div><Lbl c="Status"/>
                <select style={inp} value={iss.status||"Open"} onChange={e=>onUpdate(idx,"status",e.target.value)}>
                  {["Open","In Progress","Resolved","Escalated"].map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)}
                </select>
              </div>
              <div><Lbl c="Resolution Summary"/>
                <input style={inp} value={iss.resolution||""} disabled={isResolved}
                  onChange={e=>!isResolved&&onUpdate(idx,"resolution",e.target.value)}
                  placeholder={isResolved?"Locked once resolved":"What was done to resolve this?"}/>
              </div>
            </div>
          )}

          {/* Action Log */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
              Action Log ({actions.length})
            </div>
            {actions.length===0
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:8 }}>No actions logged yet.</div>
              : actions.map((a,ai)=>(
                <div key={ai} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:`1px solid ${C.border}22`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2 }}>{a.date}</span>
                  <span style={{ fontSize:11, color:C.sage, flex:1 }}>{a.text}</span>
                  {a.owner   && <span style={{ fontSize:9, color:C.accentL, flexShrink:0 }}>{a.owner}</span>}
                  {a.dueDate && <span style={{ fontSize:9, color:C.muted, fontFamily:"monospace", flexShrink:0 }}>{a.dueDate}</span>}
                </div>
              ))
            }
            {(editAllowed || canPropose) && (
              editAllowed ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px auto", gap:6, marginTop:8 }}>
                  <input style={inp} value={newAction.text}    onChange={e=>setNewAction(p=>({...p,text:e.target.value}))}    placeholder="Action taken or assigned"/>
                  <OwnerSelect value={newAction.owner} onChange={v=>setNewAction(p=>({...p,owner:v}))} teamNames={teamNames} placeholder="Owner"/>
                  <input style={inp} type="date" value={newAction.dueDate} onChange={e=>setNewAction(p=>({...p,dueDate:e.target.value}))}/>
                  <button onClick={addAction} style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>+ Log</button>
                </div>
              ) : (
                <button onClick={()=>onPropose?.("action", iss, "issue")}
                  style={{ marginTop:8, padding:"4px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:4, color:C.dim, fontSize:11, cursor:"pointer" }}>
                  + Propose action (requires PM approval)
                </button>
              )
            )}
          </div>

          {/* Footer: CCR + Secondary Risk + Delete */}
          {(editAllowed || canPropose) && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {editAllowed && iss.status!=="Resolved" && (
                <>
                  <button onClick={()=>onRaiseCCR("issue",iss)}
                    style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.milestone}`, borderRadius:5, color:C.milestone, fontSize:11, cursor:"pointer" }}>
                    ↗ Raise CCR
                  </button>
                  {/* Create secondary risk */}
                  {!confirmSec ? (
                    <button onClick={()=>setConfirmSec(true)}
                      style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.opp}`, borderRadius:5, color:C.opp, fontSize:11, cursor:"pointer" }}>
                      + Secondary Risk
                    </button>
                  ) : (
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, color:C.muted }}>Create a secondary risk from this issue?</span>
                      <button onClick={()=>{ setConfirmSec(false); onCreateSecondaryRisk?.(idx, iss); }}
                        style={{ padding:"4px 10px", background:C.opp, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yes</button>
                      <button onClick={()=>setConfirmSec(false)}
                        style={{ padding:"4px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
                    </div>
                  )}
                </>
              )}
              {canPropose && !editAllowed && !isResolved && (
                <button onClick={()=>onPropose?.("status", iss, "issue")}
                  style={{ padding:"5px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer" }}>
                  Propose Status Change
                </button>
              )}
              {/* Delete — only when not resolved */}
              {editAllowed && (
                <div style={{ marginLeft:"auto" }}>
                  {!confirmDelete ? (
                    <button onClick={()=>setConfirmDelete(true)}
                      style={{ padding:"5px 10px", background:"none", border:`1px solid ${C.risk}44`, borderRadius:5, color:C.risk, fontSize:11, cursor:"pointer", opacity:0.7 }}>
                      🗑 Delete
                    </button>
                  ) : (
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, color:C.muted }}>Remove this issue?</span>
                      <button onClick={()=>{ setConfirmDelete(false); onDelete(idx); }}
                        style={{ padding:"4px 10px", background:C.risk, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Yes, delete</button>
                      <button onClick={()=>setConfirmDelete(false)}
                        style={{ padding:"4px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending updates tab — PM reviews and approves team member proposals
// ─────────────────────────────────────────────────────────────────────────────
function PendingTab({ pendingUpdates, onApprove, onReject }) {
  const [rejectId,     setRejectId]     = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const pending  = (pendingUpdates||[]).filter(u=>u.status==="pending");
  const approved = (pendingUpdates||[]).filter(u=>u.status==="approved");
  const rejected = (pendingUpdates||[]).filter(u=>u.status==="rejected");
  const typeLabel = { action:"Action item", review:"Score review", status:"Status change" };
  return (
    <div style={{ padding:"16px 20px" }}>
      {pending.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:C.muted, fontSize:12 }}>No pending proposals.</div>
      ) : pending.map(u=>(
        <div key={u.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.milestone}`,
          borderRadius:8, padding:"12px 14px", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:C.accentL }}>{u.targetId}</span>
            <span style={{ fontSize:9, padding:"2px 7px", borderRadius:12, background:C.milestone+"22", color:C.milestone, border:`1px solid ${C.milestone}44` }}>{typeLabel[u.updateType]||u.updateType}</span>
            <span style={{ fontSize:10, color:C.muted }}>{u.date}</span>
            <span style={{ fontSize:10, color:C.dim }}>from {u.submitterName||u.submittedBy}</span>
          </div>
          <div style={{ fontSize:12, color:C.sage, marginBottom:4 }}>{u.description}</div>
          {u.data?.note && <div style={{ fontSize:10, color:C.muted, fontStyle:"italic", marginBottom:8 }}>"{u.data.note}"</div>}
          {rejectId===u.id ? (
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              <input style={{...inp, flex:1, minWidth:160}} value={rejectReason} autoFocus
                onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection…"/>
              <button onClick={()=>{ onReject(u.id,rejectReason); setRejectId(null); setRejectReason(""); }}
                disabled={!rejectReason}
                style={{ padding:"5px 12px", background:rejectReason?C.risk:C.surface2, border:"none", borderRadius:4,
                  color:rejectReason?"#fff":C.muted, fontSize:11, fontWeight:700, cursor:rejectReason?"pointer":"not-allowed" }}>Confirm Reject</button>
              <button onClick={()=>{setRejectId(null);setRejectReason("");}}
                style={{ padding:"5px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:11, cursor:"pointer" }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>onApprove(u.id)}
                style={{ padding:"5px 14px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓ Approve</button>
              <button onClick={()=>setRejectId(u.id)}
                style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.risk}`, borderRadius:4, color:C.risk, fontSize:11, cursor:"pointer" }}>✕ Reject</button>
            </div>
          )}
        </div>
      ))}
      {(approved.length>0||rejected.length>0) && (
        <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
            Actioned ({approved.length} approved, {rejected.length} rejected)
          </div>
          {[...approved,...rejected].map(u=>(
            <div key={u.id} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:`1px solid ${C.border}22`, fontSize:10, alignItems:"center" }}>
              <span style={{ fontFamily:"monospace", color:C.muted, width:60, flexShrink:0 }}>{u.targetId}</span>
              <span style={{ color:u.status==="approved"?C.activity:C.risk, fontWeight:700, flexShrink:0 }}>{u.status}</span>
              <span style={{ color:C.dim, flex:1 }}>{u.description}</span>
              {u.rejectionReason && <span style={{ color:C.risk, fontStyle:"italic" }}>— {u.rejectionReason}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function L3Risks({ state, risks, member, onStateChange, loginCodes, onTriggerCCR }) {
  const [activeTab,    setActiveTab]    = useState("risks");
  const [ccrSource,    setCcrSource]    = useState(null);
  const [filterClosed, setFilterClosed] = useState(false);
  const [closeToast,   setCloseToast]   = useState("");
  const [proposeModal, setProposeModal] = useState(null);
  const [reviewBannerDismissed, setReviewBannerDismissed] = useState(false); // { type, item, targetType }

  const canEdit    = member?.isPM;
  // Non-PM logged-in team members can submit proposals
  const canPropose = !!(member?.loginCode) && !member?.isPM && member?.isExternal !== true;

  const sheets          = state?.l2?.sheets || {};
  const issues          = sheets["05"]?.data?.issues        || [];
  const pendingUpdates  = sheets["05"]?.data?.pendingUpdates || [];
  const transitions     = sheets["05"]?.data?.transitions   || [];

  const pendingCount = pendingUpdates.filter(u=>u.status==="pending").length;

  const teamNames = useMemo(()=>(loginCodes||[]).map(m=>m.name).filter(Boolean), [loginCodes]);

  // Escalation options: all named team members + project sponsor + governance roles.
  // Materialised risks link to issues; escalation paths must cover all project users.
  const sponsor = state?.l2?.sheets?.["01"]?.data?.charter?.projectSponsor || "";
  const escalationOptions = useMemo(() => {
    const names = (loginCodes||[]).map(m=>m.name).filter(Boolean);
    return [...new Set([
      ...(sponsor ? [sponsor] : []),
      ...names,
      "Project Sponsor",
      "Steering Committee",
      "Board",
      "Project Director",
    ])].filter(Boolean);
  }, [loginCodes, sponsor]);

  // ── Core state writer ────────────────────────────────────────────────────
  const write05 = useCallback((updater) => {
    onStateChange(prev => {
      const d05  = prev.l2.sheets["05"]?.data || {};
      const next = updater(d05);
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "05": { ...prev.l2.sheets["05"], data: next }
      }}};
    });
  }, [onStateChange]);

  // ── Risk field update ─────────────────────────────────────────────────────
  const updateRisk = useCallback((idx, field, val) => {
    write05(d05 => ({ ...d05, risks:(d05.risks||[]).map((r,i)=>i===idx?{...r,[field]:val}:r) }));
  }, [write05]);

  // ── Issue field update ────────────────────────────────────────────────────
  const updateIssue = useCallback((idx, field, val) => {
    write05(d05 => ({ ...d05, issues:(d05.issues||[]).map((iss,i)=>i===idx?{...iss,[field]:val}:iss) }));
  }, [write05]);

  // ── Delete risk ───────────────────────────────────────────────────────────
  const deleteRisk = useCallback((idx) => {
    write05(d05 => ({ ...d05, risks:(d05.risks||[]).filter((_,i)=>i!==idx) }));
  }, [write05]);

  // ── Delete issue ──────────────────────────────────────────────────────────
  const deleteIssue = useCallback((idx) => {
    write05(d05 => ({ ...d05, issues:(d05.issues||[]).filter((_,i)=>i!==idx) }));
  }, [write05]);

  // ── Add new issue ─────────────────────────────────────────────────────────
  const addIssue = useCallback(() => {
    write05(d05 => {
      const curr = d05.issues || [];
      return { ...d05, issues:[...curr, {
        _id:`I-${String(101+curr.length).padStart(3,"0")}`,
        name:"", description:"", cause:"", impact:"",
        priority:"Medium", owner:"", raisedDate:toISO(new Date()),
        targetResolutionDate:"", status:"Open", resolution:"",
        escalationPath:"", actionLog:[],
      }]};
    });
  }, [write05]);

  // ── Materialise risk → create linked issue ────────────────────────────────
  const handleMaterialise = useCallback((riskIdx, risk) => {
    write05(d05 => {
      const curr    = d05.issues || [];
      const newId   = `I-${String(101+curr.length).padStart(3,"0")}`;
      const today   = toISO(new Date());
      const newIssue = {
        _id:newId, name:risk.name||"", description:`Materialised from risk ${risk._id}`,
        cause:risk.cause||"", impact:risk.potentialImpact||"",
        priority:(parseInt(risk.likelihood)||1)*(parseInt(risk.impact)||1)>=9?"High":
                 (parseInt(risk.likelihood)||1)*(parseInt(risk.impact)||1)>=4?"Medium":"Low",
        owner:risk._suggestedOwner||"", raisedDate:today, targetResolutionDate:"",
        status:"Open", resolution:"", escalationPath:risk.escalationPath||"",
        actionLog:[], linkedRiskId:risk._id,
      };
      const newRisks = (d05.risks||[]).map((r,i)=>i===riskIdx
        ?{...r,status:"Materialised",materialisedDate:today,linkedIssueId:newId}:r);
      const trnId = `TRN-${String((d05.transitions||[]).length+1).padStart(3,"0")}`;
      const trnEntry = { id:trnId, date:today, type:"risk_to_issue", sourceId:risk._id,
        targetId:newId, description:`Risk "${risk.name||risk._id}" materialised — linked issue ${newId} created`,
        performedBy:member?.loginCode||"PM" };
      return { ...d05, risks:newRisks, issues:[...curr,newIssue],
        transitions:[...(d05.transitions||[]),trnEntry] };
    });
    setCloseToast(`Risk materialised — Issue created`);
    setTimeout(()=>setCloseToast(""), 4000);
    setActiveTab("issues");
  }, [write05, member]);

  // ── Create secondary risk from issue ─────────────────────────────────────
  const handleCreateSecondaryRisk = useCallback((issueIdx, iss) => {
    write05(d05 => {
      const currRisks = d05.risks || [];
      const newId     = `R-${String(101+currRisks.length).padStart(3,"0")}`;
      const today     = toISO(new Date());
      const newRisk   = {
        _id:newId, type:"Threat",
        name:`Secondary: ${iss.name||iss._id}`, category:"",
        cause:`Secondary risk arising from issue ${iss._id}: ${iss.cause||iss.description||""}`,
        potentialImpact:"", likelihood:"1 - Low", impact:"1 - Low",
        residualLikelihood:"", residualImpact:"",
        response:"Avoid", mitigation:"", _suggestedOwner:iss.owner||"",
        escalationPath:iss.escalationPath||"", nextReviewDate:"",
        linkedSourceIssueId:iss._id, riskSource:"secondary",
      };
      const newIssues = (d05.issues||[]).map((i,idx)=>idx===issueIdx
        ?{...i,secondaryRisks:[...(i.secondaryRisks||[]),newId]}:i);
      const trnId = `TRN-${String((d05.transitions||[]).length+1).padStart(3,"0")}`;
      const trnEntry = { id:trnId, date:today, type:"issue_to_secondary_risk",
        sourceId:iss._id, targetId:newId,
        description:`Secondary risk "${newRisk.name}" created from issue ${iss._id}`,
        performedBy:member?.loginCode||"PM" };
      return { ...d05, risks:[...currRisks,newRisk], issues:newIssues,
        transitions:[...(d05.transitions||[]),trnEntry] };
    });
    setCloseToast(`Secondary risk created — see Risks tab`);
    setTimeout(()=>setCloseToast(""),4000);
    setActiveTab("risks");
  }, [write05, member]);

  // ── Submit proposal (team member) ─────────────────────────────────────────
  const handleProposalSubmit = useCallback((proposal) => {
    write05(d05=>({ ...d05, pendingUpdates:[...(d05.pendingUpdates||[]),proposal] }));
    setProposeModal(null);
    setCloseToast(`Proposal submitted — awaiting PM review`);
    setTimeout(()=>setCloseToast(""),4000);
  }, [write05]);

  // ── Approve pending update (PM) ───────────────────────────────────────────
  const handleApprove = useCallback((updateId) => {
    write05(d05 => {
      const update = (d05.pendingUpdates||[]).find(u=>u.id===updateId);
      if (!update) return d05;
      let newRisks = d05.risks||[], newIssues = d05.issues||[];
      if (update.targetType==="risk"||(!update.targetType&&(d05.risks||[]).find(r=>r._id===update.targetId))) {
        const idx = (d05.risks||[]).findIndex(r=>r._id===update.targetId);
        if (idx>=0) {
          if (update.updateType==="review") {
            const h = { date:update.date, likelihood:update.data.likelihood, impact:update.data.impact,
              score:(parseInt(update.data.likelihood)||1)*(parseInt(update.data.impact)||1), note:update.data.note||"" };
            newRisks = (d05.risks||[]).map((r,i)=>i===idx?{...r,likelihood:update.data.likelihood,
              impact:update.data.impact,lastReviewed:update.date,reviewHistory:[...(r.reviewHistory||[]),h]}:r);
          } else if (update.updateType==="status") {
            newRisks = (d05.risks||[]).map((r,i)=>i===idx?{...r,status:update.data.status}:r);
          } else if (update.updateType==="action") {
            newRisks = (d05.risks||[]).map((r,i)=>i===idx?{...r,actions:[...(r.actions||[]),update.data]}:r);
          }
        }
      } else {
        const idx = (d05.issues||[]).findIndex(iss=>iss._id===update.targetId);
        if (idx>=0) {
          if (update.updateType==="status") {
            newIssues = (d05.issues||[]).map((iss,i)=>i===idx?{...iss,status:update.data.status}:iss);
          } else if (update.updateType==="action") {
            newIssues = (d05.issues||[]).map((iss,i)=>i===idx?{...iss,actionLog:[...(iss.actionLog||[]),update.data]}:iss);
          }
        }
      }
      const newPU = (d05.pendingUpdates||[]).map(u=>u.id===updateId?{...u,status:"approved"}:u);
      return { ...d05, risks:newRisks, issues:newIssues, pendingUpdates:newPU };
    });
  }, [write05]);

  // ── Reject pending update (PM) ────────────────────────────────────────────
  const handleReject = useCallback((updateId, reason) => {
    write05(d05=>({ ...d05, pendingUpdates:(d05.pendingUpdates||[]).map(u=>u.id===updateId?{...u,status:"rejected",rejectionReason:reason}:u) }));
  }, [write05]);

  // ── CCR trigger ───────────────────────────────────────────────────────────
  const handleRaiseCCR = useCallback((type, item) => { setCcrSource({type,item}); }, []);
  const handlePrefillConfirm = useCallback(({desc,justif})=>{
    if (!ccrSource) return;
    const {type,item} = ccrSource;
    if (onTriggerCCR) onTriggerCCR({
      elementType:type, elementId:item._id, fieldName:type==="risk"?"mitigation":"resolution",
      oldValue:"", newValue:"", elementName:item.name||item._id, description:desc,
      prefillJustification:justif, date:toISO(new Date()),
      requestedBy:member?.loginCode||member?.name||"PM",
      linkedId:item._id, linkedType:type,
    });
    setCcrSource(null);
  }, [ccrSource, member, onTriggerCCR]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Materialised risks remain on the register permanently — they are part of the audit
  // trail and link to their derived issues. Only truly Closed risks get the toggle.
  const displayRisks   = useMemo(()=>filterClosed?risks:risks.filter(r=>r.status!=="Closed"), [risks,filterClosed]);
  const closedCount    = risks.filter(r=>r.status==="Closed").length;
  const openRisks     = displayRisks.filter(r=>ragColor(r.type||"Threat",r.likelihood,r.impact)===C.risk).length;
  const ambRisks      = displayRisks.filter(r=>ragColor(r.type||"Threat",r.likelihood,r.impact)===C.milestone).length;
  const openIssues    = issues.filter(i=>i.status!=="Resolved").length;
  const resolvedIss   = issues.filter(i=>i.status==="Resolved").length;
  const overdueReviews = risks.filter(r=>r.nextReviewDate&&isOverdue(r.nextReviewDate)&&r.status==="Open").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* Sub-nav */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex",
        alignItems:"center", padding:"0 20px", flexShrink:0 }}>
        {[
          ["risks",  `Risks (${risks.length})`,  "⚠️"],
          ["issues", `Issues (${issues.length})`, "🚨"],
          ...(canEdit && pendingCount>0 ? [["pending",`Updates (${pendingCount})`,"⏳"]] : []),
        ].map(([id,label,icon])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"0 14px", height:38,
              fontSize:11, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===id?C.accentL:"transparent"}`,
              color:activeTab===id?C.sage:C.muted, cursor:"pointer", whiteSpace:"nowrap", position:"relative" }}>
            <span>{icon}</span>{label}
            {id==="pending" && pendingCount>0 && activeTab!=="pending" && (
              <span style={{ position:"absolute", top:6, right:4, width:7, height:7,
                borderRadius:"50%", background:C.milestone }}/>
            )}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:10, fontSize:10, alignItems:"center" }}>
          {activeTab==="risks" ? (
            <>
              <span style={{ color:C.risk }}>⬤ {openRisks} Red</span>
              <span style={{ color:C.milestone }}>⬤ {ambRisks} Amber</span>
              <span style={{ color:C.activity }}>⬤ {displayRisks.length-openRisks-ambRisks} Green</span>
              {overdueReviews>0 && <span style={{ color:C.risk }}>🕐 {overdueReviews} review{overdueReviews>1?"s":""} overdue</span>}
              {closedCount>0 && (
                <button onClick={()=>setFilterClosed(f=>!f)}
                  style={{ padding:"2px 8px", background:"none", border:`1px solid ${C.border}`, borderRadius:10, color:C.muted, fontSize:9, cursor:"pointer" }}>
                  {filterClosed?`Hide ${closedCount} closed`:`Show ${closedCount} closed`}
                </button>
              )}
            </>
          ) : activeTab==="issues" ? (
            <>
              <span style={{ color:C.risk }}>⬤ {openIssues} Open</span>
              <span style={{ color:C.activity }}>⬤ {resolvedIss} Resolved</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Toast */}
      {closeToast && (
        <div style={{ padding:"6px 20px", background:"rgba(58,224,162,0.08)",
          borderBottom:`1px solid ${C.activity}`, fontSize:11, color:C.activity, flexShrink:0 }}>
          ✓ {closeToast}
        </div>
      )}

      {/* Content */}
      {activeTab==="pending" && canEdit ? (
        <PendingTab pendingUpdates={pendingUpdates} onApprove={handleApprove} onReject={handleReject}/>
      ) : (
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

          {activeTab==="risks" && (
            <div>
              {/* Overdue review banner */}
              {overdueReviews > 0 && !reviewBannerDismissed && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                  background:"rgba(224,92,92,0.08)", border:`1px solid ${C.risk}44`,
                  borderRadius:7, marginBottom:12, fontSize:11 }}>
                  <span style={{ color:C.risk }}>🕐</span>
                  <span style={{ color:C.dim, flex:1 }}>
                    <strong style={{ color:C.risk }}>{overdueReviews} risk{overdueReviews>1?"s":""}</strong> {overdueReviews>1?"have":"has"} a review overdue. Open each risk to log an updated score and note.
                  </span>
                  <button onClick={()=>setReviewBannerDismissed(true)}
                    style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, flexShrink:0 }}>✕</button>
                </div>
              )}
              {displayRisks.length===0 && (
                <div style={{ padding:"48px 0", textAlign:"center", color:C.muted, fontSize:13 }}>
                  {filterClosed&&closedCount>0
                    ?"No open or materialised risks. All risks are closed."
                    :"No risks logged yet. Go to L2 → Sheet 05 to add risks."}
                </div>
              )}
              {displayRisks.map((r,i)=>(
                <RiskCard
                  key={r._id||i}
                  risk={r} idx={risks.indexOf(r)}
                  canEdit={canEdit} canPropose={canPropose}
                  onUpdate={updateRisk}
                  onRaiseCCR={handleRaiseCCR}
                  onMaterialise={handleMaterialise}
                  onDelete={deleteRisk}
                  onPropose={(type,item)=>setProposeModal({type,item,targetType:"risk"})}
                  teamNames={teamNames}
                  escalationOptions={escalationOptions}
                  onClose={name=>{ setCloseToast(`Risk "${name}" closed`); setTimeout(()=>setCloseToast(""),4000); }}
                />
              ))}
              {displayRisks.length>0 && (
                <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
                  Basic details configured in L2 → Sheet 05. Actions, reviews, closure, and materialisation managed here.
                </div>
              )}
            </div>
          )}

          {activeTab==="issues" && (
            <div>
              <div style={{ fontSize:12, color:C.dim, marginBottom:14, lineHeight:1.6 }}>
                Issues are risks that have materialised. They remain in the issue register as a separate governance category. An issue may generate secondary risks, which appear in the risk register linked back here.
              </div>
              {issues.length===0 && (
                <div style={{ padding:"32px 0", textAlign:"center", color:C.muted, fontSize:13 }}>
                  No issues logged yet.{canEdit&&<span style={{ color:C.accentL }}> Add one below or materialise a risk above.</span>}
                </div>
              )}
              {issues.map((iss,i)=>(
                <IssueCard
                  key={iss._id||i}
                  iss={iss} idx={i}
                  canEdit={canEdit} canPropose={canPropose}
                  onUpdate={updateIssue}
                  onRaiseCCR={handleRaiseCCR}
                  onDelete={deleteIssue}
                  onCreateSecondaryRisk={handleCreateSecondaryRisk}
                  onPropose={(type,item,targetType)=>setProposeModal({type,item,targetType:targetType||"issue"})}
                  teamNames={teamNames}
                  escalationOptions={escalationOptions}
                />
              ))}
              {canEdit && (
                <button onClick={addIssue}
                  style={{ padding:"8px 14px", background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:4 }}>
                  + Log Issue
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* CCR prefill modal */}
      {ccrSource && (
        <CCRPrefillModal
          source={ccrSource.type} item={ccrSource.item}
          onConfirm={handlePrefillConfirm}
          onClose={()=>setCcrSource(null)}
        />
      )}

      {/* Proposal modal (non-PM) */}
      {proposeModal && (
        <ProposeModal
          type={proposeModal.type}
          targetId={proposeModal.item._id}
          targetType={proposeModal.targetType}
          member={member}
          onSubmit={handleProposalSubmit}
          onClose={()=>setProposeModal(null)}
        />
      )}
    </div>
  );
}
