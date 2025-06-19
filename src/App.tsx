import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import HowPage from "./pages/HowPage";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Import from "./pages/Import";
import SearchPage from "./pages/SearchPage";
import Settings from "./pages/Settings";
import ManagePage from "./pages/ManagePage";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

// Page transition wrapper
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  return (
    <div className="transition-opacity duration-300 animate-fade-in">
      {children}
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <PageTransition>
            <Index />
          </PageTransition>
        } 
      />
      <Route 
        path="/how" 
        element={
          <PageTransition>
            <HowPage />
          </PageTransition>
        } 
      />
      <Route
        path="/manage" 
        element={
          <PageTransition>
            <ProtectedRoute>
              <ManagePage />
            </ProtectedRoute>
          </PageTransition>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <PageTransition>
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </PageTransition>
        } 
      />
      <Route 
        path="/import" 
        element={
          <PageTransition>
            <ProtectedRoute>
              <Import />
            </ProtectedRoute>
          </PageTransition>
        } 
      />
      <Route 
        path="/search" 
        element={
          <PageTransition>
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          </PageTransition>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <PageTransition>
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </PageTransition>
        } 
      />
      <Route 
        path="*" 
        element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        } 
      />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="min-h-screen">
              <Navbar />
              <AppRoutes />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
