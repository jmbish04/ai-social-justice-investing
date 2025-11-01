/**
 * Navbar - Shared navigation bar for all pages
 *
 * @module ui/components/Navbar
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Navbar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') {
      return true;
    }
    if (path !== '/' && location.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-gray-900">The Social Justice Investor</h1>
          </Link>

          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/') && location.pathname === '/'
                  ? 'text-indigo-600'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              Home
            </Link>
            <Link
              to="/brainstorm"
              className={`text-sm font-medium transition-colors ${
                isActive('/brainstorm')
                  ? 'text-indigo-600'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              Brainstorm
            </Link>
            <Link
              to="/episodes"
              className={`text-sm font-medium transition-colors ${
                isActive('/episodes')
                  ? 'text-indigo-600'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              Episodes
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
