'use client';

import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SettingsSection = 'profile' | 'contact' | 'professional' | 'participation' | 'location' | 'finance' | 'settings';

interface SectionItem {
  key: string;
  label: string;
}

interface SettingsMobileDropdownProps {
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  sections: SectionItem[];
  isSectionCompletedSync: (section: SettingsSection) => boolean;
  t: (key: string) => string;
}

export function SettingsMobileDropdown({ 
  activeSection, 
  setActiveSection, 
  sections,
  isSectionCompletedSync,
  t 
}: SettingsMobileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentSection = sections.find(s => s.key === activeSection);
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between glass-card shadow-glow-xl border-gray-700 text-white hover:bg-gray-800/50 h-14 text-left px-4 py-3 rounded-sm"
        >
          <span className="font-medium text-base">
            {currentSection ? currentSection.label : t('menu.profile')}
          </span>
          <ChevronDownIcon className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-full glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
        {/* Unified metallic shine overlay */}
        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
        
        <div className="relative z-10">
          {sections.map((section, index) => {
            const isCompleted = isSectionCompletedSync(section.key as SettingsSection);
            const isActive = activeSection === section.key;
            
            return (
              <DropdownMenuItem
                key={section.key}
                onClick={() => {
                  // Immediate visual feedback (same as sidebar)
                  setActiveSection(section.key as SettingsSection);
                  setIsOpen(false);
                }}
                className={`sidebar-item cursor-pointer px-4 py-3 transition-all duration-300 relative overflow-hidden group transform hover:translate-x-1 rounded-sm touch-manipulation whitespace-normal leading-tight text-sm sm:text-base min-h-[3rem] flex items-center
                  ${isActive
                    ? 'active bg-gradient-to-r from-purple-800/10 via-purple-800/5 to-transparent text-purple-300 border border-purple-800/20 shadow-md scale-[1.02]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'}
                `}
                style={{ 
                  marginBottom: index < sections.length - 1 ? '2px' : '0'
                }}
              >
                {/* Enhanced hover gradient - same as sidebar */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-800/2 via-purple-800/1 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-sm"></div>
                )}
                
                <span className="relative z-10 font-medium tracking-normal text-base leading-relaxed transition-all duration-200 group-hover:translate-x-1 flex items-center justify-between w-full">
                  <span>{section.label}</span>
                  {isCompleted && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-green-500/20 border border-green-500/50 rounded-full">
                      <span className="text-green-400 text-xs">✓</span>
                    </span>
                  )}
                </span>
                
                {/* Subtle metallic shine effect - same as sidebar */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/1 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600 ease-in-out"></div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 