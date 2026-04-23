import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { UserRole, USER_ROLE_WEIGHT } from "@/types/user";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  minRole?: UserRole;
}

const ProtectedRoute = ({
  allowedRoles,
  minRole,
}: ProtectedRouteProps = {}) => {
  const { isAuthenticated, isInitializing, role } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Checking your session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role as UserRole)) {
    return <Navigate to="/" replace />;
  }

  if (
    minRole &&
    USER_ROLE_WEIGHT[role as UserRole] < USER_ROLE_WEIGHT[minRole]
  ) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
