'use client';

import { useState, useEffect } from 'react';
import { GuestWelcomePopup } from './GuestWelcomePopup';

interface GuestPopupWrapperProps {
  isGuest: boolean;
}

export function GuestPopupWrapper({ isGuest }: GuestPopupWrapperProps) {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!isGuest) return;

    // Check if popup has been dismissed before
    const popupDismissed = localStorage.getItem('guest-welcome-popup-dismissed');
    
    if (!popupDismissed) {
      // Show popup after a short delay for better UX
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isGuest]);

  const handleClosePopup = () => {
    setShowPopup(false);
    // Remember that user dismissed the popup
    localStorage.setItem('guest-welcome-popup-dismissed', 'true');
  };

  if (!isGuest) return null;

  return (
    <GuestWelcomePopup 
      isVisible={showPopup} 
      onClose={handleClosePopup} 
    />
  );
} 