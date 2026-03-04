import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "@/features/dashboard/components/Dashboard";
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
import ProtectedRoute from "./components/ProtectedRoute";

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
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Homepage />} />
              <Route path="/doc" element={<Doc />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/samples" element={<SampleList />} />
              <Route path="/prediction" element={<Prediction />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/users" element={<UserManagement />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
