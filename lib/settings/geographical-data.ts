import { Country, State, City } from 'country-state-city';

export interface CountryOption {
  value: string;
  label: string;
  flag: string;
}

export interface StateOption {
  value: string;
  label: string;
  countryCode: string;
}

export interface CityOption {
  value: string;
  label: string;
  countryCode: string;
  stateCode?: string;
}

// Custom overrides for incorrect data in country-state-city package
// Key format: "countryCode-stateCode" or "countryCode" for country-level overrides
const CITY_OVERRIDES: Record<string, CityOption[]> = {
  // Austria Vienna state - only Vienna city (npm package has corrupted data for this state)
  'AT-9': [
    {
      value: 'Vienna',
      label: 'Vienna',
      countryCode: 'AT',
      stateCode: '9'
    }
  ]
};

// Cache for geographical data to avoid recomputation
type GeoCacheValue = CountryOption[] | StateOption[] | CityOption[] | string;
const geoCache = new Map<string, GeoCacheValue>();



/**
 * Lazy-loaded country options with caching
 */
export function getCountryOptionsLazy(): CountryOption[] {
  const cacheKey = 'countries';
  
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey) as CountryOption[];
  }

  const countries = Country.getAllCountries();
  const countryOptions = countries
    .map(country => ({
      value: country.isoCode,
      label: country.name,
      flag: country.flag
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  geoCache.set(cacheKey, countryOptions);
  return countryOptions;
}

/**
 * Lazy-loaded state options for a specific country with caching
 */
export function getStateOptionsLazy(countryCode: string): StateOption[] {
  if (!countryCode) return [];
  
  const cacheKey = `states-${countryCode}`;
  
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey) as StateOption[];
  }

  const states = State.getStatesOfCountry(countryCode);
  const stateOptions = states
    .map(state => ({
      value: state.isoCode,
      label: state.name,
      countryCode: state.countryCode
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  geoCache.set(cacheKey, stateOptions);
  return stateOptions;
}

/**
 * Lazy-loaded city options with custom overrides and caching
 */
export function getCityOptionsLazy(countryCode: string, stateCode?: string): CityOption[] {
  if (!countryCode) return [];
  
  // Check for state-specific overrides first (e.g., "AT-9" for Vienna state)
  if (stateCode) {
    const stateOverrideKey = `${countryCode}-${stateCode}`;
    if (CITY_OVERRIDES[stateOverrideKey]) {
      return CITY_OVERRIDES[stateOverrideKey];
    }
  }
  
  // Check for country-level overrides (e.g., "AT" for all of Austria)
  if (CITY_OVERRIDES[countryCode]) {
    return CITY_OVERRIDES[countryCode];
  }

  const cacheKey = `cities-${countryCode}${stateCode ? `-${stateCode}` : ''}`;
  
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey) as CityOption[];
  }

  let cities;
  if (stateCode) {
    cities = City.getCitiesOfState(countryCode, stateCode);
  } else {
    cities = City.getCitiesOfCountry(countryCode);
  }
  
  // Handle case where cities might be undefined
  if (!cities || cities.length === 0) {
    geoCache.set(cacheKey, []);
    return [];
  }

  const cityOptions = cities
    .map(city => ({
      value: city.name,
      label: city.name,
      countryCode: city.countryCode,
      stateCode: city.stateCode
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  geoCache.set(cacheKey, cityOptions);
  return cityOptions;
}

/**
 * Helper function to get country name by ISO code with caching
 */
export function getCountryNameLazy(isoCode: string): string {
  const cacheKey = `country-name-${isoCode}`;
  
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey) as string;
  }

  const country = Country.getCountryByCode(isoCode);
  const countryName = country?.name || isoCode;
  
  geoCache.set(cacheKey, countryName);
  return countryName;
}

/**
 * Helper function to get state name by ISO code with caching
 */
export function getStateNameLazy(countryCode: string, stateCode: string): string {
  const cacheKey = `state-name-${countryCode}-${stateCode}`;
  
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey) as string;
  }

  const state = State.getStateByCodeAndCountry(stateCode, countryCode);
  const stateName = state?.name || stateCode;
  
  geoCache.set(cacheKey, stateName);
  return stateName;
}

/**
 * Clear geographical data cache (useful for testing or memory management)
 */
export function clearGeoCache(): void {
  geoCache.clear();
}

/**
 * Get cache size for monitoring
 */
export function getGeoCacheSize(): number {
  return geoCache.size;
} 