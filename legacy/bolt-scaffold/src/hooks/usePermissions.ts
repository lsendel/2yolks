import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Permission } from '../types/api';

export const usePermissions = () => {
  const { user } = useAuthStore();

  const permissions = useMemo(() => {
    if (!user) return [];
    return user.permissions || [];
  }, [user]);

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;
    
    // Super admin has all permissions
    if (user.role === 'admin' && user.is_admin) return true;
    
    return permissions.some(
      permission => 
        permission.resource === resource && 
        permission.action === action
    );
  };

  const hasAnyPermission = (checks: Array<{ resource: string; action: string }>): boolean => {
    return checks.some(({ resource, action }) => hasPermission(resource, action));
  };

  const hasAllPermissions = (checks: Array<{ resource: string; action: string }>): boolean => {
    return checks.every(({ resource, action }) => hasPermission(resource, action));
  };

  const canManageUsers = (): boolean => {
    return hasPermission('users', 'manage') || user?.role === 'admin';
  };

  const canModerateContent = (): boolean => {
    return hasPermission('content', 'moderate') || 
           user?.role === 'admin' || 
           user?.role === 'moderator';
  };

  const canCreateContent = (): boolean => {
    return hasPermission('recipes', 'create') || 
           user?.role === 'content_creator' || 
           user?.role === 'admin';
  };

  const canEditOwnContent = (): boolean => {
    return hasPermission('recipes', 'edit_own') || canCreateContent();
  };

  const canEditAnyContent = (): boolean => {
    return hasPermission('recipes', 'edit_any') || user?.role === 'admin';
  };

  const canDeleteOwnContent = (): boolean => {
    return hasPermission('recipes', 'delete_own') || canCreateContent();
  };

  const canDeleteAnyContent = (): boolean => {
    return hasPermission('recipes', 'delete_any') || user?.role === 'admin';
  };

  const canViewAnalytics = (): boolean => {
    return hasPermission('analytics', 'view') || 
           user?.role === 'admin' || 
           user?.role === 'content_creator';
  };

  const canManageSystem = (): boolean => {
    return hasPermission('system', 'manage') || user?.role === 'admin';
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canManageUsers,
    canModerateContent,
    canCreateContent,
    canEditOwnContent,
    canEditAnyContent,
    canDeleteOwnContent,
    canDeleteAnyContent,
    canViewAnalytics,
    canManageSystem,
  };
};