import { useState } from "react";

const T = {
  greenDeep:   "#0a2e1a",
  greenBright: "#2d9e5f",
  greenLight:  "#4eca82",
  gold:        "#c9a84c",
  white:       "#f8faf9",
  grayMid:     "#8aab97",
  dark:        "#071a0f",
};

export default function AuthPage({ onLogin, loading, error }: {
  onLogin: (email: string, password: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onLogin(email, password);
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: T.greenDeep,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "DM Sans, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 80% 60% at 10% 0%, rgba(45,158,95,0.2) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 90% 100%, rgba(78,202,130,0.12) 0%, transparent 55%),
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(45,158,95,0.04) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(45,158,95,0.04) 40px)
        `,
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "rgba(13,51,32,0.95)",
        border: "1px solid rgba(45,158,95,0.2)",
        borderRadius: 20,
        padding: "48px 44px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, color: T.greenLight, letterSpacing: "0.02em" }}>
            GREENFIELD
          </div>
          <div style={{ fontSize: 11, color: T.grayMid, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 4 }}>
            CRM Foncier
          </div>
          <div style={{ width: 40, height: 2, background: `linear-gradient(90deg,${T.greenBright},${T.greenLight})`, margin: "16px auto 0" }} />
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: T.white, marginBottom: 6 }}>
          Connexion
        </div>
        <div style={{ fontSize: 12.5, color: T.grayMid, marginBottom: 28 }}>
          Accès réservé aux membres de l'équipe
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11.5, color: T.grayMid, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@greenfield.ma"
              autoComplete="email"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: "1px solid rgba(45,158,95,0.25)",
                background: "rgba(255,255,255,0.06)", color: T.white,
                fontSize: 14, outline: "none", boxSizing: "border-box",
                fontFamily: "DM Sans, sans-serif",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(78,202,130,0.6)"}
              onBlur={e => e.target.style.borderColor = "rgba(45,158,95,0.25)"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11.5, color: T.grayMid, display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>
              Mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 44px 12px 14px", borderRadius: 10,
                  border: "1px solid rgba(45,158,95,0.25)",
                  background: "rgba(255,255,255,0.06)", color: T.white,
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: "DM Sans, sans-serif",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(78,202,130,0.6)"}
                onBlur={e => e.target.style.borderColor = "rgba(45,158,95,0.25)"}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: T.grayMid, fontSize: 14, padding: 4,
                }}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 18,
              fontSize: 12.5, color: "#e74c3c",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: "100%", padding: "13px",
              borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer",
              background: loading || !email || !password
                ? "rgba(45,158,95,0.3)"
                : `linear-gradient(135deg, ${T.greenBright}, ${T.greenLight})`,
              color: loading || !email || !password ? T.grayMid : T.dark,
              fontWeight: 700, fontSize: 14,
              fontFamily: "DM Sans, sans-serif",
              transition: "all 0.2s",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11.5, color: "rgba(138,171,151,0.4)" }}>
          Accès sur invitation uniquement
        </div>
      </div>
    </div>
  );
}
