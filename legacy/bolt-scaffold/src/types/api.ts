// Core API types
export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  dietary_preferences?: string[];
  is_admin: boolean;
  role: 'user' | 'admin' | 'moderator' | 'content_creator';
  permissions: Permission[];
  created_at: string;
  updated_at?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  author_id: string;
  author?: User;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  cook_time: number;
  prep_time: number;
  servings: number;
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
  status: 'draft' | 'published' | 'archived' | 'flagged';
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
  duration?: number;
}

export interface Nutrition {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

export interface Review {
  id: string;
  recipe_id: string;
  user_id: string;
  user?: User;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at?: string;
  status: 'published' | 'flagged' | 'hidden';
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

export interface SavedRecipe {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe?: Recipe;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// Analytics types
export interface Analytics {
  totalUsers: number;
  totalRecipes: number;
  totalReviews: number;
  averageRating: number;
  recentActivity: ActivityItem[];
  popularRecipes: Recipe[];
  userGrowth: GrowthData[];
  recipeGrowth: GrowthData[];
}

export interface ActivityItem {
  id: string;
  type: 'user_registered' | 'recipe_created' | 'review_posted' | 'recipe_featured';
  user_id: string;
  user?: User;
  resource_id?: string;
  resource_type?: string;
  description: string;
  created_at: string;
}

export interface GrowthData {
  date: string;
  count: number;
}

// Content moderation types
export interface ModerationItem {
  id: string;
  content_type: 'recipe' | 'review' | 'user';
  content_id: string;
  reporter_id?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  moderator_id?: string;
  moderator_notes?: string;
  created_at: string;
  updated_at?: string;
}

// Search and filter types
export interface SearchFilters {
  query?: string;
  category?: string;
  difficulty?: string[];
  maxCookTime?: number;
  dietary?: string[];
  rating?: number;
  featured?: boolean;
  author?: string;
}

export interface SortOptions {
  field: 'created_at' | 'rating' | 'review_count' | 'title' | 'cook_time';
  direction: 'asc' | 'desc';
}