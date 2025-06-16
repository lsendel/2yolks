import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

// Layout Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Pages
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import AddRecipePage from './pages/AddRecipePage';
import MyRecipesPage from './pages/MyRecipesPage';
import SavedRecipesPage from './pages/SavedRecipesPage';
import MealPlannerPage from './pages/MealPlannerPage';
import ShoppingListPage from './pages/ShoppingListPage';
import CookingModePage from './pages/CookingModePage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRecipes from './pages/admin/AdminRecipes';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import ContentCreatorDashboard from './pages/admin/ContentCreatorDashboard';

// Protected Route Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';

function App() {
  const { initialize } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/recipe/:id" element={<RecipeDetailPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes */}
            <Route path="/add-recipe" element={
              <RoleBasedRoute requiredPermission={{ resource: 'recipes', action: 'create' }}>
                <AddRecipePage />
              </RoleBasedRoute>
            } />
            <Route path="/my-recipes" element={
              <ProtectedRoute>
                <MyRecipesPage />
              </ProtectedRoute>
            } />
            <Route path="/saved" element={
              <ProtectedRoute>
                <SavedRecipesPage />
              </ProtectedRoute>
            } />
            <Route path="/meal-planner" element={
              <ProtectedRoute>
                <MealPlannerPage />
              </ProtectedRoute>
            } />
            <Route path="/shopping-list" element={
              <ProtectedRoute>
                <ShoppingListPage />
              </ProtectedRoute>
            } />
            <Route path="/cooking/:id" element={
              <ProtectedRoute>
                <CookingModePage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />

            {/* Role-Based Admin Routes */}
            <Route path="/admin" element={
              <RoleBasedRoute requiredRole="admin">
                <SuperAdminDashboard />
              </RoleBasedRoute>
            } />
            <Route path="/admin/users" element={
              <RoleBasedRoute requiredPermission={{ resource: 'users', action: 'manage' }}>
                <AdminUsers />
              </RoleBasedRoute>
            } />
            <Route path="/admin/recipes" element={
              <RoleBasedRoute requiredPermission={{ resource: 'content', action: 'moderate' }}>
                <AdminRecipes />
              </RoleBasedRoute>
            } />
            <Route path="/admin/analytics" element={
              <RoleBasedRoute requiredPermission={{ resource: 'analytics', action: 'view' }}>
                <AdminAnalytics />
              </RoleBasedRoute>
            } />

            {/* Content Creator Dashboard */}
            <Route path="/creator" element={
              <RoleBasedRoute requiredRole="content_creator">
                <ContentCreatorDashboard />
              </RoleBasedRoute>
            } />

            {/* Legacy Admin Routes (for backward compatibility) */}
            <Route path="/admin/dashboard" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
          </Routes>
        </main>
        <Footer />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'dark:bg-gray-800 dark:text-white',
            duration: 4000,
          }}
        />
      </div>
    </Router>
  );
}

export default App;