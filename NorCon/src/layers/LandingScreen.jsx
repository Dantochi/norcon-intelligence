import { useState, useEffect } from "react";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c",
};

const inp = {
  width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
  borderRadius:6, color:C.sage, fontSize:14, padding:"11px 14px",
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  textTransform:"uppercase", letterSpacing:".1em",
};

export default function LandingScreen({ onCreateNew, onLogin, lastLogin }) {
  const [mode,        setMode]        = useState(null); // null | 'login'
  const [projectCode, setProjectCode] = useState('');
  const [memberCode,  setMemberCode]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Pre-fill fields from last login
  useEffect(() => {
    if (!lastLogin) return;
    if (lastLogin.projectCode) setProjectCode(lastLogin.projectCode.toUpperCase());
    if (lastLogin.memberCode)  setMemberCode(lastLogin.memberCode.toUpperCase());
  }, [lastLogin]);

  const handleLogin = async () => {
    if (!projectCode.trim() || !memberCode.trim()) {
      setError('Please enter both your project code and team member code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onLogin(projectCode.trim(), memberCode.trim());
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const clearLastLogin = () => {
    setProjectCode('');
    setMemberCode('');
    try { localStorage.removeItem("norcon_last_login"); } catch(e) { /* ignore */ }
  };

  return (
    <div style={{
      background: C.bg, minHeight:"100vh", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:24, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>

      {/* Logo + title */}
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <img src="/norcon-logo.png" alt="NorCon Projects"
          style={{ width:180, height:168, objectFit:"contain", background:"#fff",
            borderRadius:10, padding:8, margin:"0 auto 16px", display:"block",
            boxSizing:"border-box" }}/>
        <div style={{ fontSize:14, color:C.muted }}>
          AI-driven project management for teams that deliver
        </div>
      </div>

      {/* Card */}
      <div style={{
        width:"100%", maxWidth:420,
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:12, overflow:"hidden",
      }}>

        {mode === null && (
          <div style={{ padding:28 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.sage, marginBottom:6, textAlign:"center" }}>
              Welcome
            </div>
            <div style={{ fontSize:13, color:C.muted, textAlign:"center", marginBottom:24 }}>
              What would you like to do?
            </div>

            <div onClick={onCreateNew} style={{
              border:`1px solid ${C.accent}`, borderRadius:8, padding:"16px 20px",
              marginBottom:12, cursor:"pointer", transition:"all .2s",
              background:"rgba(46,125,82,0.06)",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(46,125,82,0.12)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(46,125,82,0.06)"}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:36, height:36, background:C.accent, borderRadius:7,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0,
                }}>✨</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.sage, marginBottom:2 }}>
                    Create a new project
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>
                    Upload a document and let AI extract your project elements
                  </div>
                </div>
              </div>
            </div>

            <div onClick={()=>setMode('login')} style={{
              border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 20px",
              cursor:"pointer", transition:"all .2s",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentL}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:36, height:36, background:C.surface2, border:`1px solid ${C.border}`,
                  borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:18, flexShrink:0,
                }}>🔑</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.sage, marginBottom:2 }}>
                    Login to existing project
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>
                    Enter your project code and team member code
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div>
            <div style={{
              background:C.surface2, borderBottom:`1px solid ${C.border}`,
              padding:"14px 20px", display:"flex", alignItems:"center", gap:10,
            }}>
              <button onClick={()=>{setMode(null);setError('');}} style={{
                background:"none", border:"none", color:C.muted, cursor:"pointer",
                fontSize:18, padding:0, lineHeight:1,
              }}>←</button>
              <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>Login to project</div>
            </div>

            {/* Welcome back banner */}
            {lastLogin?.memberName && (
              <div style={{ background:C.accent+"11", borderBottom:`1px solid ${C.accent}33`,
                padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.accentL }}>
                    Welcome back, {lastLogin.memberName}
                  </div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
                    Fields pre-filled from your last session
                  </div>
                </div>
                <button onClick={clearLastLogin}
                  style={{ fontSize:10, color:C.muted, background:"none", border:"none",
                    cursor:"pointer", textDecoration:"underline" }}>
                  Not you?
                </button>
              </div>
            )}

            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>
                  Project Code
                </div>
                <input
                  style={{ ...inp, borderColor: error ? C.risk : C.border }}
                  value={projectCode}
                  onChange={e => setProjectCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WF"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                  The short code for your project (given by your PM)
                </div>
              </div>

              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>
                  Your Team Member Code
                </div>
                <input
                  style={{ ...inp, borderColor: error ? C.risk : C.border }}
                  value={memberCode}
                  onChange={e => setMemberCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WF-4821"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                  Your personal login code (given by your PM)
                </div>
              </div>

              {error && (
                <div style={{
                  background:"rgba(224,92,92,0.1)", border:`1px solid ${C.risk}`,
                  borderRadius:6, padding:"10px 14px", fontSize:12, color:"#ff9e9e",
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                style={{
                  padding:"12px", background: loading ? C.surface2 : C.accent,
                  color:"#fff", border:"none", borderRadius:7, fontSize:14,
                  fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}>
                {loading ? (
                  <>
                    <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                    Signing in...
                  </>
                ) : "Enter Project →"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:32, fontSize:12, color:C.muted, textAlign:"center" }}>
        Powered by NorCon Projects · APM-aligned project management
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
