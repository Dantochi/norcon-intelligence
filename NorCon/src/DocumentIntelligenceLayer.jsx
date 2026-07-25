import { useState, useRef, useEffect } from "react"; // FIX 8: added useEffect
import mammoth from "mammoth";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", deliverable:"#3a9ce0",
  stakeholder:"#9c6ee0", activity:"#3ae0a2", issue:"#e06e3a",
};

const TYPES = {
  risk:        { label:"Risk",        icon:"⚠️",  color:"#e05c5c", prefix:"R"   },
  stakeholder: { label:"Stakeholder", icon:"👤",  color:"#9c6ee0", prefix:"SH"  },
  deliverable: { label:"Deliverable", icon:"📦",  color:"#3a9ce0", prefix:"D"   },
  activity:    { label:"Activity",    icon:"⚙️",  color:"#3ae0a2", prefix:"ACT" },
  milestone:   { label:"Milestone",   icon:"🏁",  color:"#e0a23a", prefix:"MS"  },
  issue:       { label:"Issue",       icon:"🚨",  color:"#e06e3a", prefix:"I"   },
  constraint:  { label:"Constraint",  icon:"🔒",  color:"#c0a0ff", prefix:"CON" },
};

const VIEW_TABS  = ["all","charter","risk","stakeholder","deliverable","activity","milestone","issue","constraint"];
const STAGES     = ["ingest","analyse","classify","map","review"];

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function fmtBytes(b){ if(b<1024)return b+"B"; if(b<1048576)return(b/1024).toFixed(1)+"KB"; return(b/1048576).toFixed(1)+"MB"; }
function csvLine(arr){ return arr.map(v => `"${String(v==null?"":v).replace(/"/g,'""')}"`).join(","); }

function Pill({ children, color }){
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
      border:`1px solid ${color||C.border}`, color:color||C.dim, background:"transparent" }}>
      {children}
    </span>
  );
}

function Field({ label, value }){
  if(!value) return null;
  return (
    <div style={{ display:"flex", gap:6, marginBottom:3, fontSize:11 }}>
      <span style={{ color:C.muted, fontSize:10, fontWeight:600, textTransform:"uppercase",
        letterSpacing:".3px", whiteSpace:"nowrap", minWidth:90, flexShrink:0 }}>{label}</span>
      <span style={{ color:C.dim, lineHeight:1.4 }}>{value}</span>
    </div>
  );
}

