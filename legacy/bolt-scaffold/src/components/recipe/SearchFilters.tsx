import React from 'react';
import { Filter, X } from 'lucide-react';
import { useRecipeStore } from '../../stores/recipeStore';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchFiltersProps {
  isOpen: boolean;
  onToggle: () => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ isOpen, onToggle }) => {
  const { filters, setFilters, clearFilters } = useRecipeStore();

  const cuisineOptions = [
    'Italian', 'Mexican', 'Asian', 'American', 'Mediterranean', 
    'Indian', 'French', 'Thai', 'Japanese', 'Greek'
  ];

  const difficultyOptions = ['Easy', 'Medium', 'Hard'];

  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 
    'Keto', 'Paleo', 'Low-Carb', 'High-Protein'
  ];

  const handleCuisineChange = (cuisine: string) => {
    const newCuisines = filters.cuisine.includes(cuisine)
      ? filters.cuisine.filter(c => c !== cuisine)
      : [...filters.cuisine, cuisine];
    setFilters({ cuisine: newCuisines });
  };

  const handleDifficultyChange = (difficulty: string) => {
    const newDifficulties = filters.difficulty.includes(difficulty)
      ? filters.difficulty.filter(d => d !== difficulty)
      : [...filters.difficulty, difficulty];
    setFilters({ difficulty: newDifficulties });
  };

  const handleDietaryChange = (dietary: string) => {
    const newDietary = filters.dietary.includes(dietary)
      ? filters.dietary.filter(d => d !== dietary)
      : [...filters.dietary, dietary];
    setFilters({ dietary: newDietary });
  };

  const hasActiveFilters = 
    filters.cuisine.length > 0 || 
    filters.difficulty.length > 0 || 
    filters.dietary.length > 0 || 
    filters.maxCookTime < 120;

  return (
    <div className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={onToggle}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
          isOpen || hasActiveFilters
            ? 'bg-orange-500 text-white border-orange-500'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <Filter size={16} />
        <span>Filters</span>
        {hasActiveFilters && (
          <span className="bg-white text-orange-500 text-xs px-1.5 py-0.5 rounded-full font-medium">
            {[...filters.cuisine, ...filters.difficulty, ...filters.dietary].length}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Cook Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Cook Time: {filters.maxCookTime} minutes
                </label>
                <input
                  type="range"
                  min="15"
                  max="120"
                  value={filters.maxCookTime}
                  onChange={(e) => setFilters({ maxCookTime: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>15m</span>
                  <span>120m</span>
                </div>
              </div>

              {/* Cuisine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cuisine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {cuisineOptions.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => handleCuisineChange(cuisine)}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.cuisine.includes(cuisine)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty
                </label>
                <div className="flex space-x-2">
                  {difficultyOptions.map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => handleDifficultyChange(difficulty)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.difficulty.includes(difficulty)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dietary Preferences
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {dietaryOptions.map((dietary) => (
                    <button
                      key={dietary}
                      onClick={() => handleDietaryChange(dietary)}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.dietary.includes(dietary)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {dietary}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchFilters;