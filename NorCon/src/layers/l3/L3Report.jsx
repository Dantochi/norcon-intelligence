import { useState } from "react";
import * as XLSX from "xlsx";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

// ── Excel style helpers ────────────────────────────────────────────────────────
const HDR    = { fill:{fgColor:{rgb:"0D2B1B"},patternType:"solid"}, font:{color:{rgb:"E5F0E8"},bold:true,sz:11}, alignment:{horizontal:"left",vertical:"center",wrapText:true}, border:{bottom:{style:"thin",color:{rgb:"2E7D52"}}} };
const ALT    = { fill:{fgColor:{rgb:"183D28"},patternType:"solid"}, font:{color:{rgb:"b8d4c0"},sz:10}, alignment:{wrapText:true,vertical:"top"} };
const NRM    = { fill:{fgColor:{rgb:"122E1E"},patternType:"solid"}, font:{color:{rgb:"E5F0E8"},sz:10}, alignment:{wrapText:true,vertical:"top"} };
const SUB    = { fill:{fgColor:{rgb:"122E1E"},patternType:"solid"}, font:{color:{rgb:"3a9962"},bold:true,sz:10}, alignment:{horizontal:"left"} };
const R_RED  = { fill:{fgColor:{rgb:"2a1515"},patternType:"solid"}, font:{color:{rgb:"e05c5c"},bold:true,sz:10} };
const R_AMB  = { fill:{fgColor:{rgb:"2a2010"},patternType:"solid"}, font:{color:{rgb:"e0a23a"},bold:true,sz:10} };
const R_GRN  = { fill:{fgColor:{rgb:"102a20"},patternType:"solid"}, font:{color:{rgb:"3ae0a2"},bold:true,sz:10} };
const DONE   = { fill:{fgColor:{rgb:"102a20"},patternType:"solid"}, font:{color:{rgb:"3ae0a2"},sz:10} };
const CC_BLUE= { fill:{fgColor:{rgb:"102030"},patternType:"solid"}, font:{color:{rgb:"3a9ce0"},bold:false,sz:10} };
const CC_PURP= { fill:{fgColor:{rgb:"1e1030"},patternType:"solid"}, font:{color:{rgb:"9c6ee0"},bold:false,sz:10} };
function ragS(l,i){ const s=(parseInt(l)||1)*(parseInt(i)||1); return s>=9?R_RED:s>=4?R_AMB:R_GRN; }

function buildSheet(headers,rows,widths,styleFn){
  const ws={};
  headers.forEach((h,c)=>{ ws[XLSX.utils.encode_cell({r:0,c})]={v:h,t:"s",s:HDR}; });
  rows.forEach((row,ri)=>{
    const base=ri%2===0?NRM:ALT;
    row.forEach((val,c)=>{
      const addr=XLSX.utils.encode_cell({r:ri+1,c});
      ws[addr]={v:val==null?"":String(val),t:"s",s:styleFn?styleFn(ri,c,val,row)||base:base};
    });
  });
  ws["!cols"]=widths.map(w=>({wch:w}));
  ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:headers.length-1}});
  ws["!freeze"]={xSplit:0,ySplit:1};
  return ws;
}

function buildProjectContext(state,project,charter,activities,milestones,risks,deliverables,stakeholders,teamMembers){
  const sheets=state?.l2?.sheets||{};
  const changes=sheets["06"]?.data?.changes||[];
  const issues=sheets["05"]?.data?.issues||[];
  const sustain=state?.sustainData?.evidence||[];
  const baseline=state?.baseline;
  const benefits=charter?.benefits||[];
  const dels=sheets["07"]?.data?.deliverables||deliverables;

  const done=[...activities,...milestones].filter(a=>a._complete).length;
  const total=activities.length+milestones.length;
  const pct=total>0?Math.round((done/total)*100):0;
  const red=risks.filter(r=>(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)>=9).length;
  const amb=risks.filter(r=>{const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);return s>=4&&s<9;}).length;
  const nextMs=milestones.filter(m=>!m._complete&&m.targetDate).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate))[0];
  const overdue=activities.filter(a=>!a._complete&&a.targetDate&&new Date(a.targetDate)<new Date()).length;

  const briData=benefits.map(b=>{
    const objIds=(b.objectives||[]).map(o=>o._id);
    const linked=dels.filter(d=>objIds.includes(d.linkedObjectiveId));
    const kpis=linked.flatMap(d=>d.kpis||[]).filter(k=>k.target&&k.actual!=null&&k.actual!=="");
    const bri=kpis.length>0?Math.round(kpis.reduce((s,k)=>s+Math.min(100,(parseFloat(k.actual)/parseFloat(k.target))*100),0)/kpis.length):null;
    return {name:b.name,bri,kpiCount:kpis.length};
  });
  const sustainScore=sustain.length>0?Math.round((sustain.reduce((s,e)=>s+(e.score||0),0)/sustain.length)*100):null;

  return {
    project:{name:charter?.projectName||project?.name,code:charter?.projectCode||project?.code,manager:charter?.projectManager,sponsor:charter?.projectSponsor,start:charter?.startDate,end:charter?.endDate,budget:charter?.budget,purpose:charter?.purpose,problem:charter?.problemStatement,strategic:charter?.strategicAlignment},
    progress:{pct,done,total,overdue},
    baseline:baseline?{confirmedDate:baseline.confirmedDate,version:baseline.version}:null,
    risks:{total:risks.length,red,amber:amb,green:risks.length-red-amb,top:risks.filter(r=>(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)>=4).slice(0,5).map(r=>({name:r.name,score:(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1),response:r.response,owner:r._suggestedOwner}))},
    issues:{total:issues.length,open:issues.filter(i=>i.status!=="Resolved").length,escalated:issues.filter(i=>i.status==="Escalated").length},
    milestones:{total:milestones.length,complete:milestones.filter(m=>m._complete).length,next:nextMs?{name:nextMs.name,date:nextMs.targetDate}:null,overdue:milestones.filter(m=>!m._complete&&m.targetDate&&new Date(m.targetDate)<new Date()).length},
    changes:{total:changes.length,approved:changes.filter(c=>c.status==="approved").length,pending:changes.filter(c=>c.status==="pending"||c.status==="reviewed").length},
    benefits:briData,
    sustainability:{score:sustainScore,evidenceCount:sustain.length},
    stakeholders:stakeholders.length,
    team:teamMembers.length,
    lessonsLearned:benefits.filter(b=>b.lessonsLearned).map(b=>({benefit:b.name,lessons:b.lessonsLearned})),
  };
}

