import { useState } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const STATUS_COLORS = {
  pending:  { color:C.milestone, label:"Pending"  },
  reviewed: { color:"#3a9ce0",   label:"Reviewed" },
  approved: { color:C.activity,  label:"Approved" },
  rejected: { color:C.risk,      label:"Rejected" },
};

function Badge({ status }) {
  const cfg = STATUS_COLORS[(status||"").toLowerCase()] || STATUS_COLORS.pending;
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
      background:cfg.color+"22", color:cfg.color, border:`1px solid ${cfg.color}55` }}>
      {cfg.label}
    </span>
  );
}

export default function L3ChangeControl({ changes, approvers, member }) {
  const [activeTab, setActiveTab] = useState("major");

  const majorChanges = (changes||[]).filter(c =>
    c.type === "major" || (!c.type && (c.id||"").startsWith("CCR"))
  );
  const minorChanges = (changes||[]).filter(c =>
    c.type === "minor" || (c.id||"").startsWith("MIN")
  );

  return (
    <div style={{ padding:20 }}>

      {/* ── Tab bar ── */}
      <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
        {[
          ["major", `Change Requests (${majorChanges.length})`],
          ["minor", `Minor Updates (${minorChanges.length})`],
        ].map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding:"6px 16px", borderRadius:5, border:"none", fontSize:12, fontWeight:600,
              background: activeTab===t ? C.accent : "none",
              color: activeTab===t ? "#fff" : C.muted, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ MAJOR — CCR log ══ */}
      {activeTab === "major" && (
        <div>
          {majorChanges.length === 0 && (
            <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:40 }}>
              <div style={{ fontSize:32, opacity:.3, marginBottom:12 }}>📋</div>
              No change requests yet. When a baseline element is edited in the operating
              layer, a Change Request will appear here.
            </div>
          )}

          {majorChanges.map((ccr, i) => {
            const s   = (ccr.status || "pending").toLowerCase();
            const col = s==="approved"?C.activity : s==="rejected"?C.risk : s==="reviewed"?"#3a9ce0" : C.milestone;
            const reviewed = ["reviewed","approved"].includes(s);
            return (
              <div key={ccr.id||i} style={{ background:C.surface, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${col}`, borderRadius:8, padding:"12px 14px", marginBottom:10 }}>

                {/* Header row */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:12, color:C.accentL, fontWeight:700 }}>{ccr.id}</span>
                  <span style={{ fontSize:10, color:C.muted }}>{ccr.date}</span>
                  <Badge status={s}/>
                  {ccr.priority && (
                    <span style={{ fontSize:9, color:C.muted, padding:"2px 6px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                      {ccr.priority}
                    </span>
                  )}
                  <span style={{ fontSize:11, color:C.dim, marginLeft:"auto" }}>
                    by {ccr.requestedBy||"—"}
                  </span>
                </div>

                {/* Description */}
                <div style={{ fontSize:12, color:C.sage, marginBottom:6 }}>{ccr.description||"—"}</div>
                {ccr.justification && (
                  <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:6 }}>{ccr.justification}</div>
                )}
                {(ccr.impacts||ccr.impact) && (
                  <div style={{ fontSize:10, color:C.dim, marginBottom:6 }}>
                    Impact: {Array.isArray(ccr.impacts) ? ccr.impacts.join(", ") : ccr.impact}
                  </div>
                )}
                {ccr.proposedValue !== undefined && (
                  <div style={{ background:C.surface2, borderRadius:5, padding:"6px 10px", marginBottom:8, fontSize:11 }}>
                    <span style={{ color:C.risk, textDecoration:"line-through", marginRight:8 }}>
                      {String(ccr.oldValue||"")}
                    </span>
                    <span style={{ color:C.activity }}>→ {String(ccr.proposedValue||"")}</span>
                  </div>
                )}

                {/* Approval trail — read only */}
                <div style={{ display:"flex", gap:12, paddingTop:8, borderTop:`1px solid ${C.border}`,
                  flexWrap:"wrap", alignItems:"center" }}>
                  {/* Reviewer */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:18, height:18, borderRadius:4,
                      background: reviewed ? C.accentL+"22" : C.surface2,
                      border:`1px solid ${reviewed ? C.accentL : C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, color:C.accentL }}>
                      {reviewed ? "✓" : ""}
                    </div>
                    <div>
                      <div style={{ fontSize:8, color:C.muted, textTransform:"uppercase" }}>Reviewer</div>
                      <div style={{ fontSize:10, color:C.dim }}>{ccr.reviewerName||ccr.reviewerCode||"—"}</div>
                    </div>
                  </div>

                  <div style={{ color:C.border }}>→</div>

                  {/* Approver */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:18, height:18, borderRadius:4,
                      background: s==="approved" ? C.activity+"22" : C.surface2,
                      border:`1px solid ${s==="approved" ? C.activity : C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, color:C.activity }}>
                      {s==="approved" ? "✓" : ""}
                    </div>
                    <div>
                      <div style={{ fontSize:8, color:C.muted, textTransform:"uppercase" }}>Approver</div>
                      <div style={{ fontSize:10, color:C.dim }}>{ccr.approverName||ccr.approverCode||"—"}</div>
                    </div>
                  </div>

                  {s==="rejected" && ccr.rejectionReason && (
                    <span style={{ fontSize:10, color:C.risk }}>Rejected: {ccr.rejectionReason}</span>
                  )}
                  <span style={{ marginLeft:"auto", fontSize:9, color:C.muted, fontStyle:"italic" }}>
                    Approve in L2 → Sheet 06
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MINOR — auto-log ══ */}
      {activeTab === "minor" && (
        <div>
          {minorChanges.length === 0 && (
            <div style={{ color:C.muted, fontSize:12, textAlign:"center", padding:40 }}>
              No minor updates logged yet. Non-baseline edits and progress updates
              will appear here automatically.
            </div>
          )}

          {minorChanges.length > 0 && (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
              {/* Header */}
              <div style={{ display:"grid", gridTemplateColumns:"100px 150px 1fr 130px", gap:8,
                padding:"7px 14px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
                {["ID","Date / By","Description","Element"].map(h => (
                  <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted,
                    textTransform:"uppercase", letterSpacing:".4px" }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {minorChanges.map((m, i) => (
                <div key={m.id||i} style={{ display:"grid", gridTemplateColumns:"100px 150px 1fr 130px",
                  gap:8, padding:"8px 14px", borderBottom:`1px solid ${C.border}22`,
                  background: i%2===0 ? C.surface : "transparent" }}>
                  <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{m.id||"—"}</div>
                  <div>
                    <div style={{ fontSize:11, color:C.dim }}>{m.date||"—"}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{m.requestedBy||"—"}</div>
                  </div>
                  <div style={{ fontSize:11, color:C.sage }}>{m.description||"—"}</div>
                  <div style={{ fontSize:10, color:C.accentL }}>{m.elementId||"—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
