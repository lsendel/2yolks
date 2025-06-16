import { create } from 'zustand';
import { supabase, Recipe, isValidConfig } from '../lib/supabase';
import { sampleRecipes } from '../data/sampleRecipes';
import { ApiCache, PerformanceMonitor } from '../utils/api';
import { trackRecipeSearch } from '../utils/seo';
import toast from 'react-hot-toast';

interface RecipeState {
  recipes: Recipe[];
  featuredRecipes: Recipe[];
  userRecipes: Recipe[];
  savedRecipes: Recipe[];
  isLoading: boolean;
  searchQuery: string;
  filters: {
    cuisine: string[];
    difficulty: string[];
    maxCookTime: number;
    dietary: string[];
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  
  // Actions
  fetchRecipes: (page?: number) => Promise<void>;
  fetchFeaturedRecipes: () => Promise<void>;
  fetchUserRecipes: (userId: string) => Promise<void>;
  fetchSavedRecipes: (userId: string) => Promise<void>;
  searchRecipes: (query: string) => Promise<void>;
  addRecipe: (recipe: Partial<Recipe>) => Promise<string | null>;
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<boolean>;
  deleteRecipe: (id: string) => Promise<boolean>;
  saveRecipe: (recipeId: string, userId: string) => Promise<boolean>;
  unsaveRecipe: (recipeId: string, userId: string) => Promise<boolean>;
  rateRecipe: (recipeId: string, userId: string, rating: number, comment?: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<RecipeState['filters']>) => void;
  clearFilters: () => void;
  loadMore: () => Promise<void>;
  refreshRecipes: () => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  featuredRecipes: [],
  userRecipes: [],
  savedRecipes: [],
  isLoading: false,
  searchQuery: '',
  filters: {
    cuisine: [],
    difficulty: [],
    maxCookTime: 120,
    dietary: [],
  },
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    hasMore: true,
  },

  fetchRecipes: async (page = 1) => {
    const endTimer = PerformanceMonitor.startTimer('fetchRecipes');
    set({ isLoading: true });
    
    const cacheKey = `recipes-page-${page}`;
    const cached = ApiCache.get(cacheKey);
    
    if (cached && page === 1) {
      set({ recipes: cached, isLoading: false });
      endTimer();
      return;
    }

    if (!isValidConfig) {
      // Use sample data when Supabase is not configured
      setTimeout(() => {
        const startIndex = (page - 1) * 12;
        const endIndex = startIndex + 12;
        const paginatedRecipes = sampleRecipes.slice(startIndex, endIndex);
        
        set(state => ({
          recipes: page === 1 ? paginatedRecipes : [...state.recipes, ...paginatedRecipes],
          isLoading: false,
          pagination: {
            ...state.pagination,
            page,
            total: sampleRecipes.length,
            hasMore: endIndex < sampleRecipes.length,
          }
        }));
        
        if (page === 1) {
          ApiCache.set(cacheKey, paginatedRecipes, 5 * 60 * 1000);
        }
        endTimer();
      }, 500);
      return;
    }

    try {
      const { data, error, count } = await supabase
        .from('recipes')
        .select(`
          *,
          author:users(username, avatar_url)
        `, { count: 'exact' })
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range((page - 1) * 12, page * 12 - 1);

      if (error) {
        console.error('Supabase error:', error);
        // Fallback to sample data
        const startIndex = (page - 1) * 12;
        const endIndex = startIndex + 12;
        const paginatedRecipes = sampleRecipes.slice(startIndex, endIndex);
        
        set(state => ({
          recipes: page === 1 ? paginatedRecipes : [...state.recipes, ...paginatedRecipes],
          isLoading: false,
          pagination: {
            ...state.pagination,
            page,
            total: sampleRecipes.length,
            hasMore: endIndex < sampleRecipes.length,
          }
        }));
        endTimer();
        return;
      }
      
      const recipes = data || [];
      set(state => ({
        recipes: page === 1 ? recipes : [...state.recipes, ...recipes],
        isLoading: false,
        pagination: {
          ...state.pagination,
          page,
          total: count || 0,
          hasMore: recipes.length === 12,
        }
      }));

      if (page === 1) {
        ApiCache.set(cacheKey, recipes, 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      // Fallback to sample data
      const startIndex = (page - 1) * 12;
      const endIndex = startIndex + 12;
      const paginatedRecipes = sampleRecipes.slice(startIndex, endIndex);
      
      set(state => ({
        recipes: page === 1 ? paginatedRecipes : [...state.recipes, ...paginatedRecipes],
        isLoading: false,
        pagination: {
          ...state.pagination,
          page,
          total: sampleRecipes.length,
          hasMore: endIndex < sampleRecipes.length,
        }
      }));
    }
    
    endTimer();
  },

  fetchFeaturedRecipes: async () => {
    const endTimer = PerformanceMonitor.startTimer('fetchFeaturedRecipes');
    const cacheKey = 'featured-recipes';
    const cached = ApiCache.get(cacheKey);
    
    if (cached) {
      set({ featuredRecipes: cached });
      endTimer();
      return;
    }

    if (!isValidConfig) {
      // Use sample featured recipes
      const featured = sampleRecipes.filter(recipe => recipe.is_featured);
      set({ featuredRecipes: featured });
      ApiCache.set(cacheKey, featured, 15 * 60 * 1000);
      endTimer();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          author:users(username, avatar_url)
        `)
        .eq('is_published', true)
        .eq('is_featured', true)
        .order('rating', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Supabase error:', error);
        // Fallback to sample data
        const featured = sampleRecipes.filter(recipe => recipe.is_featured);
        set({ featuredRecipes: featured });
        ApiCache.set(cacheKey, featured, 15 * 60 * 1000);
        endTimer();
        return;
      }
      
      set({ featuredRecipes: data || [] });
      ApiCache.set(cacheKey, data || [], 15 * 60 * 1000);
    } catch (error) {
      console.error('Error fetching featured recipes:', error);
      // Fallback to sample data
      const featured = sampleRecipes.filter(recipe => recipe.is_featured);
      set({ featuredRecipes: featured });
      ApiCache.set(cacheKey, featured, 15 * 60 * 1000);
    }
    
    endTimer();
  },

  fetchUserRecipes: async (userId: string) => {
    const endTimer = PerformanceMonitor.startTimer('fetchUserRecipes');
    set({ isLoading: true });
    
    const cacheKey = `user-recipes-${userId}`;
    const cached = ApiCache.get(cacheKey);
    
    if (cached) {
      set({ userRecipes: cached, isLoading: false });
      endTimer();
      return;
    }
    
    if (!isValidConfig) {
      // Use sample data filtered by user
      const userRecipes = sampleRecipes.filter(recipe => recipe.author_id === userId);
      setTimeout(() => {
        set({ userRecipes, isLoading: false });
        ApiCache.set(cacheKey, userRecipes, 10 * 60 * 1000);
        endTimer();
      }, 500);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          author:users(username, avatar_url)
        `)
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        set({ userRecipes: [], isLoading: false });
        endTimer();
        return;
      }
      
      set({ userRecipes: data || [], isLoading: false });
      ApiCache.set(cacheKey, data || [], 10 * 60 * 1000);
    } catch (error) {
      console.error('Error fetching user recipes:', error);
      set({ userRecipes: [], isLoading: false });
    }
    
    endTimer();
  },

