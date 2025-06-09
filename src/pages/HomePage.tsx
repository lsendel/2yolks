import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChefHat, Users, ArrowRight, Star, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { useRecipeStore } from '../stores/recipeStore';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

const HomePage: React.FC = () => {
  const { featuredRecipes, recipes, fetchFeaturedRecipes, fetchRecipes, searchRecipes } = useRecipeStore();
  const { isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Curated food images for the rotating panel
  const heroImages = [
    {
      url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Truffle Risotto',
      description: 'Creamy perfection with wild mushrooms'
    },
    {
      url: 'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Wagyu Steak',
      description: 'Premium cuts, perfectly seared'
    },
    {
      url: 'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Seared Scallops',
      description: 'Ocean delicacy with cauliflower purée'
    },
    {
      url: 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Chocolate Lava',
      description: 'Molten indulgence, served warm'
    },
    {
      url: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Sushi Artistry',
      description: 'Japanese precision, chef\'s selection'
    }
  ];

  // Trending tags for quick discovery
  const trendingTags = [
    '#30min', '#weeknight', '#comfort', '#healthy', '#gourmet', '#vegetarian'
  ];

  useEffect(() => {
    fetchFeaturedRecipes();
    fetchRecipes();
  }, [fetchFeaturedRecipes, fetchRecipes]);

  // Auto-rotate images every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

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

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  const recentRecipes = recipes.slice(0, 6);
  const trendingRecipes = recipes.filter(r => r.rating >= 4.7).slice(0, 4);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Rotating Food Images */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Rotating Background Images */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <img
                src={heroImages[currentImageIndex].url}
                alt={heroImages[currentImageIndex].title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20"></div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevImage}
          className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20 p-4 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all duration-300 hover:scale-110"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button
          onClick={nextImage}
          className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 p-4 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all duration-300 hover:scale-110"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Image Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex space-x-3">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentImageIndex 
                  ? 'bg-white scale-125 shadow-lg' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>

        {/* Image Info */}
        <div className="absolute bottom-20 left-8 z-20 text-white max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-3xl font-bold mb-2 drop-shadow-lg">{heroImages[currentImageIndex].title}</h3>
              <p className="text-white/90 text-lg drop-shadow-md">{heroImages[currentImageIndex].description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-center text-white max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Logo/Brand */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="text-7xl md:text-8xl font-bold tracking-tight text-white drop-shadow-2xl">
                  2yolks
                </div>
                <div className="absolute -top-3 -right-3">
                  <div className="w-5 h-5 bg-amber-400 rounded-full animate-pulse shadow-xl"></div>
                </div>
                <div className="absolute -bottom-2 -left-2">
                  <div className="w-4 h-4 bg-orange-400 rounded-full animate-pulse delay-300 shadow-xl"></div>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full border-2 border-white"></div>
                ))}
              </div>
              <span className="text-white/90 text-sm font-medium ml-3">
                ⭐ 4.9 rating from 2,000+ food lovers
              </span>
            </div>

            {/* Tagline */}
            <p className="text-xl md:text-2xl font-light mb-10 leading-relaxed drop-shadow-lg max-w-3xl mx-auto">
              Discover extraordinary recipes from passionate chefs around the world
            </p>

            {/* Enhanced Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative max-w-3xl mx-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What's in your fridge? Search recipes, ingredients..."
                  className="w-full px-6 py-5 pl-16 text-lg text-gray-900 bg-white/95 backdrop-blur-sm rounded-2xl border-0 focus:ring-4 focus:ring-white/30 focus:outline-none shadow-2xl placeholder-gray-500"
                />
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Trending Tags */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              <span className="text-white/80 text-sm font-medium">Trending:</span>
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 hover:scale-105"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Single Primary CTA */}
            <div className="flex justify-center">
              {!isAuthenticated ? (
                <Link
                  to="/register"
                  className="group flex items-center space-x-3 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 hover:scale-105"
                >
                  <Sparkles size={24} />
                  <span>Start Cooking with 2,000+ Food Lovers</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <Link
                  to="/explore"
                  className="group flex items-center space-x-3 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 hover:scale-105"
                >
                  <Search size={24} />
                  <span>Discover New Recipes</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Recipe Preview Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          {/* This Week's Trending */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <TrendingUp className="text-orange-500" size={28} />
                  <h2 className="text-3xl font-bold text-gray-900">This Week's Trending</h2>
                </div>
                <p className="text-gray-600">What our community is cooking right now</p>
              </div>
              <Link
                to="/explore?sort=popular"
                className="text-orange-500 hover:text-orange-600 font-semibold flex items-center space-x-1 group"
              >
                <span>View All</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Link
                    to={`/recipe/${recipe.id}`}
                    className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2"
                  >
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 group-hover:text-orange-500 transition-colors line-clamp-1">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock size={14} />
                          <span>{recipe.prep_time + recipe.cook_time}m</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star size={14} className="text-amber-500 fill-current" />
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
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <ChefHat className="text-orange-500" size={28} />
                    <h2 className="text-3xl font-bold text-gray-900">Chef's Picks</h2>
                  </div>
                  <p className="text-gray-600">Curated by our culinary experts for exceptional quality</p>
                </div>
                <Link
                  to="/explore?featured=true"
                  className="text-orange-500 hover:text-orange-600 font-semibold flex items-center space-x-1 group"
                >
                  <span>View All</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredRecipes.slice(0, 6).map((recipe, index) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Link
                      to={`/recipe/${recipe.id}`}
                      className="group block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3"
                    >
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white backdrop-blur-md">
                            ⭐ Featured
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-orange-500 transition-colors line-clamp-1">
                          {recipe.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {recipe.description}
                        </p>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Clock size={14} />
                              <span>{recipe.prep_time + recipe.cook_time}m</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Star size={14} className="text-amber-500 fill-current" />
                              <span>{recipe.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            recipe.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                            recipe.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
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
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="p-6"
            >
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent mb-3">15+</div>
              <div className="text-gray-600 font-semibold text-lg">Gourmet Recipes</div>
              <div className="text-gray-500 text-sm mt-1">Expertly curated</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="p-6"
            >
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent mb-3">4.9★</div>
              <div className="text-gray-600 font-semibold text-lg">Average Rating</div>
              <div className="text-gray-500 text-sm mt-1">Community approved</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="p-6"
            >
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent mb-3">2K+</div>
              <div className="text-gray-600 font-semibold text-lg">Happy Cooks</div>
              <div className="text-gray-500 text-sm mt-1">Growing daily</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-20 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="max-w-4xl mx-auto text-center px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <ChefHat className="mx-auto mb-6 text-white" size={48} />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Ready to Start Cooking?
              </h2>
              <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto">
                Join our community of passionate food lovers and discover your next favorite recipe.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="bg-white text-orange-500 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  Join Free Today
                </Link>
                <Link
                  to="/login"
                  className="border-2 border-white text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white hover:text-orange-500 transition-all duration-300"
                >
                  Sign In
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;