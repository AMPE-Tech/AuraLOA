import { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import LOADashboard from "@/pages/loa-dashboard";
import PrecatoriosPendentes from "@/pages/precatorios-pendentes";
import ContratoTecnico from "@/pages/contrato-tecnico";
import SpDashboard from "@/pages/sp-dashboard";
import ChartPreview from "@/pages/chart-preview";
import AdminPage from "@/pages/admin";
import LandingPreview from "@/pages/landing-preview";
import MarketPreview from "@/pages/market-preview";

function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aura_token");
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setIsAuthenticated(res.ok);
        if (!res.ok) {
          localStorage.removeItem("aura_token");
          localStorage.removeItem("aura_email");
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  return isAuthenticated;
}

function AuthGuard({ component: Component }: { component: React.ComponentType }) {
  const isAuthenticated = useAuth();

  useEffect(() => {
    if (isAuthenticated === false) {
      window.location.href = "/login";
    }
  }, [isAuthenticated]);

  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <Component />;
}

function AdminGuard({ component: Component }: { component: React.ComponentType }) {
  const isAuthenticated = useAuth();
  const role = localStorage.getItem("aura_role");

  useEffect(() => {
    if (isAuthenticated === false) {
      window.location.href = "/login";
    }
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated === false || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Acesso restrito a administradores.</p>
          <a href="/dashboard" className="text-primary text-sm underline mt-2 inline-block">Voltar ao dashboard</a>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/preview/charts" component={ChartPreview} />
      <Route path="/preview/landing" component={LandingPreview} />
      <Route path="/preview/market" component={MarketPreview} />
      <Route path="/dashboard">
        <AuthGuard component={LOADashboard} />
      </Route>
      <Route path="/dashboard/pendentes">
        <AuthGuard component={PrecatoriosPendentes} />
      </Route>
      <Route path="/dashboard/contrato">
        <AuthGuard component={ContratoTecnico} />
      </Route>
      <Route path="/dashboard/sp">
        <AuthGuard component={SpDashboard} />
      </Route>
      <Route path="/dashboard/admin">
        <AdminGuard component={AdminPage} />
      </Route>
      <Route path="/pendentes">
        <Redirect to="/dashboard/pendentes" />
      </Route>
      <Route path="/contrato">
        <Redirect to="/dashboard/contrato" />
      </Route>
      <Route path="/sp">
        <Redirect to="/dashboard/sp" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
