import { useLocation } from "wouter";
import { Scale, LogOut, LayoutDashboard } from "lucide-react";

export type AppRoute = "loa" | "sp" | "pendentes" | "contrato" | "admin";

interface AppTopbarProps {
  /** Which tab is currently active */
  active: AppRoute;
  /** Subtitle shown under the logo */
  subtitle?: string;
  /** Called when user clicks Sair */
  onLogout?: () => void;
}

const NAV_ITEMS: { id: AppRoute; label: string; href: string; adminOnly?: boolean }[] = [
  { id: "loa",       label: "Federal",      href: "/loa" },
  { id: "sp",        label: "SP (Estado)",  href: "/sp" },
  { id: "pendentes", label: "Pendentes",    href: "/pendentes" },
  { id: "contrato",  label: "Contrato DPO", href: "/contrato" },
  { id: "admin",     label: "Admin",        href: "/admin", adminOnly: true },
];

export function AppTopbar({ active, subtitle, onLogout }: AppTopbarProps) {
  const [, navigate] = useLocation();

  const isAdmin = typeof window !== "undefined"
    ? localStorage.getItem("aura_role") === "admin"
    : false;

  const defaultLogout = () => {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_email");
    localStorage.removeItem("aura_role");
    window.location.href = "/";
  };

  const handleLogout = onLogout ?? defaultLogout;

  const defaultSubtitles: Record<AppRoute, string> = {
    loa:       "Precatórios inscritos na LOA Federal",
    sp:        "Precatórios LOA — Estado de São Paulo",
    pendentes: "Precatórios com pagamento pendente",
    contrato:  "Contrato de Tratamento de Dados — DPO",
    admin:     "Administração da plataforma",
  };

  const displaySubtitle = subtitle ?? defaultSubtitles[active];

  return (
    <header
      data-testid="app-topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(13,20,32,0.97)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
          gap: 24,
        }}
      >
        {/* ── Logo ── */}
        <button
          data-testid="logo-auraloa"
          onClick={() => navigate("/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Scale style={{ width: 13, height: 13, color: "white" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              AuraLOA
            </div>
            <div style={{ fontSize: 9.5, color: "#64748b", lineHeight: 1.2 }}>
              {displaySubtitle}
            </div>
          </div>
        </button>

        {/* ── Nav tabs ── */}
        <nav
          style={{
            display: "flex",
            alignItems: "stretch",
            height: 52,
            flex: 1,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => navigate(item.href)}
                style={{
                  height: "100%",
                  padding: "0 14px",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#22d3ee" : "#64748b",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #22d3ee" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.12s, border-color 0.12s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.target as HTMLElement).style.color = "#94a3b8";
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.target as HTMLElement).style.color = "#64748b";
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Right actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            data-testid="button-back-dashboard"
            onClick={() => navigate("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: "#64748b",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: 6,
              transition: "color 0.12s, background 0.12s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#f1f5f9";
              el.style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#64748b";
              el.style.background = "none";
            }}
          >
            <LayoutDashboard style={{ width: 12, height: 12 }} />
            Dashboard
          </button>

          <button
            data-testid="button-logout"
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: "#64748b",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: 6,
              transition: "color 0.12s, background 0.12s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#f87171";
              el.style.background = "rgba(248,113,113,0.06)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#64748b";
              el.style.background = "none";
            }}
          >
            <LogOut style={{ width: 12, height: 12 }} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
