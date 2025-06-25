// Dynamic Settings Type System
// This allows adding new settings without breaking existing code

export type SettingType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'multiselect' 
  | 'searchable' 
  | 'language' 
  | 'country' 
  | 'city' 
  | 'tags'
  | 'checkbox'
  | 'radio';

export interface SettingOption {
  readonly value: string;
  readonly label: string;
  readonly flag?: string; // For countries/languages
  readonly description?: string;
}

export interface SettingDefinition {
  readonly key: string;
  readonly type: SettingType;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly options?: readonly SettingOption[];
  readonly searchable?: boolean;
  readonly category: SettingCategory;
  readonly icon?: string;
}

export type SettingCategory = 
  | 'personal'
  | 'professional'
  | 'location'
  | 'preferences'
  | 'contact'
  | 'participation'
  | 'account';

export type ExperienceLevel = 
  | 'intern'
  | 'entry'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'executive';

export type ParticipationRole = 
  | 'member'
  | 'expert'
  | 'activist'
  | 'supporter';

export interface UserPreferences {
  // Personal Information
  bio?: string;
  website?: string;
  contact_comment?: string;
  professional_comment?: string;
  
  // Professional Information
  profession?: string;
  organization?: string;
  experience_level?: ExperienceLevel;
  skills?: string[];
  
  // Location
  country?: string;
  city?: string;
  region?: string;
  
  // Preferences
  language?: string;
  timezone?: string;
  
  // Social Links
  social_links?: Record<string, string>;
  
  // Custom fields for future expansion
  [key: string]: unknown;
}

export interface ConsentData {
  direct_contact: boolean;
  newsletter: boolean;
  timestamps: {
    direct_contact?: {
      consent_given: boolean;
      timestamp: string;
    };
    newsletter?: {
      consent_given: boolean;
      timestamp: string;
    };
  };
}

export interface FieldChangeLimit {
  can_change: boolean;
  error_message?: string;
  daily_changes: number;
  total_changes: number;
  last_change?: string;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly username?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly full_name?: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly participation_role?: ParticipationRole[];
  readonly organization_representative?: boolean;
  readonly preferences: UserPreferences;
  readonly created_at: string;
  readonly updated_at: string;
  readonly direct_contact_consent?: boolean;
  readonly newsletter_consent?: boolean;
  readonly consent_timestamps?: Record<string, unknown>;
}

export interface SettingField {
  readonly key: keyof UserPreferences;
  readonly category: SettingCategory;
  readonly type: 'text' | 'textarea' | 'select' | 'multiselect' | 'switch';
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly options?: readonly string[];
  readonly searchable?: boolean;
}

export interface SettingUpdatePayload {
  readonly key: string;
  readonly value: unknown;
}

export type SettingsRegistry = Record<string, SettingDefinition>;

// All supported languages
export type SupportedLanguage = 
  | 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' 
  | 'nl' | 'pl' | 'ru' | 'ja' | 'ko' | 'zh' 
  | 'ar' | 'hi';

// Settings form data
export interface SettingsFormData {
  readonly personal: {
    readonly username: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly bio: string;
    readonly website: string;
  };
  readonly contact: {
    readonly phone: string;
    readonly contact_comment: string;
    readonly direct_contact_consent: boolean;
    readonly newsletter_consent: boolean;
  };
  readonly professional: {
    readonly profession: string;
    readonly organization: string;
    readonly experience_level: ExperienceLevel;
    readonly skills: readonly string[];
    readonly professional_comment: string;
    readonly organization_representative: boolean;
  };
  readonly participation: {
    readonly roles: ParticipationRole[];
  };
  readonly location: {
    readonly country: string;
    readonly city: string;
    readonly region: string;
  };
  readonly preferences: {
    readonly language: SupportedLanguage;
    readonly timezone: string;
  };
} 