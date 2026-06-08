import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "./pages/NotFound.tsx";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PlanningGestionPage = lazy(() => import("@/pages/PlanningGestionPage"));
const ProgrammePage = lazy(() => import("@/pages/ProgrammePage"));
const EvenementsPage = lazy(() => import("@/pages/EvenementsPage"));
const RotationsPage = lazy(() => import("@/pages/RotationsPage"));
const MembresPage = lazy(() => import("@/pages/MembresPage"));
const ChantsPage = lazy(() => import("@/pages/ChantsPage"));
const PermissionsPage = lazy(() => import("@/pages/PermissionsPage"));
const AccesPage = lazy(() => import("@/pages/AccesPage"));
const JournalPage = lazy(() => import("@/pages/JournalPage"));
const ConfigurationPage = lazy(() => import("@/pages/ConfigurationPage"));
const DisponibilitesPage = lazy(() => import("@/pages/DisponibilitesPage"));
const AefvPage = lazy(() => import("@/pages/AefvPage"));
const ConducteurAdminPage = lazy(() => import("@/pages/ConducteurAdminPage"));
const PredicationsPage = lazy(() => import("@/pages/PredicationsPage"));

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

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
  </div>
);

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;

  return (
    <Routes>
      {/* Public route — always accessible, no auth required */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Auth gate — all other routes require being logged in */}
      {!user ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <>
          <Route element={<AppLayout />}>
            <Suspense fallback={<PageLoader />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/programme" element={<ProgrammePage />} />
              <Route path="/evenements" element={<EvenementsPage />} />
              <Route path="/planning" element={<Guard action="planning_edit"><PlanningGestionPage /></Guard>} />
              <Route path="/membres" element={<Guard action="members_view"><MembresPage /></Guard>} />
              <Route path="/rotations" element={<Guard action="planning_edit"><RotationsPage /></Guard>} />
              <Route path="/chants" element={<Guard action="songs_view"><ChantsPage /></Guard>} />
              <Route path="/acces" element={<Guard action="members_manage"><AccesPage /></Guard>} />
              <Route path="/comptes" element={<Navigate to="/acces" replace />} />
              <Route path="/permissions" element={<Guard action="config_edit"><PermissionsPage /></Guard>} />
              <Route path="/journal" element={<Guard action="config_edit"><JournalPage /></Guard>} />
              <Route path="/configuration" element={<Guard action="config_edit"><ConfigurationPage /></Guard>} />
              <Route path="/disponibilites" element={<Guard action="planning_view"><DisponibilitesPage /></Guard>} />
              <Route path="/conducteur" element={<Guard action="planning_edit"><ConducteurAdminPage /></Guard>} />
              <Route path="/aefv" element={<Guard action="archives_view"><AefvPage /></Guard>} />
              <Route path="/archives" element={<Navigate to="/aefv" replace />} />
              <Route path="/predications" element={<Guard action="config_view"><PredicationsPage /></Guard>} />
            </Suspense>
          </Route>
          <Route path="*" element={<NotFound />} />
        </>
      )}
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename="/">
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
