# Role-Based Access Control (RBAC) Documentation

## Overview

The 2yolks platform implements a comprehensive Role-Based Access Control system that manages user permissions and access to various platform features based on assigned roles.

## Role Hierarchy

### 1. User (Default Role)
**Description**: Standard platform users who can discover and interact with recipes.

**Permissions**:
- View published recipes
- Create and manage reviews
- Save recipes to favorites
- Create meal plans
- Manage shopping lists
- Update own profile

**Access Restrictions**:
- Cannot create recipes
- Cannot access admin features
- Cannot moderate content

### 2. Content Creator
**Description**: Users who can create and publish recipes on the platform.

**Permissions** (Inherits User permissions plus):
- Create new recipes
- Edit own recipes
- Delete own recipes
- View recipe analytics
- Manage recipe gallery images
- Feature recipe requests

**Access Restrictions**:
- Cannot edit other users' recipes
- Cannot access user management
- Cannot moderate content from other users

### 3. Moderator
**Description**: Users responsible for content moderation and community management.

**Permissions** (Inherits User permissions plus):
- Moderate user-generated content
- Review flagged recipes and reviews
- Approve/reject content
- Manage user reports
- View moderation analytics
- Temporary user restrictions

**Access Restrictions**:
- Cannot manage user accounts
- Cannot access system settings
- Cannot delete users permanently

### 4. Admin (Super Admin)
**Description**: Full platform administrators with complete system access.

**Permissions** (All permissions):
- Complete user management
- System configuration
- Content moderation override
- Analytics access
- Database management
- Security settings
- Role assignment

## Permission System

### Permission Structure
```typescript
interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;  // What the permission applies to
  action: string;    // What action is allowed
}
```

### Resource Types
- `users` - User account management
- `recipes` - Recipe content management
- `reviews` - Review management
- `content` - General content moderation
- `analytics` - Platform analytics
- `system` - System configuration
- `moderation` - Content moderation tools

### Action Types
- `view` - Read access
- `create` - Create new items
- `edit_own` - Edit own content
- `edit_any` - Edit any content
- `delete_own` - Delete own content
- `delete_any` - Delete any content
- `manage` - Full management access
- `moderate` - Moderation capabilities

## Implementation Details

### Permission Checking Hook
```typescript
// hooks/usePermissions.ts
export const usePermissions = () => {
  const { user } = useAuthStore();

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;
    
    // Super admin has all permissions
    if (user.role === 'admin' && user.is_admin) return true;
    
    return user.permissions?.some(
      permission => 
        permission.resource === resource && 
        permission.action === action
    ) || false;
  };

  // Convenience methods
  const canManageUsers = () => hasPermission('users', 'manage');
  const canModerateContent = () => hasPermission('content', 'moderate');
  const canCreateContent = () => hasPermission('recipes', 'create');
  
  return {
    hasPermission,
    canManageUsers,
    canModerateContent,
    canCreateContent,
    // ... other convenience methods
  };
};
```

### Route Protection
```typescript
// components/auth/RoleBasedRoute.tsx
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
  const { user, isAuthenticated } = useAuthStore();
  const { hasPermission } = usePermissions();

  // Authentication check
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to={fallbackPath} replace />;
  }

  // Permission check
  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
```

## Role Assignment Process

### Self-Registration
Users can choose their initial role during registration:

```typescript
// Self-signup with role selection
const signUpWithRole = async (userData: {
  email: string;
  password: string;
  username: string;
  role: 'user' | 'content_creator';
}) => {
  const permissions = getRolePermissions(userData.role);
  
  const newUser = await createUser({
    ...userData,
    permissions,
    is_admin: false
  });
  
  return newUser;
};
```

### Admin Role Assignment
Admins can modify user roles and permissions:

```typescript
// Admin role management
const updateUserRole = async (userId: string, newRole: string) => {
  const permissions = getRolePermissions(newRole);
  
  await updateUser(userId, {
    role: newRole,
    permissions
  });
};
```

## Permission Matrices

### User Permissions Matrix
| Resource | View | Create | Edit Own | Edit Any | Delete Own | Delete Any | Manage |
|----------|------|--------|----------|----------|------------|------------|---------|
| Recipes  | ✅   | ❌     | ❌       | ❌       | ❌         | ❌         | ❌      |
| Reviews  | ✅   | ✅     | ✅       | ❌       | ✅         | ❌         | ❌      |
| Users    | ❌   | ❌     | ✅       | ❌       | ❌         | ❌         | ❌      |