// ── Shared card shell ────────────────────────────────────────────────────────
function GridCard({ title, icon, children, scrollable }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:9,
      display:"flex", flexDirection:"column", height:"100%", minHeight:0, overflow:"hidden", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px",
        borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.sage }}>{title}</span>
      </div>
      <div style={{ flex:1, minHeight:0, overflowY:scrollable?"auto":"hidden", padding:"12px 16px" }}>
        {children}
      </div>
    </div>
  );
}

function StatBadge({ value, label, color }) {
  return (
    <div style={{ background:C.surface2, borderRadius:6, padding:"8px 14px", textAlign:"center", border:`1px solid ${color}33`, flexShrink:0 }}>
      <div style={{ fontSize:18, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>{label}</div>
    </div>
  );
}

function CCRBadge({ status }) {
  const cols = { pending:C.milestone, reviewed:"#3a9ce0", approved:C.activity, rejected:C.risk };
  const col  = cols[(status||"pending").toLowerCase()]||C.muted;
  return <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:12, background:col+"22", color:col, border:`1px solid ${col}44` }}>{status}</span>;
}

export default function L3Report({ state,project,charter,activities,milestones,risks,deliverables,stakeholders,teamMembers,raciData,member,baseline,currentPlan }) {
  const [genState,  setGenState]  = useState("idle");
  const [genStep,   setGenStep]   = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [reportMsg, setReportMsg] = useState("");

  const sheets  = state?.l2?.sheets||{};
  const changes = sheets["06"]?.data?.changes||[];
  const issues  = sheets["05"]?.data?.issues||[];
  const sustain = state?.sustainData?.evidence||[];
  const benefits= charter?.benefits||[];

  const done    = [...activities,...milestones].filter(a=>a._complete).length;
  const total   = activities.length+milestones.length;
  const pct     = total>0?Math.round((done/total)*100):0;
  const red          = risks.filter(r=>(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1)>=9).length;
  const amb          = risks.filter(r=>{const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);return s>=4&&s<9;}).length;
  const closedRisks  = risks.filter(r=>r.status==="Closed").length;
  const openIss      = issues.filter(i=>i.status!=="Resolved").length;
  const escalatedIss = issues.filter(i=>i.status==="Escalated").length;
  const nextMs       = milestones.filter(m=>!m._complete&&m.targetDate).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate))[0];
  const dels         = sheets["07"]?.data?.deliverables||deliverables;

  const pendingCCR  = changes.filter(c=>c.status==="pending"||c.status==="reviewed").length;
  const approvedCCR = changes.filter(c=>c.status==="approved").length;
  const rejectedCCR = changes.filter(c=>c.status==="rejected").length;
  const majorCCR    = changes.filter(c=>c.type==="major"||(c.id||"").startsWith("CCR"));
  const minorCCR    = changes.filter(c=>c.type==="minor"||(c.id||"").startsWith("MIN"));

  const busy = genState !== "idle";

  // ── Workbook ──────────────────────────────────────────────────────────────
  const generateWorkbook = async () => {
    setGenState("workbook"); setGenStep("Generating AI executive summary..."); setAiSummary("");
    const ctx = buildProjectContext(state,project,charter,activities,milestones,risks,deliverables,stakeholders,teamMembers);
    const prompt = `Write a professional Executive Summary (300-400 words) for this project. Sections: Project Overview, Progress Update, Key Risks & Issues, Benefits Realisation, Upcoming Milestones, Recommendations. Be direct and factual.

PROJECT: ${ctx.project.name||"Unknown"} | PM: ${ctx.project.manager||"—"} | SPONSOR: ${ctx.project.sponsor||"—"}
DATES: ${ctx.project.start||"TBC"} to ${ctx.project.end||"TBC"} | BUDGET: ${ctx.project.budget||"—"}
PROGRESS: ${ctx.progress.pct}% (${ctx.progress.done}/${ctx.progress.total} tasks). Overdue: ${ctx.progress.overdue}.
BASELINE: ${ctx.baseline?`Confirmed ${ctx.baseline.confirmedDate}`:"Not confirmed"}
RISKS: ${ctx.risks.red} RED, ${ctx.risks.amber} AMBER, ${ctx.risks.green} GREEN. Issues: ${ctx.issues.open} open.
BENEFITS: ${ctx.benefits.map(b=>b.bri!==null?`${b.name} BRI:${b.bri}%`:`${b.name} no data`).join("; ")||"None"}
MILESTONES: ${ctx.milestones.complete}/${ctx.milestones.total}. Next: ${ctx.milestones.next?`${ctx.milestones.next.name} ${ctx.milestones.next.date}`:"None"}.
CHANGES: ${ctx.changes.approved} approved, ${ctx.changes.pending} pending.`;
    let summary = "Executive summary unavailable.";
    try {
      const r = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const d = await r.json();
      summary = (d.content||[]).map(b=>b.text||"").join("").trim();
      setAiSummary(summary);
    } catch(err) { console.error("Workbook AI summary failed:",err.message); }
    setGenStep("Building workbook...");
    await buildWorkbook(summary);
    setGenState("idle"); setGenStep("");
  };

  const buildWorkbook = async (summary) => {
    const wb = XLSX.utils.book_new();
    const c  = charter||{};

    const s00={};
    [[`${c.projectName||project?.name||"Project"} — Executive Summary`],[`Generated: ${new Date().toLocaleString()}`],[`PM: ${c.projectManager||"—"}  |  Sponsor: ${c.projectSponsor||"—"}  |  Progress: ${pct}%`],[""],[summary]].forEach((row,ri)=>{
      row.forEach((val,ci)=>{
        const addr=XLSX.utils.encode_cell({r:ri,c:ci});
        s00[addr]={v:val,t:"s",s:ri===0?HDR:ri===2?SUB:NRM};
      });
    });
    s00["!cols"]=[{wch:120}];
    s00["!merges"]=[{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:4,c:0},e:{r:4,c:3}}];
    s00["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:5,c:3}});
    XLSX.utils.book_append_sheet(wb,s00,"00 Executive Summary");

    const cRows=[["Project Name",c.projectName||""],["Project Code",c.projectCode||""],["Project Manager",c.projectManager||""],["Project Sponsor",c.projectSponsor||""],["Organisation",c.organisation||""],["Start Date",c.startDate||""],["End Date",c.endDate||""],["Budget",c.budget||""],["Purpose",c.purpose||""],["Problem Statement",c.problemStatement||""],["Strategic Alignment",c.strategicAlignment||""],["Within Scope",(c.withinScope||[]).join("; ")],["Out of Scope",(c.outOfScope||[]).join("; ")]];
    benefits.forEach(b=>{
      cRows.push(["",""]);cRows.push([`BENEFIT ${b._id}`,b.name||""]);cRows.push(["  Category",b.category||""]);cRows.push(["  Owner",b.owner||""]);cRows.push(["  Description",b.description||""]);cRows.push(["  Target Date",b.targetDate||""]);
      (b.objectives||[]).forEach(o=>{cRows.push([`  Objective ${o._id}`,o.objective||""]);cRows.push(["    Success Criterion",o.successCriterion||""]);cRows.push(["    Target Date",o.targetDate||""]);});
    });
    XLSX.utils.book_append_sheet(wb,buildSheet(["Field","Value"],cRows,[32,80],null),"01 Charter");

    XLSX.utils.book_append_sheet(wb,buildSheet(["Login Code","Name","Role","Delivery Role","Availability","Location","Responsibilities"],teamMembers.map(m=>[m.loginCode,m.name,m.role,m.deliveryRole||"",m.availability||"",m.location||"",m.responsibilities||""]),[14,22,28,24,14,16,40],null),"02 Team");

    const bActs=baseline?.snapshot?.activities||[];
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["ID","Activity / Milestone","Phase","Responsible","Start","Target","Baseline End","Status"],
      [...activities.map(a=>{const ba=bActs.find(x=>x._id===a._id);return[a._id,a.name||"",a.phase||"",a.responsible||"",a.startDate||"",a.targetDate||"",ba?.targetDate||"—",a._complete?"Complete":"In Progress"];}),
       ...milestones.map(m=>{const bm=baseline?.snapshot?.milestones?.find(x=>x._id===m._id);return[m._id,m.name||"",m.phase||"","—","",m.targetDate||"",bm?.targetDate||"—",m._complete?"Complete":"Pending"];})],
      [12,40,22,24,12,14,14,14],(ri,ci,val)=>{if(ci===7&&val==="Complete")return DONE;return null;}
    ),"03 Schedule");

    const mems=teamMembers.filter(m=>m.name&&m.role);
    const rRows=[...(raciData?.raciRows||[]),...(raciData?.customRows||[])];
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Task ID","Task","Phase",...mems.map(m=>`${m.name}\n(${m.loginCode})`)],
      rRows.map(r=>[r.taskId,r.label||"",r.phase||"",...mems.map(m=>r.assignments?.[m.loginCode]||"")]),
      [12,40,20,...mems.map(()=>16)],
      (ri,ci,val)=>{if(ci>=3){if(val==="R")return R_RED;if(val==="A")return R_AMB;if(val==="C")return CC_BLUE;if(val==="I")return CC_PURP;}return null;}
    ),"04 RACI");

    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Risk ID","Type","Name","Category","Cause","Potential Impact","Inh. Likelihood","Inh. Impact","Inh. Score","Response","Mitigation","Res. Likelihood","Res. Impact","Res. Score","Owner","Escalation Path","Status","Next Review","Last Reviewed","Open Actions","Total Actions"],
      risks.map(r=>{
        const is=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
        const rs=r.residualLikelihood&&r.residualImpact?(parseInt(r.residualLikelihood)||1)*(parseInt(r.residualImpact)||1):"";
        const openActs=(r.actions||[]).filter(a=>!a.done).length;
        const lastRev=(r.reviewHistory||[]).length>0?r.reviewHistory[r.reviewHistory.length-1].date:"";
        return[r._id,r.type||"Threat",r.name||"",r.category||"",r.cause||"",r.potentialImpact||"",r.likelihood||"",r.impact||"",is,r.response||"",r.mitigation||"",r.residualLikelihood||"",r.residualImpact||"",rs,r._suggestedOwner||"",r.escalationPath||"",r.status||"Open",r.nextReviewDate||"",lastRev,openActs,(r.actions||[]).length];
      }),
      [12,12,28,18,24,24,14,12,10,12,32,14,12,10,20,24,14,14,14,12,12],
      (ri,ci,val,row)=>{if(ci===8)return ragS(row[6],row[7]);if(ci===13&&val)return ragS(row[11],row[12]);if(ci===16&&val==="Closed")return DONE;if(ci===16&&val==="Materialised"){return{fill:{fgColor:{rgb:"1e1030"},patternType:"solid"},font:{color:{rgb:"9c6ee0"},sz:10}};}return null;}
    ),"05 Risk Register");

    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Issue ID","Name","Description","Cause","Impact","Priority","Owner","Raised","Target Resolution","Status","Resolution","Action Count","Overdue"],
      issues.map(i=>{const overdue=i.targetResolutionDate&&new Date(i.targetResolutionDate)<new Date()&&i.status!=="Resolved"?"Yes":"";return[i._id,i.name||"",i.description||"",i.cause||"",i.impact||"",i.priority||"",i.owner||"",i.raisedDate||"",i.targetResolutionDate||"",i.status||"Open",i.resolution||"",(i.actionLog||[]).length,overdue];}),
      [12,28,36,28,28,12,20,14,18,14,36,14,10],
      (ri,ci,val)=>{if(ci===9){if(val==="Resolved")return DONE;if(val==="Escalated")return R_RED;if(val==="Open")return R_AMB;}if(ci===12&&val==="Yes")return R_RED;return null;}
    ),"05b Issues Register");

    const reviewRows=[];
    risks.forEach(r=>{(r.reviewHistory||[]).forEach(h=>{reviewRows.push([r._id,r.name||"",h.date,h.likelihood||"",h.impact||"",h.score||"",h.note||""]);});});
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Risk ID","Risk Name","Review Date","Likelihood","Impact","Score","Note"],
      reviewRows.length>0?reviewRows:[["No reviews logged yet","","","","","",""]],
      [12,30,14,14,14,10,60],(ri,ci,val,row)=>{if(ci===5&&reviewRows.length>0)return ragS(row[3],row[4]);return null;}
    ),"05c Risk Review History");

    const rb=state?.riskBaseline;
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Risk ID","Type","Name","Category","Likelihood","Impact","Score","Response","Mitigation","Owner","Escalation Path","Snapshot Date"],
      rb?.risks?.length>0?rb.risks.map(r=>{const s=(parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);return[r._id,r.type||"Threat",r.name||"",r.category||"",r.likelihood||"",r.impact||"",s,r.response||"",r.mitigation||"",r._suggestedOwner||"",r.escalationPath||"",rb.snapshotDate||""];}):
      [["No baseline snapshot yet — confirm baseline in L3 to capture","","","","","","","","","","",""]],
      [12,12,28,18,14,12,10,12,36,20,24,14],(ri,ci,val,row)=>{if(ci===6&&typeof val==="number")return ragS(row[4],row[5]);return null;}
    ),"05e Baseline Risk Register");

    const transRows=sheets["05"]?.data?.transitions||[];
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Transition ID","Date","Type","Source ID","Target ID","Description","Performed By"],
      transRows.length>0?transRows.map(t=>[t.id,t.date,t.type==="risk_to_issue"?"Risk → Issue":"Issue → Risk",t.sourceId,t.targetId,t.description,t.performedBy||""]):[["No transitions recorded","","","","","",""]],
      [14,14,18,14,14,60,16],null
    ),"05d Risk-Issue Transitions");

    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["CCR ID","Date","Requested By","Type","Description","Priority","Status","Linked To"],
      changes.map(c=>[c.id,c.date,c.requestedBy,c.type,c.description,c.priority||"",c.status||"pending",c.linkedId||""]),
      [12,14,20,12,44,12,14,16],
      (ri,ci,val)=>{if(ci===6){if(val==="approved")return DONE;if(val==="rejected")return R_RED;if(val==="pending"||val==="reviewed")return R_AMB;}return null;}
    ),"06 Change Control");

    const kRows=[];
    benefits.forEach(b=>{
      kRows.push([`BENEFIT: ${b.name}`,b.category||"",b.owner||"",b.targetDate||"","","","","",""]);
      (b.objectives||[]).map(o=>o._id).forEach(objId=>{
        dels.filter(d=>d.linkedObjectiveId===objId).forEach(d=>{
          (d.kpis||[]).forEach(k=>{
            const pct2=k.target&&k.actual!=null&&k.actual!==""?Math.round((parseFloat(k.actual)/parseFloat(k.target))*100)+"%":"—";
            kRows.push(["",d._id,d.name||"",k._id,k.name||"",k.baseline||"",k.target||"",k.actual||"",pct2]);
          });
        });
      });
    });
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Benefit","Del ID","Deliverable","KPI ID","KPI Metric","Baseline","Target","Actual","Achievement %"],
      kRows,[28,12,32,16,36,12,12,12,16],
      (ri,ci,val)=>{if(ci===8&&val!=="—"){const n=parseInt(val);return n>=85?DONE:n>=50?R_AMB:R_RED;}return null;}
    ),"07 Benefits & KD Tracker");

    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["SH ID","Name","Category","Contact","Power","Interest","Influence","Ease","Priority Score","Engagement Strategy"],
      stakeholders.map(s=>{const ps=(((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1);return[s._id||"",s.name||"",s.category||"",s.contact||"",s.power||5,s.interest||5,s.influence||5,s.ease||5,ps,s.engagementStrategy||""];}),
      [12,28,20,24,10,10,12,10,16,40],null
    ),"08 Stakeholders");

    const comms=sheets["09"]?.data?.comms||[];
    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Stakeholder","Category","Contact","Format","Frequency","Key Content","Next Date","Escalation Path","Status"],
      comms.map(c=>[c.stakeholderName||"",c.category||"",c.contact||"",c.format||"",c.frequency||"",c.keyContent||"",c.nextDate||"",c.escalationPath||"",c.status||""]),
      [28,20,24,16,16,40,14,30,14],null
    ),"09 Comms Plan");

    XLSX.utils.book_append_sheet(wb,buildSheet(
      ["Activity","Dimension","Focus Area","Question","Answer","Score","Date"],
      sustain.map(e=>[e.activityName||"",e.area||"",e.areas?.[0]||"",e.question||"",e.answer||"",e.score!=null?e.score:"",e.date||""]),
      [36,20,20,50,14,10,14],
      (ri,ci,val)=>{if(ci===4){if(val==="yes")return DONE;if(val==="partially")return R_AMB;if(val==="no")return R_RED;}return null;}
    ),"10 Sustainability Evidence");

    const fn=`NorCon_${(project?.code||c.projectCode||"PROJECT")}_Workbook_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb,fn,{bookType:"xlsx",type:"binary",cellStyles:true});
  };

  // ── Word report ───────────────────────────────────────────────────────────
  const generateReport = async () => {
    setGenState("report"); setReportMsg("Claude is writing the report...");
    const ctx = buildProjectContext(state,project,charter,activities,milestones,risks,deliverables,stakeholders,teamMembers);
    const c = charter||{};
    const prompt = `You are generating a formal Project Report for ${ctx.project.name||"the project"}. Write a comprehensive professional narrative with these exact sections. Use ## to mark each section heading. Be specific and data-driven.

