'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { useTranslations } from 'next-intl';
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/settings/types";

interface MobileMenuProps {
  user: User | null;
  userProfile: UserProfile | null;
  homeText: string;
  manifestText: string;
  dashboardText: string;
  signInText: string;
  signUpText: string;
}

export function MobileMenu({ user, userProfile, homeText, manifestText, dashboardText, signInText, signUpText }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tAccessibility = useTranslations('accessibility');

  // Ensure component is mounted before running client-side code
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMounted) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, isMounted]);

  // Close menu on route change
  useEffect(() => {
    if (!isMounted) return;

    const handleRouteChange = () => setIsOpen(false);
    
    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [isMounted]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  // Prevent rendering until mounted to avoid hydration mismatches
  if (!isMounted) {
    return (
      <div className="relative">
        <button 
          className="flex items-center justify-center w-10 h-10 text-purple-400 hover:text-purple-300 transition-colors rounded-sm hover:bg-purple-400/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          aria-label={tAccessibility('menuButton')}
          disabled
        >
          <div className="relative w-6 h-6">
            <span className="absolute h-0.5 w-6 bg-current top-1" />
            <span className="absolute h-0.5 w-6 bg-current top-3" />
            <span className="absolute h-0.5 w-6 bg-current top-5" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Burger Menu Button */}
      <button 
        ref={buttonRef}
        onClick={toggleMenu}
        className="flex items-center justify-center w-10 h-10 text-purple-400 hover:text-purple-300 transition-colors rounded-sm hover:bg-purple-400/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        aria-label={tAccessibility('menuButton')}
        aria-expanded={isOpen}
      >
        <div className="relative w-6 h-6">
          {/* Animated hamburger icon */}
          <span className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
            isOpen ? 'rotate-45 top-3' : 'top-1'
          }`} />
          <span className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out top-3 ${
            isOpen ? 'opacity-0' : 'opacity-100'
          }`} />
          <span className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
            isOpen ? '-rotate-45 top-3' : 'top-5'
          }`} />
        </div>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-40 lg:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Menu Popup */}
      <div 
        ref={menuRef}
        className={`absolute right-0 top-12 w-64 z-50 transition-all duration-200 ease-out transform-gpu ${
          isOpen 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <div className="relative z-10 p-4 space-y-3">
            {user ? (
              // Logged in user menu
              <>
                <div className="border-b border-gray-700/30 pb-3 mb-3">
                  <p className="text-purple-400 text-sm font-medium truncate">
                    {userProfile?.username || user.email?.split('@')[0] || 'User'}
                  </p>
                </div>
                
                {/* Home Link */}
                <Link 
                  href="/" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors"
                  onClick={closeMenu}
                >
                  {homeText}
                </Link>
                
                {/* Manifest Link */}
                <Link 
                  href="/manifest" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors"
                  onClick={closeMenu}
                >
                  {manifestText}
                </Link>
                
                {/* Dashboard Link */}
                <Link 
                  href="/protected" 
                  className="dashboard-btn mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors"
                  onClick={closeMenu}
                >
                  <span className="btn-text">{dashboardText}</span>
                </Link>
                
                {/* Logout Button */}
                <div className="mobile-menu-item px-4 py-1 border-t border-gray-700/30 pt-3">
                  <div onClick={closeMenu}>
                    <LogoutButton />
                  </div>
                </div>
              </>
            ) : (
              // Guest user menu
              <>
                {/* Home Link */}
                <Link 
                  href="/" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors"
                  onClick={closeMenu}
                >
                  {homeText}
                </Link>
                
                {/* Manifest Link */}
                <Link 
                  href="/manifest" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors"
                  onClick={closeMenu}
                >
                  {manifestText}
                </Link>
                
                {/* Sign In Link */}
                <Link 
                  href="/auth/login" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-white hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors border-t border-gray-700/30"
                  onClick={closeMenu}
                >
                  {signInText}
                </Link>
                
                {/* Sign Up Link */}
                <Link 
                  href="/auth/sign-up" 
                  className="mobile-menu-item block w-full text-left px-4 py-3 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded-sm transition-colors font-medium"
                  onClick={closeMenu}
                >
                  {signUpText}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 