import { useState } from "react";
import { SHEETS, isSheetAccessible } from "../store/appStore.js";
import Sheet01Charter from "./sheets/Sheet01Charter.jsx";
import Sheet02Team from "./sheets/Sheet02Team.jsx";
import Sheet03Schedule from "./sheets/Sheet03Schedule.jsx";
import Sheet04RACI from "./sheets/Sheet04RACI.jsx";
import Sheet05Risks from "./sheets/Sheet05Risks.jsx";
import Sheet06Change from "./sheets/Sheet06Change.jsx";
import Sheet07KDTracker from "./sheets/Sheet07KDTracker.jsx";
import Sheet08Stakeholders from "./sheets/Sheet08Stakeholders.jsx";
import Sheet10Sustainability from "./sheets/Sheet10Sustainability.jsx";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c",
};

const STATUS_COLORS = {
  empty:         { dot:"#1F4D34",  label:"Empty"        },
  "ai-draft":    { dot:"#3a9ce0",  label:"AI Draft"     },
  "in-progress": { dot:"#e0a23a",  label:"In Progress"  },
  approved:      { dot:"#3ae0a2",  label:"Approved"     },
};

const SHEET_COMPONENTS = {
  "01": Sheet01Charter,
  "02": Sheet02Team,
  "03": Sheet03Schedule,
  "04": Sheet04RACI,
  "05": Sheet05Risks,
  "06": Sheet06Change,
  "07": Sheet07KDTracker,
  "08": Sheet08Stakeholders,
  "10": Sheet10Sustainability,
};

