import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PlanningPage from "@/pages/PlanningPage";
import ProgrammePage from "@/pages/ProgrammePage";
import EvenementsPage from "@/pages/EvenementsPage";
import RotationsPage from "@/pages/RotationsPage";
import MembresPage from "@/pages/MembresPage";
import ChantsPage from "@/pages/ChantsPage";
import ComptesPage from "@/pages/ComptesPage";
import PermissionsPage from "@/pages/PermissionsPage";
import ConfigurationPage from "@/pages/ConfigurationPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground text-sm">Chargement...</div></div>;
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/programme" element={<ProgrammePage />} />
        <Route path="/evenements" element={<EvenementsPage />} />
        <Route path="/cultes" element={<PlanningPage />} />
        <Route path="/membres" element={<MembresPage />} />
        <Route path="/rotations" element={<RotationsPage />} />
        <Route path="/chants" element={<ChantsPage />} />
        <Route path="/comptes" element={<ComptesPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/configuration" element={<ConfigurationPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
