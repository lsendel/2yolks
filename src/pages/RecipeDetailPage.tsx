import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Clock, 
  Users, 
  Star, 
  Heart, 
  ChefHat, 
  ArrowLeft, 
  Share2, 
  Bookmark,
  MessageCircle,
  ThumbsUp,
  Play,
  CheckCircle2,
  Timer,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecipeStore } from '../stores/recipeStore';
import { useAuthStore } from '../stores/authStore';
import { useLanguageStore } from '../stores/languageStore';
import { Recipe, Review } from '../lib/supabase';
import { sampleRecipes } from '../data/sampleRecipes';

const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const { t, language } = useLanguageStore();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState(4);
  const [isSaved, setIsSaved] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions' | 'reviews'>('ingredients');

  // Sample reviews data
  const sampleReviews: Review[] = [
    {
      id: '1',
      recipe_id: id || '',
      user_id: 'user1',
      user: {
        id: 'user1',
        username: 'FoodieChef',
        email: 'foodie@example.com',
        avatar_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
        is_admin: false,
        created_at: '2024-01-01'
      },
      rating: 5,
      comment: 'Absolutely incredible! The flavors were perfectly balanced and the instructions were easy to follow. This has become my go-to recipe for special occasions.',
      created_at: '2024-01-20T10:00:00Z'
    },
    {
      id: '2',
      recipe_id: id || '',
      user_id: 'user2',
      user: {
        id: 'user2',
        username: 'HomeCook123',
        email: 'home@example.com',
        is_admin: false,
        created_at: '2024-01-01'
      },
      rating: 4,
      comment: 'Great recipe! I made a few modifications based on dietary restrictions and it still turned out amazing. Will definitely make again.',
      created_at: '2024-01-19T15:30:00Z'
    },
    {
      id: '3',
      recipe_id: id || '',
      user_id: 'user3',
      user: {
        id: 'user3',
        username: 'ChefMaster',
        email: 'chef@example.com',
        avatar_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
        is_admin: false,
        created_at: '2024-01-01'
      },
      rating: 5,
      comment: 'Professional chef here - this recipe is spot on! The technique described is exactly how we do it in the restaurant. Kudos to the author!',
      created_at: '2024-01-18T09:15:00Z'
    }
  ];

  useEffect(() => {
    if (id) {
      // Find recipe from sample data
      const foundRecipe = sampleRecipes.find(r => r.id === id);
      if (foundRecipe) {
        setRecipe(foundRecipe);
        setServings(4); // Default servings
        setReviews(sampleReviews);
      }
    }
  }, [id]);

  const toggleStepCompletion = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepIndex)) {
      newCompleted.delete(stepIndex);
    } else {
      newCompleted.add(stepIndex);
    }
    setCompletedSteps(newCompleted);
  };

  const adjustServings = (newServings: number) => {
    if (newServings > 0 && newServings <= 20) {
      setServings(newServings);
    }
  };

  const getAdjustedQuantity = (originalQuantity: string, originalServings: number = 4) => {
    const ratio = servings / originalServings;
    const numMatch = originalQuantity.match(/(\d+(?:\.\d+)?)/);
    
    if (numMatch) {
      const originalNum = parseFloat(numMatch[1]);
      const adjustedNum = (originalNum * ratio).toFixed(ratio < 1 ? 2 : 1);
      return originalQuantity.replace(numMatch[1], adjustedNum);
    }
    
    return originalQuantity;
  };

  const submitReview = () => {
    if (!isAuthenticated || !user) return;
    
    const review: Review = {
      id: Date.now().toString(),
      recipe_id: id || '',
      user_id: user.id,
      user: user,
      rating: newReview.rating,
      comment: newReview.comment,
      created_at: new Date().toISOString()
    };
    
    setReviews([review, ...reviews]);
    setNewReview({ rating: 5, comment: '' });
    setShowReviewForm(false);
  };

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : recipe.rating;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="relative h-96 md:h-[500px] overflow-hidden">
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        
        {/* Back Button */}
        <Link
          to="/explore"
          className="absolute top-6 left-6 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all duration-300"
        >
          <ArrowLeft size={20} />
        </Link>

        {/* Action Buttons */}
        <div className="absolute top-6 right-6 flex space-x-3">
          <button className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all duration-300">
            <Share2 size={20} />
          </button>
          <button 
            onClick={() => setIsSaved(!isSaved)}
            className={`p-3 backdrop-blur-md rounded-full transition-all duration-300 ${
              isSaved ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Heart size={20} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Recipe Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3 mb-4">
              {recipe.is_featured && (
                <span className="px-3 py-1 bg-amber-500 rounded-full text-sm font-medium">
                  ⭐ {t('featured')}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                recipe.difficulty === 'Easy' ? 'bg-emerald-500' :
                recipe.difficulty === 'Medium' ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                {t(`difficulty.${recipe.difficulty.toLowerCase()}`)}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-wide">
              {recipe.title}
            </h1>
            
            <p className="text-xl text-white/90 mb-6 max-w-3xl leading-relaxed">
              {recipe.description}
            </p>

            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Clock size={20} />
                <span>{recipe.prep_time + recipe.cook_time} {t('minutes')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users size={20} />
                <span>{servings} {t('servings')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star size={20} className="fill-current text-amber-400" />
                <span>{averageRating.toFixed(1)} ({reviews.length} {t('reviews')})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column - Recipe Details */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
              {[
                { key: 'ingredients', label: t('ingredients'), icon: Scale },
                { key: 'instructions', label: t('instructions'), icon: Play },
                { key: 'reviews', label: t('reviews'), icon: MessageCircle }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <tab.icon size={18} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'ingredients' && (
                <motion.div
                  key="ingredients"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {t('ingredients')}
                    </h2>
                    
                    {/* Servings Adjuster */}
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('servings')}:</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => adjustServings(servings - 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{servings}</span>
                        <button
                          onClick={() => adjustServings(servings + 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {recipe.ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <div className="flex-1">
                          <span className="font-medium text-orange-600 dark:text-orange-400">
                            {getAdjustedQuantity(ingredient.quantity)} {ingredient.unit}
                          </span>
                          <span className="text-gray-900 dark:text-white ml-2">
                            {ingredient.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'instructions' && (
                <motion.div
                  key="instructions"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg"
                >
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {t('instructions')}
                  </h2>

                  <div className="space-y-6">
                    {recipe.steps.map((step, index) => (
                      <div
                        key={index}
                        className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                          completedSteps.has(index)
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600'
                        }`}
                      >
                        <div className="flex items-start space-x-4">
                          <button
                            onClick={() => toggleStepCompletion(index)}
                            className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              completedSteps.has(index)
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-orange-500'
                            }`}
                          >
                            {completedSteps.has(index) ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <span className="text-sm font-medium">{index + 1}</span>
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <p className={`text-gray-900 dark:text-white leading-relaxed ${
                              completedSteps.has(index) ? 'line-through opacity-75' : ''
                            }`}>
                              {step.description}
                            </p>
                            
                            {step.media_url && (
                              <div className="mt-4">
                                <img
                                  src={step.media_url}
                                  alt={`Step ${index + 1}`}
                                  className="w-full max-w-md rounded-xl"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {t('reviews')} ({reviews.length})
                    </h2>
                    
                    {isAuthenticated && (
                      <button
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-medium hover:bg-orange-600 transition-colors"
                      >
                        {t('writeReview')}
                      </button>
                    )}
                  </div>

                  {/* Review Form */}
                  {showReviewForm && (
                    <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('rating')}
                        </label>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setNewReview({ ...newReview, rating: star })}
                              className={`text-2xl ${
                                star <= newReview.rating ? 'text-amber-400' : 'text-gray-300'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('comment')}
                        </label>
                        <textarea
                          value={newReview.comment}
                          onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          rows={4}
                          placeholder={t('shareYourThoughts')}
                        />
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={submitReview}
                          className="px-6 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
                        >
                          {t('submit')}
                        </button>
                        <button
                          onClick={() => setShowReviewForm(false)}
                          className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reviews List */}
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                        <div className="flex items-start space-x-4">
                          {review.user?.avatar_url ? (
                            <img
                              src={review.user.avatar_url}
                              alt={review.user.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full flex items-center justify-center text-white font-semibold">
                              {review.user?.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {review.user?.username}
                              </h4>
                              <div className="flex text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={16}
                                    className={i < review.rating ? 'fill-current' : 'text-gray-300'}
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                              {review.comment}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Nutrition Info */}
            {recipe.nutrition && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('nutrition')}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('calories')}</span>
                    <span className="font-medium">{recipe.nutrition.calories}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('protein')}</span>
                    <span className="font-medium">{recipe.nutrition.protein}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('carbs')}</span>
                    <span className="font-medium">{recipe.nutrition.carbs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('fat')}</span>
                    <span className="font-medium">{recipe.nutrition.fat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('fiber')}</span>
                    <span className="font-medium">{recipe.nutrition.fiber}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cooking Timer */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {t('cookingTimer')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="text-gray-600 dark:text-gray-400">{t('prepTime')}</span>
                  <div className="flex items-center space-x-2">
                    <Timer size={16} className="text-orange-500" />
                    <span className="font-medium">{recipe.prep_time} {t('min')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="text-gray-600 dark:text-gray-400">{t('cookTime')}</span>
                  <div className="flex items-center space-x-2">
                    <Timer size={16} className="text-rose-500" />
                    <span className="font-medium">{recipe.cook_time} {t('min')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                  <span className="text-orange-700 dark:text-orange-300 font-medium">{t('totalTime')}</span>
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-orange-500" />
                    <span className="font-bold text-orange-700 dark:text-orange-300">
                      {recipe.prep_time + recipe.cook_time} {t('min')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('tags')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-900/20 dark:to-rose-900/20 text-orange-700 dark:text-orange-300 text-sm rounded-full font-medium border border-orange-200 dark:border-orange-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailPage;