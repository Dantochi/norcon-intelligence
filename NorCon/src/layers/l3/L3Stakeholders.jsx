import { useState, useCallback } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
  purple:"#9c6ee0",
};
const inp = {
  background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4,
  color:C.sage, fontSize:11, padding:"5px 8px", outline:"none",
  fontFamily:"inherit", width:"100%", boxSizing:"border-box",
};

const APM_TEMPLATES = {
  "Lead":                "Involve in governance decisions. Schedule regular one-to-ones. Ensure they co-sign key approvals. Make them feel personal ownership of the project's success.",
  "Own":                 "Assign formal accountability for a specific deliverable or outcome. Treat as near-team-member. Regular structured check-ins focused on delivery.",
  "Contribute":          "Co-create specific outputs. Invite to workshops and review points. Leverage their network actively at defined moments.",
  "Endorse":             "Contact at key milestone moments only. Present decisions rather than involving in making them. Seek their formal backing and public endorsement.",
  "Endorse / Follow":    "Brief, targeted communications at decision points. Make approval as easy as possible. Monitor for disposition shifts.",
  "Follow":              "Regular one-way updates. Acknowledge their interest without demanding action. Keep informed at key milestones.",
  "Observe / Contribute":"Monitor their public positions. Look for opportunities to raise interest through Champions or Amplifiers. Do not invest heavily until interest is confirmed.",
  "Observe":             "No proactive engagement. Include in broad communications only. Review at each phase gate.",
};

const SENTIMENT_COLORS = {
  Positive:C.activity, Neutral:C.dim, Cautious:C.milestone, Opposed:C.risk,
};

