'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function GuestExplainerSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const tHome = useTranslations('home');

  return (
    <div className="w-full max-w-md mx-auto">
      {/* More Info Button - smaller version of partners button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full border border-purple-800/60 text-purple-400 hover:bg-purple-800 hover:text-white transition-all duration-200 rounded-sm px-4 py-2 text-sm font-medium"
      >
        {isExpanded ? '▲ ' : '▼ '}{tHome('moreInfo')}
      </button>

      {/* Collapsible Content */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-4 break-words">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <div className="relative z-10">
            {/* Content using existing popup translation */}
            <div className="text-gray-300 text-sm md:text-base leading-relaxed">
              <div 
                dangerouslySetInnerHTML={{ __html: tHome('guestPopup.content') }}
                className="[&>strong]:text-white [&>strong]:font-semibold"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 