import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";
import { Zap, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha email e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao fazer login");
      }

      const data = await res.json();
      localStorage.setItem("aura_token", data.token);
      localStorage.setItem("aura_email", data.email);
      localStorage.setItem("aura_role", data.role);

      toast({
        title: "Login realizado",
        description: `Bem-vindo, ${data.email}`,
      });

      setLocation("/dashboard");
    } catch (err: any) {
      toast({
        title: "Erro no login",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicTopbar />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-5">
            <div className="p-2 rounded-md bg-primary/15 mb-3">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-login-title">
              AuraLOA
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse a plataforma de pesquisa
            </p>
          </div>

          <Card>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                    autoComplete="email"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                    autoComplete="current-password"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-9 text-sm"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Cadeia de custodia com SHA-256
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] w-full mx-auto px-6">
        <PublicFooter />
      </div>
    </div>
  );
}
