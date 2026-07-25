import { useEffect, useState } from "react";

const C = { bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a" };
const inp = { width:"100%", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, color:C.sage, fontSize:13, padding:"9px 12px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const Lbl = ({ children }) => <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:5 }}>{children}</div>;
const Section = ({ title, sub }) => (
  <div style={{ borderBottom:`1px solid ${C.border}`, paddingBottom:6, marginBottom:14, marginTop:24 }}>
    <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px" }}>{title}</div>
    {sub && <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub}</div>}
  </div>
);

const BENEFIT_CATEGORIES = ["Strategic","Operational","Financial","Stakeholder","Community","Environmental","Knowledge","Capability","Reputational","Social"];

function nextNumberedId(arr, prefix) {
  const max = (arr || []).reduce((highest, item) => {
    const n = parseInt(String(item?._id || "").replace(`${prefix}-`, ""), 10);
    return Number.isFinite(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3,"0")}`;
}
function makeBenId(arr) { return nextNumberedId(arr, "BEN"); }
function makeObjId(arr) { return nextNumberedId(arr, "OBJ"); }
function blankBenefit(arr) {
  return { _id: makeBenId(arr), name:"", description:"", category:"Strategic", owner:"", targetDate:"", objectives:[] };
}
function blankObjective(arr) {
  return { _id: makeObjId(arr), objective:"", successCriterion:"", targetDate:"" };
}

function safeObjective(o) {
  return {
    _id:              o._id              || makeObjId([]),
    objective:        o.objective        || "",
    successCriterion: o.successCriterion || "",
    targetDate:       o.targetDate       || "",
  };
}

function safeBenefit(b, idx) {
  return {
    _id:             b._id             || `BEN-${String(idx+1).padStart(3,"0")}`,
    name:            b.name            || "",
    description:     b.description     || "",
    category:        b.category        || "Strategic",
    owner:           b.owner           || "",
    targetDate:      b.targetDate      || "",
    sustainmentPlan: b.sustainmentPlan || "",
    lessonsLearned:  b.lessonsLearned  || "",
    objectives:      (b.objectives     || []).map(safeObjective),
  };
}

export default function Sheet01Charter({ data, locked, onUpdate }) {
  const c = data.charter || {};
  const buildForm = (charter) => ({
    projectName:        charter.projectName        || "",
    projectCode:        charter.projectCode        || "",
    projectManager:     charter.projectManager     || "",
    projectSponsor:     charter.projectSponsor     || "",
    organisation:       charter.organisation       || "",
    startDate:          charter.startDate          || "",
    endDate:            charter.endDate            || "",
    budget:             charter.budget             || "",
    purpose:            charter.purpose            || "",
    problemStatement:   charter.problemStatement   || "",
    strategicAlignment: charter.strategicAlignment || "",
    withinScope:        (charter.withinScope  || []).join("\n"),
    outOfScope:         (charter.outOfScope   || []).join("\n"),
  });

  const [form, setForm] = useState(() => buildForm(c));

  // Benefits (with nested objectives) — migrate old flat objectives if benefits not yet defined
  const [benefits, setBenefits] = useState(() => {
    if (c.benefits && c.benefits.length > 0) return c.benefits.map(safeBenefit);
    return [];
  });

  useEffect(() => {
    setForm(buildForm(c));
    setBenefits(c.benefits && c.benefits.length > 0 ? c.benefits.map(safeBenefit) : []);
  }, [data.charter]);

  // ── Persist helpers ────────────────────────────────────────────────────────
  const persist = (nextForm, nextBenefits) => {
    onUpdate({
      charter: {
        ...nextForm,
        withinScope: nextForm.withinScope.split("\n").filter(Boolean),
        outOfScope:  nextForm.outOfScope.split("\n").filter(Boolean),
        benefits:    nextBenefits,
      },
    }, "in-progress");
  };

  const setField = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    persist(next, benefits);
  };

  // ── Benefit CRUD ──────────────────────────────────────────────────────────
  const addBenefit = () => {
    const next = [...benefits, blankBenefit(benefits)];
    setBenefits(next);
    persist(form, next);
  };
  const removeBenefit = (bi) => {
    const next = benefits.filter((_, i) => i !== bi);
    setBenefits(next);
    persist(form, next);
  };
  const updateBenefit = (bi, field, val) => {
    const next = benefits.map((b, i) => i === bi ? { ...b, [field]: val } : b);
    setBenefits(next);
    persist(form, next);
  };

  // ── Objective CRUD (nested inside benefit) ────────────────────────────────
  const addObjective = (bi) => {
    const next = benefits.map((b, i) => {
      if (i !== bi) return b;
      return { ...b, objectives: [...b.objectives, blankObjective(b.objectives)] };
    });
    setBenefits(next);
    persist(form, next);
  };
  const removeObjective = (bi, oi) => {
    const next = benefits.map((b, i) => {
      if (i !== bi) return b;
      return { ...b, objectives: b.objectives.filter((_, j) => j !== oi) };
    });
    setBenefits(next);
    persist(form, next);
  };
  const updateObjective = (bi, oi, field, val) => {
    const next = benefits.map((b, i) => {
      if (i !== bi) return b;
      return { ...b, objectives: b.objectives.map((o, j) => j === oi ? { ...o, [field]: val } : o) };
    });
    setBenefits(next);
    persist(form, next);
  };

  return (
    <div style={{ maxWidth:760 }}>

      {/* ── General Information ── */}
      <Section title="General Information" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        {[
          ["projectName","Project Name"],["projectCode","Project Code"],
          ["projectManager","Project Manager"],["projectSponsor","Project Sponsor"],
          ["organisation","Organisation"],["budget","Total Budget"],
        ].map(([k, l]) => (
          <div key={k}>
            <Lbl>{l}</Lbl>
            <input style={inp} value={form[k]} disabled={locked} onChange={e => setField(k, e.target.value)} placeholder={`Enter ${l.toLowerCase()}`}/>
          </div>
        ))}
        <div>
          <Lbl>Start Date</Lbl>
          <input style={inp} type="date" value={form.startDate} disabled={locked} onChange={e => setField("startDate", e.target.value)}/>
        </div>
        <div>
          <Lbl>End Date</Lbl>
          <input style={inp} type="date" value={form.endDate} disabled={locked} onChange={e => setField("endDate", e.target.value)}/>
        </div>
      </div>

      {/* ── Purpose & Problem ── */}
      <Section title="Purpose & Problem" />
      {[
        ["purpose",            "Purpose — What will this project produce or achieve?"],
        ["problemStatement",   "Problem Statement — What issue does this project address?"],
        ["strategicAlignment", "Strategic Alignment — Which organisational goals does this support?"],
      ].map(([k, l]) => (
        <div key={k} style={{ marginBottom:12 }}>
          <Lbl>{l}</Lbl>
          <textarea style={{ ...inp, resize:"vertical", minHeight:60, lineHeight:1.5 }} value={form[k]} disabled={locked} onChange={e => setField(k, e.target.value)} placeholder="Enter details..."/>
        </div>
      ))}

      {/* ── Scope ── */}
      <Section title="Scope" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div>
          <Lbl>Within Scope (one per line)</Lbl>
          <textarea style={{ ...inp, resize:"vertical", minHeight:80, lineHeight:1.6 }} value={form.withinScope} disabled={locked} onChange={e => setField("withinScope", e.target.value)} placeholder="1. Item one&#10;2. Item two"/>
        </div>
        <div>
          <Lbl>Out of Scope (one per line)</Lbl>
          <textarea style={{ ...inp, resize:"vertical", minHeight:80, lineHeight:1.6 }} value={form.outOfScope} disabled={locked} onChange={e => setField("outOfScope", e.target.value)} placeholder="1. Item one&#10;2. Item two"/>
        </div>
      </div>

      {/* ── Benefits ── */}
      <Section
        title="Benefits"
        sub="Define the value this project is intended to realise. Each benefit may contain one or more objectives that must be achieved to realise it."
      />

      {benefits.length === 0 && (
        <div style={{ fontSize:12, color:C.muted, fontStyle:"italic", marginBottom:12 }}>
          No benefits defined yet. Add a benefit below to begin structuring project value.
        </div>
      )}

      {benefits.map((b, bi) => (
        <div key={b._id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`4px solid ${C.milestone}`, borderRadius:8, padding:"14px 16px", marginBottom:14 }}>

          {/* Benefit header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.milestone, fontWeight:700 }}>{b._id}</div>
            <div style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:C.milestone+"22", color:C.milestone, border:`1px solid ${C.milestone}44` }}>{b.category}</div>
            <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
              {!locked && (
                <button onClick={() => removeBenefit(bi)} style={{ background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:13 }}>✕</button>
              )}
            </div>
          </div>

          {/* Benefit fields */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Lbl>Benefit Name</Lbl>
              <input style={inp} value={b.name} disabled={locked} onChange={e => updateBenefit(bi, "name", e.target.value)} placeholder="e.g. Improve student employability"/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <Lbl>Description — What measurable improvement will be achieved?</Lbl>
              <textarea style={{ ...inp, resize:"vertical", minHeight:52, lineHeight:1.5 }} value={b.description} disabled={locked} onChange={e => updateBenefit(bi, "description", e.target.value)} placeholder="Describe the expected improvement and how it will be evidenced"/>
            </div>
            <div>
              <Lbl>Category</Lbl>
              <select style={inp} value={b.category} disabled={locked} onChange={e => updateBenefit(bi, "category", e.target.value)}>
                {BENEFIT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Benefit Owner</Lbl>
              <input style={inp} value={b.owner} disabled={locked} onChange={e => updateBenefit(bi, "owner", e.target.value)} placeholder="Who is responsible for realising this benefit?"/>
            </div>
            <div>
              <Lbl>Target Realisation Date</Lbl>
              <input style={inp} type="date" value={b.targetDate||""} disabled={locked} onChange={e => updateBenefit(bi, "targetDate", e.target.value)}/>
            </div>
            <div>
              <Lbl>Evidence / Sustainment Plan</Lbl>
              <input style={inp} value={b.sustainmentPlan||""} disabled={locked} onChange={e => updateBenefit(bi, "sustainmentPlan", e.target.value)} placeholder="How will this benefit be evidenced and sustained?"/>
            </div>
          </div>

          {/* Nested Objectives */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:10 }}>
              Objectives — what must be achieved to realise this benefit
            </div>

            {b.objectives.length === 0 && (
              <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:8 }}>No objectives yet for this benefit.</div>
            )}

            {b.objectives.map((o, oi) => (
              <div key={o._id} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accentL}`, borderRadius:6, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ fontFamily:"monospace", fontSize:10, color:C.accentL }}>{o._id}</div>
                  {!locked && b.objectives.length > 0 && (
                    <button onClick={() => removeObjective(bi, oi)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.risk, cursor:"pointer", fontSize:12 }}>✕</button>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <Lbl>Objective</Lbl>
                    <input style={inp} value={o.objective} disabled={locked} onChange={e => updateObjective(bi, oi, "objective", e.target.value)} placeholder="State the objective clearly"/>
                  </div>
                  <div>
                    <Lbl>Success Criterion / KPI</Lbl>
                    <input style={inp} value={o.successCriterion} disabled={locked} onChange={e => updateObjective(bi, oi, "successCriterion", e.target.value)} placeholder="How will success be measured?"/>
                  </div>
                  <div>
                    <Lbl>Target Date</Lbl>
                    <input style={inp} type="date" value={o.targetDate||""} disabled={locked} onChange={e => updateObjective(bi, oi, "targetDate", e.target.value)}/>
                  </div>
                </div>
              </div>
            ))}

            {!locked && (
              <button onClick={() => addObjective(bi)} style={{ padding:"6px 12px", background:"none", border:`1px dashed ${C.border}`, borderRadius:5, color:C.dim, fontSize:11, cursor:"pointer", width:"100%", marginTop:4 }}>
                + Add Objective to {b.name || b._id}
              </button>
            )}
          </div>
        </div>
      ))}

      {!locked && (
        <button onClick={addBenefit} style={{ padding:"8px 16px", background:"none", border:`1px dashed ${C.milestone}`, borderRadius:6, color:C.milestone, fontSize:12, cursor:"pointer", width:"100%", marginBottom:8 }}>
          + Add Benefit
        </button>
      )}

    </div>
  );
}
