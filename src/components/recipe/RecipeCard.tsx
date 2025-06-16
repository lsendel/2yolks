import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star, Heart, User, ChefHat, Eye, MessageCircle, Bookmark } from 'lucide-react';
import { Recipe } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { trackRecipeView, trackRecipeSave } from '../../utils/seo';

interface RecipeCardProps {
  recipe: Recipe;
  onSave?: (recipeId: string) => void;
  isSaved?: boolean;
  showAuthor?: boolean;
  showActions?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'featured';
}

const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onSave,
  isSaved = false,
  showAuthor = true,
  showActions = false,
  className = '',
  variant = 'default',
}) => {
  const totalTime = recipe.prep_time + recipe.cook_time;

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSave) {
      onSave(recipe.id);
      trackRecipeSave(recipe.id, recipe.title);
    }
  };

  const handleCardClick = () => {
    trackRecipeView(recipe.id, recipe.title);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-emerald-500/90 text-white shadow-emerald-500/25';
      case 'Medium':
        return 'bg-amber-500/90 text-white shadow-amber-500/25';
      case 'Hard':
        return 'bg-rose-500/90 text-white shadow-rose-500/25';
      default:
        return 'bg-slate-500/90 text-white shadow-slate-500/25';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
        return 'max-w-sm';
      case 'featured':
        return 'max-w-md ring-2 ring-orange-200 dark:ring-orange-800';
      default:
        return '';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`group bg-white dark:bg-gray-800 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 dark:border-gray-700 backdrop-blur-sm ${getVariantClasses()} ${className}`}
    >
      <Link to={`/recipe/${recipe.id}`} className="block" onClick={handleCardClick}>
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
              <ChefHat className="text-6xl text-slate-400 dark:text-gray-500" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex space-x-2">
            {onSave && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveClick}
                className={`p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg ${
                  isSaved
                    ? 'bg-rose-500/90 text-white shadow-rose-500/25'
                    : 'bg-white/90 text-gray-600 hover:bg-rose-500 hover:text-white shadow-black/10'
                }`}
              >
                <Heart size={18} className={isSaved ? 'fill-current' : ''} />
              </motion.button>
            )}
            
            {showActions && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-full bg-white/90 text-gray-600 hover:bg-blue-500 hover:text-white backdrop-blur-md transition-all duration-300 shadow-lg"
              >
                <Bookmark size={18} />
              </motion.button>
            )}
          </div>

          {/* Badges */}
          <div className="absolute bottom-4 left-4 flex space-x-2">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-md shadow-lg ${getDifficultyColor(recipe.difficulty)}`}>
              {recipe.difficulty}
            </span>
            
            {recipe.is_featured && (
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white backdrop-blur-md shadow-lg shadow-amber-500/25">
                ⭐ Featured
              </span>
            )}
          </div>

          {/* Quick Stats Overlay */}
          <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="flex space-x-3 text-white text-sm">
              <div className="flex items-center space-x-1 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
                <Eye size={14} />
                <span>{recipe.review_count * 10}</span>
              </div>
              <div className="flex items-center space-x-1 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
                <MessageCircle size={14} />
                <span>{recipe.review_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Title */}
          <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-4 line-clamp-2 group-hover:text-orange-500 transition-colors leading-tight tracking-wide">
            {recipe.title}
          </h3>

          {/* Description */}
          {recipe.description && variant !== 'compact' && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
              {/* Time */}
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Clock size={14} className="text-orange-500" />
                </div>
                <span className="font-medium">{totalTime}m</span>
              </div>

              {/* Rating */}
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Star size={14} className="text-amber-500 fill-current" />
                </div>
                <span className="font-medium">{recipe.rating.toFixed(1)}</span>
                <span className="text-xs opacity-75">({recipe.review_count})</span>
              </div>
            </div>

            {/* Nutrition Highlight */}
            {recipe.nutrition && variant !== 'compact' && (
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-full font-medium">
                {recipe.nutrition.calories} cal
              </div>
            )}
          </div>

          {/* Author */}
          {showAuthor && recipe.author && variant !== 'compact' && (
            <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
              {recipe.author.avatar_url ? (
                <img
                  src={recipe.author.avatar_url}
                  alt={recipe.author.username}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full flex items-center justify-center shadow-lg">
                  <User size={16} className="text-white" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white tracking-wide">
                  {recipe.author.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recipe Creator
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && variant !== 'compact' && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-900/20 dark:to-rose-900/20 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium border border-orange-200 dark:border-orange-800 tracking-wide"
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full font-medium">
                  +{recipe.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Compact variant tags */}
          {recipe.tags && recipe.tags.length > 0 && variant === 'compact' && (
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export default RecipeCard;