function ElementCard({ el, onStateChange }){
  const t = TYPES[el.type] || {};
  const isAccepted = el._state === "accepted";
  const isRejected = el._state === "rejected";
  const score = el.likelihood && el.impact
    ? (parseInt(el.likelihood)||1) * (parseInt(el.impact)||1)
    : null;
  const ragColor = score ? (score>=9 ? C.risk : score>=4 ? C.milestone : C.activity) : null;
  const priorityColor = (p) => {
    const lp = (p||"").toLowerCase();
    return lp==="high" ? C.risk : lp==="low" ? C.activity : C.milestone;
  };
  const priorityScore = el.power && el.interest && el.influence
    ? (((parseInt(el.power)||5)+(parseInt(el.influence)||5))/2*(parseInt(el.interest)||5)/10).toFixed(1)
    : null;

  return (
    <div style={{
      background: isAccepted ? "rgba(58,224,162,0.04)" : C.surface,
      border: `1px solid ${isAccepted ? C.activity : isRejected ? C.risk : C.border}`,
      borderRadius:8, padding:"12px 14px", marginBottom:8,
      display:"flex", gap:10, alignItems:"flex-start",
      opacity: isRejected ? 0.3 : 1, transition:"all .2s"
    }}>
      <div style={{ width:3, borderRadius:2, background:t.color||C.accent, alignSelf:"stretch", flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{el._id}</span>
          <Pill color={t.color}>{t.icon} {t.label}</Pill>
          <Pill color={isAccepted ? C.activity : isRejected ? C.risk : C.muted}>
            {isAccepted ? "Accepted" : isRejected ? "Rejected" : "Draft"}
          </Pill>
          <span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:9, color:C.muted }}>V{el._version||1}</span>
        </div>

        {/* Name */}
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:6 }}>
          {el.name || el.description || "—"}
        </div>

        {/* Type-specific fields */}
        {el.description && el.name && <Field label="Description"  value={el.description}/>}
        {el.cause               && <Field label="Cause"           value={el.cause}/>}
        {el.potentialImpact     && <Field label="Impact"          value={el.potentialImpact}/>}
        {el.mitigation          && <Field label="Mitigation"      value={el.mitigation}/>}
        {el.engagementStrategy  && <Field label="Strategy"        value={el.engagementStrategy}/>}
        {el.successCriterion    && <Field label="KPI"             value={el.successCriterion}/>}
        {el.targetDate          && <Field label="Target Date"     value={el.targetDate}/>}
        {el.riskIfBreached      && <Field label="Risk if Breached" value={el.riskIfBreached}/>}
        {el.phase               && <Field label="Phase"           value={el.phase}/>}
        {el.responsible         && <Field label="Responsible"     value={el.responsible}/>}
        {el.source              && <Field label="Source"          value={el.source}/>}

        {/* Governance strip */}
        <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}`,
          display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginRight:2 }}>Gov</span>
          <Pill color={C.accentL}>Owner: {el._suggestedOwner||"TBC"}</Pill>
          <Pill color={C.sageDim}>Approver: {el._suggestedApprover||"TBC"}</Pill>
          {el._governanceTier && <Pill color="#b8d4c0">{el._governanceTier}</Pill>}
          {el.priority  && <Pill color={priorityColor(el.priority)}>{el.priority}</Pill>}
          {el.category  && <Pill>{el.category}</Pill>}
          {el.likelihood && <Pill>L: {el.likelihood}</Pill>}
          {el.impact    && <Pill>I: {el.impact}</Pill>}
          {score        && <Pill color={ragColor}>Score: {score}</Pill>}
          {el.power     && <Pill>Power: {el.power}</Pill>}
          {el.interest  && <Pill>Interest: {el.interest}</Pill>}
          {el.influence && <Pill>Influence: {el.influence}</Pill>}
          {priorityScore && <Pill color={C.stakeholder}>★ {priorityScore}</Pill>}
        </div>
      </div>

      {/* Accept / Reject */}
      <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
        <button title="Accept"
          onClick={() => onStateChange(el._id, isAccepted ? "pending" : "accepted")}
          style={{ width:28, height:28, borderRadius:5, cursor:"pointer", fontSize:13,
            border:`1px solid ${isAccepted ? C.activity : C.border}`,
            background: isAccepted ? "rgba(58,224,162,0.15)" : "none",
            color: isAccepted ? C.activity : C.muted }}>✓</button>
        <button title="Reject"
          onClick={() => onStateChange(el._id, isRejected ? "pending" : "rejected")}
          style={{ width:28, height:28, borderRadius:5, cursor:"pointer", fontSize:13,
            border:`1px solid ${isRejected ? C.risk : C.border}`,
            background: isRejected ? "rgba(224,92,92,0.15)" : "none",
            color: isRejected ? C.risk : C.muted }}>✕</button>
      </div>
    </div>
  );
}

function CharterPanel({ charter }){
  const c = charter || {};
  const F = ({ label, value, full }) => {
    const empty = !value || value === "null";
    return (
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6,
        padding:"10px 12px", gridColumn: full ? "1/-1" : undefined }}>
        <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px",
          color:C.muted, marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:12, color: empty ? C.muted : C.sage,
          fontStyle: empty ? "italic" : "normal", lineHeight:1.5, whiteSpace:"pre-line" }}>
          {empty ? "Not found in document" : value}
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <F label="Project Name"       value={c.projectName}/>
        <F label="Project Code"       value={c.projectCode}/>
        <F label="Project Manager"    value={c.projectManager}/>
        <F label="Project Sponsor"    value={c.projectSponsor}/>
        <F label="Organisation"       value={c.organisation}/>
        <F label="Start Date"         value={c.startDate}/>
        <F label="End Date"           value={c.endDate}/>
        <F label="Budget"             value={c.budget}/>
        <F label="Purpose"            value={c.purpose}           full/>
        <F label="Problem Statement"  value={c.problemStatement}  full/>
        <F label="Strategic Alignment" value={c.strategicAlignment} full/>
        {(c.withinScope||[]).length>0 && (
          <F label="Within Scope" value={(c.withinScope||[]).map((s,i)=>`${i+1}. ${s}`).join("\n")} full/>
        )}
        {(c.outOfScope||[]).length>0 && (
          <F label="Out of Scope" value={(c.outOfScope||[]).map((s,i)=>`${i+1}. ${s}`).join("\n")} full/>
        )}
      </div>
      {(c.objectives||[]).length > 0 && (
        <>
          <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".8px",
            color:C.muted, padding:"6px 0", borderBottom:`1px solid ${C.border}`, marginBottom:8 }}>
            Objectives & Success Criteria
          </div>
          {c.objectives.map((o,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:7, padding:"11px 13px", marginBottom:8 }}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.muted, marginBottom:3 }}>
                OBJ-{String(i+1).padStart(3,"0")}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.sage, marginBottom:4 }}>
                {o.objective||"—"}
              </div>
              {o.successCriterion && (
                <div style={{ fontSize:11, color:C.dim }}>
                  <span style={{ color:C.muted, fontSize:10, fontWeight:600, textTransform:"uppercase", marginRight:6 }}>KPI</span>
                  {o.successCriterion}
                </div>
              )}
              {o.targetDate && (
                <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>
                  <span style={{ color:C.muted, fontSize:10, fontWeight:600, textTransform:"uppercase", marginRight:6 }}>Target</span>
                  {o.targetDate}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────────────────
export default function DocumentIntelligenceLayer({ onSendToPersonalisation, onStartExtraction, onExtractionError }){
  const [inputTab,  setInputTab]  = useState("upload");
  const [viewTab,   setViewTab]   = useState("all");
  const [file,      setFile]      = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [projName,  setProjName]  = useState("");
  const [docType,   setDocType]   = useState("auto");
  const [loading,   setLoading]   = useState(false);
  const [stage,     setStage]     = useState(null);
  const [loadMsg,   setLoadMsg]   = useState("");
  const [charter,   setCharter]   = useState(null);
  const [elements,  setElements]  = useState([]);
  const [toast,     setToast]     = useState(null);
  const [dragover,  setDragover]  = useState(false);
  const fileRef           = useRef();
  // FIX 8: store auto-advance timer ID so the useEffect cleanup below cancels
  // it if the component unmounts before the 1.8 s delay fires, preventing
  // onSendToPersonalisation from being called on an unmounted component.
  const autoAdvanceTimer  = useRef(null);
  useEffect(() => () => clearTimeout(autoAdvanceTimer.current), []);

  const isReady = (inputTab==="upload" && file) || (inputTab==="paste" && pasteText.trim().length > 20);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  const handleStateChange = (id, newState) => {
    setElements(prev => prev.map(el => el._id === id ? { ...el, _state: newState } : el));
  };

  const visibleElements = (viewTab === "all" || viewTab === "charter")
    ? elements
    : elements.filter(el => el.type === viewTab);

  const stats = {
    total:    elements.length,
    accepted: elements.filter(e => e._state === "accepted").length,
    rejected: elements.filter(e => e._state === "rejected").length,
    pending:  elements.filter(e => e._state === "pending").length,
  };

  const tabCount = tab => {
    if(tab === "all")     return elements.length;
    if(tab === "charter") return charter ? "✓" : "—";
    return elements.filter(e => e.type === tab).length;
  };

  const stageIdx = STAGES.indexOf(stage);

  // ── Extraction ─────────────────────────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    setLoading(true);
    setStage("ingest");
    setLoadMsg("Reading document...");

    let docText = "";
    if(inputTab === "upload"){
      const ext = file.name.split(".").pop().toLowerCase();
      try {
        if(ext === "docx" || ext === "doc"){
          const ab = await file.arrayBuffer();
          const r  = await mammoth.extractRawText({ arrayBuffer: ab });
          docText  = r.value;
        } else {
          docText = await file.text();
        }
      } catch(e){
        setLoading(false); setStage(null);
        showToast("Could not read file: " + e.message);
        return;
      }
      if(!docText || docText.trim().length < 10){
        setLoading(false); setStage(null);
        showToast("No readable text found. Try pasting the text directly.");
        return;
      }
    } else {
      docText = pasteText.trim();
    }

    // Move PM to setup immediately — extraction runs in background
    if (onStartExtraction) onStartExtraction();

    await sleep(300); setStage("analyse"); setLoadMsg("Analysing project context...");
    await sleep(300); setStage("classify"); setLoadMsg("Classifying project elements...");
    await sleep(200); setStage("map"); setLoadMsg("Mapping elements with governance metadata...");

    // FIX: reduced to 12000 chars; replaced "[... truncated ...]" marker which
    // the AI sometimes embedded in JSON strings, corrupting parse at that boundary.
    const maxDoc = docText.length > 12000
      ? docText.slice(0, 12000) + "\\n<<<DOCUMENT_TRUNCATED_HERE>>>"
      : docText;
    const hint   = docType !== "auto" ? "Document type: " + docType + ". " : "";
    const pn     = projName ? 'Project name: "' + projName + '". ' : "";

    const prompt =
      "You are the Document Intelligence Engine for NorCon Projects — an expert project management AI with Sage level knowledge of APM body of knowledge.\n" +
      (pn ? pn + "\n" : "") +
      (hint ? hint + "\n" : "") +
      `
