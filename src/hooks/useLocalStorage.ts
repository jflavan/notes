import { useState, useEffect, useCallback, useRef } from 'react';
import type { StorageKey, Note, Tag, Preferences } from '../types';
import { getStorageItem, setStorageItem, isStorageAvailable } from '../utils/storage';

// Type guard functions
function isNote(value: unknown): value is Note {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'body' in value &&
    'tagIds' in value &&
    'pinned' in value &&
    'archived' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    Array.isArray((value as Note).tagIds)
  );
}

function isTag(value: unknown): value is Tag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'createdAt' in value &&
    'updatedAt' in value
  );
}

function isPreferences(value: unknown): value is Preferences {
  return (
    typeof value === 'object' &&
    value !== null &&
    'theme' in value &&
    'density' in value &&
    'tagFilterMode' in value
  );
}

interface UseLocalStorageOptions<T> {
  /** Validate the parsed value */
  validate?: (value: unknown) => boolean;
  /** Transform the value before storing */
  serialize?: (value: T) => string;
  /** Transform the stored value after retrieving */
  deserialize?: (value: string) => T;
  /** Debounce save operations by this many milliseconds */
  debounceMs?: number;
  /** Skip saving if value hasn't changed */
  skipEqual?: boolean;
}

/**
 * Hook for using localStorage with automatic JSON serialization and type safety
 * @param key Storage key
 * @param initialValue Initial value if nothing in storage
 * @param options Configuration options
 * @returns [value, setValue, error]
 */
export function useLocalStorage<T>(
  key: StorageKey,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, Error | null] {
  const {
    validate,
    serialize = JSON.stringify,
    debounceMs = 300,
    skipEqual = true,
  } = options;

  const [state, setState] = useState<T>(initialValue);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef<boolean>(true);

  // Load initial value from storage
  useEffect(() => {
    async function loadInitialValue() {
      if (!isStorageAvailable()) {
        return;
      }

      try {
        const item = await getStorageItem<T>(key);
        
        if (!mountedRef.current) return;
        
        if (item === null || item === undefined) {
          console.log(`No stored value found for ${key}, using initial value:`, initialValue);
          setState(initialValue);
          return;
        }
        
        console.log(`Found stored value for ${key}:`, item);

        // Type-specific validation based on storage key
        let isValid = true;
        
        if (key === 'app.notes.v1') {
          isValid = Array.isArray(item) && item.every(isNote);
          if (!isValid) {
            console.warn(`Invalid notes array in storage`);
            setState(initialValue);
            return;
          }
        } else if (key === 'app.tags.v1') {
          isValid = Array.isArray(item) && item.every(isTag);
          if (!isValid) {
            console.warn(`Invalid tags array in storage`);
            setState(initialValue);
            return;
          }
        } else if (key === 'app.preferences.v1') {
          isValid = isPreferences(item);
          if (!isValid) {
            console.warn(`Invalid preferences object in storage`);
            setState(initialValue);
            return;
          }
        } else if (Array.isArray(initialValue) && !Array.isArray(item)) {
          console.warn(`Invalid array value in storage for key "${key}"`);
          setState(initialValue);
          return;
        }

        // Run custom validation if provided
        if (validate && !validate(item)) {
          console.warn(`Invalid value in storage for key "${key}"`);
          setState(initialValue);
          return;
        }

        console.log(`Setting state for ${key} with loaded value:`, item);
        setState(item as T);
        setError(null);
      } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        setError(error instanceof Error ? error : new Error('Failed to parse stored value'));
        setState(initialValue);
      }
    }

    loadInitialValue();
    
    return () => {
      mountedRef.current = false;
    };
  }, [key]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        if (!mountedRef.current) return;

        try {
          const item = await getStorageItem<T>(key);
          
          if (!mountedRef.current) return;
          if (item === null) return;

          let isValid = true;
          
          // Type-specific validation
          if (key === 'app.notes.v1') {
            isValid = Array.isArray(item) && item.every(isNote);
          } else if (key === 'app.tags.v1') {
            isValid = Array.isArray(item) && item.every(isTag);
          } else if (key === 'app.preferences.v1') {
            isValid = isPreferences(item);
          } else if (validate) {
            isValid = validate(item);
          }

          if (isValid) {
            setState(item as T);
            setError(null);
          }
        } catch (error) {
          console.error(`Error syncing from storage event:`, error);
          if (mountedRef.current) {
            setError(error instanceof Error ? error : new Error('Failed to sync from storage event'));
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, validate]);

  // Save to localStorage with debouncing and equality check
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setState((prevState) => {
          const newValue = value instanceof Function ? value(prevState) : value;

          // Skip if value hasn't changed and skipEqual is true
          if (skipEqual && serialize(prevState) === serialize(newValue)) {
            return prevState;
          }

          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }

          // Schedule the save operation
          const saveOperation = async () => {
            if (!mountedRef.current) return;

            try {
              console.log(`Saving to localStorage: ${key}`, newValue);
              await setStorageItem(key, newValue);
              console.log(`Successfully saved to localStorage: ${key}`);
              if (mountedRef.current) {
                setError(null);
              }
            } catch (error) {
              console.error(`Error saving to localStorage:`, error);
              if (mountedRef.current) {
                setError(error instanceof Error ? error : new Error('Failed to save to localStorage'));
              }
            }
          };

          // Debounce the save operation
          debounceTimerRef.current = window.setTimeout(saveOperation, debounceMs);

          return newValue;
        });
      } catch (error) {
        console.error(`Error in setValue:`, error);
        setError(error instanceof Error ? error : new Error('Failed to update state'));
      }
    },
    [key, debounceMs, skipEqual, serialize]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return [state, setValue, error];
}