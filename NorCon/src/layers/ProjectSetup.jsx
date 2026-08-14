import { useState, useCallback, useRef, useEffect } from "react";
import mammoth from "mammoth";
import DatePickerField from "../components/DatePickerField.jsx";
import { generateLoginCode } from "../store/appStore.js";
import Sheet01Charter      from "./sheets/Sheet01Charter.jsx";
import Sheet02Team         from "./sheets/Sheet02Team.jsx";
import Sheet03Schedule     from "./sheets/Sheet03Schedule.jsx";
import Sheet04RACI         from "./sheets/Sheet04RACI.jsx";
import Sheet05Risks        from "./sheets/Sheet05Risks.jsx";
import Sheet06Change       from "./sheets/Sheet06Change.jsx";
import Sheet07KDTracker    from "./sheets/Sheet07KDTracker.jsx";
import Sheet08Stakeholders from "./sheets/Sheet08Stakeholders.jsx";
import Sheet10Sustainability from "./sheets/Sheet10Sustainability.jsx";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const TIERS = {
  light: {
    label: "Light", icon: "🌱",
    desc: "Essentials for simple projects — events, community initiatives, birthday planning.",
    sheets: ["02","01","04","03","05","10"],
    l3Tabs: ["home","dashboard","baseline","raci","risks","sustain","report"],
  },
  full: {
    label: "Full", icon: "🏗️",
    desc: "Complete governance suite for complex or professional projects.",
    sheets: ["02","01","04","05","08","07","06","03","10"],
    l3Tabs: ["home","dashboard","baseline","raci","benefits","risks","stakeholders","sustain","report"],
  },
};

const SHEET_COMPONENTS = {
  "01": Sheet01Charter, "02": Sheet02Team, "03": Sheet03Schedule,
  "04": Sheet04RACI, "05": Sheet05Risks, "06": Sheet06Change,
  "07": Sheet07KDTracker, "08": Sheet08Stakeholders, "10": Sheet10Sustainability,
};
const SHEET_LABELS = {
  "01":"Charter", "02":"Team", "03":"Schedule", "04":"RACI",
  "05":"Risks", "06":"Change Control", "07":"Benefits & KPIs",
  "08":"Stakeholders", "10":"Sustainability",
};

const WIZARD_SHEETS = {
  light: ["02","01","05","10"],
  full:  ["02","01","08","07","05","10"],
};
// Schedule ("03") always appended last — needs maximum accumulated context
const scheduleLast = (arr) => [...arr, "03"];

// hide scrollbars in Firefox and IE/Edge (they don't support ::-webkit-scrollbar)
const hiddenScrollbarStyle = { scrollbarWidth:"none", msOverflowStyle:"none" };

// Normalise any date string to YYYY-MM-DD (required by <input type="date">).
// Accepts ISO strings, MM/DD/YYYY, DD/MM/YYYY (heuristic), and natural language.
// Returns empty string if unparseable.
function toYMD(s) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  if (!t || t === "mm/dd/yyyy" || t === "TBD" || t === "N/A") return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // MM/DD/YYYY or M/D/YYYY
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  // DD-MM-YYYY or DD.MM.YYYY
  const dmy = t.match(/^(\d{1,2})[\-\.](\d{1,2})[\-\.](\d{4})$/);
  if (dmy) {
    const [,d,m,y] = dmy;
    // If first number > 12 it must be day-first
    return parseInt(d) > 12
      ? `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`
      : `${y}-${d.padStart(2,"0")}-${m.padStart(2,"0")}`;
  }
  // Fall back to Date constructor (handles ISO 8601 variants, natural language)
  const d = new Date(t);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const CLUSTERS = {
  "02": [
    { id:"t2", title:"Core team", fields:[
      { key:"teamRoles", label:"Team roles needed", type:"roles" },
    ]},
  ],
  "01": [
    { id:"c1", title:"Name your project", fields:[
      { key:"projectName", label:"Project Name", type:"text", required:true },
      { key:"organisation", label:"Organisation", type:"text" },
    ]},
    { id:"c2", title:"What's it for?", fields:[
      { key:"purpose", label:"Purpose — what will this achieve?", type:"textarea", aiChips:true },
    ]},
    { id:"c3", title:"Sponsorship & oversight", fields:[
      { key:"projectSponsor", label:"Project Sponsor", type:"text" },
    ]},
    { id:"c4", title:"Timing", fields:[
      { key:"startDate", label:"Start Date", type:"date" },
      { key:"endDate", label:"End Date", type:"date" },
    ]},
    { id:"c5", title:"Budget", fields:[
      { key:"budget", label:"Total Budget", type:"text", placeholder:"e.g. 5000 or N/A" },
    ]},
  ],
  "04": [],
  "05": [
    { id:"rk1", title:"What could go wrong?", fields:[
      { key:"risks", label:"Key risks", type:"chips-multi", aiChips:true },
    ]},
  ],
  "08": [
    { id:"s1", title:"Who has a stake in this?", fields:[
      { key:"stakeholders", label:"Key stakeholders", type:"chips-multi", aiChips:true },
    ]},
  ],
  "07": [
    { id:"b1", title:"What does success unlock?", fields:[
      { key:"benefits", label:"Strategic benefits", type:"chips-multi", aiChips:true },
    ]},
  ],
  "06": [],
  "10": [
    { id:"sus1", title:"Sustainability focus", fields:[
      { key:"sustainFocus", label:"Any sustainability priorities for this project?", type:"chips-multi", aiChips:true, optional:true },
    ]},
  ],
  "03": [
    { id:"sc1", title:"Key milestones", fields:[
      { key:"keyMilestones", label:"Any fixed dates or milestones?", type:"textarea", optional:true },
    ]},
  ],
};

function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Empty response");
  // Strip markdown fences
  let clean = raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
  // Handle Claude preamble ("Here's the result:\n\n{...") by finding the outermost JSON object
  const firstBrace = clean.indexOf("{");
  const lastBrace  = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try { return JSON.parse(clean); }
  catch(e1) {
    // Attempt brace-balancing recovery on truncated responses
    let attempt = clean;
    let braces=0, brackets=0, inStr=false, escape=false;
    for (let i=0;i<attempt.length;i++){
      const ch=attempt[i];
      if (escape){escape=false;continue;}
      if (ch==="\\"&&inStr){escape=true;continue;}
      if (ch==='"'){inStr=!inStr;continue;}
      if (inStr) continue;
      if (ch==="{") braces++; if (ch==="}") braces--;
      if (ch==="[") brackets++; if (ch==="]") brackets--;
    }
    attempt = attempt.replace(/,\s*$/, "");
    if (inStr) attempt += '"';
    while (brackets>0){attempt+="]";brackets--;}
    while (braces>0){attempt+="}";braces--;}
    try { return JSON.parse(attempt); }
    catch(e2){ throw new Error("JSON parse failed: "+e1.message); }
  }
}

async function callExtract(messages, maxTokens=2000) {
  const res = await fetch("/api/extract", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:maxTokens, messages }),
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error || `API error ${res.status}`); }
  const data = await res.json();
  const text = (data.content||[]).map(b=>b.text||"").join("").trim();
  if (!text) throw new Error("Empty response from AI");
  return text;
}

const excelDateToISO = (serial) => {
  if (!serial || isNaN(serial)) return "";
  const date = new Date((serial - 25569) * 86400 * 1000);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0,10);
};

const readExcelAsText = async (file) => {
  const XLSX = await import("xlsx");
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type:"array", cellDates:false });
  let output = `EXCEL FILE: ${file.name}\n\n`;
  wb.SheetNames.slice(0,3).forEach(name => {
    const ws   = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
    output += `--- Sheet: ${name} ---\n`;
    rows.slice(0,150).forEach(row => {
      const cells = row.map(c => {
        if (typeof c === "number" && c>40000 && c<60000) return excelDateToISO(c);
        return String(c).trim();
      }).filter(c=>c!=="");
      if (cells.length>0) output += cells.join("\t")+"\n";
    });
    output += "\n";
  });
  return output;
};

function TierSelect({ onSelect, onBack }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 24px",
        borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:12, cursor:"pointer" }}>← Back</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
          {["Welcome","Tier","Project Details"].map((label,i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: i===1?C.accent:i<1?C.accentL+"33":C.surface2,
                  color: i===1?"#fff":i<1?C.accentL:C.muted,
                  border:`1px solid ${i===1?C.accent:i<1?C.accentL:C.border}` }}>{i<1?"✓":i+1}</div>
                <span style={{ fontSize:11, color:i===1?C.sage:i<1?C.accentL:C.muted, fontWeight:i===1?700:400 }}>{label}</span>
              </div>
              {i<2 && <span style={{ color:C.border, fontSize:14 }}>›</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
        <div style={{ maxWidth:560, width:"100%" }}>
          <div style={{ fontSize:22, fontWeight:700, color:C.sage, marginBottom:6, textAlign:"center" }}>🏗️ NorCon Project Setup</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:32, textAlign:"center", lineHeight:1.6 }}>
            Choose the governance level that fits your project. This determines which tools and modules are available.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {Object.entries(TIERS).map(([key,t]) => (
              <button key={key} onClick={()=>onSelect(key)}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"24px 20px", cursor:"pointer", textAlign:"left", transition:"border-color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentL}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{ fontSize:28, marginBottom:10 }}>{t.icon}</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.sage, marginBottom:6 }}>{t.label}</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:14 }}>{t.desc}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {t.sheets.map(id => (
                    <div key={id} style={{ fontSize:11, color:C.dim, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ color:C.accentL, fontSize:9 }}>✓</span>{SHEET_LABELS[id]}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PMSetup({ tier, onConfirm, onBack }) {
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [pmName,      setPmName]      = useState("");
  const [pmCode,      setPmCode]      = useState("");
  const [codeReady,   setCodeReady]   = useState(false);
  const [errors,      setErrors]      = useState({});
  const tierCfg = TIERS[tier];

  const deriveCode = (name) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    if (words.length===1) return words[0].slice(0,4).toUpperCase();
    return words.map(w=>w[0]).join("").slice(0,5).toUpperCase();
  };
  const handleProjectNameChange = (val) => {
    setProjectName(val); setCodeReady(false); setPmCode("");
    if (!projectCode || projectCode===deriveCode(projectName)) setProjectCode(deriveCode(val));
  };
  const validate = () => {
    const e = {};
    if (!projectName.trim()) e.projectName="Required";
    if (!projectCode.trim()) e.projectCode="Required";
    if (!pmName.trim())      e.pmName="Required";
    setErrors(e); return Object.keys(e).length===0;
  };
  const generateCode = () => {
    if (!validate()) return;
    // Canonical generator — same prefix rules as every other code in the project
    setPmCode(generateLoginCode(projectCode || "PM", []));
    setCodeReady(true);
  };
  const handleConfirm = () => {
    if (!codeReady) { generateCode(); return; }
    if (!validate()) return;
    onConfirm({ projectName:projectName.trim(), projectCode:projectCode.trim().toUpperCase(), pmName:pmName.trim(), loginCode:pmCode });
  };
  const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, color:C.sage,
    fontSize:13, padding:"10px 13px", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
  const fieldErr = (k) => errors[k] ? <div style={{ fontSize:10, color:C.risk, marginTop:4 }}>{errors[k]}</div> : null;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflowY:"auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 24px",
        borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            color:C.muted, fontSize:12, cursor:"pointer" }}>← Back</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
          {["Welcome","Tier","Project Details"].map((label,i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background:i===2?C.accent:C.accentL+"33", color:i===2?"#fff":C.accentL,
                  border:`1px solid ${i===2?C.accent:C.accentL}` }}>{i<2?"✓":3}</div>
                <span style={{ fontSize:11, color:i===2?C.sage:C.accentL, fontWeight:i===2?700:400 }}>{label}</span>
              </div>
              {i<2 && <span style={{ color:C.border, fontSize:14 }}>›</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div style={{ maxWidth:480, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>{tierCfg.icon}</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.sage, marginBottom:6 }}>{tierCfg.label} Project Setup</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>Give your project a name and code, then register the Project Manager.</div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"24px 28px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase", letterSpacing:".6px", marginBottom:12 }}>Project Details</div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>Project Name</label>
            <input style={{ ...inp, borderColor:errors.projectName?C.risk:C.border }} value={projectName}
              onChange={e=>handleProjectNameChange(e.target.value)} placeholder="e.g. Northumbria Waterfront Regeneration" autoFocus/>
            {fieldErr("projectName")}
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>
              Project Code <span style={{ fontSize:9, color:C.muted, fontWeight:400, marginLeft:6, textTransform:"none" }}>(used as login code prefix)</span>
            </label>
            <input style={{ ...inp, borderColor:errors.projectCode?C.risk:C.border, textTransform:"uppercase", fontFamily:"monospace", letterSpacing:".08em" }}
              value={projectCode} onChange={e=>{setProjectCode(e.target.value.toUpperCase().slice(0,6));setCodeReady(false);setPmCode("");}} placeholder="e.g. NWR"/>
            {fieldErr("projectCode")}
            {!errors.projectCode && projectCode && (
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Login codes: <span style={{ color:C.accentL, fontFamily:"monospace" }}>{projectCode}-XXXX</span></div>
            )}
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, margin:"4px 0 18px" }}/>
          <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase", letterSpacing:".6px", marginBottom:12 }}>Project Manager</div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>Full Name</label>
            <input style={{ ...inp, borderColor:errors.pmName?C.risk:C.border }} value={pmName}
              onChange={e=>{setPmName(e.target.value);setCodeReady(false);setPmCode("");setErrors(p=>({...p,pmName:""}));}}
              placeholder="e.g. Sarah Johnson" onKeyDown={e=>e.key==="Enter"&&generateCode()}/>
            {fieldErr("pmName")}
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".5px", marginBottom:7 }}>Login Code</label>
            {codeReady ? (
              <div>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ flex:1, background:C.surface2, border:`1px solid ${C.accentL}66`, borderRadius:6, padding:"10px 13px",
                    fontFamily:"monospace", fontSize:16, fontWeight:700, color:C.accentL, letterSpacing:".12em" }}>{pmCode}</div>
                  <button onClick={()=>{setCodeReady(false);setPmCode("");}}
                    style={{ padding:"10px 14px", background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>Regenerate</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>Share this code with the Project Manager to log in later.</div>
              </div>
            ) : (
              <button onClick={generateCode} style={{ width:"100%", padding:"10px", background:C.surface2, border:`1px solid ${C.accentL}55`,
                borderRadius:6, color:C.accentL, fontSize:12, fontWeight:700, cursor:"pointer" }}>Generate Login Code</button>
            )}
          </div>
          <button onClick={handleConfirm} disabled={!codeReady}
            style={{ width:"100%", padding:"12px", background:codeReady?C.accent:"#1F4D34", border:"none", borderRadius:7,
              color:"#fff", fontSize:13, fontWeight:700, cursor:codeReady?"pointer":"not-allowed",
              boxShadow:codeReady?`0 4px 16px ${C.accent}44`:"none", transition:"all .2s" }}>Enter Project Setup →</button>
        </div>
        <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:C.muted }}>
          <span style={{ color:C.dim }}>{tierCfg.label} tier</span>{" · "}{tierCfg.sheets.length} sheets active{" · "}<span style={{ color:C.accentL }}>PM · Full Access</span>
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Animated pipeline tracker — shows the user exactly what the AI is doing ──
const PIPELINE_STEPS = [
  { id:"reading",      label:"Reading your input" },
  { id:"synthesising", label:"Creating comprehensive project plan" },
  { id:"extracting",   label:"Extracting structured data" },
  { id:"populating",   label:"Populating project sheets" },
  { id:"finalising",   label:"Filling remaining gaps" },
];

function PipelineTracker({ stage, statusText }) {
  const activeIdx = PIPELINE_STEPS.findIndex(s => s.id === stage);
  if (activeIdx === -1) return null;
  return (
    <div style={{ background:C.surface2, border:`1px solid ${C.accentL}44`, borderRadius:8,
      padding:"14px 16px", marginTop:12 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step.id} style={{ display:"flex", alignItems:"center", gap:10,
            padding:"5px 0", opacity: done||active ? 1 : 0.35, transition:"opacity .3s" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              background: done ? C.activity+"22" : active ? C.accentL+"22" : "transparent",
              border: `1.5px solid ${done ? C.activity : active ? C.accentL : C.border}` }}>
              {done && <span style={{ fontSize:10, color:C.activity }}>✓</span>}
              {active && <span style={{ width:7, height:7, borderRadius:"50%", background:C.accentL,
                animation:"pulse 1.1s ease-in-out infinite" }}/>}
            </div>
            <div style={{ fontSize:11, fontWeight: active?700:400,
              color: done ? C.dim : active ? C.accentL : C.muted }}>
              {step.label}{active && <AnimatedDots/>}
            </div>
          </div>
        );
      })}
      {statusText && (
        <div style={{ fontSize:10, color:C.muted, fontStyle:"italic", marginTop:8,
          paddingTop:8, borderTop:`1px solid ${C.border}` }}>
          {statusText}
        </div>
      )}
      <div style={{ height:3, borderRadius:2, background:C.border, marginTop:10, overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", top:0, bottom:0, width:"35%", borderRadius:2,
          background:`linear-gradient(90deg, transparent, ${C.accentL}, transparent)`,
          animation:"slide 1.4s ease-in-out infinite" }}/>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes slide{0%{left:-35%}100%{left:100%}}
        @keyframes dots{0%,20%{content:""}40%{content:"."}60%{content:".."}80%,100%{content:"..."}}
      `}</style>
    </div>
  );
}

function AnimatedDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(v => (v+1)%4), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

// ── Review Extracted Data — optional modal, tables, edits save instantly ────
function ReviewModal({ sheets, tier, intermediateDoc, onUpdate, onClose }) {
  const [reviewTab, setReviewTab] = useState(intermediateDoc ? "source" : "structured");
  const charter = sheets["01"]?.data?.charter || {};
  const team    = sheets["02"]?.data?.teamMembers || [];
  const acts         = sheets["03"]?.data?.activities || [];
  const miles        = sheets["03"]?.data?.milestones || [];
  const risks        = sheets["05"]?.data?.risks || [];
  const stakeholders = sheets["08"]?.data?.stakeholders || [];
  // C1 fix: benefits live in charter.benefits, not KD Tracker
  const charter0     = sheets["01"]?.data?.charter || {};
  const benefits     = charter0.benefits || [];

  const cell = { background:"transparent", border:"none", color:C.sage, fontSize:11,
    padding:"6px 8px", outline:"none", width:"100%", fontFamily:"inherit" };
  const th = { padding:"7px 8px", textAlign:"left", fontWeight:700, fontSize:9, color:C.muted,
    textTransform:"uppercase", letterSpacing:".4px", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
  const td = { borderBottom:`1px solid ${C.border}22` };

  const Section = ({ title, count, children }) => (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage }}>{title}</div>
        <div style={{ fontSize:10, color:C.accentL, background:C.accentL+"22", padding:"1px 8px", borderRadius:10 }}>{count}</div>
      </div>
      {children}
    </div>
  );

  const updateCharterField = (key, value) => onUpdate("01", { charter:{...charter,[key]:value} }, "in-progress");
  const updateTeamField = (idx, field, value) => {
    const next = team.map((m,i)=>i===idx?{...m,[field]:value}:m);
    onUpdate("02", { teamMembers: next }, "in-progress");
  };
  const updateActField = (idx, field, value) => {
    const next = acts.map((a,i)=>i===idx?{...a,[field]:value}:a);
    onUpdate("03", { activities: next, milestones: miles }, "in-progress");
  };
  const removeAct = (idx) => onUpdate("03", { activities: acts.filter((_,i)=>i!==idx), milestones: miles }, "in-progress");
  const updateMileField = (idx, field, value) => {
    const next = miles.map((m,i)=>i===idx?{...m,[field]:value}:m);
    onUpdate("03", { activities: acts, milestones: next }, "in-progress");
  };
  const removeMile = (idx) => onUpdate("03", { activities: acts, milestones: miles.filter((_,i)=>i!==idx) }, "in-progress");
  const updateRiskField = (idx, field, value) => {
    const next = risks.map((r,i)=>i===idx?{...r,[field]:value}:r);
    onUpdate("05", { risks: next }, "in-progress");
  };
  const removeRisk = (idx) => onUpdate("05", { risks: risks.filter((_,i)=>i!==idx) }, "in-progress");
  const updateSHField = (idx, field, value) => {
    const next = stakeholders.map((s,i)=>i===idx?{...s,[field]:value}:s);
    onUpdate("08", { stakeholders: next }, "in-progress");
  };
  const removeSH = (idx) => onUpdate("08", { stakeholders: stakeholders.filter((_,i)=>i!==idx) }, "in-progress");
  const updateBenField = (idx, field, value) => {
    const next = benefits.map((b,i)=>i===idx?{...b,[field]:value}:b);
    const currentCharter = sheets["01"]?.data?.charter || {};
    onUpdate("01", { charter: { ...currentCharter, benefits: next } }, "in-progress");
  };
  const removeBen = (idx) => {
    const next = benefits.filter((_,i)=>i!==idx);
    const currentCharter = sheets["01"]?.data?.charter || {};
    onUpdate("01", { charter: { ...currentCharter, benefits: next } }, "in-progress");
  };

  const overviewFields = [
    ["projectName","Project Name"], ["projectCode","Project Code"],
    ["projectManager","Project Manager"], ["projectSponsor","Project Sponsor"],
    ["organisation","Organisation"], ["startDate","Start Date"], ["endDate","End Date"],
    ["budget","Budget"],
  ];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:400,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12,
        width:"100%", maxWidth:1000, maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>

        <div style={{ padding:"18px 24px 0", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:C.sage }}>Review Extracted Data</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Edit directly — changes save instantly.</div>
            </div>
            <button onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6,
              color:C.muted, padding:"7px 14px", fontSize:12, cursor:"pointer" }}>Close</button>
          </div>
          {/* Tab bar */}
          {[
            ["source",     `📄 Synthesised Document${intermediateDoc ? "" : " (empty)"}`],
            ["structured", "📋 Structured Data"],
          ].map(([tab,label]) => {
            const active = reviewTab === tab;
            return (
              <button key={tab} onClick={()=>setReviewTab(tab)}
                style={{ padding:"8px 16px", fontSize:12, fontWeight:active?700:400,
                  border:"none", borderBottom: active?`2px solid ${C.accentL}`:"2px solid transparent",
                  background:"none", color:active?C.accentL:C.muted, cursor:"pointer", marginRight:4 }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* Synthesised Document tab */}
          {reviewTab === "source" && (
            <div>
              {intermediateDoc ? (
                <div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:12, lineHeight:1.6,
                    background:C.surface, borderRadius:6, padding:"10px 14px", border:`1px solid ${C.border}` }}>
                    This is the project document created by the AI engine in Stage 1 — the "container".
                    It was written by synthesising everything in your uploaded files (or generating from your description).
                    Stage 2 then extracted the structured data on the right tab from this document.
                    Anything captured here beyond the seven standard sections is available for future extraction as new sheets are added.
                  </div>
                  <pre style={{ fontSize:11, color:C.dim, lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-word",
                    background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"14px 16px", margin:0 }}>
                    {intermediateDoc}
                  </pre>
                </div>
              ) : (
                <div style={{ fontSize:12, color:C.muted, fontStyle:"italic", padding:"20px 0" }}>
                  No synthesised document yet. Upload project files or paste a description in the Document Intelligence section to generate it.
                </div>
              )}
            </div>
          )}

          {reviewTab === "structured" && (<>

          <Section title="Project Overview" count={overviewFields.filter(([k])=>charter[k]).length+"/"+overviewFields.length}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:C.border, borderRadius:6, overflow:"hidden" }}>
              {overviewFields.map(([key,label]) => (
                <div key={key} style={{ background:C.surface, display:"flex", alignItems:"center" }}>
                  <div style={{ width:140, flexShrink:0, fontSize:10, color:C.muted, padding:"8px 10px", borderRight:`1px solid ${C.border}` }}>{label}</div>
                  <input style={cell} value={charter[key]||""} onChange={e=>updateCharterField(key,e.target.value)} placeholder="—"/>
                </div>
              ))}
            </div>
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Purpose</div>
              <textarea value={charter.purpose||""} onChange={e=>updateCharterField("purpose",e.target.value)}
                style={{ ...cell, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, minHeight:50, resize:"none", padding:"8px 10px" }}/>
            </div>
          </Section>

          <Section title="Team" count={team.length}>
            {team.length===0 ? <EmptyNote/> : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr>{["Name","Role","Login Code",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {team.map((m,i)=>(
                    <tr key={i} style={td}>
                      <td><input style={cell} value={m.name||""} onChange={e=>updateTeamField(i,"name",e.target.value)} placeholder="Name…"/></td>
                      <td><input style={cell} value={m.role||""} onChange={e=>updateTeamField(i,"role",e.target.value)}/></td>
                      <td style={{ fontFamily:"monospace", color:C.accentL, fontSize:10, padding:"6px 8px" }}>{m.loginCode}</td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Schedule — Activities" count={acts.length}>
            {acts.length===0 ? <EmptyNote/> : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr>{["Activity","Phase","Start","End",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {acts.map((a,i)=>(
                    <tr key={i} style={td}>
                      <td><input style={cell} value={a.name||""} onChange={e=>updateActField(i,"name",e.target.value)}/></td>
                      <td><input style={cell} value={a.phase||""} onChange={e=>updateActField(i,"phase",e.target.value)}/></td>
                      <td><DatePickerField value={a.startDate||""} onChange={v=>updateActField(i,"startDate",v)} style={cell} /></td>
                      <td><DatePickerField value={a.targetDate||""} onChange={v=>updateActField(i,"targetDate",v)} style={cell} /></td>
                      <td><button onClick={()=>removeAct(i)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Schedule — Milestones" count={miles.length}>
            {miles.length===0 ? <EmptyNote/> : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr>{["Milestone","Phase","Target Date",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {miles.map((m,i)=>(
                    <tr key={i} style={td}>
                      <td><input style={cell} value={m.name||""} onChange={e=>updateMileField(i,"name",e.target.value)}/></td>
                      <td><input style={cell} value={m.phase||""} onChange={e=>updateMileField(i,"phase",e.target.value)}/></td>
                      <td><DatePickerField value={m.targetDate||""} onChange={v=>updateMileField(i,"targetDate",v)} style={cell} /></td>
                      <td><button onClick={()=>removeMile(i)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Risks" count={risks.length}>
            {risks.length===0 ? <EmptyNote/> : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr>{["Risk","Category","Likelihood","Impact","Response",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {risks.map((r,i)=>(
                    <tr key={i} style={td}>
                      <td><input style={cell} value={r.name||""} onChange={e=>updateRiskField(i,"name",e.target.value)}/></td>
                      <td><input style={cell} value={r.category||""} onChange={e=>updateRiskField(i,"category",e.target.value)}/></td>
                      <td><input style={{...cell,width:50}} value={r.likelihood||""} onChange={e=>updateRiskField(i,"likelihood",e.target.value)}/></td>
                      <td><input style={{...cell,width:50}} value={r.impact||""} onChange={e=>updateRiskField(i,"impact",e.target.value)}/></td>
                      <td><input style={cell} value={r.response||""} onChange={e=>updateRiskField(i,"response",e.target.value)}/></td>
                      <td><button onClick={()=>removeRisk(i)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {tier === "full" && (
            <>
              <Section title="Stakeholders" count={stakeholders.length}>
                {stakeholders.length===0 ? <EmptyNote/> : (
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead><tr>{["Name","Category",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {stakeholders.map((s,i)=>(
                        <tr key={i} style={td}>
                          <td><input style={cell} value={s.name||""} onChange={e=>updateSHField(i,"name",e.target.value)}/></td>
                          <td><input style={cell} value={s.category||""} onChange={e=>updateSHField(i,"category",e.target.value)}/></td>
                          <td><button onClick={()=>removeSH(i)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section title="Benefits" count={benefits.length}>
                {benefits.length===0 ? <EmptyNote/> : (
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead><tr>{["Benefit Name","Category","Owner",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {benefits.map((b,i)=>(
                        <tr key={i} style={td}>
                          <td><input style={cell} value={b.name||""} onChange={e=>updateBenField(i,"name",e.target.value)}/></td>
                          <td><input style={cell} value={b.category||""} onChange={e=>updateBenField(i,"category",e.target.value)}/></td>
                          <td><input style={cell} value={b.owner||""} onChange={e=>updateBenField(i,"owner",e.target.value)}/></td>
                          <td><button onClick={()=>removeBen(i)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
function EmptyNote() {
  return <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", padding:"8px 0" }}>Nothing here yet.</div>;
}

export default function ProjectSetup({ state, onSheetUpdate, onSheetApprove, onSheetUnlock, onSheetNav, onLaunch, onLogout }) {
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const { l2, project } = state;
  const tier    = state.projectTier;
  const tierCfg = tier ? TIERS[tier] : null;
  const sheets  = l2?.sheets || {};

  const isExisting = Object.values(sheets).some(s => s.status !== "empty") || (l2?.loginCodes||[]).length > 0;
  const pmAlreadySet = (l2?.loginCodes||[]).some(m => m.isPM || m.role === "Project Manager");

  const [phase, setPhase] = useState(() => isExisting ? "done" : "intake");
  const [aiStatus, setAiStatus] = useState("");
  const [docAnalysis, setDocAnalysis] = useState("");
  const [fileList, setFileList] = useState([]);
  const [uploadMode, setUploadMode] = useState("file");
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  // Which pipeline stage is running — drives the animated progress tracker
  // null | "reading" | "synthesising" | "extracting" | "populating" | "finalising"
  const [pipelineStage, setPipelineStage] = useState(null);
  const [showReview, setShowReview] = useState(false);

  const wizardSheetOrder = tierCfg ? scheduleLast(WIZARD_SHEETS[tier]) : [];
  const [sheetIdx, setSheetIdx] = useState(0);
  const [clusterIdx, setClusterIdx] = useState(0);
  const [fieldAnswers, setFieldAnswers] = useState({});
  const [aiChipSuggestions, setAiChipSuggestions] = useState({});
  const [chipsLoading, setChipsLoading] = useState(false);

  const [activeSheet, setActiveSheet] = useState("01");
  const [dirtySheet, setDirtySheet] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(null);
  const sheetSnapshotRef = useRef({});

  const getCharterField = (key) => sheets["01"]?.data?.charter?.[key] || "";
  const isFieldKnown = (key) => {
    switch(key) {
      case "projectManager": return !!getCharterField("projectManager");
      case "projectName":    return !!getCharterField("projectName");
      case "organisation":   return !!getCharterField("organisation");
      case "purpose":        return !!getCharterField("purpose");
      case "projectSponsor": return !!getCharterField("projectSponsor");
      case "startDate":      return !!getCharterField("startDate");
      case "endDate":        return !!getCharterField("endDate");
      case "budget":         return !!getCharterField("budget");
      case "teamRoles":      return (sheets["02"]?.data?.teamMembers||[]).filter(m=>!m.isPM).length > 0;
      case "risks":          return (sheets["05"]?.data?.risks||[]).length > 0;
      case "stakeholders":   return (sheets["08"]?.data?.stakeholders||[]).length > 0;
      case "benefits":       return (sheets["01"]?.data?.charter?.benefits||[]).length > 0;
      case "sustainFocus":   return false; // always optional, never auto-skip
      case "keyMilestones":  return false;
      default: return false;
    }
  };

  const buildContext = () => {
    const c    = sheets["01"]?.data?.charter || {};
    const team = sheets["02"]?.data?.teamMembers || [];
    const acts = sheets["03"]?.data?.activities || [];
    const miles = sheets["03"]?.data?.milestones || [];
    const risks = sheets["05"]?.data?.risks || [];
    const shs  = sheets["08"]?.data?.stakeholders || [];
    const bens = c.benefits || [];

    // Build a rich context string that wizard AI calls can use for smart suggestions
    const lines = [];
    if (c.projectName)       lines.push(`Project: ${c.projectName}`);
    if (c.organisation)      lines.push(`Organisation: ${c.organisation}`);
    if (c.purpose)           lines.push(`Purpose: ${c.purpose}`);
    if (c.problemStatement)  lines.push(`Problem: ${c.problemStatement}`);
    if (c.strategicAlignment) lines.push(`Strategic alignment: ${c.strategicAlignment}`);
    if (c.startDate || c.endDate) lines.push(`Timeline: ${c.startDate||"TBD"} → ${c.endDate||"TBD"}`);
    if (c.budget)            lines.push(`Budget: ${c.budget}`);
    if (c.withinScope?.length) lines.push(`In scope: ${c.withinScope.slice(0,3).join("; ")}`);

    if (team.length)  lines.push(`Team (${team.length}): ${team.map(m=>m.role||m.name).filter(Boolean).slice(0,5).join(", ")}`);
    if (acts.length)  lines.push(`Activities already extracted (${acts.length}): ${acts.slice(0,5).map(a=>a.name).join(", ")}${acts.length>5?" …":"" }`);
    if (miles.length) lines.push(`Milestones (${miles.length}): ${miles.map(m=>m.name).join(", ")}`);
    if (risks.length) lines.push(`Risks already identified (${risks.length}): ${risks.slice(0,5).map(r=>r.name).join(", ")}${risks.length>5?" …":""}`);
    if (shs.length)   lines.push(`Stakeholders (${shs.length}): ${shs.slice(0,5).map(s=>s.name).join(", ")}${shs.length>5?" …":""}`);
    if (bens.length)  lines.push(`Benefits (${bens.length}): ${bens.map(b=>b.name).join(", ")}`);

    return {
      // Structured fields for existing callers
      projectName:   c.projectName||"", purpose: c.purpose||"",
      organisation:  c.organisation||"", projectManager: c.projectManager||"",
      endDate:       c.endDate||"",
      teamCount:     team.length, riskCount: risks.length,
      // Rich prose summary for AI prompts
      summary: lines.join("\n"),
    };
  };

  const currentSheetId = wizardSheetOrder[sheetIdx];
  const allClustersForSheet = CLUSTERS[currentSheetId] || [];

  // Freeze which clusters are visible for this sheet the moment we arrive at it.
  // Without this, a cluster vanishes mid-interaction the instant the PM adds their
  // first chip/role (isFieldKnown flips true), snapping clusterIdx to a different
  // cluster and looking like the wizard "skipped ahead" on click.
  const [frozenVisibility, setFrozenVisibility] = useState({});
  useEffect(() => {
    if (!currentSheetId || frozenVisibility[currentSheetId]) return;
    const visible = allClustersForSheet.filter(cl =>
      cl.fields.some(f => f.optional || !isFieldKnown(f.key))
    ).map(cl => cl.id);
    setFrozenVisibility(prev => ({ ...prev, [currentSheetId]: visible }));
  }, [currentSheetId]);

  const visibleClusters = allClustersForSheet.filter(cl =>
    (frozenVisibility[currentSheetId] || allClustersForSheet.map(c=>c.id)).includes(cl.id)
  );
  const currentCluster = visibleClusters[clusterIdx];

  const totalFieldsKnown = () => {
    let known = 0, total = 0;
    Object.values(CLUSTERS).forEach(clusters => clusters.forEach(cl => cl.fields.forEach(f => {
      total++; if (isFieldKnown(f.key)) known++;
    })));
    return { known, total };
  };

  // ── New two-stage pipeline ─────────────────────────────────────────────────
  // Stage 1 (once, across ALL files combined): Claude reads all raw files and
  // writes a comprehensive intermediate project document in prose — same as
  // what you did manually. This cross-references all files, domain-enriches,
  // and captures everything including sections beyond the seven guaranteed ones.
  //
  // Stage 2 (from intermediate doc, not raw files): Extract structured schema
  // fields from the clean prose. Because the source is well-structured prose
  // rather than raw cell dumps, extraction quality matches manual Claude output.
  //
  // Floor vs ceiling: the seven sections are guaranteed minimums. Stage 1 is
  // free to capture comms plans, quality gates, budget breakdowns, constraints,
  // lessons learned etc. These land in documentSummary and surface in Review Data.

  const [intermediateDoc, setIntermediateDoc] = useState(l2?.intermediateDoc || "");

  const synthesiseDocuments = async (fileContents, sources) => {
    // Stage 1 — project intelligence engine.
    // Works for ANY input: rich multi-file documents, a single brief, or even
    // a one-line description like "birthday party for my 18th". When the input
    // is sparse, Claude generates a full project plan from PM domain knowledge.
    // When the input is rich, it extracts and synthesises.
    // Either way the output is an intermediate project document — the container —
    // from which Stage 2 extracts the schema fields.
    const isSparse = fileContents.length === 1 && fileContents[0].text.length < 600;
    setPipelineStage("synthesising");
    setAiStatus(isSparse ? "Generating project plan…" : "Creating comprehensive project plan from your documents…");

    const combined = fileContents.map(f =>
      `=== SOURCE: ${f.name} ===\n${f.text.slice(0, 18000)}`
    ).join("\n\n");

    const sourceList = sources.join(", ");

    const today = new Date().toISOString().slice(0,10);
    const tierGuidance = tier === "light"
      ? "This is a LIGHT-tier project (simple/lean). Do NOT include stakeholder-register activities, change-control activities, or formal governance-board activities in the schedule — keep activities focused on direct delivery. A brief stakeholder mention in prose is fine, but no dedicated register-population or change-control tasks."
      : "This is a FULL-tier project — include stakeholder management and change control where appropriate.";

    const stage1Prompt = `You are a senior project manager. Based on the input below, produce a comprehensive, well-structured project document suitable for setting up a full project management platform.

