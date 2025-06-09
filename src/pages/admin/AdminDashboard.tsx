import React, { useEffect, useState } from 'react';
import { Users, BookOpen, Star, TrendingUp, Flag, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';

interface DashboardStats {
  totalUsers: number;
  totalRecipes: number;
  totalReviews: number;
  averageRating: number;
  flaggedContent: number;
  todaySignups: number;
  todayRecipes: number;
  popularRecipes: any[];
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRecipes: 0,
    totalReviews: 0,
    averageRating: 0,
    flaggedContent: 0,
    todaySignups: 0,
    todayRecipes: 0,
    popularRecipes: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get total recipes
      const { count: totalRecipes } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true);

      // Get total reviews
      const { count: totalReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });

      // Get average rating
      const { data: ratingData } = await supabase
        .from('reviews')
        .select('rating');

      const averageRating = ratingData?.length
        ? ratingData.reduce((sum, review) => sum + review.rating, 0) / ratingData.length
        : 0;

      // Get today's signups
      const today = new Date().toISOString().split('T')[0];
      const { count: todaySignups } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Get today's recipes
      const { count: todayRecipes } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Get popular recipes
      const { data: popularRecipes } = await supabase
        .from('recipes')
        .select(`
          id, title, rating, review_count,
          author:users(username)
        `)
        .eq('is_published', true)
        .order('rating', { ascending: false })
        .limit(5);

      setStats({
        totalUsers: totalUsers || 0,
        totalRecipes: totalRecipes || 0,
        totalReviews: totalReviews || 0,
        averageRating,
        flaggedContent: 0, // Would need a flagged_content table
        todaySignups: todaySignups || 0,
        todayRecipes: todayRecipes || 0,
        popularRecipes: popularRecipes || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      change: stats.todaySignups > 0 ? `+${stats.todaySignups} today` : '',
    },
    {
      title: 'Total Recipes',
      value: stats.totalRecipes,
      icon: BookOpen,
      color: 'bg-green-500',
      change: stats.todayRecipes > 0 ? `+${stats.todayRecipes} today` : '',
    },
    {
      title: 'Total Reviews',
      value: stats.totalReviews,
      icon: Star,
      color: 'bg-yellow-500',
      change: '',
    },
    {
      title: 'Average Rating',
      value: stats.averageRating.toFixed(1),
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: '',
    },
    {
      title: 'Flagged Content',
      value: stats.flaggedContent,
      icon: Flag,
      color: 'bg-red-500',
      change: 'Needs Review',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of your Bolt Recipes platform
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  {stat.change && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="text-white" size={24} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Popular Recipes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Popular Recipes
              </h2>
              <Eye className="text-gray-400" size={20} />
            </div>
            
            <div className="space-y-4">
              {stats.popularRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {recipe.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      by {recipe.author?.username}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="text-yellow-500" size={16} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {recipe.rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({recipe.review_count})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quick Actions
              </h2>
              <TrendingUp className="text-gray-400" size={20} />
            </div>
            
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                <div className="font-medium text-orange-900 dark:text-orange-300">
                  Review Flagged Content
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-400">
                  {stats.flaggedContent} items pending review
                </div>
              </button>
              
              <button className="w-full text-left p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <div className="font-medium text-blue-900 dark:text-blue-300">
                  Featured Recipe Management
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  Manage featured content
                </div>
              </button>
              
              <button className="w-full text-left p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <div className="font-medium text-green-900 dark:text-green-300">
                  User Analytics
                </div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  View detailed user metrics
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;