import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChefHat, Users, ArrowRight, Star, Clock, TrendingUp, Sparkles, Play, Heart, BookOpen, Eye, MessageCircle, Timer, Award } from 'lucide-react';
import { useRecipeStore } from '../stores/recipeStore';
import { useAuthStore } from '../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import RecipeCard from '../components/recipe/RecipeCard';
import { useInView } from 'react-intersection-observer';

const HomePage: React.FC = () => {
  const { featuredRecipes, recipes, fetchFeaturedRecipes, fetchRecipes, searchRecipes } = useRecipeStore();
  const { isAuthenticated, user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentChefIndex, setCurrentChefIndex] = useState(0);

  // Intersection Observer refs for animations
  const [heroRef, heroInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [featuresRef, featuresInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [recipesRef, recipesInView] = useInView({ threshold: 0.1, triggerOnce: true });

  // Hero food showcase images with recipe data
  const heroShowcase = [
    {
      url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Truffle Mushroom Risotto',
      description: 'Creamy arborio rice with wild mushrooms and truffle oil',
      chef: 'Chef Alessandro',
      rating: 4.9,
      time: '35 min',
      difficulty: 'Medium',
      category: 'Italian'
    },
    {
      url: 'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Wagyu Beef Tenderloin',
      description: 'Premium wagyu with red wine reduction and seasonal vegetables',
      chef: 'Chef Marcus',
      rating: 4.8,
      time: '45 min',
      difficulty: 'Hard',
      category: 'Fine Dining'
    },
    {
      url: 'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=1920',
      title: 'Seared Scallops',
      description: 'Pan-seared scallops with cauliflower purée and microgreens',
      chef: 'Chef Isabella',
      rating: 4.9,
      time: '25 min',
      difficulty: 'Medium',
      category: 'Seafood'
    }
  ];

  // Trending categories with visual appeal
  const trendingCategories = [
    { name: 'Quick & Easy', icon: '⚡', count: '200+', color: 'from-emerald-400 to-teal-500', recipes: '30min or less' },
    { name: 'Comfort Food', icon: '🏠', count: '150+', color: 'from-amber-400 to-orange-500', recipes: 'Soul-warming dishes' },
    { name: 'Healthy', icon: '🥗', count: '180+', color: 'from-green-400 to-emerald-500', recipes: 'Nutritious & delicious' },
    { name: 'Gourmet', icon: '⭐', count: '120+', color: 'from-purple-400 to-pink-500', recipes: 'Restaurant quality' },
    { name: 'Vegetarian', icon: '🌱', count: '160+', color: 'from-lime-400 to-green-500', recipes: 'Plant-based goodness' },
    { name: 'Desserts', icon: '🍰', count: '90+', color: 'from-pink-400 to-rose-500', recipes: 'Sweet indulgences' }
  ];

  // Featured chefs (always shown first)
  const featuredChefs = [
    {
      name: 'Chef Alessandro',
      specialty: 'Italian Cuisine',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 24,
      followers: '2.1k',
      rating: 4.9,
      featured: true,
      bio: 'Master of traditional Italian cuisine with modern techniques'
    },
    {
      name: 'Chef Isabella',
      specialty: 'Modern French',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 18,
      followers: '1.8k',
      rating: 4.8,
      featured: true,
      bio: 'Innovative French chef bringing elegance to every dish'
    },
    {
      name: 'Chef Marcus',
      specialty: 'Fine Dining',
      avatar: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 31,
      followers: '3.2k',
      rating: 4.9,
      featured: true,
      bio: 'Award-winning chef specializing in contemporary fine dining'
    }
  ];

  // Regular chefs (rotated randomly)
  const regularChefs = [
    {
      name: 'Chef Maria',
      specialty: 'Spanish Tapas',
      avatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 16,
      followers: '1.2k',
      rating: 4.7,
      featured: false,
      bio: 'Authentic Spanish flavors with a contemporary twist'
    },
    {
      name: 'Chef David',
      specialty: 'Asian Fusion',
      avatar: 'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 22,
      followers: '1.9k',
      rating: 4.8,
      featured: false,
      bio: 'Blending traditional Asian techniques with modern presentation'
    },
    {
      name: 'Chef Sophie',
      specialty: 'Pastry & Desserts',
      avatar: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 19,
      followers: '2.3k',
      rating: 4.9,
      featured: false,
      bio: 'Creating sweet masterpieces that are works of art'
    },
    {
      name: 'Chef Antonio',
      specialty: 'Mediterranean',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 27,
      followers: '1.7k',
      rating: 4.6,
      featured: false,
      bio: 'Fresh Mediterranean ingredients in every seasonal dish'
    },
    {
      name: 'Chef Emma',
      specialty: 'Plant-Based',
      avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 21,
      followers: '1.5k',
      rating: 4.7,
      featured: false,
      bio: 'Proving that plant-based cuisine can be extraordinary'
    },
    {
      name: 'Chef James',
      specialty: 'BBQ & Grilling',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
      recipes: 15,
      followers: '1.4k',
      rating: 4.8,
      featured: false,
      bio: 'Master of smoke and fire, creating bold flavors'
    }
  ];

  // Function to get current chef rotation
  const getCurrentChefRotation = () => {
    // Always show the 3 featured chefs first
    const rotation = [...featuredChefs];
    
    // Add 3 random regular chefs
    const shuffledRegular = [...regularChefs].sort(() => Math.random() - 0.5);
    rotation.push(...shuffledRegular.slice(0, 3));
    
    return rotation;
  };

  const [chefRotation, setChefRotation] = useState(getCurrentChefRotation());

  useEffect(() => {
    fetchFeaturedRecipes();
    fetchRecipes();
  }, [fetchFeaturedRecipes, fetchRecipes]);

  // Auto-rotate hero images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroShowcase.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroShowcase.length]);

  // Auto-rotate chefs every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentChefIndex((prev) => {
        const nextIndex = (prev + 3) % chefRotation.length;
        // If we've shown all chefs, shuffle the regular chefs again
        if (nextIndex === 0) {
          setChefRotation(getCurrentChefRotation());
        }
        return nextIndex;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [chefRotation.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchRecipes(searchQuery);
      window.location.href = '/explore';
    }
  };

  const handleCategoryClick = (category: string) => {
    searchRecipes(category.toLowerCase());
    window.location.href = '/explore';
  };

  const currentHero = heroShowcase[currentImageIndex];
  const recentRecipes = recipes.slice(0, 8);
  const trendingRecipes = recipes.filter(r => r.rating >= 4.7).slice(0, 6);

  // Get current 3 chefs to display
  const currentChefs = chefRotation.slice(currentChefIndex, currentChefIndex + 3);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* Hero Section - Food-Focused */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center">
        {/* Dynamic Background */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <img
                src={currentHero.url}
                alt={currentHero.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30"></div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Brand & Search */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={heroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-white"
            >
              {/* Brand */}
              <div className="mb-8">
                <div className="relative inline-block mb-6">
                  <div className="text-7xl md:text-8xl font-bold tracking-tight bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-transparent drop-shadow-2xl">
                    2yolks
                  </div>
                  <div className="absolute -top-3 -right-3">
                    <div className="w-5 h-5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse shadow-2xl"></div>
                  </div>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-light mb-6 leading-tight">
                  Discover <span className="font-bold text-orange-400">extraordinary recipes</span><br />
                  from passionate chefs worldwide
                </h1>
                
                <p className="text-xl text-white/80 mb-8 leading-relaxed">
                  Join 2,000+ food lovers sharing gourmet recipes, cooking tips, and culinary inspiration
                </p>
              </div>

              {/* Enhanced Search */}
              <form onSubmit={handleSearch} className="mb-8">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search recipes, ingredients, or cuisines..."
                    className="w-full px-6 py-5 pl-16 text-lg text-gray-900 bg-white/95 backdrop-blur-sm rounded-3xl border-0 focus:ring-4 focus:ring-orange-500/30 focus:outline-none shadow-2xl placeholder-gray-500"
                  />
                  <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-8 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Search
                  </motion.button>
                </div>
              </form>

              {/* Quick Stats */}
              <div className="flex items-center space-x-8 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-white/80">15+ Gourmet Recipes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse delay-150"></div>
                  <span className="text-white/80">4.9★ Average Rating</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-rose-400 rounded-full animate-pulse delay-300"></div>
                  <span className="text-white/80">2K+ Happy Cooks</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column - Featured Recipe Card */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={heroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="hidden lg:block"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="text-center mb-6">
                  <span className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-sm font-semibold">
                    ⭐ Featured Recipe
                  </span>
                </div>
                
                <div className="text-white">
                  <h3 className="text-2xl font-bold mb-3">{currentHero.title}</h3>
                  <p className="text-white/80 mb-6 leading-relaxed">{currentHero.description}</p>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <Clock size={16} className="text-orange-400" />
                        <span>{currentHero.time}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star size={16} className="text-amber-400 fill-current" />
                        <span>{currentHero.rating}</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                      {currentHero.difficulty}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full flex items-center justify-center text-white font-semibold">
                        {currentHero.chef.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{currentHero.chef}</p>
                        <p className="text-xs text-white/60">{currentHero.category}</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      View Recipe
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Hero Navigation Dots */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 flex space-x-3">
          {heroShowcase.map((_, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.2 }}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentImageIndex 
                  ? 'bg-white scale-125 shadow-lg' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Trending Categories */}
      <section ref={featuresRef} className="py-20 bg-gradient-to-br from-gray-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-orange-900/10">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Explore by Category
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Discover recipes that match your mood and dietary preferences
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trendingCategories.map((category, index) => (
              <motion.button
                key={category.name}
                initial={{ opacity: 0, y: 30 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => handleCategoryClick(category.name)}
                className="group bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700"
              >
                <div className={`w-16 h-16 bg-gradient-to-r ${category.color} rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  {category.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                  {category.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {category.recipes}
                </p>
                <div className="flex items-center justify-center space-x-2 text-orange-500 font-semibold">
                  <span>{category.count} recipes</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Recipes Showcase */}
      <section ref={recipesRef} className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={recipesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-between mb-16"
          >
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Featured Recipes
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Handpicked by our culinary experts for exceptional quality
              </p>
            </div>
            <Link
              to="/explore?featured=true"
              className="hidden md:flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-8 py-4 rounded-2xl font-semibold hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <span>View All</span>
              <ArrowRight size={20} />
            </Link>
          </motion.div>

          {featuredRecipes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredRecipes.slice(0, 6).map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={recipesInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <RecipeCard recipe={recipe} showAuthor={true} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recentRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={recipesInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <RecipeCard recipe={recipe} showAuthor={true} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Chefs - Rotating Display */}
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
              <Award className="h-8 w-8 text-orange-500" />
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                Meet Our Chefs
              </h2>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              Learn from culinary masters sharing their expertise
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span>Featured chefs rotate every 10 seconds</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <AnimatePresence mode="wait">
              {currentChefs.map((chef, index) => (
                <motion.div
                  key={`${chef.name}-${currentChefIndex}`}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.9 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.1,
                    ease: "easeInOut"
                  }}
                  whileHover={{ y: -8 }}
                  className={`bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 text-center border border-gray-100 dark:border-gray-700 ${
                    chef.featured ? 'ring-2 ring-orange-200 dark:ring-orange-800' : ''
                  }`}
                >
                  {/* Featured Badge */}
                  {chef.featured && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-xs font-semibold shadow-lg">
                        ⭐ Featured Chef
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <img
                      src={chef.avatar}
                      alt={chef.name}
                      className="w-24 h-24 rounded-full mx-auto mb-6 object-cover ring-4 ring-orange-100 dark:ring-orange-900/30"
                    />
                    {chef.featured && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                          <Star size={12} className="text-white fill-current" />
                        </div>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {chef.name}
                  </h3>
                  <p className="text-orange-500 font-medium mb-3">{chef.specialty}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    {chef.bio}
                  </p>
                  
                  <div className="flex items-center justify-center space-x-6 text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-white">{chef.recipes}</div>
                      <div>Recipes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-white">{chef.followers}</div>
                      <div>Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center justify-center">
                        <Star size={14} className="text-amber-500 fill-current mr-1" />
                        {chef.rating}
                      </div>
                      <div>Rating</div>
                    </div>
                  </div>
                  
                  <button className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white py-3 rounded-2xl font-semibold hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl">
                    View Recipes
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Chef Rotation Indicators */}
          <div className="flex justify-center mt-12 space-x-2">
            {Array.from({ length: Math.ceil(chefRotation.length / 3) }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  Math.floor(currentChefIndex / 3) === index
                    ? 'bg-orange-500 scale-125'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
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
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2">Gourmet Recipes</div>
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
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2">Average Rating</div>
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
              <div className="text-gray-700 dark:text-gray-300 font-semibold text-xl mb-2">Happy Cooks</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Growing daily</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-24 bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
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
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Ready to Start Cooking?
              </h2>
              <p className="text-white/90 text-2xl mb-12 max-w-3xl mx-auto leading-relaxed">
                Join our community of passionate food lovers and discover your next favorite recipe.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/register"
                    className="bg-white text-orange-500 px-12 py-5 rounded-3xl font-bold text-xl hover:bg-gray-100 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
                  >
                    Join Free Today
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    to="/login"
                    className="border-2 border-white text-white px-12 py-5 rounded-3xl font-bold text-xl hover:bg-white hover:text-orange-500 transition-all duration-300 backdrop-blur-sm"
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