import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/user';
import { USER_ROLE_WEIGHT } from '@/types/user';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
    minRole?: UserRole;
}

const ProtectedRoute = ({ allowedRoles, minRole }: ProtectedRouteProps = {}) => {
    const { isAuthenticated, role } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(role as UserRole)) {
        return <Navigate to="/" replace />;
    }

    if (minRole && USER_ROLE_WEIGHT[role as UserRole] < USER_ROLE_WEIGHT[minRole]) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
