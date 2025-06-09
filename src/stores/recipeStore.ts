import { create } from 'zustand';
import { supabase, Recipe, isValidConfig } from '../lib/supabase';
import { sampleRecipes } from '../data/sampleRecipes';
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
  
  // Actions
  fetchRecipes: () => Promise<void>;
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

  fetchRecipes: async () => {
    set({ isLoading: true });
    
    if (!isValidConfig) {
      // Use sample data when Supabase is not configured
      setTimeout(() => {
        set({ recipes: sampleRecipes, isLoading: false });
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
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        // Fallback to sample data
        set({ recipes: sampleRecipes, isLoading: false });
        return;
      }
      
      set({ recipes: data || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching recipes:', error);
      // Fallback to sample data
      set({ recipes: sampleRecipes, isLoading: false });
    }
  },

  fetchFeaturedRecipes: async () => {
    if (!isValidConfig) {
      // Use sample featured recipes
      const featured = sampleRecipes.filter(recipe => recipe.is_featured);
      set({ featuredRecipes: featured });
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
        return;
      }
      
      set({ featuredRecipes: data || [] });
    } catch (error) {
      console.error('Error fetching featured recipes:', error);
      // Fallback to sample data
      const featured = sampleRecipes.filter(recipe => recipe.is_featured);
      set({ featuredRecipes: featured });
    }
  },

  fetchUserRecipes: async (userId: string) => {
    set({ isLoading: true });
    
    if (!isValidConfig) {
      // Use sample data filtered by user
      const userRecipes = sampleRecipes.filter(recipe => recipe.author_id === userId);
      setTimeout(() => {
        set({ userRecipes, isLoading: false });
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
        return;
      }
      
      set({ userRecipes: data || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching user recipes:', error);
      set({ userRecipes: [], isLoading: false });
    }
  },

  fetchSavedRecipes: async (userId: string) => {
    if (!isValidConfig) {
      // Use sample saved recipes
      const saved = sampleRecipes.slice(0, 3);
      set({ savedRecipes: saved });
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
        return;
      }
      
      set({ savedRecipes: data?.map(item => item.recipe).filter(Boolean) || [] });
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
    }
  },

  searchRecipes: async (query: string) => {
    set({ isLoading: true, searchQuery: query });
    
    if (!isValidConfig) {
      // Filter sample recipes by query
      const filtered = sampleRecipes.filter(recipe =>
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.description.toLowerCase().includes(query.toLowerCase()) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      setTimeout(() => {
        set({ recipes: filtered, isLoading: false });
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
        return;
      }
      
      set({ recipes: data || [], isLoading: false });
    } catch (error) {
      console.error('Error searching recipes:', error);
      // Fallback to filtered sample data
      const filtered = sampleRecipes.filter(recipe =>
        recipe.title.toLowerCase().includes(query.toLowerCase()) ||
        recipe.description.toLowerCase().includes(query.toLowerCase()) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      set({ recipes: filtered, isLoading: false });
    }
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
}));