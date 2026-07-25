import { useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const PHASE_COLORS = {
  Concept:"#9c6ee0", Definition:"#3a9ce0", Development:"#3ae0a2",
  "Handover & Closeout":"#e0a23a", "Benefits Realisation":"#e05c5c",
  Planning:"#3a9ce0", Execution:"#3ae0a2", "Monitoring & Control":"#e0a23a",
  Closure:"#8aac96", Initiation:"#9c6ee0",
};

// APM phase order for auto-sequencing
const PHASE_ORDER = ["Concept","Initiation","Definition","Planning","Development","Execution","Monitoring & Control","Handover & Closeout","Benefits Realisation","Closure"];

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function daysBetween(a, b)   { return Math.round((new Date(b)-new Date(a))/86400000); }
function fmtDate(d)          { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); }
function fmtInput(d)         { return new Date(d).toISOString().split("T")[0]; }

// Auto-assign dates if missing — spread phases across a 90-day window from today
function autoAssignDates(items) {
  const phases = [...new Set(items.map(i=>i.phase||"Definition"))];
  phases.sort((a,b)=>PHASE_ORDER.indexOf(a)-PHASE_ORDER.indexOf(b));
  const phaseDays = Math.max(14, Math.floor(90/Math.max(phases.length,1)));
  const projectStart = new Date();

  return items.map(item => {
    if (item.startDate || item.targetDate) return item;
    const phaseIdx = Math.max(0, phases.indexOf(item.phase||"Definition"));
    const start    = addDays(projectStart, phaseIdx * phaseDays);
    const end      = addDays(start, item.itemType==="milestone" ? 0 : phaseDays - 2);
    return { ...item, startDate: fmtInput(start), targetDate: fmtInput(end), _autoDate: true };
  });
}

