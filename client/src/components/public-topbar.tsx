import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, Globe, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicTopbarProps {
  scrollTo?: (id: string) => void;
}

export function PublicTopbar({ scrollTo }: PublicTopbarProps) {
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-7 py-4">

        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate("/")}
          data-testid="logo-auratech"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-md bg-slate-600">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">AuraLOA</h1>
            <p className="text-[11px] text-muted-foreground font-normal">
              Análise Inteligente de Precatórios
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="http://auratg.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-600/50 bg-slate-600/[0.08] text-xs font-medium text-slate-300/80 hover:text-slate-200 hover:bg-slate-600/[0.14] transition-colors"
            data-testid="button-auratech-ecosystem"
          >
            AuraTECH Ecosystem
          </a>

          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-600/50 bg-slate-600/[0.08] text-xs font-medium text-slate-300/80 hover:text-slate-200 hover:bg-slate-600/[0.14] transition-colors"
            data-testid="button-lang-toggle"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "pt" ? "EN" : "PT"}
          </button>

          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-600 bg-slate-600 text-xs font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
            data-testid="button-nav-login"
          >
            Login
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 p-5 flex flex-col gap-3">
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-slate-600/50 bg-slate-600/[0.08] text-xs font-medium text-slate-300/80 hover:text-slate-200 hover:bg-slate-600/[0.14] transition-colors"
            data-testid="button-lang-toggle-mobile"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "pt" ? "EN" : "PT"}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-slate-600 bg-slate-600 text-xs font-medium text-white hover:bg-slate-500 hover:border-slate-500 transition-colors"
            data-testid="button-nav-login-mobile"
          >
            Login
          </button>
        </div>
      )}
    </header>
  );
}
