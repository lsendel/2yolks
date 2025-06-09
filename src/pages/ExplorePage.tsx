import React, { useState, useEffect } from 'react';
import { Search, Grid, List, Filter, SlidersHorizontal } from 'lucide-react';
import { useRecipeStore } from '../stores/recipeStore';
import { useAuthStore } from '../stores/authStore';
import RecipeCard from '../components/recipe/RecipeCard';
import SearchFilters from '../components/recipe/SearchFilters';
import { motion } from 'framer-motion';

const ExplorePage: React.FC = () => {
  const {
    recipes,
    isLoading,
    searchQuery,
    fetchRecipes,
    searchRecipes,
    setSearchQuery,
    saveRecipe,
    unsaveRecipe,
  } = useRecipeStore();
  
  const { user, isAuthenticated } = useAuthStore();
  
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'rating' | 'popular'>('newest');

  // Quick filter categories
  const quickFilters = [
    { label: 'All Recipes', value: 'all', active: true },
    { label: 'Popular', value: 'popular' },
    { label: 'New', value: 'newest' },
    { label: 'Quick (30min)', value: 'quick' },
    { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Gourmet', value: 'gourmet' }
  ];

  useEffect(() => {
    if (searchQuery) {
      searchRecipes(searchQuery);
    } else {
      fetchRecipes();
    }
  }, [searchQuery, fetchRecipes, searchRecipes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearchQuery);
  };

  const handleSaveRecipe = async (recipeId: string) => {
    if (!isAuthenticated || !user) return;
    
    // Check if already saved (this would need to be tracked in state)
    const isSaved = false; // This would come from user's saved recipes
    
    if (isSaved) {
      await unsaveRecipe(recipeId, user.id);
    } else {
      await saveRecipe(recipeId, user.id);
    }
  };

  const sortedRecipes = [...recipes].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'popular':
        return b.review_count - a.review_count;
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Discover Recipes
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Explore our collection of extraordinary recipes from passionate chefs
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search recipes, ingredients, or cuisines..."
                className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-semibold transition-colors duration-200"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick Filter Categories */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {quickFilters.map((filter) => (
              <button
                key={filter.value}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  filter.active
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-colors ${
                isFiltersOpen
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
            </button>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="rating">Highest Rated</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {isFiltersOpen && (
          <div className="mb-8">
            <SearchFilters
              isOpen={isFiltersOpen}
              onToggle={() => setIsFiltersOpen(!isFiltersOpen)}
            />
          </div>
        )}

        {/* Results Count */}
        {!isLoading && (
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? `${sortedRecipes.length} recipes found for "${searchQuery}"`
                : `${sortedRecipes.length} recipes available`
              }
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Recipe Grid */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-6'
            }
          >
            {sortedRecipes.length > 0 ? (
              sortedRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <RecipeCard
                    recipe={recipe}
                    onSave={isAuthenticated ? handleSaveRecipe : undefined}
                    className={viewMode === 'list' ? 'flex-row h-32' : ''}
                  />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  No recipes found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search or filters to discover new recipes'
                    : 'Be the first to share a recipe with our community!'
                  }
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setLocalSearchQuery('');
                    }}
                    className="text-orange-500 hover:text-orange-600 font-semibold"
                  >
                    Clear search and explore all recipes
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;