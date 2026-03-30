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
import MembresPage from "@/pages/MembresPage";
import ChantsPage from "@/pages/ChantsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// Placeholder pages for nav items not yet built
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="text-center py-12">
    <h1 className="text-lg font-bold text-foreground mb-2">{title}</h1>
    <p className="text-sm text-muted-foreground">Page en cours de développement</p>
  </div>
);

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/programme" element={<PlaceholderPage title="Programme du culte" />} />
        <Route path="/evenements" element={<PlaceholderPage title="Événements" />} />
        <Route path="/cultes" element={<PlanningPage />} />
        <Route path="/membres" element={<MembresPage />} />
        <Route path="/rotations" element={<PlaceholderPage title="Rotations" />} />
        <Route path="/chants" element={<ChantsPage />} />
        <Route path="/admin" element={<PlaceholderPage title="Administration" />} />
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
