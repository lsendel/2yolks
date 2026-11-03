import React from 'react';
import { BarChart3, Users, ChefHat, TrendingUp, Eye, Heart, Clock, Star } from 'lucide-react';

const AdminAnalytics = () => {
  // Mock data for demonstration
  const stats = {
    totalUsers: 1247,
    totalRecipes: 892,
    totalViews: 15643,
    avgRating: 4.6
  };

  const recentActivity = [
    { type: 'recipe', action: 'New recipe added', user: 'Sarah Chen', time: '2 hours ago' },
    { type: 'user', action: 'New user registered', user: 'Mike Johnson', time: '4 hours ago' },
    { type: 'recipe', action: 'Recipe updated', user: 'Emma Davis', time: '6 hours ago' },
    { type: 'user', action: 'User upgraded to premium', user: 'Alex Rodriguez', time: '8 hours ago' }
  ];

  const topRecipes = [
    { name: 'Classic Chocolate Chip Cookies', views: 2341, likes: 189, rating: 4.8 },
    { name: 'Homemade Pizza Dough', views: 1987, likes: 156, rating: 4.7 },
    { name: 'Creamy Mushroom Risotto', views: 1654, likes: 134, rating: 4.6 },
    { name: 'Beef Bourguignon', views: 1432, likes: 112, rating: 4.9 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor your platform's performance and user engagement</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-sm text-green-600 mt-1">+12% from last month</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Recipes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalRecipes.toLocaleString()}</p>
                <p className="text-sm text-green-600 mt-1">+8% from last month</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <ChefHat className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalViews.toLocaleString()}</p>
                <p className="text-sm text-green-600 mt-1">+24% from last month</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-3xl font-bold text-gray-900">{stats.avgRating}</p>
                <p className="text-sm text-green-600 mt-1">+0.2 from last month</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-full ${
                    activity.type === 'recipe' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    {activity.type === 'recipe' ? (
                      <ChefHat className={`h-4 w-4 ${
                        activity.type === 'recipe' ? 'text-orange-600' : 'text-blue-600'
                      }`} />
                    ) : (
                      <Users className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-600">{activity.user}</p>
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="h-3 w-3 mr-1" />
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Recipes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Top Performing Recipes</h2>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {topRecipes.map((recipe, index) => (
                <div key={index} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{recipe.name}</h3>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium text-gray-700">{recipe.rating}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{recipe.views.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="h-4 w-4" />
                        <span>{recipe.likes}</span>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">User Growth Over Time</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Chart visualization would go here</p>
              <p className="text-sm text-gray-400">Integration with charting library needed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;