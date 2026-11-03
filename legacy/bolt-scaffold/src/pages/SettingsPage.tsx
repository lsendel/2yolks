import React, { useState } from 'react';
import { User, Bell, Shield, Palette, Globe, Save } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true,
  });
  const [privacy, setPrivacy] = useState({
    profilePublic: true,
    recipesPublic: true,
    showActivity: false,
  });

  const handleSave = () => {
    // Here you would typically save to your backend
    console.log('Settings saved');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <User className="mr-3 h-6 w-6" />
              Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your account preferences and privacy settings
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* Theme Settings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Palette className="mr-2 h-5 w-5" />
                Appearance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['light', 'dark', 'system'].map((themeOption) => (
                  <button
                    key={themeOption}
                    onClick={() => setTheme(themeOption as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === themeOption
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {themeOption}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {themeOption === 'system' ? 'Auto' : `${themeOption} mode`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notifications
              </h2>
              <div className="space-y-3">
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {key === 'weekly' ? 'Weekly Recipe Digest' : `${key} Notifications`}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {key === 'email' && 'Receive notifications via email'}
                        {key === 'push' && 'Receive push notifications in browser'}
                        {key === 'weekly' && 'Get weekly recipe recommendations'}
                      </p>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Privacy
              </h2>
              <div className="space-y-3">
                {Object.entries(privacy).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        {key === 'profilePublic' && 'Public Profile'}
                        {key === 'recipesPublic' && 'Public Recipes'}
                        {key === 'showActivity' && 'Show Activity'}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {key === 'profilePublic' && 'Allow others to view your profile'}
                        {key === 'recipesPublic' && 'Make your recipes discoverable by others'}
                        {key === 'showActivity' && 'Display your cooking activity to followers'}
                      </p>
                    </div>
                    <button
                      onClick={() => setPrivacy(prev => ({ ...prev, [key]: !value }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Language & Region */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Globe className="mr-2 h-5 w-5" />
                Language & Region
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Measurement Units
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white">
                    <option>Imperial (cups, oz, °F)</option>
                    <option>Metric (ml, g, °C)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSave}
                className="w-full sm:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;