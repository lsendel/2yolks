import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mail, MapPin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative">
                <div className="text-2xl font-bold text-orange-500">2yolks</div>
                <div className="absolute -top-1 -right-1">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                </div>
                <div className="absolute -bottom-0.5 -left-0.5">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              A culinary platform where passionate chefs and home cooks share extraordinary recipes, 
              discover new flavors, and connect through the art of cooking.
            </p>
            <div className="flex items-center space-x-2 text-gray-400">
              <Heart size={16} className="text-red-500" />
              <span>Made with passion for cooking</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/explore" className="text-gray-400 hover:text-white transition-colors">
                  Explore Recipes
                </Link>
              </li>
              <li>
                <Link to="/add-recipe" className="text-gray-400 hover:text-white transition-colors">
                  Share Recipe
                </Link>
              </li>
              <li>
                <Link to="/meal-planner" className="text-gray-400 hover:text-white transition-colors">
                  Meal Planner
                </Link>
              </li>
              <li>
                <Link to="/shopping-list" className="text-gray-400 hover:text-white transition-colors">
                  Shopping List
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Community</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 2yolks. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <a href="mailto:hello@2yolks.com" className="text-gray-400 hover:text-white transition-colors">
                <Mail size={18} />
              </a>
              <span className="text-gray-600">|</span>
              <div className="flex items-center space-x-1 text-gray-400">
                <MapPin size={16} />
                <span className="text-sm">Powered by Bolt</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;