Your task is to analyse the project document and return a single valid JSON object. You operate in two modes simultaneously:

MODE 1 — EXTRACTION: Pull every piece of project information explicitly or implicitly stated in the document.
MODE 2 — RECOMMENDATION: Where standard project elements are logically expected but absent, generate them as recommendations based on project type, context, and best practice. Mark these with source: "Recommended — not in document".

Return ONLY the JSON — no markdown, no backticks, no explanation, no text before or after.

═══════════════════════════════════════════════
INTELLIGENCE RULES
═══════════════════════════════════════════════

═══════════════════════════════════════════════
PROJECT MANAGEMENT HIERARCHY — CRITICAL
═══════════════════════════════════════════════

You must understand and strictly apply the NorCon project management hierarchy. Confusing these levels is the most common error — read carefully.

BENEFIT — the VALUE realised by the project. High-level, strategic, outcome-focused. Answers: "Why does this project exist? What improvement will it create for the organisation or community?"
  Examples of CORRECT benefits:
  ✓ "Improved student employability outcomes"
  ✓ "Increased community access to professional networks"
  ✓ "Enhanced organisational capacity for future projects"
  Examples of WRONG benefits (these are objectives or activities, not benefits):
  ✗ "Deliver a mentorship programme" — this is a deliverable
  ✗ "Hold 10 workshops" — this is an activity
  ✗ "Create a database of mentors" — this is a deliverable

