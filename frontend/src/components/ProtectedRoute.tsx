import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store/useAppStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin' | 'developer' | ('admin' | 'developer')[];
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();
  const { user } = useAppStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user?.role as any)) {
      return <Navigate to="/match" replace />;
    }
  }

  return <>{children}</>;
};
