import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a" };

const APM_PHASES = [
  "Concept","Definition","Development","Handover & Closeout","Benefits Realisation",
  "Initiation","Planning","Execution","Monitoring & Control","Closure","Transition","Custom...",
];

const ALL_ROLES = [
  "── PM / Governance Roles ──",
  "Project Manager","Assistant Project Manager","Project Scheduler","Project Controller",
  "Risk Owner","Communications Lead","Technical Lead 1","Technical Lead 2",
  "Research Coordinator","Marketing Lead","Document Controller",
  "── Delivery / Technical Roles ──",
  "Content Curator","Communications Coordinator","Data Analyst","Design Lead",
  "Outreach Lead","Technical Specialist","Partnership Lead","Editorial Lead",
  "Custom...",
];

const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c}) => <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;

function EditableSelect({ value, onChange, options, disabled, placeholder }) {
  const [custom,    setCustom]    = useState(false);
  const [customVal, setCustomVal] = useState("");

  if (custom) {
    return (
      <input style={{...inp,flex:1}} value={customVal} autoFocus
        onChange={e=>setCustomVal(e.target.value)}
        onBlur={()=>{ if(customVal.trim()) onChange(customVal.trim()); setCustom(false); }}
        onKeyDown={e=>{ if(e.key==="Enter"){ onChange(customVal.trim()||value); setCustom(false); } if(e.key==="Escape") setCustom(false); }}
        placeholder="Type custom value..."/>
    );
  }

  return (
    <select style={inp} value={value||""} disabled={disabled}
      onChange={e => { if(e.target.value==="Custom..."){setCustom(true);setCustomVal("");} else onChange(e.target.value); }}>
      <option value="">{placeholder||"Select..."}</option>
      {options.map(o => o.startsWith("──")
        ? <option key={o} disabled value="" style={{color:C.muted,background:C.surface2,fontWeight:700}}>{o}</option>
        : <option key={o} value={o} style={{background:C.surface2}}>{o}</option>
      )}
    </select>
  );
}

function EditableField({ value, onChange, disabled, placeholder }) {
  return (
    <input style={inp} value={value||""} disabled={disabled}
      onChange={e=>onChange(e.target.value)} placeholder={placeholder||""}/>
  );
}

// Coerce _state → _complete for backwards-compatibility with activities
// created before the _complete field was standardised.
function normaliseActivity(a) {
  const hasComplete = typeof a._complete === "boolean";
  return {
    ...a,
    _complete: hasComplete ? a._complete : (a._state === "complete"),
    _state:    a._state || (a._complete ? "complete" : "pending"),
  };
}

function renumberSerialWithMap(items, prefix) {
  const idMap = {};
  const renumbered = items.map((item, index) => {
    const nextId = `${prefix}-${String(index + 1).padStart(3,"0")}`;
    if (item._id && item._id !== nextId) idMap[item._id] = nextId;
    return { ...item, _id: nextId };
  });
  return { items: renumbered, idMap };
}

function migrateCostData(costData, idMap, validIds) {
  return Object.entries(costData || {}).reduce((acc, [id, value]) => {
    const nextId = idMap[id] || id;
    if (validIds.has(nextId)) acc[nextId] = value;
    return acc;
  }, {});
}

function migrateExpenditureLog(log, idMap, validActivityIds) {
  return (log || [])
    .map(entry => ({ ...entry, activityId: idMap[entry.activityId] || entry.activityId }))
    .filter(entry => !entry.activityId || validActivityIds.has(entry.activityId));
}