OBJECTIVE — the OUTCOME STATE that must be achieved for the benefit to be realised. High-level, measurable, describes a condition that will exist when the benefit is on track. NOT a task. NOT an action. Answers: "What must be true for this benefit to happen?"
  Examples of CORRECT objectives (for benefit "Improved student employability"):
  ✓ "Students complete the programme with demonstrable industry skills and connections"
  ✓ "Employer partners recognise programme graduates as work-ready candidates"
  Examples of WRONG objectives (these are activities or deliverables):
  ✗ "Recruit 20 mentors" — this is an activity
  ✗ "Deliver 10 workshops" — this is an activity
  ✗ "Build a mentor matching platform" — this is a deliverable
  LIMIT: maximum 5 objectives per benefit. Quality over quantity. If you find yourself writing more than 5, merge or elevate them.

DELIVERABLE — the TANGIBLE OUTPUT produced by the project. A thing that is created, built, or produced. Answers: "What will exist at the end that did not exist before?"
  Examples: Mentorship programme, Training materials, Digital platform, Event series, Policy document

ACTIVITY — an ACTION taken to produce a deliverable. A task, a step, a piece of work. Answers: "What does the team DO to create the deliverable?"
  Examples: Recruit mentors, Design workshop content, Build website, Conduct stakeholder interviews

THE TEST: If it sounds like something you could put on a to-do list → it is an ACTIVITY, not an objective.
If it describes a thing that will be built or created → it is a DELIVERABLE, not an objective.
If it describes a state of the world being better in some way → it is a BENEFIT or OBJECTIVE.

BENEFITS EXTRACTION RULES:
- Benefits are rarely labelled "benefit" in a brief. Find them in: purpose statements, problem statements, expected outcomes, strategic goals, "we aim to...", "this will result in...", "the project will improve...".
- If no benefits are stated, DERIVE them from what the project is trying to achieve. Every project exists to create value — name that value.
- Minimum 2 benefits, maximum 6 benefits per project.
- Benefit categories: Strategic | Operational | Financial | Stakeholder | Community | Environmental | Knowledge | Capability | Reputational | Social

OBJECTIVES RULES:
- Maximum 5 objectives per benefit.
- Each objective must be an outcome state, not an action.
- Run the test: does it sound like a task? If yes, move it to activities. Does it describe something built? Move it to deliverables.

DELIVERABLES + KPIs (cross-field derivation):
- For every deliverable found or inferred, create at least one KPI measuring its completion or quality.
- KPI name should be specific and measurable: not "success" but "number of students completing mentorship" or "% of workshops rated good or excellent".
- If baseline is unknown, set it to "0" for new initiatives or leave empty for existing programmes.
- Target should be a specific number or % derived from context (e.g. if brief mentions "200 participants", target = "200").

RISKS (always recommend standard risks):
- Extract all explicit risks.
- Additionally recommend standard risks for this project type that are absent. Examples: digital projects → data protection, cybersecurity, user adoption. Community projects → volunteer attrition, venue availability. Construction → H&S, weather, supply chain.
- Minimum 4 risks per project.

STAKEHOLDERS:
- Extract named individuals and organisations.
- Infer obvious stakeholders not named: funders, end users, regulatory bodies, community groups — based on project context.
- Assign power/interest/influence scores (1-10) based on their role and relationship to the project.

ACTIVITIES + MILESTONES:
- Extract all explicitly described tasks and events.
- Infer a logical set of phase-based activities if not fully described (e.g. planning, procurement, delivery, review).
- Every project should have at least one milestone per phase.

TEAM:
- Extract any named individuals with roles.
- Infer expected roles if not named (e.g. "a Project Manager will be needed", "a Communications Lead is implied by the stakeholder engagement requirements").

═══════════════════════════════════════════════
JSON SCHEMA
═══════════════════════════════════════════════

{
  "charter": {
    "projectName": "string or null",
    "projectCode": "short code 2-6 chars or null",
    "projectManager": "name or null",
    "projectSponsor": "name or null",
    "organisation": "string or null",
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null",
    "budget": "string e.g. £35,000 or null",
    "purpose": "clear 1-3 sentence statement of project purpose",
    "problemStatement": "what problem or need this project addresses",
    "strategicAlignment": "which organisational or strategic goals this supports",
    "withinScope": ["item 1", "item 2"],
    "outOfScope": ["item 1"],
    "documentSummary": "2-3 sentence overview of the document",
    "benefits": [
      {
        "_id": "BEN-001",
        "name": "benefit name — concise and value-focused",
        "description": "the measurable improvement expected and how it will manifest",
        "category": "Strategic|Operational|Financial|Stakeholder|Community|Environmental|Knowledge|Capability|Reputational|Social",
        "owner": "role most responsible for ensuring this benefit is realised",
        "targetDate": "YYYY-MM-DD or null",
        "sustainmentPlan": "how the benefit will be evidenced and sustained after project closure",
        "lessonsLearned": "",
        "objectives": [
          {
            "_id": "OBJ-001",
            "objective": "specific, actionable objective that contributes to realising the benefit",
            "successCriterion": "how achievement of this objective will be measured",
            "targetDate": "YYYY-MM-DD or null"
          }
        ]
      }
    ]
  },
  "team": [
    {
      "_id": "TM-001",
      "name": "person name or null if inferred",
      "role": "project role title",
      "email": "email or null"
    }
  ],
  "elements": [
    {
      "_id": "R-101",
      "_version": 1,
      "_status": "Draft",
      "_suggestedOwner": "most logically responsible role",
      "_suggestedApprover": "role who approves changes to this",
      "_governanceTier": "Tier 1 — Sponsor|Tier 2 — Mentor / Assessor|Tier 3 — Project Manager|Tier 4 — Project Team",
      "type": "risk|stakeholder|deliverable|activity|milestone|issue|constraint",
      "name": "element name",
      "source": "direct quote or section reference, OR Recommended — not in document",

      "cause": "(risk only) root cause",
      "potentialImpact": "(risk only) consequence if it occurs",
      "likelihood": "(risk only) 1|2|3",
      "impact": "(risk only) 1|2|3",
      "mitigation": "(risk only) how to reduce probability or impact",
      "response": "(risk only) Avoid|Reduce|Transfer|Accept|Exploit|Enhance|Share",
      "category": "(risk only) e.g. Technical, Financial, People, External, Legal",

      "organisation": "(stakeholder only)",
      "role": "(stakeholder only) their role in relation to the project",
      "power": "(stakeholder only) 1-10",
      "interest": "(stakeholder only) 1-10",
      "influence": "(stakeholder only) 1-10",
      "ease": "(stakeholder only) 1-10",
      "engagementStrategy": "(stakeholder only) how to engage",

      "description": "(deliverable/activity/issue/constraint) detail",
      "phase": "Concept|Definition|Development|Handover & Closeout|Execution",
      "priority": "(deliverable/issue) high|medium|low",
      "kpis": [
        {
          "_id": "D-001-KPI01",
          "name": "specific measurable KPI",
          "baseline": "starting value or 0 for new initiatives",
          "target": "target value derived from document context",
          "unit": "%, #, £, score",
          "measurementFrequency": "Monthly|Weekly|Quarterly|Per Milestone|At Closure",
          "dataSource": "where data will come from",
          "owner": "who measures and reports this KPI"
        }
      ],

      "responsible": "(activity only) role responsible",
      "startDate": "(activity only) YYYY-MM-DD or null",
      "targetDate": "(activity/milestone only) YYYY-MM-DD or null",

      "constraintType": "(constraint only) Constraint|Assumption|Dependency",
      "riskIfBreached": "(constraint only) consequence",
      "owner": "(constraint only) responsible role"
    }
  ]
}

═══════════════════════════════════════════════
GOVERNANCE RULES
═══════════════════════════════════════════════
- Tier 1 — Sponsor: scope, budget, strategic decisions, programme milestones
- Tier 2 — Mentor / Assessor: assurance, quality gates, programme alignment
- Tier 3 — Project Manager: risks, issues, change control, team management
- Tier 4 — Project Team: tasks, sub-deliverables, day-to-day activities

ID formats: BEN-001, OBJ-001, TM-001, R-101 (risks), SH-001 (stakeholders), D-001 (deliverables), ACT-001 (activities), MS-001 (milestones), I-101 (issues), CON-001 (constraints). Deliverable KPIs: D-001-KPI01.
For activities/milestones with dates found in the document: include startDate/targetDate and set _autoDate to false.
Remove all comment/instruction lines (lines starting with field name explanations in brackets) from your output — only output actual data fields.

