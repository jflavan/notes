import type { StorageKey, StorageError, AppData, Note, Tag, Preferences } from '../types';

export interface StorageAdapter {
  isAvailable(): boolean;
  getItem<T>(key: StorageKey): Promise<T | null>;
  setItem<T>(key: StorageKey, value: T): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
  clear(): Promise<void>;
  getQuota(): Promise<number | null>;
}

const STORAGE_KEYS = {
  NOTES: 'app.notes.v1' as const,
  TAGS: 'app.tags.v1' as const,
  PREFERENCES: 'app.preferences.v1' as const,
  META: 'app.meta.v1' as const,
};

/**
 * Checks if localStorage is available and has space
 * @returns true if localStorage is available and has space
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Gets the available storage space in bytes
 * @returns Promise resolving to available storage space in bytes, or null if not supported
 */
export function getStorageQuota(): Promise<number | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return navigator.storage.estimate()
      .then(({ quota, usage }) => {
        if (typeof quota === 'number' && typeof usage === 'number') {
          return quota - usage;
        }
        return null;
      })
      .catch(() => null);
  }
  return Promise.resolve(null);
}

export class LocalStorageAdapter implements StorageAdapter {
  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getItem<T>(key: StorageKey): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      throw {
        type: 'parse_error',
        message: `Failed to parse item from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        key,
      } as StorageError;
    }
  }

  async setItem<T>(key: StorageKey, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw {
          type: 'quota_exceeded',
          message: 'Storage quota exceeded. Try removing some items or exporting your data.',
          key,
        } as StorageError;
      }
      throw {
        type: 'write_error',
        message: `Failed to write to storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        key,
      } as StorageError;
    }
  }

  async removeItem(key: StorageKey): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }

  async getQuota(): Promise<number | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { quota, usage } = await navigator.storage.estimate();
      if (typeof quota === 'number' && typeof usage === 'number') {
        return quota - usage;
      }
    }
    return null;
  }
}

/**
 * Removes an item from localStorage
 * @param key Storage key
 */
// Create the storage instance
export const storage = new LocalStorageAdapter();

// Export common functions that match the previous API
export const getStorageItem = async <T>(key: StorageKey): Promise<T | null> => {
  return await storage.getItem<T>(key);
};

export const setStorageItem = async <T>(key: StorageKey, value: T): Promise<void> => {
  await storage.setItem(key, value);
};

export const removeStorageItem = async (key: StorageKey): Promise<void> => {
  await storage.removeItem(key);
};

function isValidNote(note: unknown): note is Note {
  if (!note || typeof note !== 'object') return false;
  const n = note as Note;
  return (
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    Array.isArray(n.tagIds) &&
    typeof n.pinned === 'boolean' &&
    typeof n.archived === 'boolean' &&
    typeof n.createdAt === 'string' &&
    typeof n.updatedAt === 'string'
  );
}

function isValidTag(tag: unknown): tag is Tag {
  if (!tag || typeof tag !== 'object') return false;
  const t = tag as Tag;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.createdAt === 'string' &&
    typeof t.updatedAt === 'string' &&
    (t.color === undefined || typeof t.color === 'string')
  );
}

function isValidPreferences(prefs: unknown): prefs is Preferences {
  if (!prefs || typeof prefs !== 'object') return false;
  const p = prefs as Preferences;
  return (
    ['light', 'dark', 'system'].includes(p.theme) &&
    ['comfortable', 'compact'].includes(p.density) &&
    ['ANY', 'ALL'].includes(p.tagFilterMode)
  );
}

function isValidAppData(data: unknown): data is AppData {
  if (!data || typeof data !== 'object') return false;
  const d = data as AppData;
  return (
    typeof d.version === 'number' &&
    Array.isArray(d.notes) && d.notes.every(isValidNote) &&
    Array.isArray(d.tags) && d.tags.every(isValidTag) &&
    isValidPreferences(d.preferences)
  );
}

/**
 * Exports all app data to a JSON string
 * @returns Promise resolving to a JSON string containing all app data
 */
export async function exportData(): Promise<string> {
  const notes = (await getStorageItem<Note[]>(STORAGE_KEYS.NOTES)) ?? [];
  const tags = (await getStorageItem<Tag[]>(STORAGE_KEYS.TAGS)) ?? [];
  const preferences = (await getStorageItem<Preferences>(STORAGE_KEYS.PREFERENCES)) ?? {
    theme: 'system',
    density: 'comfortable',
    tagFilterMode: 'ANY',
  };
  const data: AppData = {
    version: 1,
    notes,
    tags,
    preferences,
  };
  if (!isValidAppData(data)) {
    throw {
      type: 'parse_error',
      message: 'Exported data is invalid',
    } as StorageError;
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Imports data from a JSON string
 * @param json JSON string containing app data
 * @returns true if import was successful
 * @throws StorageError if import fails
 */
export async function importData(json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json);
    if (!isValidAppData(data)) {
      throw new Error('Invalid data structure');
    }
    if (data.version !== 1) {
      throw new Error(`Unsupported data version: ${data.version}`);
    }
    await setStorageItem(STORAGE_KEYS.NOTES, data.notes);
    await setStorageItem(STORAGE_KEYS.TAGS, data.tags);
    await setStorageItem(STORAGE_KEYS.PREFERENCES, data.preferences);
    await setStorageItem(STORAGE_KEYS.META, { lastBackupAt: new Date().toISOString() });
    return true;
  } catch (error) {
    throw {
      type: 'parse_error',
      message: `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    } as StorageError;
  }
}

export { STORAGE_KEYS };