TODAY'S DATE: ${today}. All generated dates MUST be on or after today unless the input explicitly states otherwise. Anchor the schedule to start from today (or the input's stated start date if later) and work toward any stated deadline.

TIER: ${tierGuidance}

SOURCES: ${sourceList}

INPUT:
${combined}

---

${isSparse
  ? `The input is a brief description or idea. Use your project management expertise to generate a realistic, detailed project plan from it. Mark generated content with [Generated] and content drawn from the input with [From input]. Be creative but realistic — treat it as a real project.`
  : `The input contains project documents. Synthesise ALL of them into one comprehensive document. Cross-reference between files. Preserve all dates, codes, IDs, and numeric values exactly. Mark extracted content with [Extracted] and domain-enriched additions with [Recommended].`}

Produce a project document covering ALL sections below. Go beyond this list wherever the input provides richer information (communications plans, quality gates, budget breakdowns, governance, change control, lessons learned, etc.).

1. PROJECT OVERVIEW — name, code, PM, sponsor, organisation, dates, budget
2. PURPOSE, PROBLEM & STRATEGIC ALIGNMENT
3. SCOPE — within scope (numbered list); out of scope (numbered list)
4. PROJECT TEAM — ${isSparse
  ? "List the ROLES needed for this project only — do NOT invent or generate names. Names will be assigned by the PM. Format each as: Role Title (Governance Tier). Example: Project Manager (Tier 3), Event Coordinator (Tier 4)."
  : "All members with full names, roles, and governance tiers — extract exactly as found in the documents."}