export default function PersonalisationLayer({ state, onSheetUpdate, onSheetApprove, onSheetUnlock, onSheetNav, onGoToL3, onLaunch, onLogout }) {
  const { l2, l1, project } = state;
  const current  = l2.currentSheet === '09' ? '08' : l2.currentSheet; // 09 merged into 08
  const sheets   = l2.sheets;
  const currentIdx  = SHEETS.findIndex(s => s.id === current);
  const prevSheet   = currentIdx > 0 ? SHEETS[currentIdx - 1] : null;
  const nextSheet   = currentIdx < SHEETS.length - 1 ? SHEETS[currentIdx + 1] : null;
  const approvedCount = Object.values(sheets).filter(s => s.locked).length;
  const SheetComponent = SHEET_COMPONENTS[current];

  // Next button: approve+lock current, then navigate
  const handleNext = () => {
    if (!nextSheet) return;
    if (!sheets[current]?.locked) {
      onSheetApprove(current);
    }
    onSheetNav(nextSheet.id);
  };

  // Back button: just navigate, no lock
  const handleBack = () => {
    if (prevSheet) onSheetNav(prevSheet.id);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>

      {/* Progress bar */}
      <div style={{ background:C.surface2, borderBottom:`1px solid ${C.border}`, padding:"10px 20px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:6 }}>
          <span>Project setup progress</span>
          <span style={{ color:C.dim, fontWeight:600 }}>{approvedCount} of {SHEETS.length} sheets approved</span>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {SHEETS.map(s => {
            const st    = sheets[s.id]?.status || "empty";
            const isCurr = s.id === current;
            const col   = STATUS_COLORS[st]?.dot || C.border;
            return (
              <div key={s.id} title={`${s.label} — ${STATUS_COLORS[st]?.label}`}
                onClick={() => isSheetAccessible(s.id, sheets) && onSheetNav(s.id)}
                style={{ flex:1, height:5, borderRadius:3, background:col,
                  opacity: isCurr ? 1 : 0.6,
                  outline: isCurr ? `2px solid ${C.accentL}` : "none",
                  outlineOffset:1,
                  cursor: isSheetAccessible(s.id, sheets) ? "pointer" : "not-allowed" }}/>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:200, minWidth:180, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700,
            color:C.muted, textTransform:"uppercase", letterSpacing:".8px",
            borderBottom:`1px solid ${C.border}` }}>Sheets</div>
          {SHEETS.map(s => {
            const st         = sheets[s.id]?.status || "empty";
            const active     = s.id === current;
            const accessible = isSheetAccessible(s.id, sheets);
            const stCfg      = STATUS_COLORS[st] || STATUS_COLORS.empty;
            return (
              <div key={s.id} onClick={() => accessible && onSheetNav(s.id)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
                  cursor: accessible ? "pointer" : "not-allowed",
                  background: active ? C.surface2 : "transparent",
                  borderLeft: active ? `2px solid ${C.accentL}` : "2px solid transparent",
                  opacity: accessible ? 1 : 0.4, transition:"background .15s" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:stCfg.dot, flexShrink:0 }}/>
                <span style={{ fontSize:12, color: active ? C.sage : C.dim, flex:1 }}>{s.label}</span>
                {!accessible && <span style={{ fontSize:10, color:C.muted }}>🔒</span>}
                {sheets[s.id]?.locked && <span style={{ fontSize:11, color:C.accentL }}>✓</span>}
              </div>
            );
          })}

          {/* Logout */}
          {onLogout && (
            <div style={{ marginTop:"auto", padding:"10px 14px", borderTop:`1px solid ${C.border}` }}>
              <button onClick={onLogout}
                style={{ width:"100%", padding:"7px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.muted, fontSize:11, cursor:"pointer", textAlign:"left" }}>
                ← Log out
              </button>
            </div>
          )}

          {/* Team members */}
          {l2.loginCodes.length > 0 && (
            <>
              <div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700,
                color:C.muted, textTransform:"uppercase", letterSpacing:".8px",
                borderTop:`1px solid ${C.border}`, marginTop:8 }}>Team</div>
              {l2.loginCodes.map((m,i) => (
                <div key={i} style={{ padding:"6px 14px", display:"flex", flexDirection:"column", gap:2 }}>
                  <div style={{ fontSize:11, color:C.dim, fontWeight:600 }}>{m.name||"Unnamed"}</div>
                  <div style={{ fontSize:10, color:C.muted, display:"flex", gap:6 }}>
                    <span style={{ fontFamily:"monospace", color:C.accentL }}>{m.loginCode}</span>
                    <span>{m.role}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Sheet header */}
          <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", gap:12, flexShrink:0, background:C.surface }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.sage }}>
                {SHEETS.find(s => s.id === current)?.label}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                Sheet {current} of {SHEETS.length}
                {" · "}{STATUS_COLORS[sheets[current]?.status]?.label || "Empty"}
                {sheets[current]?.locked && " · Locked"}
              </div>
            </div>
            {sheets[current]?.locked ? (
              <button onClick={() => onSheetUnlock(current)}
                style={{ padding:"7px 14px", background:"none", border:`1px solid ${C.border}`,
                  borderRadius:5, color:C.dim, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                Unlock to Edit
              </button>
            ) : (
              <button onClick={() => onSheetApprove(current)}
                style={{ padding:"7px 14px", background:C.accent, border:"none",
                  borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                Approve & Lock
              </button>
            )}
          </div>

          {/* Sheet content */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
            {SheetComponent && (
              <SheetComponent
                data={sheets[current]?.data || {}}
                locked={sheets[current]?.locked || false}
                l1={l1}
                project={project}
                loginCodes={l2.loginCodes}
                allSheets={sheets}
                onUpdate={(data, status) => onSheetUpdate(current, data, status)}/>
            )}
          </div>

          {/* Navigation — Next auto-approves current sheet */}
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:C.surface, flexShrink:0 }}>
            <button onClick={handleBack} disabled={!prevSheet}
              style={{ padding:"7px 16px", background:"none", border:`1px solid ${C.border}`,
                borderRadius:5, color: prevSheet ? C.dim : C.muted, fontSize:12, fontWeight:600,
                cursor: prevSheet ? "pointer" : "not-allowed", opacity: prevSheet ? 1 : 0.4 }}>
              {String.fromCharCode(8592)} {prevSheet?.label || ""}
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11, color:C.muted }}>{currentIdx + 1} / {SHEETS.length}</span>
              {!nextSheet && onLaunch && (
                <button onClick={onLaunch}
                  style={{ padding:"8px 20px", background:"#2E7D52", border:"none", borderRadius:6,
                    color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:6 }}>
                  💾 Save &amp; Launch Project →
                </button>
              )}
              {onGoToL3 && approvedCount > 0 && nextSheet && (
                <button onClick={onGoToL3} style={{ padding:"5px 12px", background:C.accent, color:"#fff", border:"none", borderRadius:5, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  Go to Operating Layer →
                </button>
              )}
            </div>
            <button onClick={handleNext} disabled={!nextSheet}
              style={{ padding:"7px 16px", background: nextSheet ? C.accent : "none",
                border:`1px solid ${nextSheet ? C.accent : C.border}`,
                borderRadius:5, color: nextSheet ? "#fff" : C.muted, fontSize:12, fontWeight:700,
                cursor: nextSheet ? "pointer" : "not-allowed", opacity: nextSheet ? 1 : 0.4 }}>
              {nextSheet?.label || ""} {String.fromCharCode(8594)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
