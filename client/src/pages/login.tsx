import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";
import { Zap, LogIn, Loader2, KeyRound, ArrowLeft, CheckCircle, UserPlus } from "lucide-react";

type View = "login" | "register" | "forgot" | "reset";

export default function LoginPage() {
  // Detecta token na URL para abrir direto na view de reset
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ? "reset" : "login";
  });
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("token") ?? ""
  );

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Cadastro
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Esqueci
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Resetar
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Campos obrigatórios", description: "Preencha email e senha.", variant: "destructive" });
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
      toast({ title: "Login realizado", description: `Bem-vindo, ${data.email}` });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Erro no login", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Cadastro ───────────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    if (regPassword.length < 6) {
      toast({ title: "Senha inválida", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (regPassword !== regConfirm) {
      toast({ title: "Senhas diferentes", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, name: regName, password: regPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao criar conta");
      }
      const data = await res.json();
      localStorage.setItem("aura_token", data.token);
      localStorage.setItem("aura_email", data.email);
      localStorage.setItem("aura_role", data.role);
      toast({ title: "Conta criada!", description: `Bem-vindo, ${data.name}` });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Erro no cadastro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Esqueci minha senha ────────────────────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: "Informe o email", description: "Digite seu email cadastrado.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      toast({ title: "Erro", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Resetar senha ──────────────────────────────────────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Senha inválida", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao redefinir senha");
      }
      setResetDone(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Link inválido ou expirado.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicTopbar />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Ícone + título */}
          <div className="flex flex-col items-center mb-5">
            <div className="p-2 rounded-md bg-primary/15 mb-3">
              {view === "login"    && <Zap      className="w-5 h-5 text-primary" />}
              {view === "register" && <UserPlus className="w-5 h-5 text-primary" />}
              {(view === "forgot" || view === "reset") && <KeyRound className="w-5 h-5 text-primary" />}
            </div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-login-title">
              {view === "login"    && "AuraLOA"}
              {view === "register" && "Criar conta"}
              {view === "forgot"   && "Recuperar acesso"}
              {view === "reset"    && "Nova senha"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {view === "login"    && "Acesse a plataforma de pesquisa"}
              {view === "register" && "Crie sua conta gratuitamente"}
              {view === "forgot"   && "Enviaremos um link para seu email"}
              {view === "reset"    && "Defina sua nova senha de acesso"}
            </p>
          </div>

          <Card>
            <CardContent className="p-5">

              {/* ── VIEW: LOGIN ── */}
              {view === "login" && (
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setView("forgot")}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        data-testid="link-forgot-password"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
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
                  <div className="text-center pt-1">
                    <span className="text-[10px] text-muted-foreground">Não tem conta?{" "}</span>
                    <button
                      type="button"
                      onClick={() => setView("register")}
                      className="text-[10px] text-primary hover:underline font-medium"
                      data-testid="link-register"
                    >
                      Cadastre-se
                    </button>
                  </div>
                </form>
              )}

              {/* ── VIEW: CADASTRO ── */}
              {view === "register" && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name" className="text-xs">Nome completo</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Seu nome"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      data-testid="input-reg-name"
                      autoComplete="name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      data-testid="input-reg-email"
                      autoComplete="email"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-xs">Senha</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      data-testid="input-reg-password"
                      autoComplete="new-password"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-xs">Confirmar senha</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="Repita a senha"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      data-testid="input-reg-confirm"
                      autoComplete="new-password"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-9 text-sm"
                    disabled={isLoading}
                    data-testid="button-register-submit"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Criar conta grátis
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1"
                    data-testid="link-back-to-login-from-register"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Já tenho conta — fazer login
                  </button>
                </form>
              )}

              {/* ── VIEW: ESQUECI ── */}
              {view === "forgot" && !forgotSent && (
                <form onSubmit={handleForgot} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs">Email cadastrado</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      data-testid="input-forgot-email"
                      autoComplete="email"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-9 text-sm"
                    disabled={isLoading}
                    data-testid="button-forgot-submit"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Enviar link de recuperação
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1"
                    data-testid="link-back-to-login"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Voltar ao login
                  </button>
                </form>
              )}

              {/* ── VIEW: ESQUECI — confirmação enviada ── */}
              {view === "forgot" && forgotSent && (
                <div className="space-y-4 text-center py-2">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Link enviado</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se <span className="font-medium text-foreground">{forgotEmail}</span> estiver cadastrado,
                    você receberá um link válido por 1 hora.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView("login"); setForgotSent(false); setForgotEmail(""); }}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Voltar ao login
                  </button>
                </div>
              )}

              {/* ── VIEW: RESET ── */}
              {view === "reset" && !resetDone && (
                <form onSubmit={handleReset} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                      autoComplete="new-password"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs">Confirmar senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-password"
                      autoComplete="new-password"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-9 text-sm"
                    disabled={isLoading}
                    data-testid="button-reset-submit"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Redefinir senha
                  </Button>
                </form>
              )}

              {/* ── VIEW: RESET — sucesso ── */}
              {view === "reset" && resetDone && (
                <div className="space-y-4 text-center py-2">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Senha redefinida</p>
                  <p className="text-xs text-muted-foreground">
                    Sua senha foi atualizada com sucesso. Faça login com a nova senha.
                  </p>
                  <Button
                    className="w-full h-9 text-sm"
                    onClick={() => { setView("login"); window.history.replaceState({}, "", "/login"); }}
                    data-testid="button-go-to-login"
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                    Ir para o login
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Cadeia de custódia com SHA-256
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] w-full mx-auto px-6">
        <PublicFooter />
      </div>
    </div>
  );
}