5. PROJECT SCHEDULE — all phases; every activity (name, phase, responsible role, start date, target date, description); every milestone (name, phase, target date). ${isSparse ? "Generate a realistic full schedule." : "Extract ALL activities found — never truncate."}
6. RISK REGISTER — every risk (name, cause, potential impact, likelihood 1–3, impact 1–3, mitigation, response, category). ${isSparse ? "Generate 6–10 realistic risks." : "Extract all risks."}
7. STAKEHOLDER REGISTER — every stakeholder (name, role, power 1–10, interest 1–10, influence 1–10, ease 1–10, engagement strategy)
8. BENEFITS & OBJECTIVES — each benefit with nested objectives (objective, success criterion/KPI, target date)
9. DELIVERABLES & KPIs
10. CONSTRAINTS, ASSUMPTIONS & DEPENDENCIES

Be exhaustive. Never truncate. ${isSparse ? "A sparse input should produce a complete, professional project plan — this is the value the engine provides." : ""}`;

    const intermediateText = await callExtract(
      [{ role:"user", content:stage1Prompt }], 6000
    );
    setIntermediateDoc(intermediateText);
    // Persist to l2 state — survives remounts, refresh, and L3 round-trips,
    // and is saved to Redis with the rest of the project state.
    onSheetUpdate("__intermediateDoc__", {}, "empty", intermediateText);
    setDocAnalysis(intermediateText.slice(0, 500) + (intermediateText.length > 500 ? "…" : ""));
    return intermediateText;
  };


  const extractSchemaFromDocument = async (intermediateText) => {
    setPipelineStage("extracting");
    setAiStatus("Extracting structured data from synthesised document…");
    const prompt = `Extract ALL structured project data from this project document into the JSON schema below.

DOCUMENT:
${intermediateText.slice(0, 28000)}

Rules:
- Extract ALL items — never truncate activities, risks, or stakeholders
- Dates: YYYY-MM-DD format
- Responsible: ROLE names only (e.g. "Project Manager", "Research Coordinator") — never person names
- Risk likelihood/impact: ONLY "1 - Low", "2 - Medium", or "3 - High"
- Benefits must include nested objectives where defined
- withinScope and outOfScope as string arrays
- documentSummary: one paragraph prose summary of the whole project for context

Return ONLY JSON, no markdown, no preamble:
{"charter":{"projectName":"","purpose":"","problemStatement":"","strategicAlignment":"","startDate":"","endDate":"","budget":"","projectManager":"","projectSponsor":"","organisation":"","withinScope":[],"outOfScope":[]},"team":[{"name":"","role":""}],"activities":[{"name":"","phase":"","responsible":"","description":"","startDate":"","targetDate":"","_complete":false,"plannedCost":""}],"milestones":[{"name":"","phase":"","targetDate":"","_complete":false}],"risks":[{"name":"","cause":"","potentialImpact":"","likelihood":"2 - Medium","impact":"2 - Medium","response":"Reduce","mitigation":"","category":""}],"stakeholders":[{"name":"","category":"","power":"5","interest":"5","influence":"5","ease":"5","engagementStrategy":""}],"benefits":[{"name":"","description":"","category":"Strategic","owner":"","targetDate":"","objectives":[{"objective":"","successCriterion":"","targetDate":""}]}],"documentSummary":""}`;

    const raw = await callExtract([{ role:"user", content:prompt }], 12000);
    return safeParseJSON(raw);
  };

  const applyExtractedData = (extracted) => {
    setPipelineStage("populating");
    // Sheet 01 — charter + benefits (single atomic write, no race condition)
    if (extracted.charter || extracted.benefits?.length) {
      const c = sheets["01"]?.data?.charter || {};
      const mergedCharter = { ...c };
      if (extracted.charter) {
        Object.entries(extracted.charter).forEach(([k,v]) => {
          if (Array.isArray(v)) { if (v.length > 0 && !(c[k]?.length)) mergedCharter[k] = v; }
          else if (v && !c[k]) mergedCharter[k] = v;
        });
      }
      if (extracted.documentSummary && !mergedCharter.documentSummary) {
        mergedCharter.documentSummary = extracted.documentSummary;
      }
      if (extracted.benefits?.length) {
        const existingBens = c.benefits || [];
        const newBens = extracted.benefits
          .filter(b => b.name && !existingBens.some(e => e.name?.toLowerCase() === b.name.toLowerCase()))
          .map((b,i) => ({
            _id:`BEN-${String(existingBens.length+i+1).padStart(3,"0")}`,
            name:b.name, description:b.description||"", category:b.category||"Strategic",
            owner:b.owner||"", targetDate:b.targetDate||"",
            sustainmentPlan:"", lessonsLearned:"",
            objectives:(b.objectives||[]).map((o,j) => ({
              _id:`OBJ-${String(j+1).padStart(3,"0")}`,
              objective:o.objective||"", successCriterion:o.successCriterion||"", targetDate:o.targetDate||"",
            })),
          }));
        if (newBens.length) mergedCharter.benefits = [...existingBens, ...newBens];
      }
      if (JSON.stringify(mergedCharter) !== JSON.stringify(c)) {
        onSheetUpdate("01", { charter: mergedCharter }, "ai-draft");
      }
    }

    // Sheet 02 — team
    const existingTeam = sheets["02"]?.data?.teamMembers || [];
    const SINGLE_ROLES = ["Project Manager","Project Sponsor"];
    if (extracted.team?.length) {
      const existingCodes = [...(l2?.loginCodes||[]).map(m=>m.loginCode), ...existingTeam.map(m=>m.loginCode).filter(Boolean)];
      const newM = extracted.team.filter(m => {
        // Accept entries that have at least a role (name may be blank for generated/role-only entries)
        if (!m.role && !m.name) return false;
        // Never duplicate a singleton governance role
        if (SINGLE_ROLES.includes(m.role) && existingTeam.some(e => e.role === m.role)) return false;
        // Deduplicate by name only when a name is present
        if (m.name && existingTeam.some(e => e.name?.toLowerCase() === m.name.toLowerCase())) return false;
        // Deduplicate by role for role-only entries
        if (!m.name && existingTeam.some(e => e.role === m.role)) return false;
        return true;
      }).map((m,i) => {
        const code = generateLoginCode(project?.code || "NC", existingCodes);
        existingCodes.push(code);
        return {
          _id:`TM-${String(existingTeam.length+i+1).padStart(3,"0")}`,
          name: m.name || "",   // blank for generated/role-only — PM fills in later
          role: m.role || "",
          deliveryRole:"", availability:"", loginCode:code, location:"", responsibilities:"",
        };
      });
      if (newM.length) onSheetUpdate("02", { teamMembers:[...existingTeam,...newM] }, "ai-draft");
    }

    // Sheet 03 — activities + milestones (single atomic write — no race condition)
    {
      const existingActs  = sheets["03"]?.data?.activities || [];
      const existingMiles = sheets["03"]?.data?.milestones || [];
      let finalActs = [...existingActs], finalMiles = [...existingMiles], changed = false;
      if (extracted.activities?.length) {
        const newA = extracted.activities
          .filter(a => a.name && !existingActs.some(e => e.name?.toLowerCase().trim() === a.name.toLowerCase().trim()))
          .map((a,i) => ({
            _id:`ACT-${String(existingActs.length+i+1).padStart(3,"0")}`,
            name:a.name, phase:a.phase||"",
            startDate:  toYMD(a.startDate),
            targetDate: toYMD(a.targetDate),
            responsible: a.responsible && /coordinator|manager|lead|curator|controller|scheduler|analyst|specialist/i.test(a.responsible) ? a.responsible : "",
            description:a.description||"",
            _complete:a._complete||false, _state:a._complete?"complete":"pending",
          }));
        if (newA.length) { finalActs = [...existingActs,...newA]; changed = true; }

        // Migrate any plannedCost on extracted activities into costData structure
        // so it renders in the Planned Cost (£) field in Sheet 03 and the L3 cost overview
        const existingCostData = sheets["03"]?.data?.costData || {};
        const newCostData = { ...existingCostData };
        let costChanged = false;
        extracted.activities.forEach((a, i) => {
          if (!a.name) return;
          const matched = finalActs.find(fa => fa.name?.toLowerCase().trim() === a.name.toLowerCase().trim());
          if (matched && a.plannedCost && !newCostData[matched._id]?.plannedAmount) {
            newCostData[matched._id] = { ...(newCostData[matched._id]||{}), plannedAmount: String(a.plannedCost) };
            costChanged = true;
          }
        });
        if (costChanged) {
          onSheetUpdate("03", { costData: newCostData }, "ai-draft");
        }
      }
      if (extracted.milestones?.length) {
        const newMs = extracted.milestones
          .filter(m => m.name && !existingMiles.some(e => e.name?.toLowerCase().trim() === m.name.toLowerCase().trim()))
          .map((m,i) => ({
            _id:`MS-${String(existingMiles.length+i+1).padStart(3,"0")}`,
            name:m.name, phase:m.phase||"", targetDate:m.targetDate||"",
            _complete:m._complete||false, _state:m._complete?"complete":"pending",
          }));
        if (newMs.length) { finalMiles = [...existingMiles,...newMs]; changed = true; }
      }
      if (changed) onSheetUpdate("03", { activities:finalActs, milestones:finalMiles }, "ai-draft");
    }

    // Sheet 05 — risks
    const existingRisks = sheets["05"]?.data?.risks || [];
    if (extracted.risks?.length) {
      const normLevel = (v) => { const s=String(v||"").trim(); if(s.includes("-")) return s; const n=parseInt(s); return n===1?"1 - Low":n===3?"3 - High":"2 - Medium"; };
      const newR = extracted.risks
        .filter(r => r.name && !existingRisks.some(e => e.name?.toLowerCase().trim() === r.name.toLowerCase().trim()))
        .map((r,i) => ({
          _id:`R-${String(101+existingRisks.length+i)}`, name:r.name, cause:r.cause||"",
          potentialImpact:r.potentialImpact||"", likelihood:normLevel(r.likelihood), impact:normLevel(r.impact),
          response:r.response||"Reduce", mitigation:r.mitigation||"", category:r.category||"",
        }));
      if (newR.length) onSheetUpdate("05", { risks:[...existingRisks,...newR] }, "ai-draft");
    }

    // Sheet 08 — stakeholders (Full tier only)
    if (tier === "full") {
      const existingSH = sheets["08"]?.data?.stakeholders || [];
      if (extracted.stakeholders?.length) {
        const newSH = extracted.stakeholders
          .filter(s => s.name && !existingSH.some(e => e.name?.toLowerCase() === s.name.toLowerCase()))
          .map((s,i) => ({
            _id:`SH-${String(existingSH.length+i+1).padStart(3,"0")}`, name:s.name, category:s.category||"",
            power:parseInt(s.power)||5, interest:parseInt(s.interest)||5,
            influence:parseInt(s.influence)||5, ease:parseInt(s.ease)||5,
            status:"Identified", scoreHistory:[], statusHistory:[],
            engagementStrategy:s.engagementStrategy||"",
          }));
        if (newSH.length) onSheetUpdate("08", { stakeholders:[...existingSH,...newSH] }, "ai-draft");
      }
    }
  };

  // Generate activities and risks when extraction/synthesis leaves gaps.
  // Runs AFTER extraction — never overwrites data already placed.
  const generateMissingContent = async (source) => {
    setPipelineStage("finalising");
    const c = sheets["01"]?.data?.charter || {};
    const projectName   = c.projectName   || "";
    const purpose       = c.purpose       || "";
    const organisation  = c.organisation  || "";
    const existingActs  = sheets["03"]?.data?.activities || [];
    const existingRisks = sheets["05"]?.data?.risks || [];
    if (!projectName && !purpose) return;

    const contextStr = [
      projectName  ? `Project: ${projectName}` : "",
      organisation ? `Organisation: ${organisation}` : "",
      purpose      ? `Purpose: ${purpose}` : "",
      c.problemStatement ? `Problem: ${c.problemStatement}` : "",
    ].filter(Boolean).join("\n");

    if (existingActs.length === 0) {
      setAiStatus("Generating project schedule…");
      try {
        const today = new Date().toISOString().slice(0,10);
        const prompt = `You are an expert PM. Based on this project context, generate a realistic schedule of 6-10 activities across APM lifecycle phases (Concept, Definition, Development, Handover & Closeout).