export default function L3Gantt({ activities, milestones, member, onStateChange }) {
  const [editing,   setEditing]   = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");

  const canEdit = member?.isPM;

  const rawItems = [
    ...activities.map(a=>({...a, itemType:"activity",  color:PHASE_COLORS[a.phase]||C.accentL})),
    ...milestones.map(m=>({...m, itemType:"milestone", color:C.milestone})),
  ].filter(i=>i.name||i.description);

  const allItems = autoAssignDates(rawItems);

  // Date range
  const allDates = allItems.flatMap(i=>[i.startDate,i.targetDate].filter(Boolean)).map(d=>new Date(d));
  const minDate  = allDates.length>0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate  = allDates.length>0 ? new Date(Math.max(...allDates)) : addDays(new Date(),90);
  const ganttStart = addDays(minDate,-7);
  const ganttEnd   = addDays(maxDate,14);
  const totalDays  = Math.max(daysBetween(ganttStart,ganttEnd),30);
  const DAY_W      = 24;

  // Week markers
  const weeks = [];
  let wCur = new Date(ganttStart);
  while(wCur<ganttEnd){ weeks.push(new Date(wCur)); wCur=addDays(wCur,7); }

  const todayOff = daysBetween(ganttStart, new Date());

  const getBar = (item) => {
    const s = item.startDate;
    const e = item.targetDate||item.startDate;
    if(!s) return null;
    const left  = Math.max(0, daysBetween(ganttStart, new Date(s)));
    const width = Math.max(item.itemType==="milestone"?8:DAY_W, daysBetween(new Date(s),new Date(e))*DAY_W + DAY_W);
    return { left:left*DAY_W, width };
  };

  const saveEdit = (taskId, itemType) => {
    if(!editStart) return;
    const key = itemType==="milestone"?"milestones":"activities";
    onStateChange(prev=>({
      ...prev,
      l2:{
        ...prev.l2,
        sheets:{
          ...prev.l2.sheets,
          "03":{
            ...prev.l2.sheets["03"],
            data:{
              ...prev.l2.sheets["03"].data,
              [key]:(prev.l2.sheets["03"].data[key]||[]).map(i=>
                i._id===taskId ? {...i, startDate:editStart, targetDate:editEnd||editStart, _autoDate:false} : i
              ),
            },
          },
        },
      },
    }));
    setEditing(null);
  };

  // Group by phase
  const phases = [...new Set(allItems.map(i=>i.phase||"Unassigned"))];
  phases.sort((a,b)=>PHASE_ORDER.indexOf(a)-PHASE_ORDER.indexOf(b));

  return (
    <div style={{padding:20}}>
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:C.muted}}>
          {allItems.some(i=>i._autoDate) && <span style={{color:C.milestone}}>⚠ Some dates are estimated — click any bar to set actual dates</span>}
          {!allItems.some(i=>i._autoDate) && <span>Date range: {fmtDate(ganttStart)} — {fmtDate(ganttEnd)}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted}}>
          <div style={{width:20,height:2,background:C.risk}}/>Today
        </div>
        {canEdit && <span style={{fontSize:11,color:C.accentL}}>PM: click any bar to edit dates</span>}
      </div>

      {allItems.length===0 && (
        <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:40}}>
          No activities yet. Complete Sheet 03 in the Personalisation Layer.
        </div>
      )}

      {allItems.length>0 && (
        <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth:180+totalDays*DAY_W}}>

              {/* Date header */}
              <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.surface2,position:"sticky",top:0,zIndex:10}}>
                <div style={{width:180,flexShrink:0,borderRight:`1px solid ${C.border}`,padding:"6px 10px",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".4px"}}>
                  Activity / Phase
                </div>
                <div style={{flex:1,position:"relative",height:34,overflow:"hidden"}}>
                  {/* Month labels */}
                  {weeks.filter((_,i)=>i%4===0).map((w,i)=>(
                    <div key={i} style={{position:"absolute",left:daysBetween(ganttStart,w)*DAY_W,top:0,height:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-start",paddingTop:2,paddingLeft:4}}>
                      <div style={{fontSize:9,fontWeight:700,color:C.dim,whiteSpace:"nowrap"}}>
                        {new Date(w).toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}
                      </div>
                    </div>
                  ))}
                  {/* Week ticks */}
                  {weeks.map((w,i)=>(
                    <div key={i} style={{position:"absolute",left:daysBetween(ganttStart,w)*DAY_W,top:20,fontSize:8,color:C.muted,whiteSpace:"nowrap",paddingLeft:2}}>
                      {new Date(w).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
                    </div>
                  ))}
                  {/* Today marker in header */}
                  {todayOff>=0&&todayOff<=totalDays&&(
                    <div style={{position:"absolute",left:todayOff*DAY_W,top:0,width:2,height:"100%",background:C.risk,opacity:.8}}/>
                  )}
                </div>
              </div>

              {/* Phase groups */}
              {phases.map(phase=>{
                const items = allItems.filter(i=>(i.phase||"Unassigned")===phase);
                const col   = PHASE_COLORS[phase]||C.muted;
                return (
                  <div key={phase}>
                    {/* Phase header */}
                    <div style={{display:"flex",background:"rgba(0,0,0,0.15)",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{width:180,flexShrink:0,borderRight:`1px solid ${C.border}`,padding:"4px 10px",display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:3,height:12,background:col,borderRadius:2}}/>
                        <span style={{fontSize:10,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:".4px"}}>{phase}</span>
                      </div>
                      <div style={{flex:1,position:"relative",height:24}}>
                        {weeks.map((w,i)=>(
                          <div key={i} style={{position:"absolute",left:daysBetween(ganttStart,w)*DAY_W,top:0,width:1,height:"100%",background:C.border,opacity:.3}}/>
                        ))}
                        {todayOff>=0&&todayOff<=totalDays&&(
                          <div style={{position:"absolute",left:todayOff*DAY_W,top:0,width:1,height:"100%",background:C.risk,opacity:.3}}/>
                        )}
                      </div>
                    </div>

                    {/* Task rows */}
                    {items.map((item,idx)=>{
                      const bar    = getBar(item);
                      const isMil  = item.itemType==="milestone";
                      const isEdit = editing===item._id;

                      return (
                        <div key={item._id||idx}>
                          <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,minHeight:34,alignItems:"center",background:idx%2===0?C.surface:"transparent"}}>
                            {/* Label */}
                            <div style={{width:180,flexShrink:0,borderRight:`1px solid ${C.border}`,padding:"5px 10px 5px 20px",display:"flex",alignItems:"center",gap:6}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,color:item._complete?C.muted:C.sage,textDecoration:item._complete?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {isMil?"🏁 ":""}{item.name||item.description||"—"}
                                </div>
                                <div style={{fontSize:9,color:C.muted,display:"flex",gap:6,flexWrap:"wrap"}}>
                                  <span>{item._id}</span>
                                  {(item.responsible||item._suggestedOwner)&&<span style={{color:C.accentL}}>● {item.responsible||item._suggestedOwner}</span>}
                                  {item._autoDate&&<span style={{color:C.milestone}}>est.</span>}
                                  {item._complete&&<span style={{color:C.activity}}>✓</span>}
                                </div>
                              </div>
                            </div>

                            {/* Gantt track */}
                            <div style={{flex:1,position:"relative",height:34,overflow:"hidden"}}>
                              {weeks.map((w,i)=>(
                                <div key={i} style={{position:"absolute",left:daysBetween(ganttStart,w)*DAY_W,top:0,width:1,height:"100%",background:C.border,opacity:.25}}/>
                              ))}
                              {todayOff>=0&&todayOff<=totalDays&&(
                                <div style={{position:"absolute",left:todayOff*DAY_W,top:0,width:2,height:"100%",background:C.risk,opacity:.5,zIndex:2}}/>
                              )}
                              {bar&&(
                                <div
                                  onClick={()=>{
                                    if(!canEdit)return;
                                    setEditing(item._id);
                                    setEditStart(item.startDate||fmtInput(new Date()));
                                    setEditEnd(item.targetDate||fmtInput(addDays(new Date(),7)));
                                  }}
                                  title={`${fmtDate(item.startDate||new Date())} → ${fmtDate(item.targetDate||new Date())}${canEdit?" · Click to edit":""}`}
                                  style={{
                                    position:"absolute",left:bar.left,width:bar.width,
                                    top:isMil?13:7,height:isMil?8:20,
                                    borderRadius:isMil?1:4,
                                    background:item._complete?C.activity+"99":col+"bb",
                                    border:`1px solid ${item._complete?C.activity:col}`,
                                    cursor:canEdit?"pointer":"default",
                                    display:"flex",alignItems:"center",paddingLeft:5,
                                    fontSize:9,color:"#fff",fontWeight:600,
                                    overflow:"hidden",whiteSpace:"nowrap",zIndex:3,
                                    boxShadow:isMil?"none":`0 1px 3px rgba(0,0,0,0.3)`,
                                  }}>
                                  {!isMil&&bar.width>50&&(item.name||"").slice(0,16)}
                                  {isMil&&<div style={{width:8,height:8,background:col,borderRadius:1,transform:"rotate(45deg)",margin:"0 auto"}}/>}
                                </div>
                              )}
                              {!bar&&(
                                <div style={{position:"absolute",left:8,top:10,fontSize:10,color:C.muted,fontStyle:"italic",cursor:canEdit?"pointer":"default"}}
                                  onClick={()=>{if(canEdit){setEditing(item._id);setEditStart(fmtInput(new Date()));setEditEnd(fmtInput(addDays(new Date(),14)));}}}>
                                  {canEdit?"+ Set dates":"No dates"}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Inline editor */}
                          {isEdit&&(
                            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px 8px 20px",background:"rgba(46,125,82,0.1)",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                              <span style={{fontSize:11,color:C.dim,fontWeight:600}}>Edit: {item.name||item._id}</span>
                              <div>
                                <div style={{fontSize:9,color:C.muted,marginBottom:2}}>Start Date</div>
                                <input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}
                                  style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:4,color:C.sage,fontSize:11,padding:"4px 8px",outline:"none"}}/>
                              </div>
                              <div>
                                <div style={{fontSize:9,color:C.muted,marginBottom:2}}>End / Target Date</div>
                                <input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}
                                  style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:4,color:C.sage,fontSize:11,padding:"4px 8px",outline:"none"}}/>
                              </div>
                              <button onClick={()=>saveEdit(item._id,item.itemType)}
                                style={{padding:"5px 14px",background:C.accent,border:"none",borderRadius:4,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:10}}>
                                Save
                              </button>
                              <button onClick={()=>setEditing(null)}
                                style={{padding:"5px 10px",background:"none",border:`1px solid ${C.border}`,borderRadius:4,color:C.muted,fontSize:11,cursor:"pointer",marginTop:10}}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
