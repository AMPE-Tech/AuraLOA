import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Scale, Globe, Menu, X } from "lucide-react";

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
            <p className="text-[14px] text-muted-foreground font-semibold">
              Análise Inteligente de Precatórios
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="http://auratg.co"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-600/50 bg-slate-600/[0.08] text-xs font-medium text-slate-300/80 hover:text-slate-200 hover:bg-slate-600/[0.14] transition-colors"
            data-testid="button-auratech-ecosystem"
          >
            AuraTECH Ecosystem
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-medium text-muted-foreground hover:text-foreground h-10 px-3"
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            data-testid="button-lang-toggle"
          >
            <Globe className="w-4 h-4 mr-1.5" />
            {lang === "pt" ? "EN" : "PT"}
          </Button>
          <Button
            size="sm"
            className="h-10 px-5 text-sm font-medium hidden sm:inline-flex"
            onClick={() => navigate("/login")}
            data-testid="button-nav-login"
          >
            Login
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 p-5 space-y-4 text-sm font-medium">
          <Button
            size="sm"
            className="w-full mt-2 h-10 text-sm font-medium"
            onClick={() => navigate("/login")}
          >
            Login
          </Button>
        </div>
      )}
    </header>
  );
}
