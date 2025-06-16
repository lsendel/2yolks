import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  BookOpen, 
  TrendingUp, 
  Users, 
  Star,
  Eye,
  Heart,
  MessageCircle,
  Calendar,
  BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useRecipeStore } from '../../stores/recipeStore';
import { Recipe } from '../../types/api';

const ContentCreatorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { recipes, fetchUserRecipes } = useRecipeStore();
  const [stats, setStats] = useState({
    totalRecipes: 0,
    totalViews: 0,
    totalLikes: 0,
    averageRating: 0,
    followers: 0
  });
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCreatorData();
    }
  }, [user]);

  const fetchCreatorData = async () => {
    try {
      setLoading(true);
      
      if (user) {
        await fetchUserRecipes(user.id);
        
        // Calculate stats from user's recipes
        const userRecipes = recipes.filter(recipe => recipe.author_id === user.id);
        const totalViews = userRecipes.reduce((sum, recipe) => sum + (recipe.review_count * 10), 0); // Mock view calculation
        const totalLikes = userRecipes.reduce((sum, recipe) => sum + recipe.review_count, 0);
        const averageRating = userRecipes.length > 0 
          ? userRecipes.reduce((sum, recipe) => sum + recipe.rating, 0) / userRecipes.length 
          : 0;

        setStats({
          totalRecipes: userRecipes.length,
          totalViews,
          totalLikes,
          averageRating,
          followers: Math.floor(Math.random() * 1000) + 100 // Mock followers
        });

        setRecentRecipes(userRecipes.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Creator Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your recipes and track your performance
              </p>
            </div>
            <Link
              to="/add-recipe"
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-6 py-3 rounded-2xl font-semibold hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <PlusCircle size={20} />
              <span>Create Recipe</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Recipes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalRecipes}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Views</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalViews.toLocaleString()}</p>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Likes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLikes}</p>
              </div>
              <Heart className="h-8 w-8 text-rose-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.averageRating.toFixed(1)}</p>
              </div>
              <Star className="h-8 w-8 text-amber-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Followers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.followers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </motion.div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Recipes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Recipes</h2>
              <Link
                to="/my-recipes"
                className="text-orange-500 hover:text-orange-600 font-medium text-sm"
              >
                View All
              </Link>
            </div>

            <div className="space-y-4">
              {recentRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">
                      {recipe.title}
                    </h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-amber-500 fill-current" />
                        <span>{recipe.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle size={14} />
                        <span>{recipe.review_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {recipe.review_count * 10} views
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}

              {recentRecipes.length === 0 && (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No recipes yet</p>
                  <Link
                    to="/add-recipe"
                    className="inline-flex items-center space-x-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <PlusCircle size={16} />
                    <span>Create Your First Recipe</span>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>

          {/* Performance Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Performance Overview</h2>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-6">
              {/* Views Trend */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Views This Month</span>
                  <span className="text-sm font-bold text-green-600">+15%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              {/* Engagement Trend */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement Rate</span>
                  <span className="text-sm font-bold text-blue-600">+8%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>

              {/* Rating Trend */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Rating</span>
                  <span className="text-sm font-bold text-amber-600">4.7/5</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: '94%' }}></div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/add-recipe"
                  className="flex items-center justify-center space-x-2 p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <PlusCircle size={16} />
                  <span className="text-sm font-medium">New Recipe</span>
                </Link>
                <Link
                  to="/my-recipes"
                  className="flex items-center justify-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <BookOpen size={16} />
                  <span className="text-sm font-medium">Manage</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ContentCreatorDashboard;