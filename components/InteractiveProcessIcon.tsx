'use client';

import { useEffect, useState } from 'react';

export function InteractiveProcessIcon() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsActive(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative w-full h-48 flex items-center justify-center">
        {/* Ambient Background Glow */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 via-transparent to-transparent blur-3xl"></div>
        
        {/* Central Research Unit */}
        <div className="relative">
          {/* Outer Ring */}
          <div className={`absolute inset-0 w-32 h-32 rounded-full border border-blue-400/30 transition-all duration-700 ${isActive ? 'scale-125 border-blue-300/50 rotate-45' : 'scale-100 rotate-0'}`}></div>
          <div className={`absolute inset-2 w-28 h-28 rounded-full border border-blue-500/20 transition-all duration-700 ${isActive ? 'scale-110 border-blue-400/40 -rotate-45' : 'scale-100 rotate-0'}`}></div>
          
          {/* Main Research Core */}
          <div className={`relative w-32 h-32 bg-gradient-to-br from-blue-500/90 via-blue-600/95 to-blue-800/90 rounded-2xl border border-blue-400/50 shadow-2xl backdrop-blur-sm transition-all duration-700 ${isActive ? 'scale-110 shadow-blue-500/50 shadow-2xl' : 'scale-100'}`}>
            {/* Inner Glow Layers */}
            <div className="absolute inset-4 bg-gradient-to-br from-blue-300/40 via-blue-400/30 to-transparent rounded-xl animate-pulse"></div>
            <div className="absolute inset-6 bg-gradient-to-br from-blue-200/30 via-transparent to-blue-400/20 rounded-lg animate-ping"></div>
            
            {/* Geometric Pattern Overlay */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-blue-200"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-blue-200"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-blue-200"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-blue-200"></div>
            </div>
            
            {/* Research Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-white text-lg font-bold tracking-wider mb-1">RESEARCH</div>
            </div>
          </div>
        </div>

        {/* ChatGPT (Left) */}
        <div className="absolute left-8 top-1/2 transform -translate-y-1/2">
          <div className="relative">
            {/* Outer Glow Ring */}
            <div className={`absolute -inset-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 blur-lg transition-all duration-700 ${isActive ? 'scale-110 opacity-100' : 'scale-100 opacity-60'}`}></div>
            
            <div className={`relative w-20 h-20 bg-gradient-to-br from-emerald-500/90 via-green-600/95 to-green-700/90 rounded-2xl border border-emerald-400/50 shadow-xl backdrop-blur-sm transition-all duration-700 ${isActive ? 'scale-105 shadow-emerald-500/50' : 'scale-100'}`}>
              {/* Inner Glow */}
              <div className="absolute inset-3 bg-gradient-to-br from-emerald-300/50 via-green-400/30 to-transparent rounded-xl animate-pulse"></div>
              
              {/* ChatGPT Icon Pattern */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-200 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-white text-xs font-bold tracking-wide">GPT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gemini (Right) */}
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
          <div className="relative">
            {/* Outer Glow Ring */}
            <div className={`absolute -inset-2 rounded-2xl bg-gradient-to-r from-purple-500/20 to-violet-500/20 blur-lg transition-all duration-700 ${isActive ? 'scale-110 opacity-100' : 'scale-100 opacity-60'}`}></div>
            
            <div className={`relative w-20 h-20 bg-gradient-to-br from-purple-500/90 via-violet-600/95 to-purple-700/90 rounded-2xl border border-purple-400/50 shadow-xl backdrop-blur-sm transition-all duration-700 ${isActive ? 'scale-105 shadow-purple-500/50' : 'scale-100'}`}>
              {/* Inner Glow */}
              <div className="absolute inset-3 bg-gradient-to-br from-purple-300/50 via-violet-400/30 to-transparent rounded-xl animate-pulse"></div>
              
              {/* Gemini Icon Pattern */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="flex space-x-1">
                    <div className="w-3 h-6 bg-white/90 rounded-full transform -rotate-12"></div>
                    <div className="w-3 h-6 bg-white/90 rounded-full transform rotate-12"></div>
                  </div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-purple-200 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-white text-xs font-bold tracking-wide">GEMINI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Connection System */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Left Connection (ChatGPT to Research) */}
          <div className="absolute left-28 top-1/2 transform -translate-y-1/2">
            {/* Main Connection Line */}
            <div className={`w-20 h-0.5 bg-gradient-to-r from-emerald-400/80 via-cyan-400/80 to-blue-500/80 transition-all duration-1000 ${isActive ? 'opacity-100 scale-x-100' : 'opacity-40 scale-x-75'}`}>
              {/* Data Flow Visualization */}
              <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50 transition-all duration-1000 ${isActive ? 'translate-x-18 opacity-100' : 'translate-x-2 opacity-60'}`}></div>
              <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 transition-all duration-1000 ${isActive ? 'translate-x-15 opacity-100' : 'translate-x-1 opacity-40'}`} style={{ animationDelay: '0.3s' }}></div>
              <div className={`absolute left-6 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50 transition-all duration-1000 ${isActive ? 'translate-x-12 opacity-100' : 'translate-x-0 opacity-30'}`} style={{ animationDelay: '0.6s' }}></div>
            </div>
            
            {/* Connection Enhancement Lines */}
            <div className={`absolute top-1 w-20 h-px bg-gradient-to-r from-emerald-300/40 to-blue-400/40 transition-all duration-1000 ${isActive ? 'opacity-80' : 'opacity-20'}`}></div>
            <div className={`absolute -top-1 w-20 h-px bg-gradient-to-r from-emerald-300/40 to-blue-400/40 transition-all duration-1000 ${isActive ? 'opacity-80' : 'opacity-20'}`}></div>
          </div>

          {/* Right Connection (Research to Gemini) */}
          <div className="absolute right-28 top-1/2 transform -translate-y-1/2">
            {/* Main Connection Line */}
            <div className={`w-20 h-0.5 bg-gradient-to-r from-blue-500/80 via-indigo-400/80 to-purple-400/80 transition-all duration-1000 ${isActive ? 'opacity-100 scale-x-100' : 'opacity-40 scale-x-75'}`}>
              {/* Data Flow Visualization */}
              <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50 transition-all duration-1000 ${isActive ? 'translate-x-18 opacity-100' : 'translate-x-2 opacity-60'}`}></div>
              <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50 transition-all duration-1000 ${isActive ? 'translate-x-15 opacity-100' : 'translate-x-1 opacity-40'}`} style={{ animationDelay: '0.3s' }}></div>
              <div className={`absolute left-6 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50 transition-all duration-1000 ${isActive ? 'translate-x-12 opacity-100' : 'translate-x-0 opacity-30'}`} style={{ animationDelay: '0.6s' }}></div>
            </div>
            
            {/* Connection Enhancement Lines */}
            <div className={`absolute top-1 w-20 h-px bg-gradient-to-r from-blue-400/40 to-purple-300/40 transition-all duration-1000 ${isActive ? 'opacity-80' : 'opacity-20'}`}></div>
            <div className={`absolute -top-1 w-20 h-px bg-gradient-to-r from-blue-400/40 to-purple-300/40 transition-all duration-1000 ${isActive ? 'opacity-80' : 'opacity-20'}`}></div>
          </div>
        </div>

        {/* Enhanced Floating Data Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full transition-all duration-1000 ${isActive ? 'opacity-100' : 'opacity-20'}`}
              style={{
                left: `${10 + (i * 8)}%`,
                top: `${20 + (i % 5) * 12}%`,
                animationDelay: `${i * 0.5}s`,
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                backgroundColor: i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#3b82f6' : '#8b5cf6',
                boxShadow: `0 0 ${4 + (i % 3) * 2}px currentColor`,
              }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
} 