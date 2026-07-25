import { useState } from "react";
import { IMPACT_OPTIONS, PRIORITY_OPTIONS } from "../../store/changeControl.js";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a",
};
const inp = {
  width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
  borderRadius:5, color:C.sage, fontSize:12, padding:"8px 10px",
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};

// Impact colour map. "No Impact" uses a distinct muted-sage tone to signal
// it is a positive explicit choice, not an unset state.
const IMPACT_COLORS = {
  Scope:     "#3a9962",
  Time:      "#e0a23a",
  Cost:      "#e05c5c",
  Quality:   "#3a9ce0",
  "No Impact": "#6a8c7a",
};

export default function CCRPopup({ change, existingCCRs, onSubmit, onAddToExisting, onMinor, onCancel, benefits }) {
  // Pre-fill justification when the CCR was raised from a Risk or Issue
  const [justification,  setJustification]  = useState(change?.prefillJustification || "");
  const [priority,       setPriority]       = useState("High");
  const [impacts,        setImpacts]        = useState([]);
  const [benefitImpacts, setBenefitImpacts] = useState({}); // { [benefitId]: { affected, note, benefitName } }
  const [error,          setError]          = useState("");
  const [showAddTo,      setShowAddTo]      = useState(false);
  const [selectedCCR,    setSelectedCCR]    = useState("");

  // Open CCRs that can be added to
  const openCCRs = (existingCCRs || []).filter(c =>
    c.type === "major" && c.status !== "approved" && c.status !== "rejected"
  );

  // "No Impact" is mutually exclusive with substantive impact areas.
  const toggleImpact = (imp) => {
    setError("");
    if (imp === "No Impact") {
      // Selecting No Impact clears all other selections (and toggles itself)
      setImpacts(prev => prev.includes("No Impact") ? [] : ["No Impact"]);
    } else {
      // Selecting any substantive impact removes No Impact
      setImpacts(prev => {
        const without = prev.filter(i => i !== "No Impact");
        return without.includes(imp)
          ? without.filter(i => i !== imp)
          : [...without, imp];
      });
    }
  };

  const handleSubmit = () => {
    if (!justification.trim()) { setError("Please provide a justification for this change."); return; }
    if (!impacts.length)       { setError("Please select at least one impact area, or choose 'No Impact'."); return; }
    const benefitImpactsList = Object.entries(benefitImpacts)
      .filter(([,v])=>v.affected)
      .map(([id,v])=>({ benefitId:id, benefitName:v.benefitName||"", note:v.note||"" }));
    onSubmit({ justification, priority, impacts, benefitImpacts: benefitImpactsList });
  };

  const handleAddTo = () => {
    if (!selectedCCR) { setError("Please select an existing CCR."); return; }
    onAddToExisting?.(selectedCCR, {
      description: change.description,
      fieldName:   change.fieldName,
      oldValue:    change.oldValue,
      newValue:    change.newValue,
    });
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }}>
      <div style={{
        background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
        width:"100%", maxWidth:520, overflow:"hidden",
        boxShadow:"0 20px 60px rgba(0,0,0,0.5)",
      }}>

        {/* Header */}
        <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"14px 20px" }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.sage, marginBottom:3 }}>
            ⚠️ Baseline Change Detected
          </div>
          <div style={{ fontSize:12, color:C.dim, lineHeight:1.5 }}>
            You have modified a baseline element. This requires a Change Request.
          </div>
        </div>

        <div style={{ padding:"20px" }}>

          {/* Auto-filled change details */}
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
              Change Details (Auto-generated)
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12, marginBottom:8 }}>
              <div><span style={{ color:C.muted }}>Date: </span><span style={{ color:C.sage }}>{change.date}</span></div>
              <div><span style={{ color:C.muted }}>Requested by: </span><span style={{ color:C.sage }}>{change.requestedBy}</span></div>
            </div>
            {change.changeList && change.changeList.length > 1 ? (
              <div>
                <div style={{ fontSize:10, color:C.muted, marginBottom:5 }}>Changes made ({change.changeList.length}):</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:100, overflowY:"auto" }}>
                  {change.changeList.map((c,i) => (
                    <div key={i} style={{ fontSize:11, color:C.dim, background:"rgba(255,255,255,0.03)",
                      borderRadius:4, padding:"3px 8px", borderLeft:`2px solid ${C.border}` }}>
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize:12 }}>
                <span style={{ color:C.muted }}>Change: </span>
                <span style={{ color:C.sage }}>{change.description}</span>
              </div>
            )}
          </div>

          {/* Impact checkboxes — force selection, No Impact is mutually exclusive */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.dim, marginBottom:4, textTransform:"uppercase", letterSpacing:".4px" }}>
              Impact Areas <span style={{ color:C.risk }}>*</span>
            </div>
            <div style={{ fontSize:10, color:C.muted, marginBottom:8 }}>
              Select all that apply, or choose <em>No Impact</em> if this change does not affect any baseline dimension.
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {IMPACT_OPTIONS.map(imp => {
                const selected = impacts.includes(imp);
                const col      = IMPACT_COLORS[imp];
                const isNone   = imp === "No Impact";
                return (
                  <button key={imp} onClick={() => toggleImpact(imp)}
                    style={{
                      padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
                      border:`1px solid ${selected ? col : C.border}`,
                      background: selected ? col+"22" : "none",
                      color: selected ? col : C.muted,
                      cursor:"pointer",
                      // Visual separator between substantive impacts and No Impact
                      marginLeft: isNone ? "auto" : 0,
                    }}>
                    {imp}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benefit Impact Assessment — shown when substantive impacts are selected and benefits exist */}
          {(benefits||[]).length > 0 && impacts.length > 0 && !impacts.includes("No Impact") && (
            <div style={{ marginBottom:14, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
              <div style={{ padding:"9px 12px", background:C.surface2, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.dim }}>📈 Benefit Impact</span>
                <span style={{ fontSize:10, color:C.muted }}>Which benefits does this change affect?</span>
              </div>
              <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
                {(benefits||[]).map(b => {
                  const bi = benefitImpacts[b._id] || {};
                  return (
                    <div key={b._id} style={{ display:"flex", alignItems:"flex-start", gap:10, paddingBottom:8, borderBottom:`1px solid ${C.border}22` }}>
                      <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", flexShrink:0, marginTop:1 }}>
                        <input type="checkbox" checked={!!bi.affected}
                          onChange={e=>setBenefitImpacts(prev=>({...prev,[b._id]:{...prev[b._id],affected:e.target.checked,benefitName:b.name}}))}
                          style={{ accentColor:C.accentL, cursor:"pointer" }}/>
                      </label>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:bi.affected?C.sage:C.muted, marginBottom:bi.affected?4:0 }}>{b.name||"Unnamed benefit"}</div>
                        {bi.affected && (
                          <input style={{...inp, fontSize:11}}
                            value={bi.note||""}
                            onChange={e=>setBenefitImpacts(prev=>({...prev,[b._id]:{...prev[b._id],note:e.target.value,benefitName:b.name}}))}
                            placeholder="How does this change affect this benefit? (optional)"/>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Priority */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.dim, marginBottom:6, textTransform:"uppercase", letterSpacing:".4px" }}>Priority</div>
            <div style={{ display:"flex", gap:8 }}>
              {PRIORITY_OPTIONS.map(p => {
                const cols = { High:C.risk, Medium:C.milestone, Low:C.accentL };
                const selected = priority === p;
                return (
                  <button key={p} onClick={() => setPriority(p)}
                    style={{
                      flex:1, padding:"7px", borderRadius:5, fontSize:12, fontWeight:600,
                      border:`1px solid ${selected ? cols[p] : C.border}`,
                      background: selected ? cols[p]+"22" : "none",
                      color: selected ? cols[p] : C.muted, cursor:"pointer",
                    }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Justification */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.dim, marginBottom:6, textTransform:"uppercase", letterSpacing:".4px" }}>
              Justification <span style={{ color:C.risk }}>*</span>
            </div>
            <textarea
              value={justification}
              onChange={e => { setJustification(e.target.value); setError(""); }}
              placeholder="Why is this change needed? What is the impact on the project?"
              style={{ ...inp, resize:"vertical", minHeight:80, lineHeight:1.5 }}/>
          </div>

          {/* Add to existing CCR — collapsible, only when open CCRs exist */}
          {openCCRs.length > 0 && (
            <div style={{ marginBottom:14, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden" }}>
              <button onClick={() => setShowAddTo(s=>!s)}
                style={{ width:"100%", padding:"9px 12px", background:C.surface2, border:"none",
                  color:C.dim, fontSize:11, fontWeight:600, cursor:"pointer", textAlign:"left",
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>➕ Add to an existing Change Request instead</span>
                <span style={{ color:C.muted }}>{showAddTo ? "▲" : "▼"}</span>
              </button>
              {showAddTo && (
                <div style={{ padding:"10px 12px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8, lineHeight:1.4 }}>
                    Use this when this change is a downstream consequence of a CCR already in progress
                    (e.g. a date shift caused by an approved scope change).
                  </div>
                  <select value={selectedCCR} onChange={e => { setSelectedCCR(e.target.value); setError(""); }}
                    style={inp}>
                    <option value="">Select existing CCR…</option>
                    {openCCRs.map(c => (
                      <option key={c.id} value={c.id} style={{ background:C.surface2 }}>
                        {c.id} — {(c.description||"").slice(0,55)}{(c.description||"").length>55?"…":""}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAddTo}
                    style={{ marginTop:8, width:"100%", padding:"8px", background:"none",
                      border:`1px solid ${C.milestone}`, borderRadius:5, color:C.milestone,
                      fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    Add to Selected CCR
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background:"rgba(224,92,92,0.1)", border:`1px solid ${C.risk}`, borderRadius:5, padding:"8px 12px", fontSize:12, color:"#ff9e9e", marginBottom:12 }}>
              {error}
            </div>
          )}

          {/* Primary actions */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onCancel}
              style={{ flex:1, padding:"9px", background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={onMinor}
              style={{ flex:1, padding:"9px", background:"none", border:`1px solid ${C.accentL}`, borderRadius:6, color:C.accentL, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              Log as Minor Update
            </button>
            <button onClick={handleSubmit}
              style={{ flex:2, padding:"9px", background:C.accent, border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Submit Change Request →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
