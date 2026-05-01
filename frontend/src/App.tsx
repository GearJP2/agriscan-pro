import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";

const queryClient = new QueryClient();

const Dashboard = lazy(
  () => import("@/components/surveillance/SurveillanceDashboard"),
);
const Homepage = lazy(() => import("./pages/Homepage"));
const Doc = lazy(() => import("./pages/Doc"));
const Prediction = lazy(() => import("./pages/Prediction"));
const SampleList = lazy(
  () => import("@/features/samples/components/SampleList"),
);
const UserManagement = lazy(
  () => import("@/features/users/components/UserManagement"),
);
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Activity = lazy(() => import("./pages/Activity"));
const Notifications = lazy(() => import("./pages/Notifications"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const GoogleAuthCallback = lazy(() => import("./pages/GoogleAuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const RouteLoadingFallback = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Loading page</p>
      <p className="text-sm text-muted-foreground">
        Pulling the next view into place.
      </p>
    </div>
  </div>
);

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WatchlistProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </WatchlistProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Homepage />} />
    <Route path="/doc" element={<Doc />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
    <Route path="/prediction" element={<Prediction />} />
    <Route path="/verify-email" element={<VerifyEmail />} />

    <Route element={<ProtectedRoute minRole="research_assistant" />}>
      <Route path="/samples" element={<SampleList />} />
    </Route>

    <Route element={<ProtectedRoute minRole="researcher" />}>
      <Route path="/users" element={<UserManagement />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/notifications" element={<Notifications />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

export const AppLayout = () => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <div className="flex flex-1 flex-col pt-24 md:pt-28">
      <RouteErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <AppRoutes />
        </Suspense>
      </RouteErrorBoundary>
    </div>
    <Footer />
  </div>
);

const AppRouter = () => (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <AppLayout />
  </BrowserRouter>
);

const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;