TODAY'S DATE: ${today}. All dates must be on or after today.
${tier === "light" ? "LIGHT-tier project: no stakeholder-register or change-control activities — direct delivery tasks only." : ""}

${contextStr}

Return ONLY JSON, no markdown:
{"activities":[{"name":"","phase":"","responsible":"","description":""}]}

Rules: use ONLY those phases; leave responsible blank; make activity names specific to this project.`;
        const raw = await callExtract([{role:"user",content:prompt}], 2000);
        const parsed = safeParseJSON(raw);
        if (parsed.activities?.length) {
          const newA = parsed.activities.filter(a => a.name).map((a,i) => ({
            _id:`ACT-${String(i+1).padStart(3,"0")}`,
            name:a.name, phase:a.phase||"Definition", responsible:"",
            description:a.description||"", _complete:false, _state:"pending",
          }));
          if (newA.length) onSheetUpdate("03", { activities:newA, milestones: sheets["03"]?.data?.milestones||[] }, "ai-draft");
        }
      } catch(e) { /* non-fatal */ }
    }

    if (existingRisks.length === 0) {
      setAiStatus("Generating risk register…");
      try {
        const prompt = `You are a project risk expert. Based on this project context, identify 4-6 realistic risks.

${contextStr}

Return ONLY JSON, no markdown:
{"risks":[{"name":"","cause":"","potentialImpact":"","likelihood":"2 - Medium","impact":"2 - Medium","response":"Reduce","mitigation":"","category":""}]}

Use ONLY these likelihood/impact values: "1 - Low", "2 - Medium", "3 - High".`;
        const raw = await callExtract([{role:"user",content:prompt}], 1500);
        const parsed = safeParseJSON(raw);
        if (parsed.risks?.length) {
          const newR = parsed.risks.filter(r => r.name).map((r,i) => ({
            _id:`R-${String(101+i)}`, name:r.name, cause:r.cause||"",
            potentialImpact:r.potentialImpact||"", likelihood:r.likelihood||"2 - Medium",
            impact:r.impact||"2 - Medium", response:r.response||"Reduce",
            mitigation:r.mitigation||"", category:r.category||"",
          }));
          if (newR.length) onSheetUpdate("05", { risks:newR }, "ai-draft");
        }
      } catch(e) { /* non-fatal */ }
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files||[]);
    if (!files.length) return;
    setExtracting(true);
    setPipelineStage("reading");
    const fileContents = [];
    for (const file of files) {
      setAiStatus(`Reading ${file.name}…`);
      try {
        let text = "";
        const name = file.name.toLowerCase();
        if (name.endsWith(".docx")) {
          const buf = await file.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer: buf });
          text = res.value.replace(/\n{3,}/g,"\n\n").trim();
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          text = await readExcelAsText(file);
        } else {
          text = await file.text();
        }
        if (text.trim()) {
          fileContents.push({ name: file.name, text });
          setFileList(prev => [...prev, file.name]);
        }
      } catch(err) { setAiStatus(`⚠ ${file.name}: ${err.message}`); }
    }

    if (fileContents.length > 0) {
      try {
        const intermediateText = await synthesiseDocuments(fileContents, fileContents.map(f=>f.name));
        const extracted = await extractSchemaFromDocument(intermediateText);
        applyExtractedData(extracted);
        // Only generate missing content if still in setup — never write to sheets post-launch
        if (state.activeLayer !== "L3") {
          await generateMissingContent("documents").catch(()=>{});
        }
      } catch(err) { setAiStatus(`⚠ Extraction error: ${err.message}`); }
    }

    setExtracting(false);
    setPipelineStage(null);
    setAiStatus("");
    e.target.value = "";
  };

  const handleTextExtract = async () => {
    if (!pasteText.trim()) return;
    setExtracting(true);
    setPipelineStage("reading");
    try {
      // Paste text goes through the full two-stage pipeline — same as file upload.
      // This means "I want to organise a birthday party for my 18th" produces a
      // complete project plan in the intermediate container, then extracts to schema.
      const intermediateText = await synthesiseDocuments(
        [{ name:"pasted description", text:pasteText }],
        ["pasted description"]
      );
      const extracted = await extractSchemaFromDocument(intermediateText);
      applyExtractedData(extracted);
      setFileList(prev => [...prev, "Pasted text"]);
      setPasteText("");
      if (state.activeLayer !== "L3") {
        await generateMissingContent("paste").catch(()=>{});
      }
    } catch(err) { setAiStatus(`⚠ ${err.message}`); }
    setExtracting(false);
    setPipelineStage(null);
    setAiStatus("");
  };


  const enterWizard = () => {
    setPhase("wizard");
    setSheetIdx(0);
    setClusterIdx(0);
  };

  const advanceWizard = () => {
    const nextClusterIdx = clusterIdx + 1;
    if (nextClusterIdx < visibleClusters.length) {
      setClusterIdx(nextClusterIdx);
      return;
    }
    const nextSheetIdx = sheetIdx + 1;
    if (nextSheetIdx < wizardSheetOrder.length) {
      setSheetIdx(nextSheetIdx);
      setClusterIdx(0);
      return;
    }
    // Wizard complete — generate missing content before entering Personalisation
    setPhase("done");
    setActiveSheet(tierCfg.sheets[0]);
    // Only run in background if still in setup — never post-launch
    if (state.activeLayer !== "L3") {
      generateMissingContent("wizard").catch(()=>{});
    }
  };

  const goBackWizard = () => {
    if (clusterIdx > 0) { setClusterIdx(clusterIdx - 1); return; }
    if (sheetIdx > 0) {
      const prevSheetId = wizardSheetOrder[sheetIdx-1];
      const prevAllClusters = CLUSTERS[prevSheetId] || [];
      const prevVisibleIds = frozenVisibility[prevSheetId] ||
        prevAllClusters.filter(cl => cl.fields.some(f=>f.optional||!isFieldKnown(f.key))).map(cl=>cl.id);
      const prevClusters = prevAllClusters.filter(cl => prevVisibleIds.includes(cl.id));
      setSheetIdx(sheetIdx - 1);
      setClusterIdx(Math.max(0, prevClusters.length - 1));
      return;
    }
    setPhase("intake");
  };

  const saveFieldAnswer = async (key, value) => {
    setFieldAnswers(prev => ({ ...prev, [key]: value }));
    if (["projectManager","projectName","organisation","purpose","projectSponsor","startDate","endDate","budget"].includes(key)) {
      const c = sheets["01"]?.data?.charter || {};
      onSheetUpdate("01", { charter: { ...c, [key]: value } }, "in-progress");
      return;
    }
    if (key === "keyMilestones") {
      if (!value || !value.trim()) return;
      // Parse free-text milestone description into real Schedule milestone records
      setAiStatus("Adding milestones to Schedule…");
      try {
        const prompt = `Extract distinct milestones from this PM input. Each milestone needs a name and, if a date is mentioned or inferable, a target date (YYYY-MM-DD).
