import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, 
  User, 
  Heart, 
  Plus, 
  Calendar, 
  ShoppingCart, 
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Shield,
  BookOpen
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguageStore } from '../../stores/languageStore';
import LanguageSelector from './LanguageSelector';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsProfileOpen(false);
  };

  const navItems = [
    { path: '/', label: t('home') },
    { path: '/explore', label: t('recipes'), icon: BookOpen },
  ];

  const userMenuItems = [
    { path: '/add-recipe', label: t('addRecipe'), icon: Plus },
    { path: '/my-recipes', label: t('myRecipes'), icon: User },
    { path: '/saved', label: t('saved'), icon: Heart },
    { path: '/meal-planner', label: t('mealPlanner'), icon: Calendar },
    { path: '/shopping-list', label: t('shoppingList'), icon: ShoppingCart },
    { path: '/settings', label: t('settings'), icon: Settings },
  ];

  if (user?.is_admin) {
    userMenuItems.splice(-1, 0, { path: '/admin', label: 'Admin', icon: Shield });
  }

  return (
    <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 bg-clip-text text-transparent">
                2yolks
              </div>
              <div className="absolute -top-1 -right-1">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <div className="absolute -bottom-0.5 -left-0.5">
                <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-rose-400 rounded-full animate-pulse delay-300 shadow-lg"></div>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-12">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 text-sm font-medium transition-all duration-300 relative group ${
                  location.pathname === item.path
                    ? 'text-orange-500'
                    : 'text-gray-700 dark:text-gray-200 hover:text-orange-500'
                }`}
              >
                {item.icon && <item.icon size={18} />}
                <span className="tracking-wide">{item.label}</span>
                <div className={`absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-rose-500 transform transition-transform duration-300 ${
                  location.pathname === item.path ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}></div>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <button
              onClick={() => navigate('/explore')}
              className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 group"
            >
              <Search size={20} className="group-hover:scale-110 transition-transform duration-300" />
            </button>

            {/* Language Selector */}
            <LanguageSelector />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 group"
            >
              {theme === 'light' ? 
                <Moon size={20} className="group-hover:scale-110 transition-transform duration-300" /> : 
                <Sun size={20} className="group-hover:scale-110 transition-transform duration-300" />
              }
            </button>

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 group"
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-orange-300 transition-all duration-300"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-rose-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg group-hover:shadow-xl transition-all duration-300">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 tracking-wide">
                    {user?.username}
                  </span>
                </button>

                {/* Profile Dropdown */}
                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute right-0 mt-3 w-64 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 py-3 z-50 backdrop-blur-xl"
                    >
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      </div>
                      
                      {userMenuItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 group"
                        >
                          <item.icon size={16} className="group-hover:scale-110 transition-transform duration-200" />
                          <span className="tracking-wide">{item.label}</span>
                        </Link>
                      ))}
                      
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 group"
                        >
                          <LogOut size={16} className="group-hover:scale-110 transition-transform duration-200" />
                          <span className="tracking-wide">{t('signOut')}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-orange-500 transition-all duration-300 tracking-wide"
                >
                  {t('signIn')}
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-2xl hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 tracking-wide"
                >
                  {t('joinFree')}
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden border-t border-gray-100 dark:border-gray-800 py-4 overflow-hidden"
            >
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-4 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-orange-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 rounded-xl mx-2"
                >
                  {item.icon && <item.icon size={18} />}
                  <span className="tracking-wide">{item.label}</span>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;