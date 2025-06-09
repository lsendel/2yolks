import { createClient } from '@supabase/supabase-js';

// Check if we have valid Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidConfig = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project-id.supabase.co' && 
  supabaseAnonKey !== 'your-anon-key-here' &&
  supabaseUrl.includes('.supabase.co');

let supabase: any;

if (isValidConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    supabase = createMockClient();
  }
} else {
  console.warn('Supabase not configured properly. Please set up your environment variables.');
  supabase = createMockClient();
}

function createMockClient() {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Supabase not configured. Please set up your environment variables.' } 
      }),
      signUp: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Supabase not configured. Please set up your environment variables.' } 
      }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ 
        eq: () => ({ 
          single: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured. Please set up your environment variables.' } 
          }) 
        }),
        order: () => ({ 
          limit: () => Promise.resolve({ 
            data: [], 
            error: { message: 'Supabase not configured. Please set up your environment variables.' } 
          }) 
        }),
        or: () => ({ 
          order: () => Promise.resolve({ 
            data: [], 
            error: { message: 'Supabase not configured. Please set up your environment variables.' } 
          }) 
        })
      }),
      insert: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Supabase not configured. Please set up your environment variables.' } 
      }),
      update: () => ({ 
        eq: () => Promise.resolve({ 
          error: { message: 'Supabase not configured. Please set up your environment variables.' } 
        }) 
      }),
      delete: () => ({ 
        eq: () => Promise.resolve({ 
          error: { message: 'Supabase not configured. Please set up your environment variables.' } 
        }) 
      }),
      upsert: () => Promise.resolve({ 
        error: { message: 'Supabase not configured. Please set up your environment variables.' } 
      }),
    }),
  };
}

export { supabase, isValidConfig };

// Database Types
export interface Recipe {
  id: string;
  title: string;
  description: string;
  author_id: string;
  author?: {
    username: string;
    avatar_url?: string;
  };
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  cook_time: number;
  prep_time: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  nutrition?: Nutrition;
  rating: number;
  review_count: number;
  image_url?: string;
  gallery_images?: string[];
  created_at: string;
  updated_at: string;
  is_published: boolean;
  is_featured: boolean;
}

export interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

export interface Step {
  description: string;
  media_url?: string;
  media_type?: 'image' | 'video';
}

export interface Nutrition {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  dietary_preferences?: string[];
  is_admin: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  recipe_id: string;
  user_id: string;
  user?: User;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id: string;
  recipe?: Recipe;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  ingredient: Ingredient;
  is_checked: boolean;
  meal_plan_id?: string;
  created_at: string;
}