'use client';

import { useTranslations } from 'next-intl';

interface GuestWelcomePopupProps {
  isVisible: boolean;
  onClose: () => void;
}

export function GuestWelcomePopup({ isVisible, onClose }: GuestWelcomePopupProps) {
  const t = useTranslations('home');

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md animate-fade-in">
      <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-6 max-w-lg w-full mx-4">
        {/* Unified metallic shine overlay */}
        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
        
        <div className="relative z-10">
          {/* Close button with proper spacing */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors duration-200 z-20"
            aria-label="Close popup"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          {/* Content with proper top spacing to avoid overlap */}
          <div className="pt-8 pr-8 text-gray-300 text-sm md:text-base leading-relaxed">
            <div 
              dangerouslySetInnerHTML={{ __html: t('guestPopup.content') }}
              className="[&>strong]:text-white [&>strong]:font-semibold"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 