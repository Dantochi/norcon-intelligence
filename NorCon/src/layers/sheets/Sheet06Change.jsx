import { useEffect, useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c})=><div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;

const CHANGE_TYPES = ["Scope Change","Schedule Change","Budget Change","Quality Change","Resource Change","Process Change","Technical Change","Custom..."];
const decColor = { approved:C.activity, rejected:C.risk, pending:C.milestone, reviewed:"#3a9ce0", Approved:C.activity, Rejected:C.risk, Pending:C.milestone, Deferred:C.muted };

function nextChangeId(changes, prefix) {
  const max = (changes || []).reduce((highest, change) => {
    const n = parseInt(String(change?.id || "").replace(`${prefix}-`, ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3,"0")}`;
}

function StatusBadge({ status }) {
  const s = (status||"pending").toLowerCase();
  const col = s==="approved"?C.activity:s==="rejected"?C.risk:s==="reviewed"?"#3a9ce0":C.milestone;
  const label = status ? status.charAt(0).toUpperCase()+status.slice(1) : "Pending";
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:col+"22",color:col,border:`1px solid ${col}`,whiteSpace:"nowrap"}}>{label}</span>;
}

export default function Sheet06Change({ data, locked, loginCodes, allSheets, onUpdate }) {
  const [changes,   setChanges]   = useState(data.changes   || []);
  const [approvers, setApprovers] = useState(data.approvers || []);
  const [activeTab, setActiveTab] = useState("log");
  const [actingAs,  setActingAs]  = useState("");   // who is actioning in the approval tab
  const [rejectId,  setRejectId]  = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setChanges(data.changes || []);
    setApprovers(data.approvers || []);
  }, [data.changes, data.approvers]);

  const charter     = allSheets?.["01"]?.data?.charter || {};
  const teamMembers = loginCodes || [];

  const initApprovers = () => {
    const list = [];
    if (charter.projectSponsor) list.push({ name:charter.projectSponsor, role:"Project Sponsor", rights:[], loginCode:"SPONSOR" });
    teamMembers.forEach(m => list.push({ name:m.name, role:m.role, rights:[], loginCode:m.loginCode }));
    return list;
  };

  const effectiveApprovers = approvers.length > 0 ? approvers : initApprovers();

  /* ── Persist helpers ── */
  const saveChanges = (next) => { setChanges(next); onUpdate({ changes:next, approvers:effectiveApprovers }, "in-progress"); };
  const saveApprovers = (next) => { setApprovers(next); onUpdate({ changes, approvers:next }, "in-progress"); };

  const updateChange = (idx, field, value) => {
    saveChanges(changes.map((c,i) => i===idx ? {...c,[field]:value} : c));
  };

  const addChange = () => {
    const id = nextChangeId(changes, "CCR");
    saveChanges([...changes, { id, date:new Date().toISOString().split("T")[0], requestedBy:"", changeType:"", description:"", justification:"", impact:"", status:"pending", approvedBy:"", type:"major" }]);
  };

  const removeChange = (idx) => saveChanges(changes.filter((_,i)=>i!==idx));

  /* ── Approval actions (in L2) ── */
  const actionChange = (id, newStatus, reason) => {
    const actor = effectiveApprovers.find(a=>a.loginCode===actingAs||a.name===actingAs);
    const next = changes.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, status: newStatus };
      if (newStatus === "reviewed")  updated.reviewerName = actor?.name || actingAs;
      if (newStatus === "approved")  updated.approverName = actor?.name || actingAs;
      if (newStatus === "rejected") { updated.approverName = actor?.name || actingAs; if(reason) updated.rejectionReason = reason; }
      return updated;
    });
    saveChanges(next);
    setRejectId(null);
    setRejectReason("");
  };

  /* ── Approval rights helpers ── */
  const teamRolesList = [
    ...teamMembers.map(m => ({ role:m.role, name:m.name, loginCode:m.loginCode })),
    ...(charter?.projectSponsor ? [{ role:"Project Sponsor", name:charter.projectSponsor, loginCode:"SPONSOR" }] : []),
  ].filter(r=>r.role);
  const seen = new Set();
  const uniqueRoles = teamRolesList.filter(r => { if(seen.has(r.role)) return false; seen.add(r.role); return true; });

  const toggleRoleRight = (role, right) => {
    if (locked) return;
    const base = approvers.length > 0 ? [...approvers] : [...initApprovers()];
    const idx  = base.findIndex(a=>a.role===role);
    if (idx===-1) base.push({ name:role, role, rights:[right], loginCode:"" });
    else { const cur=base[idx].rights||[]; base[idx]={...base[idx], rights: cur.includes(right)?cur.filter(r=>r!==right):[...cur,right]}; }
    saveApprovers(base);
  };

  /* ── Derived ── */
  const majorChanges = changes.filter(c => c.type==="major" || (!c.type && c.id?.startsWith("CCR")));
  const minorChanges = changes.filter(c => c.type==="minor"  || c.id?.startsWith("MIN"));
  const pendingCCRs  = majorChanges.filter(c => c.status==="pending" || c.status==="reviewed");

  const allActors = [
    ...teamMembers.map(m=>({label:`${m.name} (${m.role})`, value:m.loginCode})),
    ...(charter.projectSponsor?[{label:`${charter.projectSponsor} (Sponsor)`, value:"SPONSOR"}]:[]),
  ];

  /* ── Acting user's rights ── */
  const actorApprover = effectiveApprovers.find(a=>a.loginCode===actingAs||a.name===actingAs);
  const canReview  = (c) => !actingAs ? false : (c.status==="pending"  && (actorApprover?.rights||[]).includes("reviewer"));
  const canApprove = (c) => !actingAs ? false : (c.status==="reviewed" && (actorApprover?.rights||[]).includes("approver"));
  const canReject  = (c) => !actingAs ? false : (["pending","reviewed"].includes(c.status) && ((actorApprover?.rights||[]).some(r=>["reviewer","approver"].includes(r))));

  const teamNames = teamMembers.map(m=>m.name).filter(Boolean);
  if (charter.projectSponsor && !teamNames.includes(charter.projectSponsor)) teamNames.unshift(charter.projectSponsor);

  const TABS = [
    ["log",       "Change Request Log"],
    ["pending",   `Pending Approval${pendingCCRs.length>0?` (${pendingCCRs.length})`:""}`],
    ["approvers", "Approval Rights"],
  ];

  return (
    <div style={{maxWidth:960}}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {TABS.map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{padding:"5px 14px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,
              background:activeTab===t?C.accent:"none",color:activeTab===t?"#fff":C.muted,cursor:"pointer",position:"relative"}}>
            {l}
            {t==="pending"&&pendingCCRs.length>0&&activeTab!=="pending"&&(
              <span style={{position:"absolute",top:2,right:2,width:7,height:7,borderRadius:"50%",background:C.risk}}/>
            )}
          </button>
        ))}
      </div>

      {/* ══ CHANGE REQUEST LOG ══ */}
      {activeTab==="log" && (
        <div>
          {/* Major CCRs */}
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Change Requests (CCRs)</div>
          {majorChanges.length===0&&<div style={{color:C.muted,fontSize:12,marginBottom:16}}>No change requests yet. CCRs are raised during project delivery in L3.</div>}
          {majorChanges.map((c,i)=>(
            <div key={c.id||i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${(decColor[c.status]||C.muted)}`,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                <span style={{fontFamily:"monospace",fontSize:12,color:C.accentL,fontWeight:700}}>{c.id}</span>
                <span style={{fontSize:10,color:C.muted}}>{c.date}</span>
                <StatusBadge status={c.status}/>
                {c.reviewerName&&<span style={{fontSize:10,color:C.dim}}>Reviewed: {c.reviewerName}</span>}
                {c.approverName&&<span style={{fontSize:10,color:C.dim}}>Approved: {c.approverName}</span>}
                {c.rejectionReason&&<span style={{fontSize:10,color:C.risk}}>Rejected: {c.rejectionReason}</span>}
                {!locked&&<button onClick={()=>removeChange(changes.indexOf(c))} style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13}}>✕</button>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{fontSize:11,color:C.dim}}><span style={{color:C.muted,fontSize:9}}>FROM: </span>{c.requestedBy||"—"}</div>
                <div style={{fontSize:11,color:C.dim}}><span style={{color:C.muted,fontSize:9}}>TYPE: </span>{c.changeType||c.type||"—"}</div>
                <div style={{gridColumn:"1/-1",fontSize:11,color:C.sage}}>{c.description||"—"}</div>
                {c.justification&&<div style={{gridColumn:"1/-1",fontSize:10,color:C.muted,fontStyle:"italic"}}>{c.justification}</div>}
                {(c.impacts||c.impact)&&<div style={{fontSize:10,color:C.dim}}><span style={{color:C.muted,fontSize:9}}>IMPACT: </span>{Array.isArray(c.impacts)?c.impacts.join(", "):c.impact}</div>}
              </div>
            </div>
          ))}

          {/* Divider — Minor Changes */}
          {minorChanges.length > 0 && (
            <div style={{marginTop:20}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Minor Updates ({minorChanges.length})</div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"90px 130px 1fr",padding:"6px 12px",background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
                  {["ID","Date / By","Description"].map(h=>(
                    <div key={h} style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px"}}>{h}</div>
                  ))}
                </div>
                {minorChanges.map((m,i)=>(
                  <div key={m.id||i} style={{display:"grid",gridTemplateColumns:"90px 130px 1fr",padding:"7px 12px",borderBottom:`1px solid ${C.border}22`,background:i%2===0?C.surface:"transparent"}}>
                    <div style={{fontFamily:"monospace",fontSize:10,color:C.muted}}>{m.id||"—"}</div>
                    <div>
                      <div style={{fontSize:11,color:C.dim}}>{m.date}</div>
                      <div style={{fontSize:10,color:C.muted}}>{m.requestedBy}</div>
                    </div>
                    <div style={{fontSize:11,color:C.sage}}>{m.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!locked&&<button onClick={addChange} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%",marginTop:12}}>+ Log Change Request Manually</button>}
        </div>
      )}

      {/* ══ PENDING APPROVAL ══ */}
      {activeTab==="pending" && (
        <div>
          <div style={{fontSize:12,color:C.dim,marginBottom:14,lineHeight:1.6}}>
            Review and approve change requests raised during project delivery. Select who you are to see and action your pending items.
          </div>

          {/* Acting-as selector */}
          <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:11,color:C.dim,fontWeight:600,whiteSpace:"nowrap"}}>Acting as:</span>
            <select style={{...inp,maxWidth:280}} value={actingAs} onChange={e=>setActingAs(e.target.value)}>
              <option value="">Select your name…</option>
              {allActors.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            {actingAs && actorApprover && (
              <div style={{fontSize:11,color:C.accentL}}>
                Rights: {(actorApprover.rights||[]).join(", ")||"none assigned"}
              </div>
            )}
            {actingAs && !actorApprover && (
              <div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>No approval rights assigned to this role yet.</div>
            )}
          </div>

          {pendingCCRs.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:32}}>No change requests awaiting approval.</div>}

          {pendingCCRs.map((c,i)=>{
            const myCanReview  = canReview(c);
            const myCanApprove = canApprove(c);
            const myCanReject  = canReject(c);
            const isRejectOpen = rejectId===c.id;

            return (
              <div key={c.id||i} style={{background:C.surface,border:`1px solid ${myCanReview||myCanApprove?C.accentL:C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"monospace",fontSize:12,color:C.accentL,fontWeight:700}}>{c.id}</span>
                  <span style={{fontSize:10,color:C.muted}}>{c.date}</span>
                  <StatusBadge status={c.status}/>
                  <span style={{fontSize:11,color:C.dim}}>Requested by: {c.requestedBy||"—"}</span>
                </div>

                <div style={{background:C.surface2,borderRadius:6,padding:"10px 12px",marginBottom:12}}>
                  <div style={{fontSize:12,color:C.sage,marginBottom:4,fontWeight:600}}>{c.description||"No description"}</div>
                  {c.justification&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic",marginBottom:4}}>{c.justification}</div>}
                  {(c.impacts||c.impact)&&<div style={{fontSize:10,color:C.dim}}>Impact: {Array.isArray(c.impacts)?c.impacts.join(", "):c.impact}</div>}
                  {c.proposedValue!==undefined&&(
                    <div style={{marginTop:6,fontSize:11}}>
                      <span style={{color:C.risk,textDecoration:"line-through",marginRight:8}}>{String(c.oldValue||"")}</span>
                      <span style={{color:C.activity}}>→ {String(c.proposedValue||"")}</span>
                    </div>
                  )}
                </div>

                {/* Approval trail */}
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  {/* Reviewer box */}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:20,height:20,borderRadius:4,
                      background:["reviewed","approved"].includes(c.status)?C.accentL+"22":C.surface2,
                      border:`1px solid ${["reviewed","approved"].includes(c.status)?C.accentL:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.accentL}}>
                      {["reviewed","approved"].includes(c.status)?"✓":""}
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,textTransform:"uppercase"}}>Reviewer</div>
                      <div style={{fontSize:11,color:C.dim}}>{c.reviewerName||c.reviewerCode||"—"}</div>
                    </div>
                  </div>
                  <div style={{color:C.border}}>→</div>
                  {/* Approver box */}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:20,height:20,borderRadius:4,
                      background:c.status==="approved"?C.activity+"22":C.surface2,
                      border:`1px solid ${c.status==="approved"?C.activity:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.activity}}>
                      {c.status==="approved"?"✓":""}
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,textTransform:"uppercase"}}>Approver</div>
                      <div style={{fontSize:11,color:C.dim}}>{c.approverName||c.approverCode||"—"}</div>
                    </div>
                  </div>
                  {c.status==="rejected"&&c.rejectionReason&&(
                    <div style={{fontSize:11,color:C.risk,marginLeft:8}}>✕ Rejected: {c.rejectionReason}</div>
                  )}
                </div>

                {/* Action buttons */}
                {(myCanReview||myCanApprove||myCanReject) && (
                  <div style={{display:"flex",gap:8,paddingTop:10,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                    {myCanReview&&!isRejectOpen&&(
                      <button onClick={()=>actionChange(c.id,"reviewed")}
                        style={{padding:"6px 16px",background:C.accentL,border:"none",borderRadius:5,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✓ Mark Reviewed
                      </button>
                    )}
                    {myCanApprove&&!isRejectOpen&&(
                      <button onClick={()=>actionChange(c.id,"approved")}
                        style={{padding:"6px 16px",background:C.activity,border:"none",borderRadius:5,color:"#0D2B1B",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✓ Approve
                      </button>
                    )}
                    {myCanReject&&!isRejectOpen&&(
                      <button onClick={()=>setRejectId(c.id)}
                        style={{padding:"6px 16px",background:"none",border:`1px solid ${C.risk}`,borderRadius:5,color:C.risk,fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:"auto"}}>
                        ✕ Reject
                      </button>
                    )}
                    {isRejectOpen&&(
                      <div style={{display:"flex",gap:8,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                        <input style={{...inp,flex:1,minWidth:200}} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection…" autoFocus/>
                        <button onClick={()=>actionChange(c.id,"rejected",rejectReason)} disabled={!rejectReason}
                          style={{padding:"6px 14px",background:rejectReason?C.risk:C.surface2,border:"none",borderRadius:5,color:rejectReason?"#fff":C.muted,fontSize:12,fontWeight:700,cursor:rejectReason?"pointer":"not-allowed"}}>
                          Confirm Reject
                        </button>
                        <button onClick={()=>{setRejectId(null);setRejectReason("");}}
                          style={{padding:"6px 10px",background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.muted,fontSize:12,cursor:"pointer"}}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!actingAs&&<div style={{fontSize:10,color:C.muted,fontStyle:"italic",marginTop:8}}>Select who you are above to action this request.</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ APPROVAL RIGHTS ══ */}
      {activeTab==="approvers" && (
        <div>
          <div style={{fontSize:11,color:C.dim,marginBottom:12,lineHeight:1.6}}>
            Assign <strong style={{color:C.sage}}>Reviewer</strong> and <strong style={{color:C.sage}}>Approver</strong> rights to project roles.
            Change requests raised in L3 are routed to the designated reviewer first, then to the approver.
            Approval itself takes place here in L2.
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
            <table style={{borderCollapse:"collapse",width:"100%"}}>
              <thead>
                <tr style={{background:C.surface2}}>
                  <th style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",textAlign:"left",width:"60%"}}>Role</th>
                  <th style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:C.accentL,textTransform:"uppercase",letterSpacing:".4px",textAlign:"center"}}>Reviewer</th>
                  <th style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:C.milestone,textTransform:"uppercase",letterSpacing:".4px",textAlign:"center"}}>Approver</th>
                </tr>
              </thead>
              <tbody>
                {uniqueRoles.map((row,i)=>{
                  const match = effectiveApprovers.find(a=>a.role===row.role||a.loginCode===row.loginCode);
                  const isReviewer = !!(match?.rights||[]).includes("reviewer");
                  const isApprover = !!(match?.rights||[]).includes("approver");
                  return (
                    <tr key={i} style={{borderTop:`1px solid ${C.border}22`,background:i%2===0?C.surface:"transparent"}}>
                      <td style={{padding:"9px 12px"}}>
                        <div style={{fontSize:12,color:C.sage,fontWeight:600}}>{row.role}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2}}>{row.name}{row.loginCode?` · ${row.loginCode}`:""}</div>
                      </td>
                      <td style={{padding:"9px 12px",textAlign:"center"}}>
                        <input type="checkbox" checked={isReviewer} disabled={locked} onChange={()=>toggleRoleRight(row.role,"reviewer")}
                          style={{width:16,height:16,accentColor:C.accentL,cursor:locked?"not-allowed":"pointer"}}/>
                      </td>
                      <td style={{padding:"9px 12px",textAlign:"center"}}>
                        <input type="checkbox" checked={isApprover} disabled={locked} onChange={()=>toggleRoleRight(row.role,"approver")}
                          style={{width:16,height:16,accentColor:C.milestone,cursor:locked?"not-allowed":"pointer"}}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10,padding:"8px 12px",background:C.surface2,borderRadius:6,fontSize:10,color:C.muted}}>
            💡 Approval actions are taken in the Pending Approval tab above. L3 shows a read-only change log.
          </div>
        </div>
      )}
    </div>
  );
}
