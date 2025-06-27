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
  const tNav = useTranslations('navigation');

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
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                href="/dashboard"
                className="hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsOpen(false)}
              >
                {tNav('dashboard')}
              </Link>
              
              <Link
                href="/settings"
                className="hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                onClick={() => setIsOpen(false)}
              >
                {tNav('settings')}
              </Link>
              
              {user ? (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center px-5">
                    <div className="ml-3">
                      <div className="text-base font-medium leading-none text-white">
                        {user.email ?? 'User'}
                      </div>
                      <div className="text-sm font-medium leading-none text-gray-400">
                        {user.user_metadata?.full_name ?? user.email ?? 'User'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 