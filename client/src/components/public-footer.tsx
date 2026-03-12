import { useLocation } from "wouter";
import { Shield } from "lucide-react";
import { SiInstagram, SiTiktok, SiLinkedin } from "react-icons/si";

export function PublicFooter() {
  const [, navigate] = useLocation();

  return (
    <footer className="pt-8 pb-6 border-t border-border/40 mt-12" data-testid="section-footer">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">AuraTECH</span>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
            Infrastructure for Evidence-Based Trust. A plataforma definitiva para estruturação de evidências e auditoria com cadeia de custódia digital.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-instagram">
              <SiInstagram className="w-4 h-4" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-tiktok">
              <SiTiktok className="w-4 h-4" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-linkedin">
              <SiLinkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold mb-3">Links Rápidos</h4>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li>
              <button
                onClick={() => { const el = document.getElementById("modulos"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                className="hover:text-foreground transition-colors"
              >
                Plataforma e Módulos
              </button>
            </li>
            <li>
              <button
                onClick={() => { const el = document.getElementById("performance"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                className="hover:text-foreground transition-colors"
              >
                Performance
              </button>
            </li>
            <li>
              <button
                onClick={() => { const el = document.getElementById("trust-index"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                className="hover:text-foreground transition-colors"
              >
                Aura Trust Index
              </button>
            </li>
            <li>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="hover:text-foreground transition-colors"
              >
                Voltar ao topo
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold mb-3">Legal & Compliance</h4>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li>
              <button onClick={() => navigate("/compliance-policy")} className="hover:text-foreground transition-colors">
                Compliance & Privacidade
              </button>
            </li>
            <li>
              <button onClick={() => navigate("/compliance-policy")} className="hover:text-foreground transition-colors">
                Conformidade LGPD
              </button>
            </li>
            <li>
              <button onClick={() => navigate("/compliance-policy")} className="hover:text-foreground transition-colors">
                Termos de Uso
              </button>
            </li>
            <li>
              <a href="mailto:privacidade@auradue.com" className="hover:text-foreground transition-colors">
                DPO / Privacidade
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-border/40">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>Cadeia de Custódia Digital - Lei 13.964/2019</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          © 2025 AuraTECH. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