function Badge({ label, color, small }) {
  return (
    <span style={{ fontSize:small?8:9, fontWeight:700, padding:small?"1px 5px":"2px 7px",
      borderRadius:12, background:color+"22", color, border:`1px solid ${color}44`,
      whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function Lbl({ c }) {
  return <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
    letterSpacing:".4px", marginBottom:3 }}>{c}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stakeholder card
// ─────────────────────────────────────────────────────────────────────────────
function StakeholderCard({ sh, canEdit, member, onUpdateSH, onRaiseCCR }) {
  const [open,        setOpen]        = useState(false);
  const [logForm,     setLogForm]     = useState({ date:"", channel:"Email", summary:"", outcome:"", nextAction:"" });
  const [showLogForm, setShowLogForm] = useState(false);
  const [showAI,      setShowAI]      = useState(false);
  const [aiLoading,   setAILoading]   = useState(false);
  const [aiStrategy,  setAIStrategy]  = useState(sh.strategyAI||"");
  const [aiError,     setAIError]     = useState(""); // FIX 19: surface AI errors to user

  const commLog = sh.commLog || [];
  const today   = new Date();

  // Normalise: L2 may store as commsNextDate OR commPlan.nextContactDate
  const nextContactDate = sh.commPlan?.nextContactDate || sh.commsNextDate || "";
  const isOverdue = nextContactDate &&
    new Date(nextContactDate) < today &&
    !sh.commPlan?.suspended;

  const sentCol = SENTIMENT_COLORS[sh.sentiment] || C.muted;
  const tagColor = sh._tagColor || C.purple;

  // ── Log communication ─────────────────────────────────────────────────
  const submitLog = () => {
    if (!logForm.summary.trim()) return;
    const entry = {
      id:      `CL-${String(commLog.length+1).padStart(3,"0")}`,
      date:    logForm.date || new Date().toISOString().slice(0,10),
      by:      member?.loginCode || "PM",
      channel: logForm.channel,
      summary: logForm.summary,
      outcome: logForm.outcome,
      nextAction: logForm.nextAction,
    };
    // Compute next contact date from frequency
    const freq = sh.commPlan?.frequency || sh.commsFreq || "";
    const freqDays = { Weekly:7, "Bi-weekly":14, Monthly:30, Quarterly:90, "Milestone":null };
    const days = freqDays[freq];
    const nextDate = days
      ? new Date(Date.now() + days*86400000).toISOString().slice(0,10)
      : nextContactDate || "";

    onUpdateSH({
      commLog: [...commLog, entry],
      commPlan: { ...sh.commPlan, nextContactDate: nextDate },
    });
    setLogForm({ date:"", channel:"Email", summary:"", outcome:"", nextAction:"" });
    setShowLogForm(false);
  };

  // ── Update sentiment ──────────────────────────────────────────────────
  const updateSentiment = (sentiment) => {
    const entry = { sentiment, date:new Date().toISOString().slice(0,10), note:"" };
    onUpdateSH({
      sentiment,
      sentimentHistory:[...(sh.sentimentHistory||[]), entry],
    });
  };

  // ── Generate AI strategy ──────────────────────────────────────────────────
  const generateStrategy = async () => {
    setAILoading(true);
    setAIError(""); // clear any previous error on new attempt
    try {
      const prompt = `Generate a specific, actionable stakeholder engagement strategy (2-3 sentences) for this stakeholder on this project.

Stakeholder: ${sh.name||"Unknown"} (${sh.category||"—"})
Role: ${sh.role||"—"}
Strategic tag: ${sh.tag||"—"}  APM engagement level: ${sh.apmLevel||"—"}
Priority score: ${sh.priorityScore||"—"}
Ease of engagement: ${sh.ease||5}/10
Current sentiment: ${sh.sentiment||"Neutral"}

Project context: The project manager needs practical guidance on HOW to engage this specific stakeholder.
Use the ${sh.apmLevel||"Follow"} engagement level as the basis.
${(sh.ease||5) < 5 ? "Note: Ease is low — recommend asynchronous or indirect approaches." : "Ease is reasonable — recommend direct engagement mechanisms."}

${sh.sentiment === "Opposed" ? "IMPORTANT: This stakeholder is currently OPPOSED. The recommendation must prioritise addressing their concerns and shifting sentiment before standard engagement." : sh.sentiment === "Cautious" ? "NOTE: This stakeholder is CAUTIOUS. Recommendations should build trust before asking for active engagement." : ""}

Return only the strategy text, no headers, no bullets.`;

      const res  = await fetch("/api/extract", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:300, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      const text = (data.content||[]).map(b=>b.text||"").join("").trim();
      setAIStrategy(text);
      onUpdateSH({ strategyAI:text });
    } catch (err) {
      setAIError(`Strategy generation failed: ${err.message}`);
      console.error("AI strategy generation failed:", err);
    }
    setAILoading(false);
  };

  const confirmStrategy = () => {
    onUpdateSH({ strategyFinal: aiStrategy || APM_TEMPLATES[sh.apmLevel] || "" });
    setShowAI(false);
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`,
      borderLeft:`3px solid ${tagColor}`, borderRadius:8, marginBottom:10 }}>

      {/* Collapsed header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
        <span style={{ fontFamily:"monospace", fontSize:11, color:C.purple }}>{sh._id}</span>
        {sh.tag && <Badge label={sh.tag} color={tagColor}/>}
        {sh.apmLevel && <Badge label={sh.apmLevel} color={tagColor} small/>}
        <span style={{ fontSize:12, color:C.sage, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {sh.name||"—"}
          {sh.category && <span style={{ fontSize:10, color:C.muted, marginLeft:6 }}>{sh.category}</span>}
        </span>
        <Badge label={sh.sentiment||"Neutral"} color={sentCol} small/>
        {isOverdue && <Badge label="Overdue" color={C.risk} small/>}
        {nextContactDate && !isOverdue && (
          <span style={{ fontSize:9, color:C.muted, fontFamily:"monospace" }}>
            Next: {nextContactDate}
          </span>
        )}
        <span style={{ color:C.muted, fontSize:11 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"12px 14px" }}>

          {/* Stakeholder profile */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:12, fontSize:11 }}>
            <div><span style={{ color:C.muted }}>Contact: </span><span style={{ color:C.dim }}>{sh.contact||"—"}</span></div>
            <div><span style={{ color:C.muted }}>Priority: </span><span style={{ color:tagColor, fontWeight:700 }}>{sh.priorityScore||"—"}</span></div>
            <div><span style={{ color:C.muted }}>Power/Int/Inf: </span><span style={{ color:C.dim }}>{sh.power||5}/{sh.interest||5}/{sh.influence||5}</span></div>
            <div><span style={{ color:C.muted }}>Ease: </span><span style={{ color:C.accentL }}>{sh.ease||5}/10</span></div>
          </div>

          {/* Sentiment */}
          <div style={{ marginBottom:12 }}>
            <Lbl c="Stakeholder Sentiment"/>
            <div style={{ display:"flex", gap:6 }}>
              {["Positive","Neutral","Cautious","Opposed"].map(s => {
                const col = SENTIMENT_COLORS[s];
                const active = sh.sentiment === s;
                return (
                  <button key={s} onClick={() => canEdit && updateSentiment(s)}
                    style={{ padding:"3px 10px", borderRadius:10, border:`1px solid ${active?col:C.border}`,
                      background:active?col+"22":"none", color:active?col:C.muted,
                      fontSize:10, fontWeight:active?700:400, cursor:canEdit?"pointer":"default" }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next contact */}
          {sh.commPlan && !sh.commPlan.suspended && (
            <div style={{ marginBottom:12, padding:"8px 10px",
              background: isOverdue?"rgba(224,92,92,0.08)":"rgba(46,125,82,0.06)",
              border:`1px solid ${isOverdue?C.risk:C.border}`, borderRadius:6 }}>
              <div style={{ display:"flex", gap:12, fontSize:11, alignItems:"center" }}>
                <div><span style={{ color:C.muted }}>Channel: </span><span style={{ color:C.dim }}>{sh.commsFormat||sh.commPlan.channel||"—"}</span></div>
                <div><span style={{ color:C.muted }}>Frequency: </span><span style={{ color:C.dim }}>{sh.commPlan.frequency||sh.commsFreq||"—"}</span></div>
                <div><span style={{ color:C.muted }}>Next contact: </span>
                  <span style={{ color:isOverdue?C.risk:C.activity, fontFamily:"monospace", fontWeight:isOverdue?700:400 }}>
                    {nextContactDate||"Not set"}
                  </span>
                </div>
                {nextContactDate && canEdit && (
                  <input type="date" style={{ ...inp, width:"auto", fontSize:10 }}
                    value={nextContactDate}
                    onChange={e => onUpdateSH({ commPlan:{ ...(sh.commPlan||{}), nextContactDate:e.target.value }, commsNextDate:e.target.value })}/>
                )}
              </div>
              {sh.commsContent && <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>Purpose: {sh.commsContent}</div>}
            </div>
          )}

          {/* Engagement strategy */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <Lbl c="Engagement Strategy"/>
              {canEdit && (
                <button onClick={() => { if(showAI){setAIStrategy(""); setAIError("");} setShowAI(a=>!a); }}
                  style={{ marginLeft:"auto", padding:"2px 10px", background:"none",
                    border:`1px solid ${C.accentL}`, borderRadius:5, color:C.accentL, fontSize:9, cursor:"pointer" }}>
                  {aiLoading ? "Generating recommendations…" : "❖ Get Recommendations"}
                </button>
              )}
            </div>
            {showAI && (
              <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", marginBottom:8 }}>
                {!aiStrategy && !aiLoading && !aiError && (
                  <button onClick={generateStrategy}
                    style={{ padding:"5px 12px", background:C.accent, border:"none", borderRadius:5,
                      color:"#fff", fontSize:11, cursor:"pointer" }}>
                    Generate strategy for {sh.tag||"this stakeholder"}
                  </button>
                )}
                {aiLoading && <div style={{ fontSize:11, color:C.muted }}>Claude is generating a strategy…</div>}
                {aiError && !aiLoading && (
                  <div style={{ fontSize:11, color:C.risk, marginTop:4 }}>
                    {aiError}
                    <button onClick={generateStrategy}
                      style={{ marginLeft:10, padding:"2px 8px", background:"none",
                        border:`1px solid ${C.risk}`, borderRadius:4,
                        color:C.risk, fontSize:10, cursor:"pointer" }}>
                      Retry
                    </button>
                  </div>
                )}
                {aiStrategy && !aiLoading && (
                  <>
                    <div style={{ fontSize:11, color:C.dim, lineHeight:1.6, marginBottom:8 }}>{aiStrategy}</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={confirmStrategy}
                        style={{ padding:"4px 10px", background:C.accent, border:"none", borderRadius:4, color:"#fff", fontSize:10, cursor:"pointer" }}>
                        Use this strategy
                      </button>
                      <button onClick={() => { setAIStrategy(""); generateStrategy(); }}
                        style={{ padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:C.muted, fontSize:10, cursor:"pointer" }}>
                        Regenerate
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {canEdit ? (
              <textarea
                value={sh.strategyFinal || sh.engagementStrategy || ""}
                onChange={e => onUpdateSH({ strategyFinal:e.target.value, engagementStrategy:e.target.value })}
                placeholder={APM_TEMPLATES[sh.apmLevel] || "Describe the engagement approach for this stakeholder..."}
                style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5,
                  color:C.sage, fontSize:12, padding:"8px 10px", outline:"none",
                  fontFamily:"inherit", width:"100%", boxSizing:"border-box",
                  resize:"vertical", minHeight:70, lineHeight:1.6 }}
              />
            ) : (
              <div style={{ fontSize:12, color:C.dim, lineHeight:1.6, padding:"6px 8px",
                background:C.surface2, borderRadius:5, fontStyle:(!sh.strategyFinal&&!sh.engagementStrategy)?"italic":"normal" }}>
                {sh.strategyFinal || sh.engagementStrategy ||
                  APM_TEMPLATES[sh.apmLevel] ||
                  "No strategy defined."}
              </div>
            )}
          </div>

          {/* Communication log */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>
                Communication Log ({commLog.length})
              </div>
              {canEdit && (
                <button onClick={() => setShowLogForm(l=>!l)}
                  style={{ marginLeft:"auto", padding:"3px 10px", background:"none",
                    border:`1px solid ${C.border}`, borderRadius:5, color:C.dim, fontSize:10, cursor:"pointer" }}>
                  {showLogForm ? "Cancel" : "+ Log Communication"}
                </button>
              )}
            </div>

            {showLogForm && (
              <div style={{ background:C.surface2, borderRadius:6, padding:"10px 12px", marginBottom:10,
                border:`1px solid ${C.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
                  <div><Lbl c="Date"/>
                    <input type="date" style={inp} value={logForm.date}
                      onChange={e=>setLogForm(f=>({...f,date:e.target.value}))}/>
                  </div>
                  <div><Lbl c="Channel"/>
                    <select style={inp} value={logForm.channel} onChange={e=>setLogForm(f=>({...f,channel:e.target.value}))}>
                      {["Email","Meeting","Video Call","Phone","Letter","Social Media","In Person"].map(c=>(
                        <option key={c} value={c} style={{background:C.surface2}}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div><Lbl c="Next Action"/>
                    <input style={inp} value={logForm.nextAction}
                      onChange={e=>setLogForm(f=>({...f,nextAction:e.target.value}))} placeholder="Follow-up action"/>
                  </div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Summary of communication"/>
                    <input style={inp} value={logForm.summary}
                      onChange={e=>setLogForm(f=>({...f,summary:e.target.value}))} placeholder="What was discussed?"/>
                  </div>
                  <div style={{ gridColumn:"1/-1" }}><Lbl c="Outcome"/>
                    <input style={inp} value={logForm.outcome}
                      onChange={e=>setLogForm(f=>({...f,outcome:e.target.value}))} placeholder="Result of the communication"/>
                  </div>
                </div>
                <button onClick={submitLog}
                  style={{ padding:"6px 14px", background:C.accent, border:"none", borderRadius:5,
                    color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  Save Log Entry
                </button>
              </div>
            )}

            {commLog.length === 0
              ? <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No communications logged yet.</div>
              : commLog.slice().reverse().map((entry, ei) => (
                <div key={ei} style={{ display:"flex", gap:10, padding:"6px 0",
                  borderBottom:`1px solid ${C.border}22`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.muted, flexShrink:0, paddingTop:2 }}>{entry.date}</span>
                  <span style={{ fontSize:9, color:C.accentL, flexShrink:0 }}>{entry.channel}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:C.sage }}>{entry.summary}</div>
                    {entry.outcome && <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>Outcome: {entry.outcome}</div>}
                    {entry.nextAction && <div style={{ fontSize:10, color:C.milestone, marginTop:1 }}>Next: {entry.nextAction}</div>}
                  </div>
                  <span style={{ fontSize:9, color:C.muted, flexShrink:0 }}>by {entry.by}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main L3Stakeholders component
// ─────────────────────────────────────────────────────────────────────────────
export default function L3Stakeholders({ state, member, onStateChange }) {
  const canEdit = member?.isPM || member?.canApprove;
  const sheets  = state?.l2?.sheets || {};
  const allSH   = sheets["08"]?.data?.stakeholders || [];

  // Only Engaged stakeholders appear in L3
  const engaged = allSH
    .filter(s => s.status === "Engaged" || !s.status)
    .map((s, i) => {
      // Derive tag and colour from stored scores
      const seg = deriveTagFromScores(s.power, s.interest, s.influence);
      return {
        ...s,
        tag:         s.tag       || seg.tag,
        apmLevel:    s.apmLevel  || seg.apm,
        priorityScore: s.priorityScore ||
          ((parseInt(s.power)||5)*0.40+(parseInt(s.interest)||5)*0.35+(parseInt(s.influence)||5)*0.25).toFixed(1),
        _tagColor:   seg.color,
      };
    })
    .sort((a,b) => parseFloat(b.priorityScore) - parseFloat(a.priorityScore));

  const overdue  = engaged.filter(s => s.commPlan?.nextContactDate && new Date(s.commPlan.nextContactDate) < new Date()).length;
  const concerns = engaged.filter(s => s.sentiment === "Cautious" || s.sentiment === "Opposed").length;

  const updateSH = useCallback((shId, updates) => {
    onStateChange(prev => {
      const d08 = prev.l2.sheets["08"]?.data || {};
      const next = (d08.stakeholders||[]).map(s => s._id === shId ? { ...s, ...updates } : s);
      return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        "08": { ...prev.l2.sheets["08"], data: { ...d08, stakeholders:next } }
      }}};
    });
  }, [onStateChange]);

  if (engaged.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:12, color:C.muted, padding:40 }}>
        <div style={{ fontSize:32 }}>👥</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.dim }}>No engaged stakeholders</div>
        <div style={{ fontSize:12, textAlign:"center", maxWidth:360, lineHeight:1.6 }}>
          Go to <span style={{ color:C.accentL }}>L2 → Sheet 08</span> to add and score stakeholders,
          then set their status to <span style={{ color:C.activity }}>Engaged</span> to manage them here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* Summary bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"8px 20px", display:"flex", gap:16, alignItems:"center", flexShrink:0 }}>
        <span style={{ fontSize:11, color:C.dim }}>{engaged.length} engaged</span>
        {overdue > 0 && <span style={{ fontSize:11, color:C.risk }}>⬤ {overdue} overdue for contact</span>}
        {concerns > 0 && <span style={{ fontSize:11, color:C.milestone }}>⬤ {concerns} sentiment concern{concerns>1?"s":""}</span>}
        <span style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>
          Sorted by priority score · Communication management
        </span>
      </div>

      {/* Cards */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
        {engaged.map(sh => (
          <StakeholderCard
            key={sh._id}
            sh={sh}
            canEdit={canEdit}
            member={member}
            onUpdateSH={updates => updateSH(sh._id, updates)}
            onRaiseCCR={() => {}}
          />
        ))}
        <div style={{ fontSize:11, color:C.muted, marginTop:8, textAlign:"center" }}>
          To add, score, or change the status of stakeholders → L2 → Sheet 08
        </div>
      </div>
    </div>
  );
}

// ── Re-export the tag derivation used by StakeholderCard ───────────────────────────
const EIGHT_SEGMENTS_L3 = [
  { power:"H", interest:"H", influence:"H", tag:"Champion",             apm:"Lead",               color:"#e0a23a" },
  { power:"H", interest:"H", influence:"L", tag:"Key Decision Maker",   apm:"Own",                color:"#e05c5c" },
  { power:"H", interest:"L", influence:"H", tag:"Silent Authority",      apm:"Endorse",            color:"#9c6ee0" },
  { power:"H", interest:"L", influence:"L", tag:"Gatekeeper",            apm:"Endorse / Follow",   color:"#5a7a66" },
  { power:"L", interest:"H", influence:"H", tag:"Amplifier",             apm:"Contribute",         color:"#3a9ce0" },
  { power:"L", interest:"H", influence:"L", tag:"Active Supporter",      apm:"Follow",             color:"#3ae0a2" },
  { power:"L", interest:"L", influence:"H", tag:"Peripheral Influencer", apm:"Observe / Contribute", color:"#8aac96" },
  { power:"L", interest:"L", influence:"L", tag:"Monitor",               apm:"Observe",            color:"#5a7a66" },
];

function deriveTagFromScores(power, interest, influence) {
  const pH = (parseInt(power)||5)    >= 6;
  const iH = (parseInt(interest)||5) >= 6;
  const nH = (parseInt(influence)||5)>= 6;
  return EIGHT_SEGMENTS_L3.find(s =>
    s.power    === (pH?"H":"L") &&
    s.interest === (iH?"H":"L") &&
    s.influence=== (nH?"H":"L")
  ) || EIGHT_SEGMENTS_L3[7];
}
