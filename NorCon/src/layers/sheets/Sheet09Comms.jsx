import { useState, useEffect } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };
const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%" };
const Lbl = ({c})=><div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>{c}</div>;
const FORMATS  = ["Email","Microsoft Teams","Video Call","Report","Meeting","Newsletter","Social Media","Presentation","Letter"];
const FREQS    = ["Daily","Weekly","Fortnightly","Monthly","At each gate","Ad hoc"];
const STATUSES = ["Planned","Active","Paused","Complete"];

export default function Sheet09Comms({ data, locked, allSheets, onUpdate }) {
  // Auto-populate from stakeholders
  const stakeholderData = allSheets?.["08"]?.data?.stakeholders || [];

  const [comms, setComms] = useState(() => {
    if (data.comms && data.comms.length > 0) return data.comms;
    // Auto-populate from stakeholders sorted by priority score
    return stakeholderData
      .map(s => ({
        stakeholderName: s.name||"", category: s.category||"", contact: s.contact||"",
        format:"", frequency:"", keyContent:"", nextDate:"", escalationPath:"", status:"Planned",
        priorityScore: (((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10)
      }))
      .sort((a,b)=>b.priorityScore-a.priorityScore);
  });

  const update = (idx, field, value) => {
    const next = comms.map((c,i)=> i===idx ? {...c,[field]:value} : c);
    setComms(next);
    onUpdate({ comms:next }, 'in-progress');
  };

  const addComm = () => {
    const next = [...comms, { stakeholderName:"", category:"", contact:"", format:"", frequency:"", keyContent:"", nextDate:"", escalationPath:"", status:"Planned", priorityScore:0 }];
    setComms(next);
    onUpdate({ comms:next }, 'in-progress');
  };

  const removeComm = (idx) => {
    const next = comms.filter((_,i)=>i!==idx);
    setComms(next);
    onUpdate({ comms:next }, 'in-progress');
  };

  return (
    <div style={{maxWidth:900}}>
      <div style={{fontSize:12,color:C.dim,marginBottom:16,lineHeight:1.6}}>
        Communications plan auto-populated from Sheet 08 stakeholders, ordered by priority score.
        Complete format, frequency and key content for each stakeholder.
      </div>

      {comms.length===0&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"16px",marginBottom:12,textAlign:"center"}}>
          <div style={{color:C.muted,fontSize:12,marginBottom:8}}>No communications planned yet.</div>
          <div style={{fontSize:11,color:C.muted}}>Complete Sheet 08 (Stakeholders) to auto-populate this plan.</div>
        </div>
      )}

      {comms.map((c,i)=>(
        <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:C.sage}}>{c.stakeholderName||"Stakeholder"}</span>
            {c.category&&<span style={{fontSize:10,color:C.muted}}>{c.category}</span>}
            {c.priorityScore>0&&<span style={{fontSize:10,color:C.accentL,marginLeft:"auto"}}>★ {parseFloat(c.priorityScore).toFixed(1)}</span>}
            {!locked&&<button onClick={()=>removeComm(i)} style={{background:"none",border:"none",color:C.risk,cursor:"pointer",fontSize:13,marginLeft:c.priorityScore>0?"0":"auto"}}>✕</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><Lbl c="Stakeholder Name"/><input style={inp} value={c.stakeholderName||""} disabled={locked} onChange={e=>update(i,"stakeholderName",e.target.value)} placeholder="Name"/></div>
            <div><Lbl c="Contact"/><input style={inp} value={c.contact||""} disabled={locked} onChange={e=>update(i,"contact",e.target.value)} placeholder="Contact route"/></div>
            <div><Lbl c="Status"/>
              <select style={inp} value={c.status||"Planned"} disabled={locked} onChange={e=>update(i,"status",e.target.value)}>
                {STATUSES.map(s=><option key={s} value={s} style={{background:C.surface2}}>{s}</option>)}
              </select>
            </div>
            <div><Lbl c="Format"/>
              <select style={inp} value={c.format||""} disabled={locked} onChange={e=>update(i,"format",e.target.value)}>
                <option value="">Select...</option>
                {FORMATS.map(f=><option key={f} value={f} style={{background:C.surface2}}>{f}</option>)}
              </select>
            </div>
            <div><Lbl c="Frequency"/>
              <select style={inp} value={c.frequency||""} disabled={locked} onChange={e=>update(i,"frequency",e.target.value)}>
                <option value="">Select...</option>
                {FREQS.map(f=><option key={f} value={f} style={{background:C.surface2}}>{f}</option>)}
              </select>
            </div>
            <div><Lbl c="Next Date"/><input style={inp} type="date" value={c.nextDate||""} disabled={locked} onChange={e=>update(i,"nextDate",e.target.value)}/></div>
            <div style={{gridColumn:"1/-1"}}><Lbl c="Key Content to Communicate"/><input style={inp} value={c.keyContent||""} disabled={locked} onChange={e=>update(i,"keyContent",e.target.value)} placeholder="What will be communicated?"/></div>
            <div style={{gridColumn:"1/-1"}}><Lbl c="Escalation Path"/><input style={inp} value={c.escalationPath||""} disabled={locked} onChange={e=>update(i,"escalationPath",e.target.value)} placeholder="Who to escalate to if no response?"/></div>
          </div>
        </div>
      ))}
      {!locked&&<button onClick={addComm} style={{padding:"7px 14px",background:"none",border:`1px dashed ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",width:"100%"}}>+ Add Communication</button>}
    </div>
  );
}
