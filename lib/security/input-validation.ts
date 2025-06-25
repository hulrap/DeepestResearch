/**
 * Comprehensive input validation and sanitization utilities
 * Prevents XSS attacks, injection attacks, and enforces content limits
 */

// Comprehensive HTML tag and script sanitization
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*[^>]*/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Normalize excessive whitespace but preserve single spaces and line breaks
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Enhanced phone validation with injection prevention
export function validateAndSanitizePhone(phone: string): { isValid: boolean; sanitized: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, sanitized: '' };
  }

  // Remove all non-digit and non-plus characters to prevent injection
  const sanitized = phone.replace(/[^\d+\-\s()]/g, '');
  
  // Must start with + and have at least 7 digits after
  const phoneRegex = /^\+\d{7,15}$/;
  
  if (!phoneRegex.test(sanitized.replace(/[\-\s()]/g, ''))) {
    return { isValid: false, sanitized };
  }

  // Additional security checks
  if (sanitized.length > 20) {
    return { isValid: false, sanitized };
  }

  return { isValid: true, sanitized };
}

// Enhanced bio validation with XSS prevention - ONLY for final validation
export function validateAndSanitizeBio(bio: string): { isValid: boolean; sanitized: string } {
  if (!bio || typeof bio !== 'string') {
    return { isValid: true, sanitized: '' };
  }

  // Sanitize HTML and scripts ONLY on final validation
  const sanitized = sanitizeHtml(bio);
  
  // Length validation
  if (sanitized.length > 500) {
    return { isValid: false, sanitized: sanitized.substring(0, 500) };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /eval\s*\(/i,
    /expression\s*\(/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /document\./i,
    /window\./i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      return { isValid: false, sanitized: '' };
    }
  }

  return { isValid: true, sanitized };
}

// NEW: Lightweight typing validation - allows free typing during input
export function validateTypingInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  // Only block extremely dangerous patterns during typing
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i
  ];

  let cleaned = input;
  for (const pattern of dangerousPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Enforce length limit but allow normal typing
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

// Skills array validation with size and content limits
export function validateAndSanitizeSkills(skills: string[]): { 
  isValid: boolean; 
  sanitized: string[]; 
} {
  if (!Array.isArray(skills)) {
    return { isValid: false, sanitized: [] };
  }

  // Limit total number of skills
  if (skills.length > 50) {
    return { isValid: false, sanitized: skills.slice(0, 50) };
  }

  const sanitizedSkills: string[] = [];
  
  for (const skill of skills) {
    if (typeof skill !== 'string') {
      continue; // Skip non-string items
    }

    const sanitized = sanitizeHtml(skill.trim());
    
    // Skip empty skills
    if (!sanitized) continue;
    
    // Individual skill length limit
    if (sanitized.length > 100) {
      return { isValid: false, sanitized: sanitizedSkills };
    }

    // Check for duplicate skills (case insensitive)
    if (sanitizedSkills.some(existing => existing.toLowerCase() === sanitized.toLowerCase())) {
      continue; // Skip duplicates
    }

    sanitizedSkills.push(sanitized);
  }

  return { isValid: true, sanitized: sanitizedSkills };
}

// Username validation with injection prevention
export function validateAndSanitizeUsername(username: string): { 
  isValid: boolean; 
  sanitized: string; 
} {
  if (!username || typeof username !== 'string') {
    return { isValid: false, sanitized: '' };
  }

  // Remove any potentially dangerous characters - match database pattern [a-zA-Z0-9_-]
  const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Length validation
  if (sanitized.length < 3) {
    return { isValid: false, sanitized };
  }

  if (sanitized.length > 30) {
    return { isValid: false, sanitized: sanitized.substring(0, 30) };
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(sanitized)) {
    return { isValid: false, sanitized };
  }

  return { isValid: true, sanitized };
}

// NEW: Lightweight username typing validation
export function validateUsernameTyping(username: string): string {
  if (!username || typeof username !== 'string') return '';
  
  // Only allow safe characters during typing - match database pattern [a-zA-Z0-9_-]
  return username.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
}

// General text field sanitization - lightweight for typing
export function sanitizeTextInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';
  
  // Light sanitization during typing - only block dangerous scripts
  let cleaned = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
  cleaned = cleaned.replace(/javascript:/gi, '');
  
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

// Website URL validation and sanitization
export function validateAndSanitizeWebsite(url: string): { 
  isValid: boolean; 
  sanitized: string; 
} {
  if (!url || typeof url !== 'string') {
    return { isValid: true, sanitized: '' };
  }

  const trimmed = url.trim();
  
  // Must start with http:// or https://
  if (!trimmed.match(/^https?:\/\//)) {
    return { isValid: false, sanitized: trimmed };
  }

  // Length check
  if (trimmed.length > 500) {
    return { isValid: false, sanitized: trimmed.substring(0, 500) };
  }

  // Basic URL validation
  try {
    const urlObj = new URL(trimmed);
    
    // Block dangerous protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, sanitized: '' };
    }

    return { isValid: true, sanitized: trimmed };
  } catch {
    return { isValid: false, sanitized: trimmed };
  }
}

// NEW: Lightweight website typing validation
export function validateWebsiteTyping(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Light validation during typing - just prevent dangerous scripts
  let cleaned = url.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/vbscript:/gi, '');
  
  return cleaned.substring(0, 500);
} 