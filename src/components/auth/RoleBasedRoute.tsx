import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePermissions } from '../../hooks/usePermissions';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin' | 'moderator' | 'content_creator';
  requiredPermission?: { resource: string; action: string };
  fallbackPath?: string;
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallbackPath = '/'
}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { hasPermission } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirement
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to={fallbackPath} replace />;
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;