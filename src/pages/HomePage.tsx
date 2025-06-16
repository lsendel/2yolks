import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChefHat, Users, ArrowRight, Star, Clock, TrendingUp, Sparkles, Play, Heart, BookOpen, Eye, MessageCircle, Timer, Award, Crown, Check, Video, PlayCircle, Instagram, Youtube, TikTok } from 'lucide-react';
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
  const [currentInfluencerIndex, setCurrentInfluencerIndex] = useState(0);

  // Intersection Observer refs for animations
  const [heroRef, heroInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [featuresRef, featuresInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [recipesRef, recipesInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [planRef, planInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [influencerRef, influencerInView] = useInView({ threshold: 0.1, triggerOnce: true });

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

  // Influencers with video content
  const influencers = [
    {
      name: 'Sarah Chen',
      handle: '@sarahcooks',
      specialty: 'Asian Fusion & Street Food',
      avatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150',
      followers: '2.8M',
      platform: 'TikTok',
      videoThumbnail: 'https://images.pexels.com/photos/4253302/pexels-photo-4253302.jpeg?auto=compress&cs=tinysrgb&w=800',
      videoTitle: '5-Minute Ramen Hack That Will Blow Your Mind',
      views: '12.3M',
      likes: '890K',
      bio: 'Making Asian cuisine accessible to everyone, one viral recipe at a time',
      verified: true,
      socialLinks: {
        tiktok: '@sarahcooks',
        instagram: '@sarahcooks_official',
        youtube: 'Sarah Chen Cooking'
      }
    },
    {
      name: 'Marco Rodriguez',
      handle: '@marcosflavors',
      specialty: 'Latin American Cuisine',
      avatar: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150',
      followers: '1.9M',
      platform: 'Instagram',
      videoThumbnail: 'https://images.pexels.com/photos/4253302/pexels-photo-4253302.jpeg?auto=compress&cs=tinysrgb&w=800',
      videoTitle: 'Authentic Tacos Al Pastor - Family Recipe Revealed',
      views: '8.7M',
      likes: '654K',
      bio: 'Sharing the vibrant flavors of Latin America with authentic family recipes',
      verified: true,
      socialLinks: {
        instagram: '@marcosflavors',
        youtube: 'Marcos Kitchen',
        tiktok: '@marcosflavors'
      }
    },
    {
      name: 'Emma Thompson',
      handle: '@plantbasedwithemma',
      specialty: 'Plant-Based & Wellness',
      avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
      followers: '3.2M',
      platform: 'YouTube',
      videoThumbnail: 'https://images.pexels.com/photos/4253302/pexels-photo-4253302.jpeg?auto=compress&cs=tinysrgb&w=800',
      videoTitle: 'Plant-Based Meal Prep That Actually Tastes Amazing',
      views: '15.2M',
      likes: '1.2M',
      bio: 'Proving that plant-based eating can be delicious, satisfying, and sustainable',
      verified: true,
      socialLinks: {
        youtube: 'Plant Based with Emma',
        instagram: '@plantbasedwithemma',
        tiktok: '@emmaplantbased'
      }
    },
    {
      name: 'David Kim',
      handle: '@davidsbaking',
      specialty: 'Artisan Baking & Pastry',
      avatar: 'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=150',
      followers: '1.5M',
      platform: 'YouTube',
      videoThumbnail: 'https://images.pexels.com/photos/4253302/pexels-photo-4253302.jpeg?auto=compress&cs=tinysrgb&w=800',
      videoTitle: 'Perfect Sourdough Bread - Complete Beginner Guide',
      views: '6.8M',
      likes: '423K',
      bio: 'Demystifying artisan baking with step-by-step tutorials and pro tips',
      verified: true,
      socialLinks: {
        youtube: 'Davids Baking Studio',
        instagram: '@davidsbaking',
        tiktok: '@davidbakes'
      }
    }
  ];

  // GPL Plan features
  const gplPlans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for home cooks getting started',
      features: [
        'Access to 50+ basic recipes',
        'Basic meal planning',
        'Community support',
        'Recipe saving',
        'Mobile app access'
      ],
      buttonText: 'Get Started Free',
      buttonStyle: 'border-2 border-orange-500 text-orange-500 hover:bg-orange-50',
      popular: false
    },
    {
      name: 'Premium',
      price: '$9.99',
      period: 'month',
      description: 'For passionate food lovers who want more',
      features: [
        'Access to 500+ premium recipes',
        'Advanced meal planning & shopping lists',
        'Video cooking tutorials',
        'Nutrition tracking',
        'Priority customer support',
        'Recipe scaling & conversions',
        'Offline recipe access'
      ],
      buttonText: 'Start Premium Trial',
      buttonStyle: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600',
      popular: true
    },
    {
      name: 'Chef Pro',
      price: '$19.99',
      period: 'month',
      description: 'For culinary professionals and serious enthusiasts',
      features: [
        'Everything in Premium',
        'Exclusive chef masterclasses',
        'Recipe creation & publishing tools',
        'Advanced analytics',
        'White-label meal planning',
        'API access for integrations',
        'Personal chef consultation',
        'Early access to new features'
      ],
      buttonText: 'Go Pro',
      buttonStyle: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600',
      popular: false
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

  // Auto-rotate influencers every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentInfluencerIndex((prev) => (prev + 1) % influencers.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [influencers.length]);

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
  const currentInfluencer = influencers[currentInfluencerIndex];

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

      {/* GPL Plans Section */}
      <section ref={planRef} className="py-20 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-rose-900/10">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={planInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Crown className="h-8 w-8 text-purple-500" />
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                Choose Your Culinary Journey
              </h2>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              From home cook to professional chef - we have the perfect plan for you
            </p>
            <div className="inline-flex items-center space-x-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm font-medium">
              <Check size={16} />
              <span>30-day money-back guarantee</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {gplPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={planInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border ${
                  plan.popular 
                    ? 'border-orange-200 dark:border-orange-800 ring-2 ring-orange-200 dark:ring-orange-800' 
                    : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-500 to-rose-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                      🔥 Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      /{plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl ${plan.buttonStyle}`}
                >
                  {plan.buttonText}
                </motion.button>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              All plans include access to our mobile app and community forums. 
              <Link to="/pricing" className="text-orange-500 hover:text-orange-600 font-medium ml-1">
                Compare all features →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Meet Our Influencers Section */}
      <section ref={influencerRef} className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={influencerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Video className="h-8 w-8 text-rose-500" />
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                Meet Our Influencers
              </h2>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              Learn from viral cooking creators sharing their secrets
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-rose-400 rounded-full animate-pulse"></div>
              <span>Featured creators rotate every 8 seconds</span>
            </div>
          </motion.div>

          {/* Featured Influencer Spotlight */}
          <div className="mb-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentInfluencer.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-rose-900/20 dark:via-pink-900/20 dark:to-purple-900/20 rounded-3xl p-8 border border-rose-100 dark:border-rose-800"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  {/* Video Preview */}
                  <div className="relative">
                    <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
                      <img
                        src={currentInfluencer.videoThumbnail}
                        alt={currentInfluencer.videoTitle}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-20 h-20 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl"
                        >
                          <PlayCircle className="h-10 w-10 text-rose-500" />
                        </motion.button>
                      </div>
                    </div>
                    
                    {/* Video Stats */}
                    <div className="absolute top-4 left-4 flex space-x-2">
                      <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {currentInfluencer.views} views
                      </span>
                      <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                        ❤️ {currentInfluencer.likes}
                      </span>
                    </div>
                  </div>

                  {/* Influencer Info */}
                  <div>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="relative">
                        <img
                          src={currentInfluencer.avatar}
                          alt={currentInfluencer.name}
                          className="w-20 h-20 rounded-full object-cover ring-4 ring-rose-200 dark:ring-rose-800"
                        />
                        {currentInfluencer.verified && (
                          <div className="absolute -bottom-1 -right-1">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {currentInfluencer.name}
                        </h3>
                        <p className="text-rose-500 font-medium">{currentInfluencer.handle}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {currentInfluencer.followers} followers on {currentInfluencer.platform}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {currentInfluencer.videoTitle}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        {currentInfluencer.bio}
                      </p>
                      <div className="mt-4">
                        <span className="inline-block bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-full text-sm font-medium">
                          {currentInfluencer.specialty}
                        </span>
                      </div>
                    </div>

                    {/* Social Links */}
                    <div className="flex items-center space-x-4">
                      {currentInfluencer.socialLinks.youtube && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          <Youtube size={20} />
                        </motion.button>
                      )}
                      {currentInfluencer.socialLinks.instagram && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors"
                        >
                          <Instagram size={20} />
                        </motion.button>
                      )}
                      {currentInfluencer.socialLinks.tiktok && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <TikTok size={20} />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl font-semibold hover:from-rose-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        Follow {currentInfluencer.name}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Influencer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {influencers.map((influencer, index) => (
              <motion.div
                key={influencer.name}
                initial={{ opacity: 0, y: 30 }}
                animate={influencerInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className={`bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700 cursor-pointer ${
                  index === currentInfluencerIndex ? 'ring-2 ring-rose-200 dark:ring-rose-800' : ''
                }`}
                onClick={() => setCurrentInfluencerIndex(index)}
              >
                <div className="relative mb-4">
                  <img
                    src={influencer.avatar}
                    alt={influencer.name}
                    className="w-16 h-16 rounded-full mx-auto object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                  />
                  {influencer.verified && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                    {influencer.name}
                  </h3>
                  <p className="text-rose-500 text-sm font-medium mb-2">
                    {influencer.handle}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
                    {influencer.followers} followers
                  </p>
                  <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
                    {influencer.platform}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Influencer Rotation Indicators */}
          <div className="flex justify-center mt-12 space-x-2">
            {influencers.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentInfluencerIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentInfluencerIndex
                    ? 'bg-rose-500 scale-125'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-rose-300'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Recipes Showcase */}
      <section ref={recipesRef} className="py-20 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
                    to="/signup"
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