Input: "${value}"
Return ONLY JSON, no markdown: {"milestones":[{"name":"","targetDate":""}]}
If no clear milestones are described, return {"milestones":[]}`;
        const raw = await callExtract([{role:"user",content:prompt}], 400);
        const parsed = safeParseJSON(raw);
        if (parsed.milestones?.length) {
          const existingMiles = sheets["03"]?.data?.milestones || [];
          const newMiles = parsed.milestones.filter(m=>m.name && !existingMiles.some(e=>e.name?.toLowerCase().trim()===m.name.toLowerCase().trim()))
            .map((m,i)=>({_id:`MS-${String(existingMiles.length+i+1).padStart(3,"0")}`, name:m.name, phase:"", targetDate:m.targetDate||"", _complete:false, _state:"pending"}));
          if (newMiles.length) {
            const acts = sheets["03"]?.data?.activities || [];
            onSheetUpdate("03", { activities:acts, milestones:[...existingMiles,...newMiles] }, "in-progress");
          }
        }
      } catch(e) { /* non-fatal — milestone parsing failure shouldn't block wizard */ }
      setAiStatus("");
    }
  };

  const addTeamRole = (role) => {
    const existing = sheets["02"]?.data?.teamMembers || [];
    if (existing.some(m => m.role === role)) return;
    const existingCodes = [...(l2?.loginCodes||[]).map(m=>m.loginCode), ...existing.map(m=>m.loginCode).filter(Boolean)];
    const code = generateLoginCode(project?.code || "NC", existingCodes);
    const newMember = { _id:`TM-${String(existing.length+1).padStart(3,"0")}`, loginCode:code, name:"", role,
      deliveryRole:"", availability:"", location:"", responsibilities:"" };
    onSheetUpdate("02", { teamMembers: [...existing, newMember] }, "in-progress");
    onSheetUpdate("__loginCode__", {}, "empty", { loginCode: code, name:"", role, isPM:false });
  };
  const removeTeamRole = (role) => {
    const existing = sheets["02"]?.data?.teamMembers || [];
    const removed = existing.find(m => m.role === role);
    onSheetUpdate("02", { teamMembers: existing.filter(m => m.role !== role) }, "in-progress");
    if (removed?.loginCode) onSheetUpdate("__removeLoginCode__", {}, "empty", removed.loginCode);
  };
  const updateTeamMemberName = (role, name) => {
    const existing = sheets["02"]?.data?.teamMembers || [];
    const updated = existing.map(m => m.role === role ? { ...m, name } : m);
    onSheetUpdate("02", { teamMembers: updated }, "in-progress");
    const member = updated.find(m => m.role === role);
    if (member?.loginCode) {
      onSheetUpdate("__updateLoginCodeName__", {}, "empty", { loginCode: member.loginCode, name });
    }
  };
  const getTeamMemberByRole = (role) => (sheets["02"]?.data?.teamMembers||[]).find(m => m.role === role);

  // Map sustainability focus area names to their dimension IDs
  const AREA_TO_DIMENSION = {
    "Resource Use":"environmental","Travel":"environmental","Waste":"environmental","Digital Delivery":"environmental",
    "Accessibility":"social","Diversity":"social","Community Benefit":"social","Wellbeing":"social","Skills Development":"social",
    "Transparency":"governance","Accountability":"governance","Data Protection":"governance","Risk Management":"governance",
    "Knowledge Creation":"legacy","Skills Transfer":"legacy","Partnerships":"legacy","Project Continuity":"legacy",
  };

  const addChipItem = (fieldKey, item) => {
    if (fieldKey === "risks") {
      const existing = sheets["05"]?.data?.risks || [];
      if (existing.some(r=>r.name===item)) return;
      // H2 fix: store risk levels in the format Sheet05 dropdown expects
      onSheetUpdate("05", { risks:[...existing, {
        _id:`R-${101+existing.length}`, name:item, cause:"", potentialImpact:"",
        likelihood:"2 - Medium", impact:"2 - Medium", response:"Reduce", mitigation:"", category:"",
      }] }, "in-progress");
    } else if (fieldKey === "stakeholders") {
      const existing = sheets["08"]?.data?.stakeholders || [];
      if (existing.some(s=>s.name===item)) return;
      onSheetUpdate("08", { stakeholders:[...existing, {
        _id:`SH-${String(existing.length+1).padStart(3,"0")}`, name:item, category:"",
        power:5, interest:5, influence:5, ease:5, status:"Identified",
        scoreHistory:[], statusHistory:[], engagementStrategy:"",
      }] }, "in-progress");
    } else if (fieldKey === "benefits") {
      // C1 fix: write to charter.benefits not KD Tracker deliverables
      const charter  = sheets["01"]?.data?.charter || {};
      const existing = charter.benefits || [];
      if (existing.some(b=>b.name===item)) return;
      const newBenefit = {
        _id:`BEN-${String(existing.length+1).padStart(3,"0")}`,
        name:item, description:"", category:"Strategic",
        owner:"", targetDate:"", sustainmentPlan:"", lessonsLearned:"", objectives:[],
      };
      onSheetUpdate("01", { charter:{ ...charter, benefits:[...existing, newBenefit] } }, "in-progress");
    } else if (fieldKey === "sustainFocus") {
      // C3 fix: write dimension-aware shape { dimensionId: [area1, area2] }
      const existing  = sheets["10"]?.data?.selected  || {};
      const enab      = sheets["10"]?.data?.enabled    || {};
      const actLinks  = sheets["10"]?.data?.actLinks   || {};
      const dimId     = AREA_TO_DIMENSION[item] || "environmental";
      const dimAreas  = existing[dimId] || [];
      if (dimAreas.includes(item)) return;
      onSheetUpdate("10", {
        enabled:  { ...enab, [dimId]: true },
        selected: { ...existing, [dimId]: [...dimAreas, item] },
        actLinks,
      }, "in-progress");
    }
  };
  const removeChipItem = (fieldKey, item) => {
    if (fieldKey === "risks") {
      onSheetUpdate("05", { risks:(sheets["05"]?.data?.risks||[]).filter(r=>r.name!==item) }, "in-progress");
    } else if (fieldKey === "stakeholders") {
      onSheetUpdate("08", { stakeholders:(sheets["08"]?.data?.stakeholders||[]).filter(s=>s.name!==item) }, "in-progress");
    } else if (fieldKey === "benefits") {
      // C1 fix: remove from charter.benefits
      const charter = sheets["01"]?.data?.charter || {};
      onSheetUpdate("01", { charter:{ ...charter, benefits:(charter.benefits||[]).filter(b=>b.name!==item) } }, "in-progress");
    } else if (fieldKey === "sustainFocus") {
      // C3 fix: remove from the correct dimension array
      const existing = sheets["10"]?.data?.selected || {};
      const enab     = sheets["10"]?.data?.enabled  || {};
      const actLinks = sheets["10"]?.data?.actLinks  || {};
      const dimId    = AREA_TO_DIMENSION[item] || "environmental";
      const next     = { ...existing, [dimId]: (existing[dimId]||[]).filter(a=>a!==item) };
      onSheetUpdate("10", { enabled:enab, selected:next, actLinks }, "in-progress");
    }
  };
  const getChipItems = (fieldKey) => {
    if (fieldKey === "risks") return (sheets["05"]?.data?.risks||[]).map(r=>r.name);
    if (fieldKey === "stakeholders") return (sheets["08"]?.data?.stakeholders||[]).map(s=>s.name);
    if (fieldKey === "benefits") {
      // C1 fix: read from charter.benefits
      return (sheets["01"]?.data?.charter?.benefits||[]).map(b=>b.name);
    }
    if (fieldKey === "sustainFocus") {
      // C3 fix: flatten dimension arrays into a single list
      const selected = sheets["10"]?.data?.selected || {};
      return Object.values(selected).flatMap(arr => Array.isArray(arr) ? arr : []);
    }
    return [];
  };
  const getTeamRoles = () => (sheets["02"]?.data?.teamMembers||[]).filter(m=>!m.isPM).map(m=>m.role);

  useEffect(() => {
    if (!currentCluster) return;
    const chipField = currentCluster.fields.find(f => f.aiChips);
    if (!chipField) return;
    if (chipField.type === "textarea") return;
    fetchChipSuggestions(currentCluster.id, chipField.key);
  }, [currentCluster?.id]);

  const fetchChipSuggestions = async (clusterId, fieldKey) => {
    setChipsLoading(true);
    setAiStatus("Generating suggestions based on your project…");
    const ctx = buildContext();
    const existingItems = fieldKey === "teamRoles" ? getTeamRoles() : getChipItems(fieldKey);
    const labels = {
      risks: "potential project risks (not already in the risk register)",
      stakeholders: "key stakeholders (not already listed)",
      benefits: "strategic benefits (not already listed)",
      sustainFocus: "sustainability focus areas applicable to this project",
    };
    try {
      const prompt = `You are a project management expert advising on ${labels[fieldKey]||fieldKey}.

PROJECT CONTEXT:
${ctx.summary || `Project: ${ctx.projectName||"Unnamed"}. Purpose: ${ctx.purpose||"not yet specified"}.`}

Already selected / captured: ${existingItems.join(", ")||"none"}.

Suggest 5-6 additional ${labels[fieldKey]||fieldKey} highly specific to THIS project. Base suggestions on the full context above — reference the industry, objectives, team structure, and constraints where relevant. Do not repeat items already captured.