DOCUMENT:
` + maxDoc;

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 12000, messages: [{ role: "user", content: prompt }] })
      });

      if(!res.ok){
        const t = await res.text();
        throw new Error("API " + res.status + ": " + t.slice(0, 200));
      }

      const data  = await res.json();
      const raw   = (data.content || []).map(b => b.text || "").join("");
      const clean = raw.replace(/^```[a-z]*\\n?/, "").replace(/```$/, "").trim();
      const si    = clean.indexOf("{");
      if(si === -1) throw new Error("No JSON in response: " + raw.slice(0, 300));

      // FIX: Walk backwards from last } until JSON.parse succeeds.
      // Handles mid-response truncation from max_tokens hitting the limit.
      let parsed = null;
      let srch = clean.slice(si);
      for (let i = 0; i < 10 && !parsed; i++) {
        const ci = srch.lastIndexOf("}");
        if (ci === -1) break;
        try { parsed = JSON.parse(srch.slice(0, ci + 1)); }
        catch { srch = srch.slice(0, ci); }
      }
      if (!parsed) throw new Error("Could not parse AI response as JSON. Try pasting a shorter section of the document.");

      const els = (parsed.elements || []).map(el => ({ ...el, _state: "pending" }));
      setCharter(parsed.charter || null);
      setElements(els);
      setStage("review");
      setLoading(false);
      // FIX 8: store timer ID so the useEffect cleanup can cancel it if the
      // component unmounts before the 1.8 s auto-advance fires.
      if (onSendToPersonalisation) {
        autoAdvanceTimer.current = setTimeout(() => {
          onSendToPersonalisation(parsed.charter || null, els.filter(e => e._state !== "rejected"));
        }, 1800);
      }

    } catch(err){
      setLoading(false);
      setStage(null);
      showToast("Error: " + err.message);
      if (onExtractionError) onExtractionError(err.message);
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────────────────────
  const exportRegister = () => {
    const lines = [];
    const c = charter || {};
    lines.push("PROJECT ELEMENT REGISTER — LAYER 1 OUTPUT");
    lines.push("Generated: " + new Date().toISOString());
    lines.push("");
    lines.push("CHARTER");
    lines.push(csvLine(["Field","Value"]));
    [["Project Name",c.projectName],["Project Code",c.projectCode],
     ["Purpose",c.purpose],["Problem Statement",c.problemStatement],
     ["Strategic Alignment",c.strategicAlignment],["Start Date",c.startDate],
     ["End Date",c.endDate],["Budget",c.budget],["Project Manager",c.projectManager],
     ["Project Sponsor",c.projectSponsor],["Organisation",c.organisation]]
      .forEach(([k,v]) => lines.push(csvLine([k, v||""])));
    lines.push("");

    if((c.objectives||[]).length){
      lines.push("OBJECTIVES");
      lines.push(csvLine(["#","Objective","Success Criterion","Target Date"]));
      c.objectives.forEach((o,i) => lines.push(csvLine([i+1, o.objective, o.successCriterion, o.targetDate||""])));
      lines.push("");
    }

    const accepted = elements.filter(e => e._state !== "rejected");
    lines.push("PROJECT ELEMENTS");
    lines.push(csvLine(["Element ID","Type","Name","Version","Status","Suggested Owner","Suggested Approver","Governance Tier","Phase","Priority","Source","Extra"]));
    accepted.forEach(el => {
      const extra = [];
      if(el.cause)              extra.push("Cause: " + el.cause);
      if(el.potentialImpact)    extra.push("Impact: " + el.potentialImpact);
      if(el.mitigation)         extra.push("Mitigation: " + el.mitigation);
      if(el.likelihood)         extra.push("Likelihood: " + el.likelihood);
      if(el.impact)             extra.push("Risk Impact: " + el.impact);
      if(el.response)           extra.push("Response: " + el.response);
      if(el.category)           extra.push("Category: " + el.category);
      if(el.power)              extra.push("Power: " + el.power);
      if(el.interest)           extra.push("Interest: " + el.interest);
      if(el.influence)          extra.push("Influence: " + el.influence);
      if(el.ease)               extra.push("Ease: " + el.ease);
      if(el.engagementStrategy) extra.push("Strategy: " + el.engagementStrategy);
      if(el.targetDate)         extra.push("Target: " + el.targetDate);
      if(el.responsible)        extra.push("Responsible: " + el.responsible);
      if(el.riskIfBreached)     extra.push("Risk if Breached: " + el.riskIfBreached);
      if(el.constraintType)     extra.push("Type: " + el.constraintType);
      lines.push(csvLine([
        el._id, el.type, el.name||el.description||"",
        el._version||1, el._status||"Draft",
        el._suggestedOwner||"", el._suggestedApprover||"",
        el._governanceTier||"", el.phase||"", el.priority||"",
        el.source||"", extra.join(" | ")
      ]));
    });

    const blob = new Blob([lines.join("\n")], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "NorCon_ProjectElements_" + Date.now() + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ──────────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:C.bg, color:C.sage, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize:13, minHeight:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 20px",
        display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ width:28, height:28, background:C.accent, borderRadius:5,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🧠</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Document Intelligence Engine</div>
          <div style={{ fontSize:11, color:C.muted }}>Layer 1 — Extracts governed Project Elements for the Personalisation Layer</div>
        </div>
        <span style={{ marginLeft:"auto", background:C.accent, color:"#fff", fontSize:9,
          fontWeight:700, padding:"2px 8px", borderRadius:20, textTransform:"uppercase", letterSpacing:".5px" }}>
          Layer 1
        </span>
      </div>

      {/* Pipeline */}
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"7px 20px",
        display:"flex", alignItems:"center", gap:4, flexShrink:0, overflowX:"auto" }}>
        {STAGES.map((s,i) => {
          const active = stage === s;
          const done   = stageIdx > i && stage !== null;
          const label  = s==="map" ? "Map to Elements" : s==="review" ? "Review & Approve" : s.charAt(0).toUpperCase()+s.slice(1);
          return (
            <div key={s} style={{ display:"flex", alignItems:"center" }}>
              {i > 0 && <span style={{ color:C.border, fontSize:14, padding:"0 2px" }}>›</span>}
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700,
                color: done ? C.sageDim : active ? C.accentL : C.muted,
                background: active ? "rgba(46,125,82,0.15)" : "transparent",
                padding:"3px 8px", borderRadius:4, whiteSpace:"nowrap", transition:"all .3s",
                textTransform:"uppercase", letterSpacing:".5px" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"currentColor" }}/>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative" }}>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position:"absolute", inset:0, background:"rgba(13,43,27,0.93)", zIndex:20,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
            <div style={{ width:26, height:26, border:`2px solid ${C.border}`,
              borderTopColor:C.accentL, borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {["ingest","analyse","classify","map"].map((s,i) => (
                <div key={s} style={{ display:"flex", alignItems:"center" }}>
                  {i > 0 && <span style={{ color:C.border, fontSize:14 }}>›</span>}
                  <div style={{ padding:"5px 12px", borderRadius:4, fontSize:10, fontWeight:700,
                    textTransform:"uppercase", letterSpacing:".5px", transition:"all .4s",
                    border:`1px solid ${stage===s ? C.accentL : C.border}`,
                    color: stage===s ? C.accentL : C.muted,
                    background: stage===s ? "rgba(46,125,82,0.2)" : "transparent",
                    boxShadow: stage===s ? "0 0 10px rgba(46,125,82,0.3)" : "none" }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:C.dim }}>{loadMsg}</div>
          </div>
        )}

        {/* LEFT — Input panel */}
        <div style={{ width:290, minWidth:260, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", flexShrink:0 }}>

          <div style={{ padding:"10px 14px 8px", fontSize:10, fontWeight:700, color:C.muted,
            textTransform:"uppercase", letterSpacing:".8px", borderBottom:`1px solid ${C.border}` }}>
            Document Input
          </div>

          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
            {["upload","paste"].map(t => (
              <button key={t} onClick={() => setInputTab(t)} style={{ flex:1, padding:"7px 4px", fontSize:10,
                fontWeight:700, background:"none", border:"none", cursor:"pointer",
                color: inputTab===t ? C.accentL : C.muted,
                borderBottom: inputTab===t ? `2px solid ${C.accentL}` : "2px solid transparent",
                textTransform:"uppercase", letterSpacing:".4px" }}>
                {t === "upload" ? "📎 Upload" : "📋 Paste"}
              </button>
            ))}
          </div>

          {inputTab === "upload" ? (
            <div style={{ display:"flex", flex:1, flexDirection:"column", padding:14, overflowY:"auto", gap:10 }}>
              {file ? (
                <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
                  padding:10, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:18 }}>
                    {file.name.endsWith(".pdf") ? "📕" : (file.name.endsWith(".docx")||file.name.endsWith(".doc")) ? "📘" : "📄"}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, color:C.sage, whiteSpace:"nowrap",
                      overflow:"hidden", textOverflow:"ellipsis", fontSize:12 }}>{file.name}</div>
                    <div style={{ color:C.muted, fontSize:10 }}>{fmtBytes(file.size)}</div>
                  </div>
                  <button onClick={() => setFile(null)}
                    style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              ) : (
                <div style={{ border:`2px dashed ${dragover ? C.accent : C.border}`, borderRadius:7,
                  padding:"24px 12px", textAlign:"center", cursor:"pointer", display:"flex",
                  flexDirection:"column", alignItems:"center", gap:8,
                  background: dragover ? "rgba(46,125,82,0.07)" : "transparent" }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt"
                    style={{ display:"none" }} onChange={e => { if(e.target.files[0]) setFile(e.target.files[0]); }}/>
                  <div style={{ fontSize:28, opacity:.6 }}>📂</div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.sageDim }}>Drop project document</div>
                  <div style={{ fontSize:10, color:C.muted }}>or click to browse</div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[".PDF",".DOCX",".TXT"].map(t => (
                      <span key={t} style={{ fontSize:9, fontWeight:700, padding:"2px 6px",
                        borderRadius:3, border:`1px solid ${C.border}`, color:C.muted, fontFamily:"monospace" }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize:10, fontWeight:700, color:C.dim, display:"block", marginBottom:4 }}>
                  Project Name (optional)
                </label>
                <input style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.sage, fontSize:11, padding:"7px 9px", outline:"none", boxSizing:"border-box" }}
                  value={projName} onChange={e => setProjName(e.target.value)} placeholder="e.g. Waterfront Phase 2"/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:700, color:C.dim, display:"block", marginBottom:4 }}>
                  Document Type
                </label>
                <select style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.sage, fontSize:11, padding:"7px 9px", outline:"none", boxSizing:"border-box" }}
                  value={docType} onChange={e => setDocType(e.target.value)}>
                  {["auto","brief","contract","scope","specification","schedule","minutes","report"].map(v => (
                    <option key={v} value={v} style={{ background:C.surface2 }}>
                      {v.charAt(0).toUpperCase()+v.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flex:1, flexDirection:"column", padding:14, overflowY:"auto", gap:10 }}>
              <textarea
                style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6,
                  color:C.sage, fontSize:11, fontFamily:"monospace", lineHeight:1.6, padding:10,
                  outline:"none", resize:"none", minHeight:180, flex:1, boxSizing:"border-box" }}
                value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder={"Paste project document text here...\n\n• Project brief\n• Contract clauses\n• Scope of works\n• Meeting minutes"}/>
              <div>
                <label style={{ fontSize:10, fontWeight:700, color:C.dim, display:"block", marginBottom:4 }}>
                  Project Name (optional)
                </label>
                <input style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.sage, fontSize:11, padding:"7px 9px", outline:"none", boxSizing:"border-box" }}
                  value={projName} onChange={e => setProjName(e.target.value)} placeholder="e.g. Waterfront Phase 2"/>
              </div>
            </div>
          )}

          <button onClick={runAnalysis} disabled={!isReady || loading}
            style={{ margin:"12px 14px", padding:10, background: isReady ? C.accent : "#1F4D34",
              color:"#fff", border:"none", borderRadius:6, fontSize:12, fontWeight:700,
              cursor: isReady ? "pointer" : "not-allowed", opacity: isReady ? 1 : 0.5,
              display:"flex", alignItems:"center", justifyContent:"center", gap:7, flexShrink:0 }}>
            ⚡ Extract Project Elements
          </button>
        </div>

        {/* RIGHT — Element register */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* View tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`,
            background:C.surface2, overflowX:"auto", flexShrink:0 }}>
            {VIEW_TABS.map(tab => {
              const active = viewTab === tab;
              const t = TYPES[tab];
              const count = tabCount(tab);
              return (
                <button key={tab} onClick={() => setViewTab(tab)}
                  style={{ padding:"8px 12px", fontSize:10, fontWeight:700,
                    color: active ? C.sage : C.muted, background:"none", border:"none",
                    cursor:"pointer", borderBottom: active ? `2px solid ${C.sage}` : "2px solid transparent",
                    whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5,
                    textTransform:"uppercase", letterSpacing:".4px" }}>
                  {tab==="all" ? "🗂️ All" : tab==="charter" ? "📋 Charter" : `${t?.icon||""} ${t?.label||tab}`}
                  <span style={{ background: active ? C.accent : C.border,
                    color: active ? "#fff" : C.dim, fontSize:9, padding:"1px 5px",
                    borderRadius:10, fontWeight:700 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", gap:8, flexShrink:0, flexWrap:"wrap" }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.sage, flex:1 }}>
              {elements.length > 0
                ? viewTab==="charter"  ? "Project Charter — Extracted Data"
                  : viewTab==="all"    ? `Project Element Register — ${elements.length} elements`
                  : `${TYPES[viewTab]?.label||viewTab} Register — ${visibleElements.length} element${visibleElements.length!==1?"s":""}`
                : "Project Element Register"}
            </div>
            {elements.length > 0 && (
              <div style={{ display:"flex", gap:8, fontSize:10, color:C.muted }}>
                <span>✓ <strong style={{ color:C.activity }}>{stats.accepted}</strong></span>
                <span>⏳ <strong style={{ color:C.sageDim }}>{stats.pending}</strong></span>
                <span>✕ <strong style={{ color:C.risk }}>{stats.rejected}</strong></span>
              </div>
            )}
            <button onClick={exportRegister} disabled={elements.length === 0}
              style={{ padding:"5px 12px", background:"none", border:`1px solid ${C.accent}`,
                borderRadius:4, color:C.accentL, fontSize:10, fontWeight:700,
                cursor: elements.length > 0 ? "pointer" : "not-allowed",
                opacity: elements.length > 0 ? 1 : 0.3,
                textTransform:"uppercase", letterSpacing:".4px" }}>
              ⬇ Export Register
            </button>
            {onSendToPersonalisation && elements.length > 0 && (
              <button onClick={() => onSendToPersonalisation(charter, elements.filter(e => e._state !== "rejected"))}
                style={{ padding:"5px 14px", background:C.accent, border:"none",
                  borderRadius:4, color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer",
                  textTransform:"uppercase", letterSpacing:".4px" }}>
                Send to Personalisation Layer →
              </button>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:14 }}>
            {elements.length === 0 && !charter ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"100%", gap:10, color:C.muted,
                textAlign:"center", padding:32 }}>
                <div style={{ fontSize:48, opacity:.2 }}>🗂️</div>
                <div style={{ fontSize:15, fontWeight:600, color:C.dim }}>No elements extracted yet</div>
                <div style={{ fontSize:12, maxWidth:320, lineHeight:1.7 }}>
                  Upload or paste a project document. The engine extracts governed Project Elements —
                  each with a unique ID, suggested owner, approver and governance tier —
                  ready for the Personalisation Layer.
                </div>
              </div>
            ) : viewTab === "charter" ? (
              <CharterPanel charter={charter}/>
            ) : visibleElements.length === 0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:260, gap:8, color:C.muted, textAlign:"center" }}>
                <div style={{ fontSize:32, opacity:.25 }}>📭</div>
                <div style={{ fontSize:13, fontWeight:600, color:C.dim }}>
                  No {TYPES[viewTab]?.label||viewTab}s found
                </div>
                <div style={{ fontSize:11 }}>None were identified in this document.</div>
              </div>
            ) : (
              visibleElements.map((el, i) => (
                <ElementCard key={el._id||i} el={el} onStateChange={handleStateChange}/>
              ))
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:16, right:16, background:"#2a1515",
          border:`1px solid ${C.risk}`, borderRadius:6, padding:"10px 14px",
          fontSize:11, color:"#ff9e9e", maxWidth:340, zIndex:100, lineHeight:1.5 }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