PROJECT: ${ctx.project.name||"—"} | Code: ${ctx.project.code||"—"} | PM: ${ctx.project.manager||"—"} | Sponsor: ${ctx.project.sponsor||"—"}
Period: ${ctx.project.start||"TBC"} → ${ctx.project.end||"TBC"} | Budget: ${ctx.project.budget||"—"}
Purpose: ${ctx.project.purpose||"Not specified"}
Strategic Alignment: ${ctx.project.strategic||"Not specified"}
Baseline: ${ctx.baseline?`Confirmed ${ctx.baseline.confirmedDate} (v${ctx.baseline.version})`:"Not confirmed"}
Progress: ${ctx.progress.pct}% (${ctx.progress.done}/${ctx.progress.total} tasks). Overdue: ${ctx.progress.overdue}.
Milestones: ${ctx.milestones.complete}/${ctx.milestones.total} complete. Next: ${ctx.milestones.next?`${ctx.milestones.next.name} (${ctx.milestones.next.date})`:"None"}.
Risks: ${ctx.risks.total} total — ${ctx.risks.red} RED, ${ctx.risks.amber} AMBER, ${ctx.risks.green} GREEN.
Top risks: ${ctx.risks.top.map(r=>`${r.name} (score:${r.score}, response:${r.response||"—"})`).join("; ")||"None"}
Issues: ${ctx.issues.total} total, ${ctx.issues.open} open, ${ctx.issues.escalated} escalated.
Benefits: ${ctx.benefits.map(b=>b.bri!==null?`${b.name}: BRI ${b.bri}%`:` ${b.name}: no KPI data`).join("; ")||"None defined"}
Changes: ${ctx.changes.total} total, ${ctx.changes.approved} approved, ${ctx.changes.pending} pending.
Sustainability: ${ctx.sustainability.evidenceCount} evidence entries, ${ctx.sustainability.score!==null?`avg score ${ctx.sustainability.score}%`:"no score"}.
Lessons learned: ${ctx.lessonsLearned.map(l=>`${l.benefit}: ${l.lessons.slice(0,80)}`).join("; ")||"None recorded"}

