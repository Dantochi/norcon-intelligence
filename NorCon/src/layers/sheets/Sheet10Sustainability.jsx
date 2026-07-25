import { useEffect, useState } from "react";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2" };

const DIMENSIONS = [
  {
    id:"environmental", label:"Environmental", icon:"🌿", color:"#3ae0a2",
    desc:"Measures responsible use of resources during project delivery.",
    areas:["Resource Use","Travel","Waste","Digital Delivery"],
  },
  {
    id:"social", label:"Social", icon:"👥", color:"#5d8aff",
    desc:"Measures impact on people — accessibility, diversity, community benefit.",
    areas:["Accessibility","Diversity","Community Benefit","Wellbeing","Skills Development"],
  },
  {
    id:"governance", label:"Governance", icon:"⚖️", color:"#e0a23a",
    desc:"Measures responsible project management practice. Auto-captured from system behaviour.",
    areas:["Transparency","Accountability","Data Protection","Risk Management"],
    autoCapture: true,
  },
  {
    id:"legacy", label:"Legacy", icon:"🏛️", color:"#b87aff",
    desc:"Measures whether project outputs continue creating value beyond completion.",
    areas:["Knowledge Creation","Skills Transfer","Partnerships","Project Continuity"],
  },
];

const WEIGHTS = { environmental:25, social:35, governance:20, legacy:20 };

export default function Sheet10Sustainability({ data, locked, onUpdate }) {
  const [enabled,   setEnabled]   = useState(data.enabled   || {});
  const [selected,  setSelected]  = useState(data.selected  || {});
  const [actLinks,  setActLinks]  = useState(data.actLinks  || {});

  useEffect(() => {
    setEnabled(data.enabled || {});
    setSelected(data.selected || {});
    setActLinks(data.actLinks || {});
  }, [data.enabled, data.selected, data.actLinks]);

  const toggleDimension = (id) => {
    if (locked) return;
    const next = { ...enabled, [id]: !enabled[id] };
    setEnabled(next);
    onUpdate({ enabled:next, selected, actLinks }, 'in-progress');
  };

  const toggleArea = (dimId, area) => {
    if (locked) return;
    const cur  = selected[dimId] || [];
    const next = cur.includes(area) ? cur.filter(a=>a!==area) : [...cur, area];
    const nextSel = { ...selected, [dimId]: next };
    setSelected(nextSel);
    onUpdate({ enabled, selected:nextSel, actLinks }, 'in-progress');
  };

  const anyEnabled = Object.values(enabled).some(Boolean);

  return (
    <div style={{ maxWidth:860 }}>
      {/* Header */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:4 }}>Sustainability Tracker Setup</div>
        <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>
          Select which sustainability dimensions apply to this project. For each dimension, choose the focus areas to track.
          Governance evidence is captured automatically from system behaviour — no additional input required.
        </div>
        {/* Weights reference */}
        <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
          {DIMENSIONS.map(d=>(
            <div key={d.id} style={{ fontSize:10, color:C.muted, display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:d.color }}/>
              {d.label} <span style={{ color:d.color, fontWeight:700 }}>{WEIGHTS[d.id]}%</span>
            </div>
          ))}
          <div style={{ fontSize:10, color:C.muted, marginLeft:4 }}>weighted overall score</div>
        </div>
      </div>

      {/* Dimension cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {DIMENSIONS.map(dim => {
          const isOn = !!enabled[dim.id];
          const sel  = selected[dim.id] || [];
          return (
            <div key={dim.id} style={{
              background:C.surface, border:`1px solid ${isOn ? dim.color : C.border}`,
              borderRadius:8, overflow:"hidden",
              opacity: locked && !isOn ? 0.5 : 1,
            }}>
              {/* Dimension header */}
              <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10,
                background: isOn ? dim.color+"11" : "transparent",
                borderBottom: isOn ? `1px solid ${dim.color}33` : `1px solid ${C.border}`,
                cursor: locked ? "not-allowed" : "pointer",
              }} onClick={() => toggleDimension(dim.id)}>
                <span style={{ fontSize:20 }}>{dim.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color: isOn ? dim.color : C.sage }}>{dim.label}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{WEIGHTS[dim.id]}% of overall score</div>
                </div>
                {/* Toggle */}
                <div style={{
                  width:36, height:20, borderRadius:10,
                  background: isOn ? dim.color : C.surface2,
                  border:`1px solid ${isOn ? dim.color : C.border}`,
                  position:"relative", transition:"all .2s",
                }}>
                  <div style={{
                    width:14, height:14, borderRadius:"50%", background:"#fff",
                    position:"absolute", top:2,
                    left: isOn ? 18 : 2, transition:"left .2s",
                  }}/>
                </div>
              </div>

              {/* Focus areas */}
              {isOn && (
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:8 }}>{dim.desc}</div>
                  {dim.autoCapture && (
                    <div style={{ background:`${dim.color}11`, border:`1px solid ${dim.color}33`,
                      borderRadius:5, padding:"6px 10px", marginBottom:8, fontSize:11, color:dim.color }}>
                      ⚡ Auto-captured from system behaviour — no manual input needed
                    </div>
                  )}
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                    letterSpacing:".4px", marginBottom:6 }}>Focus Areas</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {dim.areas.map(area => {
                      const isSelected = sel.includes(area);
                      return (
                        <button key={area} onClick={() => toggleArea(dim.id, area)} disabled={locked}
                          style={{
                            padding:"4px 10px", borderRadius:20, fontSize:11,
                            border:`1px solid ${isSelected ? dim.color : C.border}`,
                            background: isSelected ? dim.color+"22" : "none",
                            color: isSelected ? dim.color : C.muted,
                            cursor: locked ? "not-allowed" : "pointer", fontWeight: isSelected ? 700 : 400,
                          }}>
                          {area}
                        </button>
                      );
                    })}
                  </div>
                  {!dim.autoCapture && sel.length === 0 && (
                    <div style={{ fontSize:10, color:C.risk, marginTop:6 }}>
                      Select at least one focus area to track this dimension.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyEnabled && (
        <div style={{ marginTop:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:7,
          padding:"12px 14px", fontSize:12, color:C.dim, lineHeight:1.6 }}>
          ✓ Sustainability tracking configured. When an activity is marked complete in the Operating Layer,
          a single micro-prompt will appear based on the activity's linked sustainability focus area.
          Governance evidence will be captured automatically.
        </div>
      )}
    </div>
  );
}
