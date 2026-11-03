import { supabase, isValidConfig } from '../lib/supabase';
import { Recipe, User, Review } from '../types/api';

// Base API client configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: this.headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async signIn(email: string, password: string): Promise<{ user: User; token: string }> {
    if (isValidConfig) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        return {
          user: profile,
          token: data.session?.access_token || '',
        };
      }
    }
    
    return this.request<{ user: User; token: string }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signUp(email: string, password: string, username: string, fullName?: string): Promise<{ user: User; token: string }> {
    if (isValidConfig) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            username,
            full_name: fullName,
            is_admin: false,
          });

        if (profileError) throw profileError;

        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        return {
          user: profile,
          token: data.session?.access_token || '',
        };
      }
    }

    return this.request<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullName }),
    });
  }

  async signOut(): Promise<void> {
    if (isValidConfig) {
      await supabase.auth.signOut();
      return;
    }

    return this.request<void>('/auth/signout', {
      method: 'POST',
    });
  }

  // Recipe methods
  async getRecipes(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    difficulty?: string;
    featured?: boolean;
  }): Promise<{ recipes: Recipe[]; total: number; page: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    return this.request<{ recipes: Recipe[]; total: number; page: number; totalPages: number }>(
      `/recipes?${searchParams.toString()}`
    );
  }

  async getRecipe(id: string): Promise<Recipe> {
    return this.request<Recipe>(`/recipes/${id}`);
  }

  async createRecipe(recipe: Partial<Recipe>): Promise<Recipe> {
    return this.request<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  }

  async updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe> {
    return this.request<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  }

  async deleteRecipe(id: string): Promise<void> {
    return this.request<void>(`/recipes/${id}`, {
      method: 'DELETE',
    });
  }

  // User methods
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<{ users: User[]; total: number; page: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    return this.request<{ users: User[]; total: number; page: number; totalPages: number }>(
      `/users?${searchParams.toString()}`
    );
  }

  async getUser(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Review methods
  async getReviews(recipeId: string): Promise<Review[]> {
    return this.request<Review[]>(`/recipes/${recipeId}/reviews`);
  }

  async createReview(recipeId: string, review: Partial<Review>): Promise<Review> {
    return this.request<Review>(`/recipes/${recipeId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(review),
    });
  }

  async updateReview(recipeId: string, reviewId: string, review: Partial<Review>): Promise<Review> {
    return this.request<Review>(`/recipes/${recipeId}/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(review),
    });
  }

  async deleteReview(recipeId: string, reviewId: string): Promise<void> {
    return this.request<void>(`/recipes/${recipeId}/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  }

  // Admin methods
  async getAnalytics(): Promise<{
    totalUsers: number;
    totalRecipes: number;
    totalReviews: number;
    averageRating: number;
    recentActivity: any[];
    popularRecipes: Recipe[];
  }> {
    return this.request<{
      totalUsers: number;
      totalRecipes: number;
      totalReviews: number;
      averageRating: number;
      recentActivity: any[];
      popularRecipes: Recipe[];
    }>('/admin/analytics');
  }

  async moderateContent(contentId: string, action: 'approve' | 'reject' | 'flag'): Promise<void> {
    return this.request<void>(`/admin/moderate/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // Set authorization token
  setAuthToken(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  // Remove authorization token
  removeAuthToken(): void {
    delete this.headers['Authorization'];
  }
}

export const apiClient = new ApiClient();