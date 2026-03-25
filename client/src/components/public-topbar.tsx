import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, Globe, Menu, X, Sun, Moon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicTopbarProps {
  scrollTo?: (id: string) => void;
  variant?: "public" | "dashboard";
  dark?: boolean;
  onToggleDark?: () => void;
  onRefresh?: () => void;
  userName?: string;
}

export function PublicTopbar({
  scrollTo,
  variant = "public",
  dark = false,
  onToggleDark,
  onRefresh,
  userName,
}: PublicTopbarProps) {
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDash = variant === "dashboard";

  const bg = isDash
    ? dark ? "bg-[#112240] border-[#1e3a5f]" : "bg-white border-gray-200"
    : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b";

  const textColor = isDash
    ? dark ? "text-[#e2e8f0]" : "text-gray-900"
    : "";

  const mutedColor = isDash
    ? dark ? "text-[#64748b]" : "text-gray-400"
    : "text-muted-foreground";

  const btnStyle = isDash
    ? dark
      ? "border-[#1e3a5f] bg-[#1a2f4a]/60 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a2f4a]"
      : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
    : "border-slate-600/50 bg-slate-600/[0.08] text-slate-300/80 hover:text-slate-200 hover:bg-slate-600/[0.14]";

  return (
    <header className={`sticky top-0 z-50 border-b ${bg} transition-colors duration-300`}>
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-7 py-4">

        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(isDash ? "/dashboard" : "/")}
          data-testid="logo-auratech"
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
          >
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-bold tracking-tight ${textColor}`}>AuraLOA</h1>
            <p className={`text-[11px] font-normal ${mutedColor}`}>
              {lang === "pt" ? "Análise Inteligente de Precatórios" : "Intelligent Precatory Analysis"}
            </p>
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">

          {!isDash && (
            <a
              href="http://auratg.co"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-colors ${btnStyle}`}
              data-testid="button-auratech-ecosystem"
            >
              AuraTECH Ecosystem
            </a>
          )}

          {/* Toggle idioma */}
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium transition-colors ${btnStyle}`}
            data-testid="button-lang-toggle"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "pt" ? "EN" : "PT"}
          </button>

          {/* Dark mode toggle — só no dashboard */}
          {isDash && onToggleDark && (
            <button
              onClick={onToggleDark}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium transition-colors ${btnStyle}`}
              data-testid="button-dark-toggle"
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {dark ? (lang === "pt" ? "Claro" : "Light") : (lang === "pt" ? "Escuro" : "Dark")}
            </button>
          )}

          {/* Refresh — só no dashboard */}
          {isDash && onRefresh && (
            <button
              onClick={onRefresh}
              className={`inline-flex items-center p-2 rounded-full border text-xs transition-colors ${btnStyle}`}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Login — só nas páginas públicas */}
          {!isDash && (
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-600 bg-slate-600 text-xs font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
              data-testid="button-nav-login"
            >
              {lang === "pt" ? "Login" : "Sign In"}
            </button>
          )}

          {/* Nome do usuário — só no dashboard */}
          {isDash && userName && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium ${btnStyle}`}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: "linear-gradient(135deg, #06b6d4, #7c3aed)" }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              {userName}
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 p-5 flex flex-col gap-3">
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-colors ${btnStyle}`}
            data-testid="button-lang-toggle-mobile"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "pt" ? "EN" : "PT"}
          </button>
          {!isDash && (
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-slate-600 bg-slate-600 text-xs font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
              data-testid="button-nav-login-mobile"
            >
              {lang === "pt" ? "Login" : "Sign In"}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
