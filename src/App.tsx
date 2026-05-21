import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PlanningGestionPage from "@/pages/PlanningGestionPage";
import ProgrammePage from "@/pages/ProgrammePage";
import EvenementsPage from "@/pages/EvenementsPage";
import RotationsPage from "@/pages/RotationsPage";
import MembresPage from "@/pages/MembresPage";
import ChantsPage from "@/pages/ChantsPage";
import ComptesPage from "@/pages/ComptesPage";
import PermissionsPage from "@/pages/PermissionsPage";
import JournalPage from "@/pages/JournalPage";
import ConfigurationPage from "@/pages/ConfigurationPage";
import DisponibilitesPage from "@/pages/DisponibilitesPage";
import ArchivesAdminPage from "@/pages/ArchivesAdminPage";
import PredicationsPage from "@/pages/PredicationsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function Guard({ action, children }: { action: string; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(action)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <span className="text-4xl">🔒</span>
        <p className="text-sm font-medium">Accès refusé</p>
        <p className="text-xs">Vous n'avez pas la permission d'accéder à cette section.</p>
      </div>
    );
  }
  return <>{children}</>;
}

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
        <Route path="/planning" element={<Guard action="planning_edit"><PlanningGestionPage /></Guard>} />
        <Route path="/membres" element={<Guard action="members_view"><MembresPage /></Guard>} />
        <Route path="/rotations" element={<Guard action="planning_edit"><RotationsPage /></Guard>} />
        <Route path="/chants" element={<Guard action="songs_view"><ChantsPage /></Guard>} />
        <Route path="/comptes" element={<Guard action="members_manage"><ComptesPage /></Guard>} />
        <Route path="/permissions" element={<Guard action="config_edit"><PermissionsPage /></Guard>} />
        <Route path="/journal" element={<Guard action="config_edit"><JournalPage /></Guard>} />
        <Route path="/configuration" element={<Guard action="config_edit"><ConfigurationPage /></Guard>} />
        <Route path="/disponibilites" element={<Guard action="planning_view"><DisponibilitesPage /></Guard>} />
        <Route path="/archives" element={<Guard action="archives_view"><ArchivesAdminPage /></Guard>} />
        <Route path="/predications" element={<Guard action="config_view"><PredicationsPage /></Guard>} />
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
        <BrowserRouter basename="/admin">
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
