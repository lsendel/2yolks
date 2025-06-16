import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChefHat, Users, ArrowRight, Star, Clock, TrendingUp, Sparkles, Play, Heart, BookOpen } from 'lucide-react';
import { useRecipeStore } from '../stores/recipeStore';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

const HomePage: React.FC = () => {
  const { featuredRecipes, recipes, fetchFeaturedRecipes, fetchRecipes, searchRecipes } = useRecipeStore();
  const { isAuthenticated, user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Curated food images for the rotating panel
  const heroImages = [
    {
      url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Truffle Risotto',
      description: 'Creamy perfection with wild mushrooms',
      chef: 'Chef Alessandro'
    },
    {
      url: 'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Wagyu Steak',
      description: 'Premium cuts, perfectly seared',
      chef: 'Chef Marcus'
    },
    {
      url: 'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Seared Scallops',
      description: 'Ocean delicacy with cauliflower purée',
      chef: 'Chef Isabella'
    }
  ];

  // Trending tags for quick discovery
  const trendingTags = [
    { tag: '#30min', color: 'from-emerald-400 to-teal-500' },
    { tag: '#weeknight', color: 'from-blue-400 to-indigo-500' },
    { tag: '#comfort', color: 'from-amber-400 to-orange-500' },
    { tag: '#healthy', color: 'from-green-400 to-emerald-500' },
    { tag: '#gourmet', color: 'from-purple-400 to-pink-500' },
    { tag: '#vegetarian', color: 'from-lime-400 to-green-500' }
  ];

  useEffect(() => {
    fetchFeaturedRecipes();
    fetchRecipes();
  }, [fetchFeaturedRecipes, fetchRecipes]);

  // Auto-rotate images every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchRecipes(searchQuery);
      window.location.href = '/explore';
    }
  };

  const handleTagClick = (tag: string) => {
    const cleanTag = tag.replace('#', '');
    searchRecipes(cleanTag);
    window.location.href = '/explore';
  };

  const recentRecipes = recipes.slice(0, 6);
  const trendingRecipes = recipes.filter(r => r.rating >= 4.7).slice(0, 4);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section - Fixed Layout */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background with fixed positioning */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <img
                src={heroImages[currentImageIndex].url}
                alt={heroImages[currentImageIndex].title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Content Container - Properly positioned */}
        <div className="relative z-20 w-full max-w-6xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center text-white"
          >
            {/* Logo/Brand */}
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="text-8xl md:text-9xl font-bold tracking-tight bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-transparent drop-shadow-2xl">
                  2yolks
                </div>
                <div className="absolute -top-4 -right-4">
                  <div className="w-6 h-6 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse shadow-2xl shadow-amber-500/50"></div>
                </div>
                <div className="absolute -bottom-3 -left-3">
                  <div className="w-5 h-5 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full animate-pulse delay-300 shadow-2xl shadow-orange-500/50"></div>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex items-center justify-center space-x-3 mb-6"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-10 h-10 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full border-3 border-white shadow-lg"></div>
                ))}
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <span className="text-white/90 text-sm font-medium">
                  ⭐ 4.9 rating from 2,000+ food lovers
                </span>
              </div>
            </motion.div>

            {/* Tagline */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-2xl md:text-3xl font-light mb-12 leading-relaxed drop-shadow-lg max-w-4xl mx-auto tracking-wide"
            >
              Discover extraordinary recipes from passionate chefs around the world
            </motion.p>

            {/* Search Bar - Properly positioned */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mb-8"
            >
              <form onSubmit={handleSearch} className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What's in your fridge? Search recipes, ingredients..."
                  className="w-full px-8 py-6 pl-20 text-lg text-gray-900 bg-white/95 backdrop-blur-sm rounded-3xl border-0 focus:ring-4 focus:ring-white/30 focus:outline-none shadow-2xl placeholder-gray-500 tracking-wide"
                />
                <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 text-gray-400" size={28} />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white px-10 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Search
                </motion.button>
              </form>
            </motion.div>

            {/* Trending Tags */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex flex-wrap items-center justify-center gap-4 mb-12"
            >
              <span className="text-white/80 text-sm font-medium tracking-wider uppercase">Trending:</span>
              {trendingTags.map((item, index) => (
                <motion.button
                  key={item.tag}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
                  onClick={() => handleTagClick(item.tag)}
                  className={`px-6 py-3 bg-gradient-to-r ${item.color} text-white rounded-full text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20`}
                >
                  {item.tag}
                </motion.button>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="flex justify-center"
            >
              {!isAuthenticated ? (
                <Link
                  to="/register"
                  className="group flex items-center space-x-4 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:from-orange-600 hover:via-rose-600 hover:to-pink-600 text-white px-12 py-6 rounded-3xl font-bold text-xl transition-all duration-500 shadow-2xl hover:shadow-3xl transform hover:-translate-y-3 hover:scale-105 backdrop-blur-sm border border-white/20"
                >
                  <Sparkles size={28} className="group-hover:rotate-12 transition-transform duration-300" />
                  <span className="tracking-wide">Start Cooking with 2,000+ Food Lovers</span>
                  <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              ) : (
                <Link
                  to="/explore"
                  className="group flex items-center space-x-4 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:from-orange-600 hover:via-rose-600 hover:to-pink-600 text-white px-12 py-6 rounded-3xl font-bold text-xl transition-all duration-500 shadow-2xl hover:shadow-3xl transform hover:-translate-y-3 hover:scale-105 backdrop-blur-sm border border-white/20"
                >
                  <Search size={28} className="group-hover:scale-110 transition-transform duration-300" />
                  <span className="tracking-wide">Discover New Recipes</span>
                  <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Image Indicators - Fixed positioning */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 flex space-x-3">
          {heroImages.map((_, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.2 }}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentImageIndex 
                  ? 'bg-white scale-125 shadow-lg shadow-white/50' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Subscriber Favorites Section */}
      {isAuthenticated && (
        <section className="py-20 bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 dark:from-orange-900/10 dark:via-rose-900/10 dark:to-pink-900/10">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Heart className="text-rose-500" size={32} />
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Your Favorites</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">Recipes you've saved and loved</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredRecipes.slice(0, 3).map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8 }}
                >
                  <Link
                    to={`/recipe/${recipe.id}`}
                    className="group block bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 right-4">
                        <Heart className="text-rose-500 fill-current" size={20} />
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <Clock size={14} />
                          <span>{recipe.prep_time + recipe.cook_time}m</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Star size={14} className="text-amber-500 fill-current" />
                          <span>{recipe.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/saved"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-8 py-4 rounded-2xl font-semibold hover:from-rose-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Heart size={20} />
                <span>View All Favorites</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Recipe Preview Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          {/* This Week's Trending */}
          <div className="mb-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="flex items-center justify-between mb-12"
            >
              <div>
                <div className="flex items-center space-x-4 mb-3">
                  <div className="p-3 bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl shadow-lg">
                    <TrendingUp className="text-white" size={32} />
                  </div>
                  <h2 className="text-4xl font-bold text-gray-900 dark:text-white tracking-wide">This Week's Trending</h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">What our community is cooking right now</p>
              </div>
              <Link
                to="/explore?sort=popular"
                className="group text-orange-500 hover:text-orange-600 font-semibold flex items-center space-x-2 bg-orange-50 dark:bg-orange-900/20 px-6 py-3 rounded-2xl transition-all duration-300 hover:bg-orange-100 dark:hover:bg-orange-900/30"
              >
                <span className="tracking-wide">View All</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {trendingRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8 }}
                >
                  <Link
                    to={`/recipe/${recipe.id}`}
                    className="group block bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="aspect-square overflow-hidden relative">
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-3 group-hover:text-orange-500 transition-colors line-clamp-1 tracking-wide">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                            <Clock size={12} className="text-orange-500" />
                          </div>
                          <span className="font-medium">{recipe.prep_time + recipe.cook_time}m</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Star size={12} className="text-amber-500 fill-current" />
                          </div>
                          <span className="font-medium">{recipe.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Chef's Picks */}
          {featuredRecipes.length > 0 && (
            <div>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="flex items-center justify-between mb-12"
              >
                <div>
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                      <ChefHat className="text-white" size={32} />
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white tracking-wide">Chef's Picks</h2>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">Curated by our culinary experts for exceptional quality</p>
                </div>
                <Link
                  to="/explore?featured=true"
                  className="group text-purple-500 hover:text-purple-600 font-semibold flex items-center space-x-2 bg-purple-50 dark:bg-purple-900/20 px-6 py-3 rounded-2xl transition-all duration-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                >
                  <span className="tracking-wide">View All</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {featuredRecipes.slice(0, 6).map((recipe, index) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -12 }}
                  >
                    <Link
                      to={`/recipe/${recipe.id}`}
                      className="group block bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border border-gray-100 dark:border-gray-700"
                    >
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute top-6 left-6">
                          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white backdrop-blur-md shadow-lg">
                            ⭐ Featured
                          </span>
                        </div>
                      </div>
                      <div className="p-8">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-orange-500 transition-colors line-clamp-1 tracking-wide">
                          {recipe.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed">
                          {recipe.description}
                        </p>
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                <Clock size={14} className="text-orange-500" />
                              </div>
                              <span className="font-medium">{recipe.prep_time + recipe.cook_time}m</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Star size={14} className="text-amber-500 fill-current" />
                              </div>
                              <span className="font-medium">{recipe.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-xs font-semibold ${
                            recipe.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            recipe.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>
                            {recipe.difficulty}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="p-8 bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-900/20 dark:to-rose-900/20 rounded-3xl border border-orange-100 dark:border-orange-800"
            >
              <div className="text-6xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent mb-4">15+</div>
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2 tracking-wide">Gourmet Recipes</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Expertly curated</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              viewport={{ once: true }}
              className="p-8 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-3xl border border-amber-100 dark:border-amber-800"
            >
              <div className="text-6xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent mb-4">4.9★</div>
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2 tracking-wide">Average Rating</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Community approved</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="p-8 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-3xl border border-purple-100 dark:border-purple-800"
            >
              <div className="text-6xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">2K+</div>
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2 tracking-wide">Happy Cooks</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Growing daily</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-24 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
          <div className="max-w-5xl mx-auto text-center px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-3xl inline-block mb-8 border border-white/20">
                <ChefHat className="text-white" size={56} />
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-wide">
                Ready to Start Cooking?
              </h2>
              <p className="text-white/90 text-2xl mb-12 max-w-3xl mx-auto leading-relaxed">
                Join our community of passionate food lovers and discover your next favorite recipe.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/register"
                    className="bg-white text-orange-500 px-12 py-5 rounded-3xl font-bold text-xl hover:bg-gray-100 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 tracking-wide"
                  >
                    Join Free Today
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/login"
                    className="border-2 border-white text-white px-12 py-5 rounded-3xl font-bold text-xl hover:bg-white hover:text-orange-500 transition-all duration-300 backdrop-blur-sm tracking-wide"
                  >
                    Sign In
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;