### Content Creator Permissions Matrix
| Resource | View | Create | Edit Own | Edit Any | Delete Own | Delete Any | Manage |
|----------|------|--------|----------|----------|------------|------------|---------|
| Recipes  | ✅   | ✅     | ✅       | ❌       | ✅         | ❌         | ❌      |
| Reviews  | ✅   | ✅     | ✅       | ❌       | ✅         | ❌         | ❌      |
| Users    | ❌   | ❌     | ✅       | ❌       | ❌         | ❌         | ❌      |
| Analytics| ✅   | ❌     | ❌       | ❌       | ❌         | ❌         | ❌      |

### Moderator Permissions Matrix
| Resource   | View | Create | Edit Own | Edit Any | Delete Own | Delete Any | Manage |
|------------|------|--------|----------|----------|------------|------------|---------|
| Recipes    | ✅   | ❌     | ❌       | ❌       | ❌         | ❌         | ❌      |
| Reviews    | ✅   | ✅     | ✅       | ✅       | ✅         | ✅         | ❌      |
| Users      | ✅   | ❌     | ✅       | ❌       | ❌         | ❌         | ❌      |
| Content    | ✅   | ❌     | ❌       | ❌       | ❌         | ❌         | ✅      |
| Moderation | ✅   | ✅     | ✅       | ✅       | ✅         | ✅         | ✅      |

### Admin Permissions Matrix
| Resource | View | Create | Edit Own | Edit Any | Delete Own | Delete Any | Manage |
|----------|------|--------|----------|----------|------------|------------|---------|
| All      | ✅   | ✅     | ✅       | ✅       | ✅         | ✅         | ✅      |

## Security Considerations

### Permission Validation
- All permissions are validated server-side
- Client-side checks are for UX only
- JWT tokens include role and permission information
- Regular permission audits are conducted

### Role Escalation Prevention
```typescript
// Prevent unauthorized role escalation
const validateRoleChange = (currentUser: User, targetRole: string) => {
  // Only admins can assign admin roles
  if (targetRole === 'admin' && currentUser.role !== 'admin') {
    throw new Error('Insufficient permissions to assign admin role');
  }
  
  // Users cannot escalate their own privileges
  if (currentUser.id === targetUserId && targetRole !== currentUser.role) {
    throw new Error('Cannot modify your own role');
  }
  
  return true;
};
```

### Audit Logging
```typescript
// Log all permission-related actions
const auditLog = {
  logRoleChange: (adminId: string, userId: string, oldRole: string, newRole: string) => {
    logger.info('Role changed', {
      adminId,
      userId,
      oldRole,
      newRole,
      timestamp: new Date().toISOString()
    });
  },
  
  logPermissionCheck: (userId: string, resource: string, action: string, granted: boolean) => {
    logger.debug('Permission check', {
      userId,
      resource,
      action,
      granted,
      timestamp: new Date().toISOString()
    });
  }
};
```

## Best Practices

### 1. Principle of Least Privilege
- Users receive minimum permissions necessary for their role
- Regular review of permissions
- Temporary elevated permissions when needed

### 2. Role Separation
- Clear distinction between roles
- No overlapping responsibilities
- Defined escalation paths

### 3. Regular Audits
- Monthly permission reviews
- Automated detection of permission anomalies
- User access recertification

### 4. Documentation
- Keep permission documentation updated
- Clear role descriptions
- Permission change procedures

## Migration and Updates

### Adding New Permissions
```typescript
// Migration script for new permissions
const addNewPermission = async (permission: Permission) => {
  // Add permission to database
  await createPermission(permission);
  
  // Update relevant roles
  const rolesToUpdate = ['content_creator', 'admin'];
  
  for (const role of rolesToUpdate) {
    await addPermissionToRole(role, permission.id);
  }
  
  // Update existing users with these roles
  await updateUsersWithRole(rolesToUpdate);
};
```

### Role Migration
```typescript
// Migrate users to new role structure
const migrateUserRoles = async () => {
  const users = await getAllUsers();
  
  for (const user of users) {
    const newPermissions = mapLegacyRoleToPermissions(user.legacy_role);
    
    await updateUser(user.id, {
      role: user.legacy_role,
      permissions: newPermissions
    });
  }
};
```

## Testing RBAC

### Unit Tests
```typescript
describe('Permission System', () => {
  test('should grant recipe creation to content creators', () => {
    const user = createMockUser('content_creator');
    const permissions = new PermissionChecker(user);
    
    expect(permissions.hasPermission('recipes', 'create')).toBe(true);
  });
  
  test('should deny user management to regular users', () => {
    const user = createMockUser('user');
    const permissions = new PermissionChecker(user);
    
    expect(permissions.hasPermission('users', 'manage')).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('Role-based Routes', () => {
  test('should redirect unauthorized users', async () => {
    const user = createMockUser('user');
    
    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });
});
```

This RBAC system provides a robust foundation for managing user access while maintaining security and scalability as the platform grows.