import { useState, useEffect, useCallback } from 'react';
import {
  getCountryOptionsLazy,
  getStateOptionsLazy,
  getCityOptionsLazy,
  getCountryNameLazy,
  getStateNameLazy,
  type CountryOption,
  type StateOption,
  type CityOption
} from './geographical-data';

interface UseGeographicalDataProps {
  selectedCountry?: string;
  selectedState?: string;
  autoLoadStates?: boolean;
  autoLoadCities?: boolean;
}

interface UseGeographicalDataReturn {
  // Data
  countries: CountryOption[];
  states: StateOption[];
  cities: CityOption[];
  
  // Loading states
  countriesLoading: boolean;
  statesLoading: boolean;
  citiesLoading: boolean;
  
  // Actions
  loadStates: (countryCode: string) => void;
  loadCities: (countryCode: string, stateCode?: string) => void;
  clearStates: () => void;
  clearCities: () => void;
  
  // Utility functions
  getCountryName: (isoCode: string) => string;
  getStateName: (countryCode: string, stateCode: string) => string;
}

export function useGeographicalData({
  selectedCountry,
  selectedState,
  autoLoadStates = true,
  autoLoadCities = true
}: UseGeographicalDataProps = {}): UseGeographicalDataReturn {
  
  // State management
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Load states function
  const loadStates = useCallback((countryCode: string) => {
    if (!countryCode) {
      setStates([]);
      return;
    }

    let isMounted = true;
    setStatesLoading(true);

    // Use setTimeout to prevent blocking UI
    setTimeout(() => {
      if (isMounted) {
        try {
          const stateOptions = getStateOptionsLazy(countryCode);
          setStates(stateOptions);
        } catch {
          setStates([]);
        } finally {
          setStatesLoading(false);
        }
      }
    }, 0);

    return () => {
      isMounted = false;
    };
  }, []);

  // Load cities function
  const loadCities = useCallback((countryCode: string, stateCode?: string) => {
    if (!countryCode) {
      setCities([]);
      return;
    }

    let isMounted = true;
    setCitiesLoading(true);

    // Use setTimeout to prevent blocking UI
    setTimeout(() => {
      if (isMounted) {
        try {
          const cityOptions = getCityOptionsLazy(countryCode, stateCode);
          setCities(cityOptions);
        } catch {
          setCities([]);
        } finally {
          setCitiesLoading(false);
        }
      }
    }, 0);

    return () => {
      isMounted = false;
    };
  }, []);

  // Clear functions
  const clearStates = useCallback(() => {
    setStates([]);
  }, []);

  const clearCities = useCallback(() => {
    setCities([]);
  }, []);

  // Load countries on mount (they're cached so this is fast after first load)
  useEffect(() => {
    let isMounted = true;
    
    const loadCountries = async () => {
      setCountriesLoading(true);
      
      // Use setTimeout to prevent blocking UI
      setTimeout(() => {
        if (isMounted) {
          try {
            const countryOptions = getCountryOptionsLazy();
            setCountries(countryOptions);
          } catch {
            setCountries([]);
          } finally {
            setCountriesLoading(false);
          }
        }
      }, 0);
    };

    loadCountries();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load states when country changes (if autoLoadStates is enabled)
  useEffect(() => {
    if (autoLoadStates && selectedCountry) {
      loadStates(selectedCountry);
    } else if (!selectedCountry) {
      clearStates();
    }
  }, [selectedCountry, autoLoadStates, loadStates, clearStates]);

  // Load cities when state changes (if autoLoadCities is enabled)
  useEffect(() => {
    if (autoLoadCities && selectedCountry) {
      if (selectedState) {
        loadCities(selectedCountry, selectedState);
      } else {
        loadCities(selectedCountry);
      }
    } else if (!selectedCountry) {
      clearCities();
    }
  }, [selectedCountry, selectedState, autoLoadCities, loadCities, clearCities]);

  // Utility functions with memoization
  const getCountryName = useCallback((isoCode: string) => {
    return getCountryNameLazy(isoCode);
  }, []);

  const getStateName = useCallback((countryCode: string, stateCode: string) => {
    return getStateNameLazy(countryCode, stateCode);
  }, []);

  return {
    // Data
    countries,
    states,
    cities,
    
    // Loading states
    countriesLoading,
    statesLoading,
    citiesLoading,
    
    // Actions
    loadStates,
    loadCities,
    clearStates,
    clearCities,
    
    // Utility functions
    getCountryName,
    getStateName
  };
}

// Additional hook for simple country selection without states/cities
export function useCountriesOnly() {
  const { countries, countriesLoading, getCountryName } = useGeographicalData({
    autoLoadStates: false,
    autoLoadCities: false
  });

  return {
    countries,
    loading: countriesLoading,
    getCountryName
  };
} 