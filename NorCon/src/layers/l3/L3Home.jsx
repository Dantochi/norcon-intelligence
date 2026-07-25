import { useState } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", stakeholder:"#9c6ee0", milestone:"#e0a23a",
};

const SUB_PAGES = ["Project Brief","Project Team","Governance"];

const Card = ({children, style={}}) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 16px", ...style }}>{children}</div>
);
const SectionTitle = ({children}) => (
  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>{children}</div>
);
const Field = ({label, value}) => (
  <div style={{ marginBottom:8 }}>
    <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:2 }}>{label}</div>
    <div style={{ fontSize:13, color:C.sage }}>{value||"—"}</div>
  </div>
);

// Editable baseline field — accumulates dirty state on blur, no immediate CCR popup
function BaselineField({ label, value, fieldName, onSetDirty, multiline }) {
  const [localVal, setLocalVal] = useState(value||"");
  const [original]              = useState(value||"");

  const handleBlur = () => {
    if (String(localVal) !== String(original)) {
      const labels = {
        startDate:"Start Date", endDate:"End Date", budget:"Budget",
        purpose:"Purpose", withinScope:"Within Scope", outOfScope:"Out of Scope",
      };
      const lbl = labels[fieldName] || label;
      onSetDirty?.(`${lbl}: "${original}" → "${localVal}"`);
    }
  };

  const style = {
    width:"100%", background:"transparent", border:"none", borderBottom:`1px solid ${C.border}`,
    color:C.sage, fontSize:13, padding:"4px 0", outline:"none", fontFamily:"inherit",
    resize:"none", lineHeight:1.5,
  };

  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:10, color:C.accentL, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>
        {label} <span style={{ color:C.milestone, fontSize:8 }}>● baseline</span>
      </div>
      {multiline ? (
        <textarea value={localVal} onChange={e=>setLocalVal(e.target.value)} onBlur={handleBlur}
          style={{ ...style, minHeight:60 }}/>
      ) : (
        <input value={localVal} onChange={e=>setLocalVal(e.target.value)} onBlur={handleBlur}
          style={style}/>
      )}
    </div>
  );
}

export default function L3Home({ charter, stakeholders, teamMembers, isPM, onGoToL2, onBaselineBlur, onSetDirty }) {
  const [sub, setSub] = useState("Project Brief");

  // Pass onSetDirty down; fall back gracefully if neither prop present
  const handleDirty = onSetDirty || onBaselineBlur;

  return (
    <div style={{ padding:20 }}>
      {/* Sub-nav */}
      <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
        {SUB_PAGES.map(p => (
          <button key={p} onClick={()=>setSub(p)}
            style={{ padding:"5px 14px", borderRadius:5, border:"none", fontSize:12, fontWeight:600,
              background: sub===p ? C.accent : "none",
              color: sub===p ? "#fff" : C.muted, cursor:"pointer" }}>
            {p}
          </button>
        ))}
      </div>

      {sub === "Project Brief" && (
        <div style={{ maxWidth:800 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <Card>
              <SectionTitle>General</SectionTitle>
              <Field label="Project Name"    value={charter.projectName}/>
              <Field label="Project Code"    value={charter.projectCode}/>
              <Field label="Project Manager" value={charter.projectManager}/>
              <Field label="Project Sponsor" value={charter.projectSponsor}/>
              <Field label="Organisation"    value={charter.organisation}/>
            </Card>
            <Card>
              <SectionTitle>Timeline & Budget</SectionTitle>
              {handleDirty ? (
                <>
                  <BaselineField label="Start Date" value={charter.startDate} fieldName="startDate" onSetDirty={handleDirty}/>
                  <BaselineField label="End Date"   value={charter.endDate}   fieldName="endDate"   onSetDirty={handleDirty}/>
                  <BaselineField label="Budget"     value={charter.budget}    fieldName="budget"    onSetDirty={handleDirty}/>
                </>
              ) : (
                <>
                  <Field label="Start Date" value={charter.startDate}/>
                  <Field label="End Date"   value={charter.endDate}/>
                  <Field label="Budget"     value={charter.budget}/>
                </>
              )}
              {isPM && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                  <button onClick={onGoToL2}
                    style={{ fontSize:11, padding:"6px 12px", background:"none", border:`1px solid ${C.border}`,
                      borderRadius:5, color:C.muted, cursor:"pointer" }}>
                    ← Go to Personalisation Layer
                  </button>
                </div>
              )}
            </Card>

            <Card style={{ gridColumn:"1/-1" }}>
              <SectionTitle>Purpose</SectionTitle>
              {handleDirty ? (
                <BaselineField label="Purpose" value={charter.purpose} fieldName="purpose"
                  onSetDirty={handleDirty} multiline/>
              ) : (
                <div style={{ fontSize:13, color:C.sage, lineHeight:1.6 }}>{charter.purpose||"—"}</div>
              )}
            </Card>

            <Card style={{ gridColumn:"1/-1" }}>
              <SectionTitle>Problem Statement</SectionTitle>
              <div style={{ fontSize:13, color:C.sage, lineHeight:1.6 }}>{charter.problemStatement||"—"}</div>
            </Card>
          </div>

          {/* Scope — baseline fields */}
          {((charter.withinScope||[]).length > 0 || (charter.outOfScope||[]).length > 0) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Card>
                <SectionTitle>Within Scope</SectionTitle>
                {handleDirty ? (
                  <BaselineField label="Within Scope" value={(charter.withinScope||[]).join("\n")} fieldName="withinScope"
                    onSetDirty={handleDirty} multiline/>
                ) : (
                  (charter.withinScope||[]).map((s,i) => <div key={i} style={{ fontSize:12, color:C.dim, marginBottom:4 }}>✓ {s}</div>)
                )}
              </Card>
              <Card>
                <SectionTitle>Out of Scope</SectionTitle>
                {handleDirty ? (
                  <BaselineField label="Out of Scope" value={(charter.outOfScope||[]).join("\n")} fieldName="outOfScope"
                    onSetDirty={handleDirty} multiline/>
                ) : (
                  (charter.outOfScope||[]).map((s,i) => <div key={i} style={{ fontSize:12, color:C.muted, marginBottom:4 }}>✕ {s}</div>)
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {sub === "Stakeholders" && (
        <div style={{ maxWidth:900 }}>
          {stakeholders.length === 0 && <div style={{ color:C.muted, fontSize:13 }}>No stakeholders recorded yet.</div>}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:10 }}>
            {stakeholders.map((s,i) => {
              const ps = (((parseInt(s.power)||5)+(parseInt(s.influence)||5))/2*(parseInt(s.interest)||5)/10).toFixed(1);
              return (
                <Card key={i}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(156,110,224,0.15)",
                      border:`1px solid ${C.stakeholder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>👤</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.sage }}>{s.name||"—"}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{s.category||"—"}</div>
                    </div>
                    <div style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:C.stakeholder }}>★ {ps}</div>
                  </div>
                  <Field label="Contact"             value={s.contact}/>
                  <Field label="Engagement Strategy" value={s.engagementStrategy}/>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    {[["P",s.power],["I",s.interest],["In",s.influence],["E",s.ease]].map(([l,v])=>(
                      <div key={l} style={{ flex:1, textAlign:"center", background:C.surface2, borderRadius:5, padding:"4px 0" }}>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase" }}>{l}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:C.sage }}>{v||5}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {sub === "Project Team" && (
        <div style={{ maxWidth:800 }}>
          {teamMembers.length === 0 && <div style={{ color:C.muted, fontSize:13 }}>No team members registered yet.</div>}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10 }}>
            {teamMembers.map((m,i) => (
              <Card key={i} style={{ borderLeft: i===0 ? `3px solid ${C.accentL}` : `1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(46,125,82,0.15)",
                    border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>👤</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.sage }}>{m.name||"—"}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{m.role||"—"}</div>
                  </div>
                </div>
                <div style={{ fontFamily:"monospace", fontSize:12, color:C.accentL, background:"rgba(46,125,82,0.1)",
                  padding:"4px 8px", borderRadius:5, display:"inline-block", marginBottom:6 }}>{m.loginCode}</div>
                {m.deliveryRole  && <div style={{ fontSize:11, color:C.dim }}>Delivery: {m.deliveryRole}</div>}
                {m.availability  && <div style={{ fontSize:11, color:C.muted }}>Availability: {m.availability}</div>}
                {m.location      && <div style={{ fontSize:11, color:C.muted }}>Location: {m.location}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {sub === "Governance" && (
        <div style={{ maxWidth:800 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            {[
              ["Tier 1 — Sponsor",          "Final authority. Approves charter, scope changes, gate sign-offs.","#e0a23a"],
              ["Tier 2 — Mentor / Assessor", "Independent assurance. Reviews documents and deliverables.",       "#3a9ce0"],
              ["Tier 3 — Project Manager",   "Day-to-day authority. Manages schedule, risk, communications.",   "#3a9962"],
              ["Tier 4 — Project Team",      "Deliver agreed tasks within scope. Escalate issues to PM.",       "#8aac96"],
            ].map(([tier,desc,col])=>(
              <Card key={tier} style={{ borderLeft:`3px solid ${col}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:col, marginBottom:4 }}>{tier}</div>
                <div style={{ fontSize:12, color:C.dim, lineHeight:1.5 }}>{desc}</div>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle>Change Control Process</SectionTitle>
            <div style={{ display:"flex", gap:8, overflowX:"auto" }}>
              {[["1","Detect","Edit scope / time / cost"],["2","Navigate away","Leave-page prompt appears"],["3","CCR Created","Routed to Reviewer"],["4","PM Reviews","Checks impacted elements"],["5","Sponsor","Signs off baseline"],["6","Goes Live","All team notified"]].map(([n,t,d])=>(
                <div key={n} style={{ background:C.surface2, borderRadius:6, padding:"8px 10px", minWidth:100, flexShrink:0 }}>
                  <div style={{ fontSize:9, color:C.accentL, fontWeight:700, marginBottom:2 }}>Step {n}</div>
                  <div style={{ fontSize:11, color:C.sage, fontWeight:600, marginBottom:2 }}>{t}</div>
                  <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{d}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
