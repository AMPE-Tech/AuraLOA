import { Scale } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #06b6d4, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Scale size={18} color="#fff" />
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>AuraLOA</span>
        </div>

        {/* 404 */}
        <div style={{
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          background: "linear-gradient(135deg, #22d3ee, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 16,
        }}>
          404
        </div>

        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
          Página não encontrada
        </p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 32 }}>
          O endereço acessado não existe ou foi removido.
        </p>

        <button
          onClick={() => navigate("/")}
          style={{
            background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 24px",
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
