import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "@/components/surveillance/SurveillanceDashboard";
import Footer from "@/components/Footer";
import NotFound from "./pages/NotFound";

import Homepage from "./pages/Homepage";
import SampleList from "@/features/samples/components/SampleList";
import Prediction from "./pages/Prediction";
import Doc from "./pages/Doc";
import UserManagement from "@/features/users/components/UserManagement";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Activity from "./pages/Activity";
import Notifications from "./pages/Notifications";
import VerifyEmail from "./pages/VerifyEmail";
import GoogleAuthCallback from "./pages/GoogleAuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "@/components/Header";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <div className="flex flex-col min-h-screen">
              <Header />
              <div className="flex-1 flex flex-col">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Homepage />} />
                  <Route path="/doc" element={<Doc />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route
                    path="/auth/google/callback"
                    element={<GoogleAuthCallback />}
                  />
                  <Route path="/prediction" element={<Prediction />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute minRole="research_assistant" />}>
                    <Route path="/samples" element={<SampleList />} />
                    <Route path="/users" element={<UserManagement />} />
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/notifications" element={<Notifications />} />
                  </Route>

                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
              <Footer />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