  fetchSavedRecipes: async (userId: string) => {
    const endTimer = PerformanceMonitor.startTimer('fetchSavedRecipes');
    const cacheKey = `saved-recipes-${userId}`;
    const cached = ApiCache.get(cacheKey);
    
    if (cached) {
      set({ savedRecipes: cached });
      endTimer();
      return;
    }

    if (!isValidConfig) {
      // Use sample saved recipes
      const saved = sampleRecipes.slice(0, 3);
      set({ savedRecipes: saved });
      ApiCache.set(cacheKey, saved, 5 * 60 * 1000);
      endTimer();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_recipes')
        .select(`
          recipe:recipes(
            *,
            author:users(username, avatar_url)
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error:', error);
        endTimer();
        return;
      }
      
      const savedRecipes = data?.map(item => item.recipe).filter(Boolean) || [];
      set({ savedRecipes });
      ApiCache.set(cacheKey, savedRecipes, 5 * 60 * 1000);
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
    }
    
    endTimer();
  },

  searchRecipes: async (query: string) => {
    const endTimer = PerformanceMonitor.startTimer('searchRecipes');
    set({ isLoading: true, searchQuery: query });
    
    const cacheKey = `search-${query}`;
    const cached = ApiCache.get(cacheKey);
    
    if (cached) {
      set({ recipes: cached, isLoading: false });
      trackRecipeSearch(query, cached.length);
      endTimer();
      return;
    }
    
    if (!isValidConfig) {
      // Filter sample recipes by query
      const filtered = sampleRecipes.filter(recipe =>
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.description.toLowerCase().includes(query.toLowerCase()) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      setTimeout(() => {
        set({ recipes: filtered, isLoading: false });
        ApiCache.set(cacheKey, filtered, 2 * 60 * 1000);
        trackRecipeSearch(query, filtered.length);
        endTimer();
      }, 500);
      return;
    }

    try {
      let queryBuilder = supabase
        .from('recipes')
        .select(`
          *,
          author:users(username, avatar_url)
        `)
        .eq('is_published', true);

      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`);
      }

      const { data, error } = await queryBuilder.order('rating', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        // Fallback to filtered sample data
        const filtered = sampleRecipes.filter(recipe =>
          recipe.title.toLowerCase().includes(query.toLowerCase()) ||
          recipe.description.toLowerCase().includes(query.toLowerCase()) ||
          recipe.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        set({ recipes: filtered, isLoading: false });
        ApiCache.set(cacheKey, filtered, 2 * 60 * 1000);
        trackRecipeSearch(query, filtered.length);
        endTimer();
        return;
      }
      
      set({ recipes: data || [], isLoading: false });
      ApiCache.set(cacheKey, data || [], 2 * 60 * 1000);
      trackRecipeSearch(query, (data || []).length);
    } catch (error) {
      console.error('Error searching recipes:', error);
      // Fallback to filtered sample data
      const filtered = sampleRecipes.filter(recipe =>
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.description.toLowerCase().includes(query.toLowerCase()) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      set({ recipes: filtered, isLoading: false });
      ApiCache.set(cacheKey, filtered, 2 * 60 * 1000);
      trackRecipeSearch(query, filtered.length);
    }
    
    endTimer();
  },

  addRecipe: async (recipe: Partial<Recipe>) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to add recipes.');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert(recipe)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to add recipe. Please check your database connection.');
        return null;
      }
      
      // Clear cache
      ApiCache.clear('recipes');
      ApiCache.clear('user-recipes');
      
      toast.success('Recipe added successfully!');
      return data.id;
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast.error('Failed to add recipe. Please check your database connection.');
      return null;
    }
  },

  updateRecipe: async (id: string, updates: Partial<Recipe>) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to update recipes.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to update recipe. Please check your database connection.');
        return false;
      }
      
      // Clear cache
      ApiCache.clear('recipes');
      ApiCache.clear('user-recipes');
      
      toast.success('Recipe updated successfully!');
      return true;
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast.error('Failed to update recipe. Please check your database connection.');
      return false;
    }
  },

  deleteRecipe: async (id: string) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to delete recipes.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to delete recipe. Please check your database connection.');
        return false;
      }
      
      // Update local state
      const { userRecipes } = get();
      set({ userRecipes: userRecipes.filter(recipe => recipe.id !== id) });
      
      // Clear cache
      ApiCache.clear('recipes');
      ApiCache.clear('user-recipes');
      
      toast.success('Recipe deleted successfully!');
      return true;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe. Please check your database connection.');
      return false;
    }
  },

  saveRecipe: async (recipeId: string, userId: string) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to save recipes.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('saved_recipes')
        .insert({ recipe_id: recipeId, user_id: userId });

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to save recipe. Please check your database connection.');
        return false;
      }
      
      // Clear saved recipes cache
      ApiCache.clear(`saved-recipes-${userId}`);
      
      toast.success('Recipe saved!');
      return true;
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe. Please check your database connection.');
      return false;
    }
  },

  unsaveRecipe: async (recipeId: string, userId: string) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to unsave recipes.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('saved_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to remove recipe from saved. Please check your database connection.');
        return false;
      }
      
      // Clear saved recipes cache
      ApiCache.clear(`saved-recipes-${userId}`);
      
      toast.success('Recipe removed from saved');
      return true;
    } catch (error) {
      console.error('Error unsaving recipe:', error);
      toast.error('Failed to remove recipe from saved. Please check your database connection.');
      return false;
    }
  },

  rateRecipe: async (recipeId: string, userId: string, rating: number, comment?: string) => {
    if (!isValidConfig) {
      toast.error('Database not configured. Please set up Supabase to rate recipes.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .upsert({
          recipe_id: recipeId,
          user_id: userId,
          rating,
          comment,
        });

      if (error) {
        console.error('Supabase error:', error);
        toast.error('Failed to submit review. Please check your database connection.');
        return false;
      }
      
      // Clear related caches
      ApiCache.clear('recipes');
      ApiCache.clear('featured');
      
      toast.success('Review submitted!');
      return true;
    } catch (error) {
      console.error('Error rating recipe:', error);
      toast.error('Failed to submit review. Please check your database connection.');
      return false;
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setFilters: (newFilters: Partial<RecipeState['filters']>) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  clearFilters: () =>
    set({
      filters: {
        cuisine: [],
        difficulty: [],
        maxCookTime: 120,
        dietary: [],
      },
    }),

  loadMore: async () => {
    const { pagination, isLoading } = get();
    if (isLoading || !pagination.hasMore) return;
    
    await get().fetchRecipes(pagination.page + 1);
  },

  refreshRecipes: async () => {
    // Clear all caches
    ApiCache.clear();
    
    // Reset pagination
    set({
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        hasMore: true,
      }
    });
    
    // Fetch fresh data
    await get().fetchRecipes(1);
    await get().fetchFeaturedRecipes();
  },
}));