import { useState } from "react";
import { generateLoginCode, generateExternalCode } from "../../store/appStore.js";

const C = { surface:"#122E1E", surface2:"#183D28", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c", milestone:"#e0a23a" };
const inp = { width:"100%", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, color:C.sage, fontSize:12, padding:"7px 10px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

// ── Expanded role catalogue — matches ProjectSetup wizard ROLE_GROUPS ─────────
const PM_ROLES = [
  // Governance
  "Project Manager","Project Sponsor","Senior Responsible Owner","Project Board Member","Independent Assessor",
  // Management
  "Assistant Project Manager","Project Coordinator","Project Scheduler","Project Controller","Document Controller",
  // Risk & Quality
  "Risk Owner","Change Manager","Quality Assurance Lead","Health & Safety Advisor",
  // Technical
  "Technical Lead","Technical Lead 1","Technical Lead 2","Design Manager","Site Manager",
  "Software Developer","Construction Manager",
  // Business
  "Finance Lead","Procurement Lead","Commercial Manager","Business Analyst",
  // People
  "Communications Lead","Stakeholder Liaison","Marketing Lead","Training Lead",
  // Research
  "Research Coordinator","Subject Matter Expert","Data Manager","Impact Assessor",
];

const DEL_ROLES = [
  "Content Curator","Research Coordinator","Communications Coordinator","Marketing Lead",
  "Data Analyst","Design Lead","Outreach Lead","Technical Specialist","Partnership Lead","Editorial Lead",
];

// ── Governance tier mapping — expanded to cover all roles ────────────────────
const GOV_TIERS = {
  "Project Sponsor":            "Tier 1 — Sponsor",
  "Senior Responsible Owner":   "Tier 1 — Sponsor",
  "Project Board Member":       "Tier 1 — Sponsor",
  "Independent Assessor":       "Tier 2 — Mentor / Assessor",
  "Project Manager":            "Tier 3 — Project Manager",
  "Assistant Project Manager":  "Tier 3 — Project Manager",
  "Project Controller":         "Tier 3 — Project Manager",
  "Change Manager":             "Tier 3 — Project Manager",
  "Project Scheduler":          "Tier 4 — Project Team",
  "Risk Owner":                 "Tier 4 — Project Team",
  "Communications Lead":        "Tier 4 — Project Team",
  "Quality Assurance Lead":     "Tier 4 — Project Team",
  "Finance Lead":               "Tier 4 — Project Team",
  "Procurement Lead":           "Tier 4 — Project Team",
  "Document Controller":        "Tier 4 — Project Team",
  "Technical Lead":             "Tier 4 — Project Team",
  "Technical Lead 1":           "Tier 4 — Project Team",
  "Technical Lead 2":           "Tier 4 — Project Team",
  "Research Coordinator":       "Tier 4 — Project Team",
  "Marketing Lead":             "Tier 4 — Project Team",
  "Stakeholder Liaison":        "Tier 4 — Project Team",
};

const EXTERNAL_TYPES = [
  { value:"sponsor",  label:"Sponsor",  color:C.accentL,   desc:"Final governance authority. Read access to all project data." },
  { value:"guest",    label:"Guest",    color:C.milestone,  desc:"Observer access. Can view reporting layer only." },
  { value:"observer", label:"Observer", color:C.muted,     desc:"Read-only access to summary view." },
];

export default function Sheet02Team({ data, locked, loginCodes, project, onUpdate }) {
  // Fully controlled — derived from props every render. No stale local copy:
  // background extraction or wizard writes to teamMembers are always reflected,
  // and a local edit can never overwrite them with an outdated snapshot.
  const members = (data.teamMembers && data.teamMembers.length > 0)
    ? data.teamMembers
    : loginCodes.map(lc => ({
        loginCode: lc.loginCode, name: lc.name||"", role: lc.role||"",
        deliveryRole: lc.deliveryRole||"", availability:"80%", responsibilities:"", location:"",
      }));

  const external = data.externalUsers || [];
  const [copied, setCopied] = useState(null); // UI-only state

  const update = (idx, field, value) => {
    const next = members.map((m,i) => i===idx ? {...m,[field]:value} : m);
    onUpdate({ teamMembers:next, externalUsers:external }, "in-progress");
  };

  const addMember = () => {
    // Use unified generateLoginCode from appStore — deduplicates correctly
    const existingCodes = [
      ...members.map(m => m.loginCode).filter(Boolean),
      ...external.map(u => u.loginCode).filter(Boolean),
    ];
    const code = generateLoginCode(project?.code || "NC", existingCodes);
    const next = [...members, {
      loginCode:code, name:"", role:"", deliveryRole:"",
      availability:"80%", location:"", responsibilities:"",
    }];
    onUpdate({ teamMembers:next, externalUsers:external }, "in-progress");
    // Note: App.jsx handleSheetUpdate("02") automatically syncs to l2.loginCodes.
  };

  const removeMember = (idx) => {
    if (idx === 0) return; // protect PM row
    const next = members.filter((_,i) => i !== idx);
    onUpdate({ teamMembers:next, externalUsers:external }, "in-progress");
  };

  // ── External user management ──────────────────────────────────────────────
  const addExternal = (type) => {
    const next = [...external, { id:`ext-${Date.now()}`, type, name:"", loginCode:"", generatedAt:"" }];
    onUpdate({ teamMembers:members, externalUsers:next }, "in-progress");
  };

  const updateExternal = (idx, field, value) => {
    const next = external.map((u,i) => i===idx ? {...u,[field]:value} : u);
    onUpdate({ teamMembers:members, externalUsers:next }, "in-progress");
  };

  const generateExCode = (idx) => {
    const user  = external[idx];
    const allCodes = [
      ...members.map(m => m.loginCode),
      ...external.map(u => u.loginCode),
    ].filter(Boolean);
    const code  = generateExternalCode(user.type, allCodes);
    const today = new Date().toLocaleDateString("en-GB");
    const next  = external.map((u,i) => i===idx ? {...u,loginCode:code,generatedAt:today} : u);
    onUpdate({ teamMembers:members, externalUsers:next }, "in-progress");
  };

  const removeExternal = (idx) => {
    const next = external.filter((_,i) => i !== idx);
    onUpdate({ teamMembers:members, externalUsers:next }, "in-progress");
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).catch(()=>{});
    setCopied(code);
    setTimeout(() => setCopied(null), 2500);
  };

  const Lbl = ({children}) => (
    <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", marginBottom:3 }}>{children}</div>
  );

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ fontSize:11, color:C.accentL, marginBottom:10 }}>
        Team members can be added at any time. The PM login code and role cannot be changed after approval.
      </div>

      {/* Governance hierarchy */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 16px", marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Governance Hierarchy</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            ["Tier 1","Sponsor","Final authority — approves charter, scope changes, gate sign-offs"],
            ["Tier 2","Mentor / Assessor","Independent assurance — reviews documents"],
            ["Tier 3","Project Manager","Day-to-day authority — manages schedule, risk, comms"],
            ["Tier 4","Project Team","Deliver agreed tasks within scope — escalate issues to PM"],
          ].map(([t,r,d]) => (
            <div key={t} style={{ background:C.surface2, borderRadius:6, padding:"8px 10px" }}>
              <div style={{ fontSize:9, color:C.accentL, fontWeight:700, marginBottom:2 }}>{t}</div>
              <div style={{ fontSize:11, color:C.sage, fontWeight:600, marginBottom:3 }}>{r}</div>
              <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team register */}
      <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:12 }}>
        Team Register — Dual-Capacity Model
      </div>

      {members.map((m,i) => (
        <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 14px", marginBottom:8,
          borderLeft:i===0?`3px solid ${C.accentL}`:`3px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontFamily:"monospace", fontSize:12, color:C.accentL, fontWeight:700, background:C.surface2, padding:"4px 10px", borderRadius:5, border:`1px solid ${C.border}` }}>
              {m.loginCode || "—"}
            </div>
            {i===0 && <div style={{ fontSize:10, color:C.accentL }}>Project Manager · Full Access</div>}
            {m.role && GOV_TIERS[m.role] && <div style={{ fontSize:10, color:C.muted, marginLeft:"auto" }}>{GOV_TIERS[m.role]}</div>}
            {i>0 && !locked && (
              <button onClick={()=>removeMember(i)} style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13 }}>✕</button>
            )}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div>
              <Lbl>Full Name</Lbl>
              <input style={inp} value={m.name||""} disabled={i===0||locked}
                onChange={e=>update(i,"name",e.target.value)} placeholder="Full name"/>
            </div>
            <div>
              <Lbl>PM / Governance Role</Lbl>
              <select style={inp} value={m.role||""} disabled={i===0||locked}
                onChange={e=>update(i,"role",e.target.value)}>
                <option value="">Select...</option>
                {PM_ROLES.map(r => <option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Delivery / Technical Role</Lbl>
              <select style={inp} value={m.deliveryRole||""} disabled={locked}
                onChange={e=>update(i,"deliveryRole",e.target.value)}>
                <option value="">Select...</option>
                {DEL_ROLES.map(r => <option key={r} value={r} style={{background:C.surface2}}>{r}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Availability</Lbl>
              <select style={inp} value={m.availability||"80%"} disabled={locked}
                onChange={e=>update(i,"availability",e.target.value)}>
                {["100%","80%","60%","50%","Part-time","Ad hoc"].map(v =>
                  <option key={v} value={v} style={{background:C.surface2}}>{v}</option>
                )}
              </select>
            </div>
            <div>
              <Lbl>Location</Lbl>
              <input style={inp} value={m.location||""} disabled={locked}
                onChange={e=>update(i,"location",e.target.value)} placeholder="City / Remote"/>
            </div>
            <div>
              <Lbl>Primary Responsibilities</Lbl>
              <input style={inp} value={m.responsibilities||""} disabled={locked}
                onChange={e=>update(i,"responsibilities",e.target.value)} placeholder="Brief summary"/>
            </div>
          </div>
        </div>
      ))}

      {!locked && (
        <button onClick={addMember}
          style={{ padding:"8px 14px", background:"none", border:`1px dashed ${C.border}`,
            borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", width:"100%", marginTop:4, marginBottom:20 }}>
          + Add Team Member
        </button>
      )}

      {/* External & Guest Access */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>
          External & Guest Access
        </div>
        <div style={{ fontSize:11, color:C.dim, marginBottom:12, lineHeight:1.6 }}>
          Add sponsors, guests, and observers here. Login codes can be generated at any time
          and shared directly with the person to give them access to the platform.
          {locked && <span style={{ color:C.accentL }}> Project is live — new codes can be generated and shared immediately.</span>}
        </div>

        {external.length === 0 && (
          <div style={{ color:C.muted, fontSize:11, marginBottom:12, fontStyle:"italic" }}>No external users added yet.</div>
        )}

        {external.map((u,i) => {
          const typeInfo = EXTERNAL_TYPES.find(t=>t.value===u.type) || EXTERNAL_TYPES[1];
          const hasCode  = !!u.loginCode;
          return (
            <div key={u.id||i} style={{ background:C.surface, border:`1px solid ${C.border}`,
              borderLeft:`3px solid ${typeInfo.color}`, borderRadius:7, padding:"12px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:12,
                  background:typeInfo.color+"22", color:typeInfo.color, border:`1px solid ${typeInfo.color}44` }}>
                  {typeInfo.label}
                </span>
                {hasCode && (
                  <div style={{ fontFamily:"monospace", fontSize:12, color:typeInfo.color, fontWeight:700,
                    background:C.surface2, padding:"3px 10px", borderRadius:5, border:`1px solid ${C.border}` }}>
                    {u.loginCode}
                  </div>
                )}
                {hasCode && (
                  <button onClick={()=>copyCode(u.loginCode)}
                    style={{ padding:"3px 10px", background:copied===u.loginCode?C.accent:"none",
                      border:`1px solid ${C.border}`, borderRadius:4, color:copied===u.loginCode?"#fff":C.dim,
                      fontSize:10, cursor:"pointer", transition:"all .2s" }}>
                    {copied===u.loginCode ? "✓ Copied!" : "Copy code"}
                  </button>
                )}
                {u.generatedAt && <span style={{ fontSize:9, color:C.muted }}>Generated {u.generatedAt}</span>}
                <button onClick={()=>removeExternal(i)}
                  style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13 }}>✕</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><Lbl>Name</Lbl>
                  <input style={inp} value={u.name||""} onChange={e=>updateExternal(i,"name",e.target.value)}
                    placeholder={`${typeInfo.label} name`}/>
                </div>
                <div><Lbl>Access type</Lbl>
                  <select style={inp} value={u.type} onChange={e=>updateExternal(i,"type",e.target.value)}>
                    {EXTERNAL_TYPES.map(t =>
                      <option key={t.value} value={t.value} style={{background:C.surface2}}>{t.label} — {t.desc}</option>
                    )}
                  </select>
                </div>
              </div>
              <div style={{ fontSize:10, color:C.muted, marginBottom:10 }}>{typeInfo.desc}</div>
              <button onClick={()=>generateExCode(i)}
                style={{ padding:"6px 14px", background:hasCode?"none":C.accent,
                  border:`1px solid ${hasCode?C.border:C.accent}`, borderRadius:5,
                  color:hasCode?C.muted:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                {hasCode ? "↻ Regenerate Login Code" : "Generate Login Code"}
              </button>
              {hasCode && (
                <span style={{ marginLeft:10, fontSize:10, color:C.muted }}>
                  Share <span style={{ fontFamily:"monospace", color:typeInfo.color }}>{u.loginCode}</span> with {u.name||"this person"} to give them access.
                </span>
              )}
            </div>
          );
        })}

        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          {EXTERNAL_TYPES.map(t => (
            <button key={t.value} onClick={()=>addExternal(t.value)}
              style={{ padding:"6px 14px", background:"none", border:`1px dashed ${t.color}44`,
                borderRadius:5, color:t.color, fontSize:11, cursor:"pointer" }}>
              + Add {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rights model */}
      <div style={{ marginTop:4, background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"12px 16px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>Rights Model</div>
        <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>
          Rights are tied to Element IDs via the RACI matrix — not to registers.
          Complete the RACI sheet to assign element-level permissions per team member.
          The Project Manager ({members[0]?.loginCode}) retains full access to all elements.
          External users (Sponsors / Guests / Observers) have read-only access to the reporting layer by default.
        </div>
      </div>
    </div>
  );
}
