import { useState, useEffect } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c",
};

const DIM_META = {
  environmental: { label:"Environmental", icon:"🌿", color:"#3ae0a2" },
  social:        { label:"Social",         icon:"👥", color:"#3a9ce0" },
  governance:    { label:"Governance",     icon:"⚖️",  color:"#e0a23a" },
  legacy:        { label:"Legacy",         icon:"🏛️", color:"#9c6ee0" },
};

const SCORE = { yes:1.0, partially:0.5, no:0.0 };

// ── AI question generation via Anthropic API ──────────────────────────────────
async function generateQuestions(activity, enabledDims) {
  // Build dimension list with their selected focus areas
  const dimDescriptions = enabledDims.map(d =>
    `${d.label} (focus areas: ${d.areas.join(", ")})`
  ).join("\n");

  const prompt = `You are a project sustainability assessor. A project activity has just been completed.

Activity: "${activity.name || activity.description || "Unnamed activity"}"
Phase: ${activity.phase || "Not specified"}
${activity.description && activity.description !== activity.name ? `Description: ${activity.description}` : ""}

Generate exactly one sustainability reflection question for each of the following dimensions. Each question must:
- Be specific to THIS activity (not generic)
- Be answerable with Yes / Partially / No
- Be concise (one sentence, under 20 words)
- Reflect the stated focus areas for that dimension

Dimensions:
${dimDescriptions}

Return ONLY a JSON object with dimension IDs as keys and questions as string values. Example format:
{"environmental":"question here","social":"question here"}

Return only the JSON, no markdown, no explanation.`;

  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error("API error " + res.status);
  const data = await res.json();
  const raw  = (data.content || []).map(b => b.text || "").join("").trim();
  const clean = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  const si = clean.indexOf("{");
  const ei = clean.lastIndexOf("}");
  if (si === -1 || ei === -1) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(si, ei + 1));
}

// ── Fallback questions if API fails ──────────────────────────────────────────
const FALLBACK = {
  environmental: "Did this activity minimise its environmental impact?",
  social:        "Did this activity create positive social value for participants?",
  governance:    "Was this activity conducted with transparency and accountability?",
  legacy:        "Will the outputs of this activity benefit the project beyond completion?",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function SustainabilityPrompt({ activity, sustainConfig, onRecord, onSkip }) {
  // Build list of enabled dimensions with their selected focus areas
  const enabledDims = Object.entries(sustainConfig?.enabled || {})
    .filter(([, on]) => on)
    .map(([id]) => ({
      id,
      ...DIM_META[id],
      areas: sustainConfig?.selected?.[id] || [],
    }))
    .filter(d => d.label); // only known dimensions

  // If nothing is enabled, skip immediately
  if (!enabledDims.length) { onSkip?.(); return null; }

  return (
    <SustainabilityModal
      activity={activity}
      enabledDims={enabledDims}
      onRecord={onRecord}
      onSkip={onSkip}
    />
  );
}

function SustainabilityModal({ activity, enabledDims, onRecord, onSkip }) {
  const [questions, setQuestions] = useState(null);   // null = loading
  const [error,     setError]     = useState(false);  // true = fell back
  const [answers,   setAnswers]   = useState({});     // { dimId: "yes"|"partially"|"no" }

  // Generate questions on mount
  useEffect(() => {
    let cancelled = false;
    generateQuestions(activity, enabledDims)
      .then(qs => {
        if (!cancelled) setQuestions(qs);
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback to hardcoded questions
          const fb = {};
          enabledDims.forEach(d => { fb[d.id] = FALLBACK[d.id] || `Did this activity address ${d.label.toLowerCase()} considerations?`; });
          setQuestions(fb);
          setError(true);
        }
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const setAnswer = (dimId, val) => setAnswers(prev => ({ ...prev, [dimId]: val }));

  const allAnswered = enabledDims.every(d => answers[d.id]);

  const handleSubmit = () => {
    if (!allAnswered) return;
    // Record one evidence entry per dimension
    const records = enabledDims.map(d => ({
      dimId:        d.id,
      area:         d.areas.length > 0 ? d.areas[0] : d.label,
      areas:        d.areas,
      question:     questions[d.id] || FALLBACK[d.id],
      answer:       answers[d.id],
      score:        SCORE[answers[d.id]] ?? 0,
      activityId:   activity._id,
      activityName: activity.name || activity.description,
    }));
    onRecord(records);
  };

  const OPTIONS = ["yes", "partially", "no"];
  const OPT_LABELS = { yes:"Yes", partially:"Partially", no:"No" };
  const OPT_SCORES = { yes:"1.0", partially:"0.5", no:"0.0" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1001,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:10, width:"100%", maxWidth:680, overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ background:"rgba(46,125,82,0.12)", borderBottom:`1px solid ${C.border}`,
          padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:18 }}>🌱</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.accentL, textTransform:"uppercase", letterSpacing:".5px" }}>
              Sustainability Review
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
              {activity.name || activity.description || "Activity"} · {activity.phase || ""}
            </div>
          </div>
          {error && (
            <div style={{ fontSize:9, color:C.muted, background:C.surface2, padding:"2px 8px", borderRadius:10, border:`1px solid ${C.border}` }}>
              Standard questions
            </div>
          )}
          <button onClick={onSkip}
            style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18, lineHeight:1 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:"16px 20px" }}>

          {/* Loading state */}
          {!questions && (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"24px 0", justifyContent:"center" }}>
              <div style={{ width:18, height:18, border:`2px solid ${C.border}`, borderTopColor:C.accentL,
                borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
              <div style={{ fontSize:12, color:C.muted }}>Generating sustainability questions…</div>
            </div>
          )}

          {/* Questions table */}
          {questions && (
            <>
              <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.5 }}>
                Reflect on this activity across each enabled sustainability dimension. Select one answer per row.
              </div>

              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 90px",
                gap:4, marginBottom:6, padding:"0 4px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px" }}>
                  Dimension & Question
                </div>
                {OPTIONS.map(o => (
                  <div key={o} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase",
                    letterSpacing:".4px", textAlign:"center" }}>
                    {OPT_LABELS[o]}
                    <div style={{ fontSize:8, color:C.muted, fontWeight:400 }}>{OPT_SCORES[o]}</div>
                  </div>
                ))}
              </div>

              {/* One row per enabled dimension */}
              {enabledDims.map(d => {
                const question = questions[d.id] || FALLBACK[d.id] || `Did this activity address ${d.label}?`;
                const answered = answers[d.id];
                return (
                  <div key={d.id} style={{
                    display:"grid", gridTemplateColumns:"1fr 90px 90px 90px",
                    gap:4, marginBottom:8, padding:"10px 12px",
                    background: answered ? `${d.color}08` : C.surface2,
                    border:`1px solid ${answered ? d.color + "44" : C.border}`,
                    borderLeft:`3px solid ${d.color}`,
                    borderRadius:6, alignItems:"center", transition:"all .2s",
                  }}>
                    {/* Dimension label + question */}
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:13 }}>{d.icon}</span>
                        <span style={{ fontSize:10, fontWeight:700, color:d.color, textTransform:"uppercase", letterSpacing:".4px" }}>
                          {d.label}
                        </span>
                        {d.areas.length > 0 && (
                          <span style={{ fontSize:8, color:C.muted }}>· {d.areas[0]}{d.areas.length > 1 ? ` +${d.areas.length-1}` : ""}</span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:C.sage, lineHeight:1.5 }}>{question}</div>
                    </div>

                    {/* Answer tick columns */}
                    {OPTIONS.map(opt => {
                      const selected = answered === opt;
                      return (
                        <div key={opt} style={{ display:"flex", justifyContent:"center" }}>
                          <button onClick={() => setAnswer(d.id, opt)}
                            style={{
                              width:34, height:34, borderRadius:6, cursor:"pointer",
                              border:`2px solid ${selected ? d.color : C.border}`,
                              background: selected ? `${d.color}22` : "none",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:15, transition:"all .15s",
                              color: selected ? d.color : C.muted,
                            }}>
                            {selected ? "✓" : ""}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Progress indicator */}
              <div style={{ fontSize:11, color:C.muted, marginBottom:14, textAlign:"right" }}>
                {Object.keys(answers).length} of {enabledDims.length} answered
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={onSkip}
                  style={{ flex:1, padding:"9px", background:"none", border:`1px solid ${C.border}`,
                    borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer" }}>
                  Skip all
                </button>
                <button onClick={handleSubmit} disabled={!allAnswered}
                  style={{ flex:3, padding:"9px", borderRadius:5, border:"none",
                    background: allAnswered ? C.accent : C.surface2,
                    color: allAnswered ? "#fff" : C.muted,
                    fontSize:12, fontWeight:700,
                    cursor: allAnswered ? "pointer" : "not-allowed",
                    transition:"all .2s" }}>
                  {allAnswered ? "Record Sustainability Evidence →" : `Answer all ${enabledDims.length} questions to continue`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// Keep named export so any existing imports don't break
export { DIM_META };