Write these sections in full:
## 1. Executive Summary
## 2. Project Overview
## 3. Progress Against Baseline
## 4. Benefits Realisation
## 5. Risks and Issues
## 6. Change History
## 7. Sustainability Performance
## 8. Lessons Learned
## 9. Recommendations and Next Steps`;

    try {
      const r = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4000,messages:[{role:"user",content:prompt}]})});
      const d = await r.json();
      const reportText = (d.content||[]).map(b=>b.text||"").join("").trim();
      setReportMsg("Building Word document...");
      const docRes = await fetch("/api/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportText,ctx})});
      if (!docRes.ok) throw new Error(`API error ${docRes.status}`);
      const blob = await docRes.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href=url; a.download=`NorCon_${(project?.code||c.projectCode||"PROJECT")}_Report_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setReportMsg("✓ Report downloaded successfully.");
    } catch(err) {
      setReportMsg(`Report generation failed: ${err.message}`);
    }
    setGenState("idle");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — 2 × 2 grid
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"60% 40%", gap:12, padding:"12px 16px", overflow:"hidden", height:"100%", boxSizing:"border-box" }}>

      {/* ══ TOP-LEFT: CHANGE CONTROL ══ */}
      <GridCard title="Change Control" icon="🔄">

        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <StatBadge value={pendingCCR}  label="Pending"       color={C.milestone} />
          <StatBadge value={approvedCCR} label="Approved"      color={C.activity}  />
          <StatBadge value={rejectedCCR} label="Rejected"      color={C.risk}      />
          <StatBadge value={majorCCR.length} label="Major CCRs" color={C.accentL}  />
          <StatBadge value={minorCCR.length} label="Minor"     color={C.muted}     />
        </div>

        {changes.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:12 }}>
            No change requests yet. CCRs raised from Risks, Issues, or baseline edits appear here.
          </div>
        )}

        {majorCCR.map((ccr,i) => {
          const s   = (ccr.status||"pending").toLowerCase();
          const col = s==="approved"?C.activity:s==="rejected"?C.risk:s==="reviewed"?"#3a9ce0":C.milestone;
          return (
            <div key={ccr.id||i} style={{ border:`1px solid ${C.border}`, borderLeft:`3px solid ${col}`, borderRadius:7, padding:"9px 11px", marginBottom:7, background:C.surface2 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, fontWeight:700 }}>{ccr.id}</span>
                <span style={{ fontSize:10, color:C.muted }}>{ccr.date}</span>
                <CCRBadge status={s}/>
                {ccr.priority && <span style={{ fontSize:9, padding:"1px 6px", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted }}>{ccr.priority}</span>}
                {ccr.linkedId  && <span style={{ fontSize:9, color:C.accentL }}>↗ {ccr.linkedId}</span>}
                <span style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>by {ccr.requestedBy||"—"}</span>
              </div>
              <div style={{ fontSize:12, color:C.sage, marginBottom:3 }}>{ccr.description||"—"}</div>
              {ccr.justification && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>{ccr.justification}</div>}
              {(ccr.benefitImpacts||[]).length>0 && (
                <div style={{ marginTop:5, fontSize:10, color:C.dim }}>
                  📈 {ccr.benefitImpacts.map(b=>`${b.benefitName}${b.note?` — ${b.note}`:""}`).join(" · ")}
                </div>
              )}
              {ccr.proposedValue!==undefined && (
                <div style={{ fontSize:11, marginTop:5 }}>
                  <span style={{ color:C.risk, textDecoration:"line-through", marginRight:8 }}>{String(ccr.oldValue||"")}</span>
                  <span style={{ color:C.activity }}>→ {String(ccr.proposedValue||"")}</span>
                </div>
              )}
              {s==="rejected"&&ccr.rejectionReason && <div style={{ fontSize:10, color:C.risk, marginTop:3 }}>Rejected: {ccr.rejectionReason}</div>}
              <div style={{ fontSize:10, color:C.muted, marginTop:5 }}>Approve in L2 → Sheet 06</div>
            </div>
          );
        })}

        {minorCCR.length > 0 && (
          <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:7 }}>Minor Updates ({minorCCR.length})</div>
            {minorCCR.map((m,i)=>(
              <div key={m.id||i} style={{ display:"flex", gap:8, padding:"3px 0", borderBottom:`1px solid ${C.border}22`, fontSize:11 }}>
                <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, width:80, flexShrink:0 }}>{m.id||"—"}</span>
                <span style={{ fontSize:9, color:C.muted, width:80, flexShrink:0 }}>{m.date}</span>
                <span style={{ color:C.dim, flex:1 }}>{m.description||"—"}</span>
                <span style={{ fontSize:9, color:C.accentL }}>{m.elementId||""}</span>
              </div>
            ))}
          </div>
        )}
      </GridCard>

      {/* ══ TOP-RIGHT: RISK REGISTER ══ */}
      <GridCard title="Risk Register" icon="⚠️">

        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <StatBadge value={risks.length}                  label="Total"     color={C.accentL}  />
          <StatBadge value={red}                           label="Red"       color={C.risk}      />
          <StatBadge value={amb}                           label="Amber"     color={C.milestone} />
          <StatBadge value={risks.length-red-amb-closedRisks} label="Green" color={C.activity}  />
          <StatBadge value={closedRisks}                   label="Closed"    color={C.muted}     />
          <StatBadge value={openIss}                       label="Open Issues" color={C.risk}    />
          <StatBadge value={escalatedIss}                  label="Escalated" color={C.risk}      />
        </div>

        {risks.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:12 }}>
            No risks logged yet. Configure in L2 → Sheet 05, or extract from a document in Layer 1.
          </div>
        )}

        {[...risks].sort((a,b)=>{
          const sa=(parseInt(a.likelihood)||1)*(parseInt(a.impact)||1);
          const sb=(parseInt(b.likelihood)||1)*(parseInt(b.impact)||1);
          return sb-sa;
        }).map((r,i)=>{
          const score    = (parseInt(r.likelihood)||1)*(parseInt(r.impact)||1);
          const col      = score>=9?C.risk:score>=4?C.milestone:C.activity;
          const isClosed = r.status==="Closed";
          const openActs = (r.actions||[]).filter(a=>!a.done).length;
          const lastRev  = (r.reviewHistory||[]).length>0?r.reviewHistory[r.reviewHistory.length-1]:null;
          return (
            <div key={r._id||i} style={{ border:`1px solid ${C.border}`, borderLeft:`3px solid ${isClosed?C.muted:col}`, borderRadius:7, padding:"9px 11px", marginBottom:7, background:C.surface2, opacity:isClosed?0.65:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, fontWeight:700 }}>{r._id}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:12, background:(isClosed?C.muted:col)+"22", color:isClosed?C.muted:col, border:`1px solid ${isClosed?C.muted:col}44` }}>
                  {isClosed?"Closed":`Score ${score}`}
                </span>
                {r.category && <span style={{ fontSize:9, color:C.muted }}>{r.category}</span>}
                {r.response && <span style={{ fontSize:9, padding:"1px 6px", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted }}>{r.response}</span>}
                {openActs>0  && <span style={{ fontSize:9, color:C.milestone }}>⚡ {openActs} open action{openActs>1?"s":""}</span>}
                {r._suggestedOwner && <span style={{ marginLeft:"auto", fontSize:10, color:C.accentL }}>{r._suggestedOwner}</span>}
              </div>
              <div style={{ fontSize:12, color:isClosed?C.muted:C.sage, marginBottom:3, textDecoration:isClosed?"line-through":"none" }}>{r.name||"—"}</div>
              {r.mitigation && (
                <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>
                  Mitigation: <span style={{ color:C.dim }}>{r.mitigation.slice(0,100)}{r.mitigation.length>100?"…":""}</span>
                </div>
              )}
              {lastRev && (
                <div style={{ fontSize:10, color:C.muted, borderTop:`1px solid ${C.border}22`, paddingTop:3, marginTop:3 }}>
                  Last review <span style={{ color:C.accentL }}>{lastRev.date}</span>:{" "}
                  <span style={{ color:C.dim }}>{lastRev.note.slice(0,80)}{lastRev.note.length>80?"…":""}</span>{" "}
                  <span style={{ fontSize:9, color:(lastRev.score||0)>=9?C.risk:(lastRev.score||0)>=4?C.milestone:C.activity }}>→ Score {lastRev.score}</span>
                </div>
              )}
              {r.closedDate && <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>Closed: {r.closedDate}</div>}
            </div>
          );
        })}

        {/* Transition log */}
        {(() => {
          const trs=sheets["05"]?.data?.transitions||[];
          if (!trs.length) return null;
          return (
            <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:7 }}>Risk–Issue Transitions ({trs.length})</div>
              {trs.map((t,i)=>(
                <div key={t.id||i} style={{ display:"flex", gap:7, padding:"4px 0", borderBottom:`1px solid ${C.border}22`, fontSize:10, alignItems:"center" }}>
                  <span style={{ fontFamily:"monospace", color:C.muted, width:72, flexShrink:0 }}>{t.date}</span>
                  <span style={{ color:t.type==="risk_to_issue"?"#e0a23a":"#9c6ee0", fontWeight:700, flexShrink:0 }}>{t.type==="risk_to_issue"?"Risk → Issue":"Issue → Risk"}</span>
                  <span style={{ fontFamily:"monospace", color:C.accentL, flexShrink:0 }}>{t.sourceId}</span>
                  <span style={{ color:C.muted, flexShrink:0 }}>→</span>
                  <span style={{ fontFamily:"monospace", color:C.accentL, flexShrink:0 }}>{t.targetId}</span>
                  <span style={{ color:C.dim, flex:1 }}>{t.description}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Issues register */}
        {issues.length > 0 && (
          <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:7 }}>Issues ({issues.length})</div>
            {issues.map((iss,i)=>{
              const sc      = ({Open:C.risk,"In Progress":C.milestone,Resolved:C.activity,Escalated:"#9c6ee0"}[iss.status]||C.muted);
              const overdue = iss.targetResolutionDate&&new Date(iss.targetResolutionDate)<new Date()&&iss.status!=="Resolved";
              return (
                <div key={iss._id||i} style={{ display:"flex", gap:7, padding:"5px 7px", borderBottom:`1px solid ${C.border}22`, borderLeft:`2px solid ${sc}`, marginBottom:3, borderRadius:4, alignItems:"flex-start", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2, width:52 }}>{iss._id}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:8, background:sc+"22", color:sc, border:`1px solid ${sc}44`, flexShrink:0 }}>{iss.status||"Open"}</span>
                  {overdue && <span style={{ fontSize:9, color:C.risk, flexShrink:0 }}>Overdue</span>}
                  <span style={{ fontSize:11, color:C.sage, flex:1 }}>{iss.name||"—"}</span>
                  {iss.owner && <span style={{ fontSize:9, color:C.accentL, flexShrink:0 }}>{iss.owner}</span>}
                  {iss.targetResolutionDate && <span style={{ fontSize:9, color:overdue?C.risk:C.muted, fontFamily:"monospace", flexShrink:0 }}>Due {iss.targetResolutionDate}</span>}
                  {(iss.actionLog||[]).length>0 && <span style={{ fontSize:9, color:C.dim, flexShrink:0 }}>{iss.actionLog.length} action{iss.actionLog.length>1?"s":""}</span>}
                  {iss.status==="Resolved"&&iss.resolution&&(
                    <div style={{ width:"100%", marginTop:2, fontSize:10, color:C.activity, fontStyle:"italic", paddingLeft:58 }}>✓ {iss.resolution}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GridCard>

      {/* ══ BOTTOM-LEFT: PROJECT WORKBOOK ══ */}
      <GridCard title="Project Workbook" icon="📊" scrollable={false}>
        <div style={{ fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.5 }}>
          Fully styled Excel workbook with AI executive summary and 10 registers including benefits & KD tracker, issues, baseline comparison, and sustainability evidence.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:4, marginBottom:12 }}>
          {[["00","Executive Summary","✨ AI"],["01","Charter + Benefits","✓"],["02","Team","✓"],["03","Schedule","✓"],["04","RACI","✓"],["05","Risk Register (live)","✓"],["05b","Issues Register","✓"],["05c","Risk Review History","✓"],["05d","Risk-Issue Transitions","✓"],["05e","Baseline Risk Register","✓"],["06","Change Control","✓"],["07","Benefits & KPIs","✓"],["08","Stakeholders","✓"],["09","Comms Plan","✓"],["10","Sustainability","✓"]].map(([n,l,badge])=>(
            <div key={n} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 7px", background:C.surface2, borderRadius:5, fontSize:11 }}>
              <span style={{ fontFamily:"monospace", fontSize:9, color:C.accentL, width:24, flexShrink:0 }}>{n}</span>
              <span style={{ color:C.dim, flex:1, fontSize:10 }}>{l}</span>
              <span style={{ fontSize:9, color:n==="00"?C.accentL:C.activity }}>{badge}</span>
            </div>
          ))}
        </div>
        {aiSummary && (
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:7, padding:"11px 13px", marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase", letterSpacing:".5px", marginBottom:5 }}>✨ AI Executive Summary Preview</div>
            <div style={{ fontSize:11, color:C.dim, lineHeight:1.7, whiteSpace:"pre-wrap", maxHeight:180, overflowY:"auto" }}>{aiSummary}</div>
          </div>
        )}
        <button onClick={generateWorkbook} disabled={busy}
          style={{ width:"100%", padding:"10px", background:busy&&genState==="workbook"?C.surface2:C.accent, color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:busy?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop: "4rem" }}>
          {busy&&genState==="workbook"
            ? <><div style={{ width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>{genStep}</>
            : "📊 Download Project Workbook"}
        </button>
      </GridCard>

      {/* ══ BOTTOM-RIGHT: PROJECT REPORT ══ */}
      <GridCard title="Project Report" icon="📄" scrollable={false}>
        <div style={{ fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.5 }}>
          A comprehensive narrative report written by Claude, covering all nine sections. Downloads as a properly formatted Word document (.docx) suitable for steering committees and project closure.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, marginBottom:12 }}>
          {["1. Executive Summary","2. Project Overview","3. Progress Against Baseline","4. Benefits Realisation","5. Risks and Issues","6. Change History","7. Sustainability Performance","8. Lessons Learned","9. Recommendations & Next Steps"].map(s=>(
            <div key={s} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10 }}>
              <span style={{ color:C.activity, fontSize:9 }}>✓</span>
              <span style={{ color:C.dim }}>{s}</span>
            </div>
          ))}
        </div>
        {reportMsg && (
          <div style={{ padding:"7px 11px", background:C.surface2, borderRadius:6, fontSize:11, color:reportMsg.startsWith("✓")?C.activity:C.dim, marginBottom:12 }}>
            {reportMsg}
          </div>
        )}
        <button onClick={generateReport} disabled={busy}
          style={{ width:"100%", padding:"10px", background:busy&&genState==="report"?C.surface2:C.accent, color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:busy?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop: "4.2rem" }}>
          {busy&&genState==="report"
            ? <><div style={{ width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>{reportMsg}</>
            : "📄 Generate Project Report (.docx)"}
        </button>
      </GridCard>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
