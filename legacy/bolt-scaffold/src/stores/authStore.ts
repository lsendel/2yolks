import { create } from 'zustand';
import { supabase, User } from '../lib/supabase';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
}

// Mock user data with RBAC
const mockUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@2yolks.com',
    full_name: 'System Administrator',
    is_admin: true,
    role: 'admin' as const,
    permissions: [
      { id: '1', name: 'manage_users', description: 'Manage all users', resource: 'users', action: 'manage' },
      { id: '2', name: 'moderate_content', description: 'Moderate content', resource: 'content', action: 'moderate' },
      { id: '3', name: 'view_analytics', description: 'View analytics', resource: 'analytics', action: 'view' },
      { id: '4', name: 'manage_system', description: 'Manage system', resource: 'system', action: 'manage' },
    ],
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'creator-1',
    username: 'chef_alessandro',
    email: 'alessandro@2yolks.com',
    full_name: 'Alessandro Romano',
    is_admin: false,
    role: 'content_creator' as const,
    permissions: [
      { id: '5', name: 'create_recipes', description: 'Create recipes', resource: 'recipes', action: 'create' },
      { id: '6', name: 'edit_own_recipes', description: 'Edit own recipes', resource: 'recipes', action: 'edit_own' },
      { id: '7', name: 'delete_own_recipes', description: 'Delete own recipes', resource: 'recipes', action: 'delete_own' },
      { id: '8', name: 'view_analytics', description: 'View analytics', resource: 'analytics', action: 'view' },
    ],
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          set({ user: profile, isAuthenticated: true, isLoading: false });
        }
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            set({ user: profile, isAuthenticated: true });
            apiClient.setAuthToken(session.access_token);
          }
        } else {
          set({ user: null, isAuthenticated: false });
          apiClient.removeAuthToken();
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      // Check for mock admin/creator accounts
      const mockUser = mockUsers.find(u => u.email === email);
      if (mockUser && password === 'password') {
        set({ user: mockUser as any, isAuthenticated: true });
        toast.success(`Welcome back, ${mockUser.username}!`);
        return true;
      }

      const { user, token } = await apiClient.signIn(email, password);
      
      if (user) {
        set({ user, isAuthenticated: true });
        apiClient.setAuthToken(token);
        toast.success('Welcome back!');
        return true;
      }

      return false;
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during sign in');
      return false;
    }
  },

  signUp: async (email: string, password: string, username: string, fullName?: string) => {
    try {
      // Check if username is available
      const existingUser = mockUsers.find(u => u.username === username);
      if (existingUser) {
        toast.error('Username is already taken');
        return false;
      }

      const { user, token } = await apiClient.signUp(email, password, username, fullName);
      
      if (user) {
        set({ user, isAuthenticated: true });
        apiClient.setAuthToken(token);
        toast.success('Account created successfully!');
        return true;
      }

      return false;
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during sign up');
      return false;
    }
  },

  signOut: async () => {
    try {
      await apiClient.signOut();
      set({ user: null, isAuthenticated: false });
      apiClient.removeAuthToken();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  },

  updateProfile: async (updates: Partial<User>) => {
    try {
      const { user } = get();
      if (!user) return false;

      const updatedUser = await apiClient.updateUser(user.id, updates);
      
      set({ user: updatedUser });
      toast.success('Profile updated successfully');
      return true;
    } catch (error) {
      toast.error('Error updating profile');
      return false;
    }
  },
}));