import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LOADashboard from "@/pages/loa-dashboard";
import PrecatoriosPendentes from "@/pages/precatorios-pendentes";
import ContratoTecnico from "@/pages/contrato-tecnico";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LOADashboard} />
      <Route path="/pendentes" component={PrecatoriosPendentes} />
      <Route path="/contrato" component={ContratoTecnico} />
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