Return ONLY JSON, no markdown: {"suggestions":["item1","item2","item3","item4","item5"]}`;
      const raw = await callExtract([{role:"user",content:prompt}], 500);
      const parsed = safeParseJSON(raw);
      setAiChipSuggestions(prev => ({ ...prev, [clusterId]: parsed.suggestions||[] }));
    } catch(e) {
      setAiChipSuggestions(prev => ({ ...prev, [clusterId]: [] }));
    }
    setChipsLoading(false);
    setAiStatus("");
  };

  const [purposeSuggestion, setPurposeSuggestion] = useState("");
  const [purposeLoading, setPurposeLoading] = useState(false);
  const purposePopulated = useRef(false);
  useEffect(() => {
    if (currentCluster?.id !== "c2") return;
    const currentPurpose = sheets["01"]?.data?.charter?.purpose;
    if (currentPurpose) { purposePopulated.current = true; return; }
    if (purposePopulated.current) return;
    setPurposeLoading(true);
    const ctx = buildContext();
    const ctxStr = ctx.summary || `Project: "${ctx.projectName||"Unnamed project"}"`;
    callExtract([{role:"user",content:
      `${ctxStr}\n\nSuggest a concise, specific one-sentence purpose statement for this project (what it will achieve, with a measurable outcome if possible). Return ONLY the sentence, no quotes, no preamble.`
    }], 150).then(text => setPurposeSuggestion(text.trim())).catch(()=>setPurposeSuggestion("")).finally(()=>setPurposeLoading(false));
  }, [currentCluster?.id, sheets]);

  const navigateToSheet = (id) => {
    if (id === activeSheet) return;
    if (dirtySheet) setSavingPrompt(id);
    else { setActiveSheet(id); onSheetNav(id); }
  };
  const clearSheetSnapshot = (sheetId) => {
    if (!sheetId) return;
    // Forget the saved copy once the user has either saved or discarded.
    delete sheetSnapshotRef.current[sheetId];
  };
  const captureSheetSnapshot = (sheetId) => {
    if (!sheetId || sheetSnapshotRef.current[sheetId]) return;
    const currentSheet = sheets[sheetId];
    if (!currentSheet) return;
    // Keep one copy of the sheet before edits so Discard can put it back.
    sheetSnapshotRef.current[sheetId] = JSON.parse(JSON.stringify(currentSheet));
  };
  const confirmSave = () => {
    if (savingPrompt) { onSheetApprove(activeSheet); setActiveSheet(savingPrompt); onSheetNav(savingPrompt); }
    clearSheetSnapshot(activeSheet);
    setSavingPrompt(null); setDirtySheet(false);
  };
  const discardAndNav = () => {
    const snapshot = sheetSnapshotRef.current[activeSheet];
    if (snapshot) {
      // Restore the exact old sheet data instead of merging new and old values.
      onSheetUpdate(activeSheet, snapshot.data || {}, snapshot.status || "in-progress", undefined, { replace: true });
      if (snapshot.locked) onSheetApprove(activeSheet);
      else onSheetUnlock(activeSheet);
    }
    clearSheetSnapshot(activeSheet);
    if (savingPrompt) { setActiveSheet(savingPrompt); onSheetNav(savingPrompt); }
    setSavingPrompt(null); setDirtySheet(false);
  };

  const ROLE_GROUPS = [
    { label:"Governance", roles:["Project Sponsor","Senior Responsible Owner","Project Board Member","Independent Assessor"] },
    { label:"Management", roles:["Assistant Project Manager","Project Coordinator","Project Scheduler","Document Controller"] },
    { label:"Risk & Quality", roles:["Risk Owner","Change Manager","Quality Assurance Lead","Health & Safety Advisor"] },
    { label:"Technical", roles:["Technical Lead","Design Manager","Site Manager","Software Developer","Construction Manager"] },
    { label:"Business", roles:["Finance Lead","Procurement Lead","Commercial Manager","Business Analyst"] },
    { label:"People", roles:["Communications Lead","Stakeholder Liaison","Marketing Lead","Training Lead"] },
    { label:"Research", roles:["Research Coordinator","Subject Matter Expert","Data Manager","Impact Assessor"] },
  ];
  const [customRoleInput, setCustomRoleInput] = useState("");

  const inp = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, color:C.sage,
    fontSize:13, padding:"10px 13px", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
  const hiddenScrollbarStyle = { scrollbarWidth:"none", msOverflowStyle:"none" };

  if (!tier) return <TierSelect onSelect={(t)=>onSheetUpdate("__tier__",{},"empty",t)} onBack={onLogout}/>;

  if (!pmAlreadySet && !isExisting) {
    return (
      <PMSetup tier={tier} onBack={()=>onSheetUpdate("__tier__",{},"empty",null)}
        onConfirm={({ projectName, projectCode, pmName, loginCode }) => {
          onSheetUpdate("__projectMeta__", {}, "empty", { projectName, projectCode });
          onSheetUpdate("02", { teamMembers:[{ _id:"TM-001", loginCode, name:pmName, role:"Project Manager",
            deliveryRole:"", availability:"", location:"", responsibilities:"", isPM:true }] }, "in-progress");
          const charter = sheets["01"]?.data?.charter || {};
          onSheetUpdate("01", { charter:{ ...charter, projectName, projectCode, projectManager:pmName } }, "in-progress");
          onSheetUpdate("__loginCode__", {}, "empty", { loginCode, name:pmName, role:"Project Manager", isPM:true });
        }}/>
    );
  }

  const progress = totalFieldsKnown();
  const progressPct = progress.total > 0 ? Math.round((progress.known/progress.total)*100) : 0;

  if (phase === "intake") {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", background:C.bg, padding:"24px 32px", overflow:"hidden" }}>
        <div style={{ maxWidth:520, width:"100%", display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
          <div style={{ textAlign:"center", marginBottom:20, flexShrink:0 }}>
            <div style={{ fontSize:26, marginBottom:8 }}>📄</div>
            <div style={{ fontSize:17, fontWeight:700, color:C.sage, marginBottom:5 }}>Have a project document?</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
              Upload a brief, schedule, or proposal and AI will read it and pre-fill your project. Or skip and we'll build it together.
            </div>
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"18px 22px",
            flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexShrink:0 }}>
              {["file","text"].map(m => (
                <button key={m} onClick={()=>setUploadMode(m)}
                  style={{ flex:1, padding:"8px", fontSize:11, fontWeight:700,
                    border:`1px solid ${uploadMode===m?C.accent:C.border}`, borderRadius:6,
                    background:uploadMode===m?C.accent+"22":"none", color:uploadMode===m?C.accentL:C.muted, cursor:"pointer" }}>
                  {m==="file" ? "📎 Upload Document" : "✏️ Paste Text"}
                </button>
              ))}
            </div>

            <div style={{ flex:1, minHeight:0, overflowY:"auto" }}>
              {uploadMode === "file" ? (
                <label style={{ display:"block", padding:"22px 14px", border:`1.5px dashed ${C.border}`,
                  borderRadius:8, cursor:"pointer", textAlign:"center", fontSize:12, color:C.muted, background:C.surface2 }}>
                  <input type="file" multiple accept=".docx,.xlsx,.xls,.pdf,.txt,.csv" onChange={handleFileUpload} style={{ display:"none" }}/>
                  {extracting ? <span style={{ color:C.accentL }}>⚡ {aiStatus || "Processing…"}</span>
                    : <>Drop files or click<br/><span style={{ fontSize:10 }}>.docx · .xlsx · .pdf · .txt</span></>}
                </label>
              ) : (
                <div>
                  <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
                    placeholder="Paste your project brief, notes, or summary…"
                    style={{ ...inp, minHeight:100, resize:"none", lineHeight:1.5 }}/>
                  <button onClick={handleTextExtract} disabled={!pasteText.trim()||extracting}
                    style={{ width:"100%", marginTop:8, padding:"9px", background:pasteText.trim()&&!extracting?C.accent:"#1F4D34",
                      border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700,
                      cursor:pasteText.trim()&&!extracting?"pointer":"not-allowed" }}>
                    {extracting ? `⚡ ${aiStatus||"Processing…"}` : "⚡ Extract Information"}
                  </button>
                </div>
              )}

              {extracting && (
                <PipelineTracker stage={pipelineStage} statusText={aiStatus}/>
              )}

              {fileList.length > 0 && (
                <div style={{ marginTop:12 }}>
                  {fileList.map((f,i) => (
                    <div key={i} style={{ fontSize:11, color:C.accentL, padding:"3px 0", display:"flex", gap:6 }}>
                      <span style={{ color:C.activity }}>✓</span>{f}
                    </div>
                  ))}
                  {docAnalysis && (
                    <div style={{ marginTop:8, fontSize:10, color:C.dim, fontStyle:"italic", lineHeight:1.5,
                      background:C.surface2, borderRadius:6, padding:"8px 10px" }}>
                      {docAnalysis.replace(/\*\*(.*?)\*\*/g,"$1").replace(/^#{1,3}\s+/gm,"").replace(/\*/g,"").trim()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:10, marginTop:14, flexShrink:0 }}>
            <button onClick={()=>onSheetUpdate("__tier__",{},"empty",null)}
              style={{ padding:"10px 16px", background:"none", border:`1px solid ${C.border}`,
                borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer" }}>← Back</button>
            <button onClick={enterWizard}
              style={{ flex:1, padding:"12px", background:C.accent, border:"none", borderRadius:7,
                color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                boxShadow:`0 4px 16px ${C.accent}44` }}>
              {fileList.length > 0 ? "Continue →" : "Skip — Build with AI Assistant →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "wizard") {
    if (!currentCluster) {
      setTimeout(() => advanceWizard(), 0);
      return null;
    }

    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        <style>{`
          .project-setup-hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"10px 24px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:C.muted, marginBottom:6 }}>
            <span>Setting up <strong style={{ color:C.accentL }}>{SHEET_LABELS[currentSheetId]}</strong></span>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ color:C.dim }}>{progress.known} of {progress.total} fields gathered ({progressPct}%)</span>
              <button onClick={()=>setShowReview(true)}
                style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.accentL}55`, borderRadius:5,
                  color:C.accentL, fontSize:10, fontWeight:600, cursor:"pointer" }}>📋 Review Data</button>
              {onLogout && (
                <button onClick={onLogout}
                  style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:5,
                    color:C.muted, fontSize:10, cursor:"pointer" }}>Log out</button>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {wizardSheetOrder.map((id,i) => (
              <div key={id} title={SHEET_LABELS[id]}
                style={{ flex:1, height:5, borderRadius:3,
                  background: i<sheetIdx?C.activity:i===sheetIdx?C.accentL:C.border,
                  opacity: i===sheetIdx?1:0.6 }}/>
            ))}
          </div>
        </div>

        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, filter:"blur(8px)", opacity:0.3, pointerEvents:"none",
            display:"flex", padding:20, gap:16 }}>
            {["Charter","Team","Schedule"].map(label => (
              <div key={label} style={{ flex:1, background:C.surface, borderRadius:8, padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:10 }}>{label}</div>
                {[1,2,3].map(i => <div key={i} style={{ height:10, background:C.surface2, borderRadius:4, marginBottom:8 }}/>)}
              </div>
            ))}
          </div>

          <div style={{ position:"relative", flex:1, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
            <div style={{ maxWidth:540, width:"100%", maxHeight:"100%", background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:12, padding:"28px 32px", boxShadow:"0 12px 40px rgba(0,0,0,0.5)",
              display:"flex", flexDirection:"column", overflow:"hidden" }}>

              <div style={{ fontSize:16, fontWeight:700, color:C.sage, marginBottom:18, flexShrink:0 }}>{currentCluster.title}</div>

              <div className="project-setup-hide-scrollbar" style={{ flex:1, minHeight:0, overflowY:"auto", marginBottom:4, ...hiddenScrollbarStyle }}>
              {currentCluster.fields.map(field => {
                if (field.optional && isFieldKnown(field.key)) return null;

                if (field.type === "roles") {
                  const selected = getTeamRoles();
                  return (
                    <div key={field.key} style={{ marginBottom:18 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:10 }}>{field.label}</div>

                      {/* Selected roles with inline name capture — required so RACI/Risk Owner dropdowns can see them */}
                      {selected.length > 0 && (
                        <div style={{ marginBottom:12, display:"flex", flexDirection:"column", gap:6 }}>
                          {selected.map(role => {
                            const member = getTeamMemberByRole(role);
                            return (
                              <div key={role} style={{ display:"flex", gap:8, alignItems:"center",
                                background:C.surface2, borderRadius:6, padding:"6px 8px", border:`1px solid ${C.border}` }}>
                                <span style={{ fontSize:10, color:C.accentL, fontWeight:600, minWidth:140, flexShrink:0 }}>{role}</span>
                                <input value={member?.name||""} onChange={e=>updateTeamMemberName(role, e.target.value)}
                                  placeholder="Enter their name…"
                                  style={{ flex:1, background:C.surface, border:`1px solid ${member?.name?C.accentL+"66":C.border}`,
                                    borderRadius:4, color:C.sage, fontSize:11, padding:"5px 8px", outline:"none" }}/>
                                <button onClick={()=>removeTeamRole(role)}
                                  style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, flexShrink:0 }}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>Add another role</div>
                      <div className="project-setup-hide-scrollbar" style={{ maxHeight:220, overflowY:"auto", marginBottom:10, ...hiddenScrollbarStyle }}>
                        {ROLE_GROUPS.map(g => (
                          <div key={g.label} style={{ marginBottom:10 }}>
                            <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", marginBottom:5 }}>{g.label}</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                              {g.roles.filter(role=>!selected.includes(role)).map(role => (
                                <button key={role} onClick={()=>addTeamRole(role)}
                                  style={{ padding:"5px 11px", borderRadius:16, fontSize:10, fontWeight:600,
                                    border:`1px solid ${C.border}`, background:"none",
                                    color:C.muted, cursor:"pointer" }}>
                                  + {role}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={customRoleInput} onChange={e=>setCustomRoleInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"&&customRoleInput.trim()){addTeamRole(customRoleInput.trim());setCustomRoleInput("");}}}
                          placeholder="Add a role not listed…" style={{ ...inp, fontSize:11 }}/>
                        <button onClick={()=>{if(customRoleInput.trim()){addTeamRole(customRoleInput.trim());setCustomRoleInput("");}}}
                          style={{ padding:"8px 14px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Add</button>
                      </div>
                      {selected.length > 0 && (
                        <div style={{ fontSize:10, color:C.muted, marginTop:8 }}>
                          {selected.length} role{selected.length!==1?"s":""} selected
                          {selected.some(r=>!getTeamMemberByRole(r)?.name) && (
                            <span style={{ color:C.milestone }}> — add names so they appear in RACI and Risk Owner lists</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (field.type === "chips-multi") {
                  const items = getChipItems(field.key);
                  // All suggestions shown; clicked ones are highlighted as selected in place
                  const allSuggestions = aiChipSuggestions[currentCluster.id] || [];
                  // Merge: suggestions first, then any custom-added items not in suggestions
                  const customItems = items.filter(it => !allSuggestions.includes(it));
                  const allChips = [...allSuggestions, ...customItems];
                  return (
                    <div key={field.key} style={{ marginBottom:18 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>{field.label}</div>

                      <div style={{ fontSize:10, fontWeight:700, color:C.accentL, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentL, animation: chipsLoading?"pulse 1.2s ease-in-out infinite":"none" }}/>
                        {chipsLoading ? "Generating suggestions…" : `AI Suggestions${items.length>0?` — ${items.length} selected`:""}`}
                      </div>

                      {/* All chips shown together — clicking toggles selected state */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:12 }}>
                        {allChips.map(chip => {
                          const selected = items.includes(chip);
                          return (
                            <button key={chip}
                              onClick={()=> selected ? removeChipItem(field.key, chip) : addChipItem(field.key, chip)}
                              style={{
                                padding:"7px 13px", borderRadius:20, fontSize:11, fontWeight:600,
                                border:`1.5px solid ${selected ? C.accentL : C.accentL+"55"}`,
                                background: selected ? C.accentL : C.accentL+"11",
                                color: selected ? "#fff" : C.dim,
                                cursor:"pointer", transition:"all .15s",
                                display:"flex", alignItems:"center", gap:5,
                              }}>
                              {selected ? "✓ " : "+ "}{chip}
                            </button>
                          );
                        })}
                        {!chipsLoading && allChips.length===0 && (
                          <span style={{ fontSize:10, color:C.muted, fontStyle:"italic" }}>Type your own below</span>
                        )}
                      </div>

                      {/* Custom item input with explicit Add button */}
                      <div style={{ display:"flex", gap:6 }}>
                        <input id={`custom-${field.key}`} placeholder="Type your own…"
                          onKeyDown={e=>{
                            if(e.key==="Enter" && e.target.value.trim()){
                              addChipItem(field.key, e.target.value.trim());
                              e.target.value="";
                              fetchChipSuggestions(currentCluster.id, field.key);
                            }
                          }}
                          style={{ ...inp, fontSize:11 }}/>
                        <button onClick={()=>{
                          const inp_el = document.getElementById(`custom-${field.key}`);
                          if(inp_el && inp_el.value.trim()){
                            addChipItem(field.key, inp_el.value.trim());
                            inp_el.value="";
                            fetchChipSuggestions(currentCluster.id, field.key);
                          }
                        }} style={{ padding:"8px 14px", background:C.accent, border:"none", borderRadius:5,
                          color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                          Add
                        </button>
                      </div>
                    </div>
                  );
                }

                if (field.type === "textarea" && field.key === "purpose") {
                  const current = getCharterField("purpose");
                  return (
                    <div key={field.key} style={{ marginBottom:18 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>{field.label}</div>
                      {!current && purposeSuggestion && (
                        <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
                          padding:"8px 10px", marginBottom:8, fontSize:11, color:C.dim, lineHeight:1.5 }}>
                          <span style={{ color:C.accentL, fontWeight:700 }}>Suggestion: </span>{purposeSuggestion}
                        </div>
                      )}
                      <textarea
                        value={fieldAnswers["purpose"] !== undefined ? fieldAnswers["purpose"] : (current || purposeSuggestion || "")}
                        onChange={e=>setFieldAnswers(prev=>({...prev,purpose:e.target.value}))}
                        onBlur={e=>saveFieldAnswer("purpose", e.target.value)}
                        placeholder={purposeLoading ? "Generating suggestion…" : "What will this project achieve?"}
                        style={{ ...inp, minHeight:70, resize:"none", lineHeight:1.5 }}/>
                    </div>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <div key={field.key} style={{ marginBottom:18 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
                        {field.label} {field.optional && <span style={{ fontWeight:400, color:C.muted, textTransform:"none" }}>(optional)</span>}
                      </div>
                      <textarea
                        value={fieldAnswers[field.key]||""}
                        onChange={e=>setFieldAnswers(prev=>({...prev,[field.key]:e.target.value}))}
                        onBlur={e=>saveFieldAnswer(field.key, e.target.value)}
                        style={{ ...inp, minHeight:60, resize:"none" }}/>
                    </div>
                  );
                }

                return (
                  <div key={field.key} style={{ marginBottom:18 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:8 }}>
                      {field.label} {field.required && <span style={{ color:C.risk }}>*</span>}
                    </div>
                    <input type={field.type==="date"?"date":"text"}
                      value={
                        fieldAnswers[field.key] !== undefined ? fieldAnswers[field.key] :
                        (getCharterField(field.key) || "")
                      }
                      onChange={e=>{
                        const v = e.target.value;
                        setFieldAnswers(prev=>({...prev,[field.key]:v}));
                        saveFieldAnswer(field.key, v);
                      }}
                      placeholder={field.placeholder||""}
                      style={inp}/>
                  </div>
                );
              })}

              </div>

              <div style={{ display:"flex", gap:10, marginTop:10, flexShrink:0 }}>
                <button onClick={goBackWizard}
                  style={{ padding:"10px 16px", background:"none", border:`1px solid ${C.border}`,
                    borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer" }}>← Back</button>
                <button onClick={advanceWizard}
                  style={{ flex:1, padding:"11px", background:C.accent, border:"none", borderRadius:7,
                    color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Continue →
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>

        {showReview && (
          <ReviewModal sheets={sheets} tier={tier} intermediateDoc={intermediateDoc} onUpdate={onSheetUpdate} onClose={()=>setShowReview(false)}/>
        )}
      </div>
    );
  }

  const activeSheets = tierCfg.sheets;
  const SheetComp = SHEET_COMPONENTS[activeSheet];
  const approvedCount = Object.values(sheets).filter(s=>s.locked).length;
  const l3Unlocked = (l2?.loginCodes||[]).length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden", height:"100%" }}>
      <style>{`
        .project-setup-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .project-setup-sheet-host > * {
          width: 100%;
          max-width: 900px !important;
        }
      `}</style>
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"8px 20px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:C.muted, marginBottom:5 }}>
          <span>Project setup — <strong style={{ color:C.accentL }}>{tierCfg.label}</strong> tier</span>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ color:C.dim }}>{approvedCount} of {activeSheets.length} sheets saved</span>
            <button onClick={()=>setShowReview(true)}
              style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.accentL}55`, borderRadius:5,
                color:C.accentL, fontSize:10, fontWeight:600, cursor:"pointer" }}>📋 Review Data</button>
            {onLogout && (
              <button onClick={onLogout}
                style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:5,
                  color:C.muted, fontSize:10, cursor:"pointer" }}>Log out</button>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {activeSheets.map(id => {
            const st = sheets[id]?.status||"empty";
            const col = st==="approved"?"#3ae0a2":st==="ai-draft"?"#3a9ce0":st==="in-progress"?"#e0a23a":C.border;
            return <div key={id} onClick={()=>navigateToSheet(id)} title={SHEET_LABELS[id]}
              style={{ flex:1, height:5, borderRadius:3, background:col, opacity:activeSheet===id?1:0.5,
                outline:activeSheet===id?`2px solid ${C.accentL}`:"none", outlineOffset:1, cursor:"pointer" }}/>;
          })}
        </div>
      </div>

      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, background:C.surface2, overflowX:"auto", flexShrink:0 }}>
        {activeSheets.map(id => {
          const st = sheets[id]?.status||"empty";
          const dot = st==="approved"?"#3ae0a2":st==="ai-draft"?"#3a9ce0":st==="in-progress"?"#e0a23a":C.border;
          const active = id===activeSheet;
          return (
            <button key={id} onClick={()=>navigateToSheet(id)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:40,
                fontSize:11, fontWeight:600, background:"none", border:"none",
                borderBottom:`2px solid ${active?C.accentL:"transparent"}`, color:active?C.sage:C.muted,
                cursor:"pointer", whiteSpace:"nowrap" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:dot, flexShrink:0 }}/>
              {SHEET_LABELS[id]}
              {sheets[id]?.locked && <span style={{ fontSize:9, color:C.accentL }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0, background:C.surface }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>{SHEET_LABELS[activeSheet]}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
            {sheets[activeSheet]?.status==="ai-draft" && "✨ AI-populated — review and adjust"}
            {sheets[activeSheet]?.status==="approved" && "✓ Saved"}
            {(!sheets[activeSheet]?.status||sheets[activeSheet]?.status==="empty") && "Empty — fill in or use document upload"}
          </div>
        </div>
        {sheets[activeSheet]?.locked ? (
          <button onClick={()=>onSheetUnlock(activeSheet)}
            style={{ padding:"6px 12px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer" }}>Unlock to Edit</button>
        ) : (
          <button onClick={()=>{onSheetApprove(activeSheet);clearSheetSnapshot(activeSheet);setDirtySheet(false);}}
            style={{ padding:"6px 14px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Save Changes</button>
        )}
        {l3Unlocked && (
          state.project?.status === "active"
            ? (
              <button onClick={onLaunch}
                style={{ padding:"6px 14px", background:"#2E7D52", border:"none", borderRadius:5,
                  color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                ▶ Open Active Project
              </button>
            ) : (
              <button onClick={() => setShowLaunchConfirm(true)}
                style={{ padding:"6px 14px", background:"#2E7D52", border:"none", borderRadius:5,
                  color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                🚀 Launch Project →
              </button>
            )
        )}
      </div>

      <div className="project-setup-hide-scrollbar" style={{ flex:1, overflowY:"auto", padding:"20px", ...hiddenScrollbarStyle }} onChange={()=>setDirtySheet(true)}>
        <div className="project-setup-sheet-host" style={{ width:"100%", maxWidth:1200, margin:"0 auto", display:"flex", justifyContent:"center" }}>
          {SheetComp && (
            <SheetComp data={sheets[activeSheet]?.data||{}} locked={sheets[activeSheet]?.locked||false}
              project={project} loginCodes={l2?.loginCodes||[]} allSheets={sheets}
              // Save a safe copy before each edit so Discard can roll the sheet back.
              onUpdate={(data,status)=>{ captureSheetSnapshot(activeSheet); setDirtySheet(true); onSheetUpdate(activeSheet,data,status); }}/>
          )}
        </div>
      </div>


      {showLaunchConfirm && (
        <div onClick={() => setShowLaunchConfirm(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#122E1E", border:"1px solid #1F4D34", borderRadius:12,
              padding:28, maxWidth:400, width:"90%", boxShadow:"0 8px 40px #0009" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#E5F0E8", marginBottom:10 }}>
              🚀 Launch Project
            </div>
            <div style={{ fontSize:12, color:"#8aac96", lineHeight:1.7, marginBottom:22 }}>
              Launching will lock your project baseline. Any future changes to scope, schedule,
              or cost will require a <strong style={{ color:"#E5F0E8" }}>Change Control Request</strong>.
              <br/><br/>
              Continue?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={() => { setShowLaunchConfirm(false); onLaunch(); }}
                style={{ flex:1, padding:"10px", background:"#2E7D52", border:"none",
                  borderRadius:7, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Yes, Launch
              </button>
              <button
                onClick={() => setShowLaunchConfirm(false)}
                style={{ flex:1, padding:"10px", background:"none",
                  border:"1px solid #1F4D34", borderRadius:7,
                  color:"#8aac96", fontSize:13, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {savingPrompt && (
        <div onClick={discardAndNav} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
            padding:24, maxWidth:360, width:"90%", boxShadow:"0 8px 32px #0008" }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.sage, marginBottom:6 }}>Save Changes?</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:18, lineHeight:1.6 }}>
              You have unsaved changes on <strong style={{ color:C.dim }}>{SHEET_LABELS[activeSheet]}</strong>.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={confirmSave} style={{ padding:"9px 14px", background:C.accent, border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>💾 Save Changes</button>
              <button onClick={discardAndNav} style={{ padding:"9px 14px", background:"none", border:`1px solid ${C.risk}22`, borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer" }}>Discard & Continue</button>
            </div>
          </div>
        </div>
      )}

      {showReview && (
        <ReviewModal sheets={sheets} tier={tier} intermediateDoc={intermediateDoc} onUpdate={onSheetUpdate} onClose={()=>setShowReview(false)}/>
      )}
    </div>
  );
}