function nextSerialId(items, prefix) {
  const max = (items || []).reduce((highest, item) => {
    const n = parseInt(String(item?._id || "").replace(`${prefix}-`, ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3,"0")}`;
}

export default function Sheet03Schedule({ data, locked, project, loginCodes, onUpdate }) {
  // Fully controlled — derived from props every render. No local copy that can
  // go stale while background extraction/generation writes to the sheet.
  const activities = (data.activities || []).map(normaliseActivity);
  const milestones = (data.milestones || []).map(normaliseActivity);
  const costData = data.costData || {};
  const readOnly = locked || project?.status === "active";

  const teamRoles  = loginCodes.flatMap(lc => [lc.role, lc.deliveryRole].filter(Boolean));
  const roleOptions = [...new Set([...teamRoles, ...ALL_ROLES])];

  const updateActivity = (idx, field, value) => {
    const oldId = activities[idx]?._id;
    const next = activities.map((a,i) => i===idx ? {...a,[field]:value} : a);
    if (field === "_id" && oldId && value && oldId !== value) {
      const idMap = { [oldId]: value };
      const validIds = new Set([...next, ...milestones].map(item => item._id).filter(Boolean));
      const validActivityIds = new Set(next.map(item => item._id).filter(Boolean));
      onUpdate({
        activities:next,
        milestones,
        costData: migrateCostData(costData, idMap, validIds),
        expenditureLog: migrateExpenditureLog(data.expenditureLog || [], idMap, validActivityIds),
        __idMap: idMap,
      }, "in-progress");
      return;
    }
    onUpdate({ activities:next, milestones }, "in-progress");
  };

  const updateMilestone = (idx, field, value) => {
    const oldId = milestones[idx]?._id;
    const next = milestones.map((m,i) => i===idx ? {...m,[field]:value} : m);
    if (field === "_id" && oldId && value && oldId !== value) {
      const idMap = { [oldId]: value };
      const validIds = new Set([...activities, ...next].map(item => item._id).filter(Boolean));
      const validActivityIds = new Set(activities.map(item => item._id).filter(Boolean));
      onUpdate({
        activities,
        milestones:next,
        costData: migrateCostData(costData, idMap, validIds),
        expenditureLog: migrateExpenditureLog(data.expenditureLog || [], idMap, validActivityIds),
        __idMap: idMap,
      }, "in-progress");
      return;
    }
    onUpdate({ activities, milestones:next }, "in-progress");
  };

  const updateCost = (itemId, value) => {
    onUpdate({
      activities,
      milestones,
      costData: {
        ...costData,
        [itemId]: { ...(costData[itemId] || {}), plannedAmount: value },
      },
    }, "in-progress");
  };

  const addActivity = () => {
    const next = [...activities, {
      _id: nextSerialId(activities, "ACT"),
      name:"", phase:"", responsible:"", description:"",
      startDate:"", targetDate:"",
      _state:"pending", _complete:false,
    }];
    onUpdate({ activities:next, milestones }, "in-progress");
  };

  const addMilestone = () => {
    const next = [...milestones, {
      _id: nextSerialId(milestones, "MS"),
      name:"", phase:"", targetDate:"", description:"",
      _state:"pending", _complete:false,
    }];
    onUpdate({ activities, milestones:next }, "in-progress");
  };

  const removeActivity  = idx => {
    const removedId = activities[idx]?._id;
    const next = activities.filter((_,i)=>i!==idx);
    if (project?.status === "active") {
      onUpdate({ activities: next, milestones }, "in-progress");
      return;
    }
    const { items, idMap } = renumberSerialWithMap(next, "ACT");
    const validIds = new Set([...items, ...milestones].map(item => item._id).filter(Boolean));
    const validActivityIds = new Set(items.map(item => item._id).filter(Boolean));
    onUpdate({
      activities: items,
      milestones,
      costData: migrateCostData(costData, idMap, validIds),
      expenditureLog: migrateExpenditureLog(data.expenditureLog || [], idMap, validActivityIds),
      __idMap: idMap,
      __removedIds: [removedId].filter(Boolean),
    }, "in-progress");
  };
  const removeMilestone = idx => {
    const removedId = milestones[idx]?._id;
    const next = milestones.filter((_,i)=>i!==idx);
    if (project?.status === "active") {
      onUpdate({ activities, milestones: next }, "in-progress");
      return;
    }
    const { items, idMap } = renumberSerialWithMap(next, "MS");
    const validIds = new Set([...activities, ...items].map(item => item._id).filter(Boolean));
    const validActivityIds = new Set(activities.map(item => item._id).filter(Boolean));
    onUpdate({
      activities,
      milestones: items,
      costData: migrateCostData(costData, idMap, validIds),
      expenditureLog: migrateExpenditureLog(data.expenditureLog || [], idMap, validActivityIds),
      __idMap: idMap,
      __removedIds: [removedId].filter(Boolean),
    }, "in-progress");
  };

  const Section = ({title,count}) => (
    <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",borderBottom:`1px solid ${C.border}`,paddingBottom:6,marginBottom:12,marginTop:20,display:"flex",justifyContent:"space-between"}}>
      <span>{title}</span>
      {count>0 && <span style={{color:C.accentL,fontSize:10}}>{count} from Layer 1</span>}
    </div>
  );

  const phaseDesc = {
    "Concept":"Explore and evaluate options. Develop the business case.",
    "Definition":"Develop the project management plan and baseline.",
    "Development":"Execute the plan, manage changes, monitor progress.",
    "Handover & Closeout":"Transfer outputs, close contracts, release team.",
    "Benefits Realisation":"Confirm benefits achieved post-handover.",
  };

  return (
    <div style={{maxWidth:960}}>
      <div className="schedule-phase-strip" style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {Object.entries(phaseDesc).map(([phase,desc]) => (
          <div key={phase} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",minWidth:140,flexShrink:0}}>
            <div style={{fontSize:10,fontWeight:700,color:C.accentL,marginBottom:2}}>{phase}</div>
            <div style={{fontSize:10,color:C.muted,lineHeight:1.4}}>{desc}</div>
          </div>
        ))}
      </div>

      <Section title="Activities" count={data.activities?.length||0}/>
      {activities.length===0 && <div style={{color:C.muted,fontSize:12,marginBottom:12}}>No activities yet. Add one below or upload a document in the Document Intelligence section.</div>}

      {activities.map((a,i) => (
        <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
            <div><Lbl c="ID"/><EditableField value={a._id} disabled={readOnly} onChange={v=>updateActivity(i,"_id",v)} placeholder="ACT-001"/></div>
            <div><Lbl c="Activity Name"/><EditableField value={a.name} disabled={readOnly} onChange={v=>updateActivity(i,"name",v)} placeholder="Activity description"/></div>
            <div><Lbl c="APM Phase"/><EditableSelect value={a.phase} disabled={readOnly} onChange={v=>updateActivity(i,"phase",v)} options={APM_PHASES} placeholder="Select phase..."/></div>
            <div><Lbl c="Responsible"/><EditableSelect value={a.responsible} disabled={readOnly} onChange={v=>updateActivity(i,"responsible",v)} options={roleOptions} placeholder="Select role..."/></div>
            {!locked && project?.status !== "active" && <button onClick={()=>removeActivity(i)} style={{background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:16,paddingBottom:2,alignSelf:"end"}}>✕</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><Lbl c="Start Date"/><input style={inp} type="date" value={a.startDate||""} disabled={readOnly} onChange={e=>updateActivity(i,"startDate",e.target.value)}/></div>
            <div><Lbl c="End Date"/><input style={inp} type="date" value={a.targetDate||""} disabled={readOnly} onChange={e=>updateActivity(i,"targetDate",e.target.value)}/></div>
            <div><Lbl c="Planned Cost (GBP)"/><input style={{...inp,textAlign:"right"}} type="number" min="0" step="0.01" value={costData[a._id]?.plannedAmount||""} disabled={readOnly} onChange={e=>updateCost(a._id,e.target.value)} placeholder="0.00"/></div>
          </div>
          <div style={{marginTop:8}}>
            <Lbl c="Description (optional)"/>
            <EditableField value={a.description} disabled={readOnly} onChange={v=>updateActivity(i,"description",v)} placeholder="Additional detail..."/>
          </div>
        </div>
      ))}
      {!locked && project?.status !== "active" && (
        <button onClick={addActivity} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%",marginBottom:8}}>
          + Add Activity
        </button>
      )}

      <Section title="Milestones" count={data.milestones?.length||0}/>
      {milestones.length===0 && <div style={{color:C.muted,fontSize:12,marginBottom:12}}>No milestones yet.</div>}

      {milestones.map((m,i) => (
        <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.milestone}`,borderRadius:7,padding:"10px 12px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 150px 140px auto",gap:8,alignItems:"end"}}>
            <div><Lbl c="ID"/><EditableField value={m._id} disabled={readOnly} onChange={v=>updateMilestone(i,"_id",v)} placeholder="MS-001"/></div>
            <div><Lbl c="Milestone Name"/><EditableField value={m.name} disabled={readOnly} onChange={v=>updateMilestone(i,"name",v)} placeholder="Milestone name"/></div>
            <div><Lbl c="APM Phase"/><EditableSelect value={m.phase} disabled={readOnly} onChange={v=>updateMilestone(i,"phase",v)} options={APM_PHASES} placeholder="Select phase..."/></div>
            <div><Lbl c="Target Date"/><input style={inp} type="date" value={m.targetDate||""} disabled={readOnly} onChange={e=>updateMilestone(i,"targetDate",e.target.value)}/></div>
            <div><Lbl c="Planned Cost (GBP)"/><input style={{...inp,textAlign:"right"}} type="number" min="0" step="0.01" value={costData[m._id]?.plannedAmount||""} disabled={readOnly} onChange={e=>updateCost(m._id,e.target.value)} placeholder="0.00"/></div>
            {!locked && project?.status !== "active" && <button onClick={()=>removeMilestone(i)} style={{background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:16,paddingBottom:2,alignSelf:"end"}}>✕</button>}
          </div>
          <div style={{marginTop:8}}>
            <Lbl c="Description (optional)"/>
            <EditableField value={m.description} disabled={readOnly} onChange={v=>updateMilestone(i,"description",v)} placeholder="What does this milestone mark?"/>
          </div>
        </div>
      ))}
      {!locked && project?.status !== "active" && (
        <button onClick={addMilestone} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%"}}>
          + Add Milestone
        </button>
      )}

      <style>{`
        .schedule-phase-strip::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
