import React, { createContext, useContext, useReducer, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Note, Tag, Preferences, FilterState } from '../types';
import { generateUUID } from '../utils/uuid';


// Create contexts for state and dispatch


interface AppState {
  notes: Note[];
  tags: Tag[];
  preferences: Preferences;
  filters: FilterState;
  selectedNoteId: string | null;
  isEditing: boolean;
}

type AppAction =
  | { type: 'ADD_NOTE'; payload: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_NOTE'; payload: Partial<Note> & { id: string } }
  | { type: 'DELETE_NOTE'; payload: { id: string } }
  | { type: 'RESTORE_NOTE'; payload: { id: string } }
  | { type: 'ADD_TAG'; payload: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TAG'; payload: Partial<Tag> & { id: string } }
  | { type: 'DELETE_TAG'; payload: { id: string } }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<Preferences> }
  | { type: 'UPDATE_FILTERS'; payload: Partial<FilterState> }
  | { type: 'SELECT_NOTE'; payload: { id: string | null } }
  | { type: 'SET_EDITING'; payload: { isEditing: boolean } }
  | { type: 'IMPORT_DATA'; payload: { notes: Note[]; tags: Tag[]; preferences: Preferences } };

const defaultState: AppState = {
  notes: [],
  tags: [],
  preferences: {
    theme: 'system',
    density: 'comfortable',
    tagFilterMode: 'ANY',
  },
  filters: {
    search: '',
    tags: [],
    showArchived: false,
    showPinned: true,
    showUntagged: false,
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  },
  selectedNoteId: null,
  isEditing: false,
};



function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_NOTE': {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
        ...action.payload,
        tagIds: action.payload.tagIds || [],
        pinned: action.payload.pinned || false,
        archived: action.payload.archived || false,
      };
      return {
        ...state,
        notes: [newNote, ...state.notes],
        selectedNoteId: newNote.id,
        isEditing: true,
      };
    }

    case 'UPDATE_NOTE': {
      const { id, ...changes } = action.payload;
      
      // Avoid unnecessary updates if nothing has changed
      const targetNote = state.notes.find(note => note.id === id);
      if (!targetNote) return state;

      // Check if any values are actually different
      const hasChanges = Object.entries(changes).some(
        ([key, value]) => targetNote[key as keyof typeof targetNote] !== value
      );

      if (!hasChanges) return state;

      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === id
            ? { ...note, ...changes, updatedAt: new Date().toISOString() }
            : note
        ),
      };
    }

    case 'DELETE_NOTE': {
      const now = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.payload.id
            ? { ...note, deletedAt: now }
            : note
        ),
        selectedNoteId: state.selectedNoteId === action.payload.id ? null : state.selectedNoteId,
      };
    }

    case 'RESTORE_NOTE': {
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.payload.id
            ? { ...note, deletedAt: null }
            : note
        ),
      };
    }

    case 'ADD_TAG': {
      const now = new Date().toISOString();
      const newTag: Tag = {
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
        ...action.payload,
      };
      return {
        ...state,
        tags: [...state.tags, newTag],
      };
    }

    case 'UPDATE_TAG': {
      const { id, ...changes } = action.payload;
      return {
        ...state,
        tags: state.tags.map((tag) =>
          tag.id === id
            ? { ...tag, ...changes, updatedAt: new Date().toISOString() }
            : tag
        ),
      };
    }

    case 'DELETE_TAG': {
      return {
        ...state,
        tags: state.tags.filter((tag) => tag.id !== action.payload.id),
        notes: state.notes.map((note) => ({
          ...note,
          tagIds: note.tagIds.filter((tagId) => tagId !== action.payload.id),
        })),
      };
    }

    case 'UPDATE_PREFERENCES': {
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };
    }

    case 'UPDATE_FILTERS': {
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };
    }

    case 'SELECT_NOTE': {
      return {
        ...state,
        selectedNoteId: action.payload.id,
        isEditing: false,
      };
    }

    case 'SET_EDITING': {
      return {
        ...state,
        isEditing: action.payload.isEditing,
      };
    }

    case 'IMPORT_DATA': {
      return {
        ...state,
        notes: action.payload.notes,
        tags: action.payload.tags,
        preferences: action.payload.preferences,
      };
    }

    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<AppAction>;
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Enhanced localStorage management
const STORAGE_KEYS = {
  NOTES: 'notes-app-data',
  TAGS: 'notes-app-tags', 
  PREFERENCES: 'notes-app-prefs',
  BACKUP_PREFIX: 'notes-backup-',
  METADATA: 'notes-metadata'
} as const;

interface StorageMetadata {
  lastSaved: string;
  version: string;
  dataSize: number;
}

function getStorageUsage(): { used: number; total: number; percentage: number } {
  let used = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage.getItem(key)?.length || 0;
    }
  }
  // Rough estimate of localStorage limit (5MB in most browsers)
  const total = 5 * 1024 * 1024;
  return { used, total, percentage: Math.round((used / total) * 100) };
}

function createBackup(key: string, data: any): void {
  try {
    const backupKey = `${STORAGE_KEYS.BACKUP_PREFIX}${key}-${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify({
      timestamp: new Date().toISOString(),
      data,
      originalKey: key
    }));
    
    // Keep only the 3 most recent backups for each key
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys
      .filter(k => k.startsWith(`${STORAGE_KEYS.BACKUP_PREFIX}${key}-`))
      .sort()
      .reverse();
    
    backupKeys.slice(3).forEach(k => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Failed to create backup:', error);
  }
}

function saveToLocalStorage<T>(key: string, data: T): boolean {
  try {
    const serialized = JSON.stringify(data);
    const sizeKB = Math.round(serialized.length / 1024);
    
    // Check storage usage before saving
    const usage = getStorageUsage();
    if (usage.percentage > 80) {
      console.warn(`⚠️ Storage usage high: ${usage.percentage}% (${Math.round(usage.used / 1024)}KB used)`);
      
      // Clean up old backups if storage is getting full
      if (usage.percentage > 90) {
        const backupKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEYS.BACKUP_PREFIX));
        backupKeys.forEach(k => localStorage.removeItem(k));
        console.log(`🧹 Cleaned up ${backupKeys.length} backup entries`);
      }
    }

    // Create backup before overwriting (only for notes and tags)
    if (key === STORAGE_KEYS.NOTES || key === STORAGE_KEYS.TAGS) {
      createBackup(key, data);
    }

    localStorage.setItem(key, serialized);
    
    // Update metadata
    const metadata: StorageMetadata = {
      lastSaved: new Date().toISOString(),
      version: '1.0.0',
      dataSize: serialized.length
    };
    localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
    
    console.log(`✅ Saved ${key} (${sizeKB}KB) - Storage: ${usage.percentage}%`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save ${key}:`, error);
    
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('🚨 Storage quota exceeded, attempting recovery...');
      return handleQuotaExceeded(key, data);
    }
    return false;
  }
}

function handleQuotaExceeded<T>(key: string, data: T): boolean {
  try {
    // Step 1: Clear old versioned keys
    const oldKeys = ['app.notes.v1', 'app.tags.v1', 'app.preferences.v1'];
    oldKeys.forEach(oldKey => {
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey);
        console.log(`🗑️ Removed old key: ${oldKey}`);
      }
    });

    // Step 2: Clear old backups (keep only 1 most recent per key)
    const backupKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEYS.BACKUP_PREFIX));
    const backupsByKey = new Map<string, string[]>();
    
    backupKeys.forEach(backupKey => {
      const baseKey = backupKey.split('-').slice(0, -1).join('-');
      if (!backupsByKey.has(baseKey)) {
        backupsByKey.set(baseKey, []);
      }
      backupsByKey.get(baseKey)!.push(backupKey);
    });

    backupsByKey.forEach((keys) => {
      const sorted = keys.sort().reverse();
      sorted.slice(1).forEach(k => {
        localStorage.removeItem(k);
        console.log(`🗑️ Removed old backup: ${k}`);
      });
    });

    // Step 3: Try to save again
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`✅ Recovery successful for ${key}`);
    return true;
  } catch (retryError) {
    console.error(`❌ Recovery failed for ${key}:`, retryError);
    
    // Last resort: show user error
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('storage-error', {
        detail: {
          type: 'quota_exceeded',
          message: 'Storage space full. Please export your data and clear browser storage.',
          key
        }
      }));
    }
    return false;
  }
}

function validateData<T>(data: any, key: string): data is T {
  switch (key) {
    case STORAGE_KEYS.NOTES:
      return Array.isArray(data) && data.every((note: any) => 
        note && 
        typeof note.id === 'string' && 
        typeof note.title === 'string' && 
        typeof note.body === 'string' &&
        Array.isArray(note.tagIds) &&
        typeof note.createdAt === 'string' &&
        typeof note.updatedAt === 'string'
      );
    case STORAGE_KEYS.TAGS:
      return Array.isArray(data) && data.every((tag: any) =>
        tag &&
        typeof tag.id === 'string' &&
        typeof tag.name === 'string' &&
        typeof tag.createdAt === 'string' &&
        typeof tag.updatedAt === 'string'
      );
    case STORAGE_KEYS.PREFERENCES:
      return data &&
        typeof data === 'object' &&
        typeof data.theme === 'string' &&
        typeof data.density === 'string' &&
        typeof data.tagFilterMode === 'string';
    default:
      return true;
  }
}

function attemptDataRecovery<T>(key: string, defaultValue: T): T {
  try {
    // Try to find the most recent backup
    const backupKeys = Object.keys(localStorage)
      .filter(k => k.startsWith(`${STORAGE_KEYS.BACKUP_PREFIX}${key.replace('notes-app-', '')}-`))
      .sort()
      .reverse();

    for (const backupKey of backupKeys) {
      try {
        const backup = JSON.parse(localStorage.getItem(backupKey) || '');
        if (backup.data && validateData<T>(backup.data, key)) {
          console.log(`🔄 Recovered ${key} from backup: ${backupKey}`);
          // Restore the data
          saveToLocalStorage(key, backup.data);
          return backup.data;
        }
      } catch (backupError) {
        console.warn(`Failed to restore from backup ${backupKey}:`, backupError);
      }
    }
  } catch (error) {
    console.error('Recovery attempt failed:', error);
  }
  
  return defaultValue;
}

function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('❌ localStorage not available, using default value');
      return defaultValue;
    }

    const item = localStorage.getItem(key);
    if (item === null || item === '') {
      console.log(`📝 No data found for ${key}, using default`);
      return defaultValue;
    }
    
    const parsed = JSON.parse(item) as T;
    
    // Validate the loaded data
    if (!validateData<T>(parsed, key)) {
      console.warn(`⚠️ Invalid data structure for ${key}, attempting recovery...`);
      return attemptDataRecovery(key, defaultValue);
    }
    
    const sizeKB = Math.round(item.length / 1024);
    console.log(`✅ Loaded ${key} (${sizeKB}KB)`);
    return parsed;
  } catch (error) {
    console.error(`❌ Failed to load ${key}:`, error);
    console.log(`🔄 Attempting data recovery for ${key}...`);
    return attemptDataRecovery(key, defaultValue);
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Load initial data from localStorage with enhanced keys
  const initialNotes = loadFromLocalStorage<Note[]>(STORAGE_KEYS.NOTES, []);
  const initialTags = loadFromLocalStorage<Tag[]>(STORAGE_KEYS.TAGS, []);
  const initialPreferences = loadFromLocalStorage<Preferences>(STORAGE_KEYS.PREFERENCES, defaultState.preferences);

  // Initialize state with loaded data
  const [state, dispatch] = useReducer(appReducer, {
    ...defaultState,
    notes: initialNotes,
    tags: initialTags,
    preferences: initialPreferences,
  });

  // Debounced save to prevent excessive writes
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  const debouncedSave = useCallback((key: string, data: any) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = window.setTimeout(() => {
      const success = saveToLocalStorage(key, data);
      if (!success && typeof window !== 'undefined') {
        // Dispatch a custom event for error handling
        window.dispatchEvent(new CustomEvent('storage-error', {
          detail: { key, data }
        }));
      }
    }, 300); // 300ms debounce
  }, []);

  // Save to localStorage whenever state changes (debounced)
  useEffect(() => {
    debouncedSave(STORAGE_KEYS.NOTES, state.notes);
  }, [state.notes, debouncedSave]);

  useEffect(() => {
    debouncedSave(STORAGE_KEYS.TAGS, state.tags);
  }, [state.tags, debouncedSave]);

  useEffect(() => {
    debouncedSave(STORAGE_KEYS.PREFERENCES, state.preferences);
  }, [state.preferences, debouncedSave]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Display storage info on mount (dev mode only)
  useEffect(() => {
    const usage = getStorageUsage();
    console.log(`📊 Storage Usage: ${usage.percentage}% (${Math.round(usage.used / 1024)}KB / ${Math.round(usage.total / 1024)}KB)`);
    
    const metadata = localStorage.getItem(STORAGE_KEYS.METADATA);
    if (metadata) {
      const meta = JSON.parse(metadata) as StorageMetadata;
      console.log(`📅 Last saved: ${new Date(meta.lastSaved).toLocaleString()}`);
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, dispatch }), 
    [state, dispatch]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Storage utility functions for external use
export const StorageUtils = {
  // Export all data as JSON
  exportData: (): string => {
    const notes = loadFromLocalStorage<Note[]>(STORAGE_KEYS.NOTES, []);
    const tags = loadFromLocalStorage<Tag[]>(STORAGE_KEYS.TAGS, []);
    const preferences = loadFromLocalStorage<Preferences>(STORAGE_KEYS.PREFERENCES, {
      theme: 'system',
      density: 'comfortable', 
      tagFilterMode: 'ANY'
    });

    return JSON.stringify({
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: { notes, tags, preferences }
    }, null, 2);
  },

  // Import data from JSON
  importData: (jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString);
      if (!imported.data) throw new Error('Invalid data format');

      const { notes, tags, preferences } = imported.data;
      
      // Validate and save
      if (Array.isArray(notes)) saveToLocalStorage(STORAGE_KEYS.NOTES, notes);
      if (Array.isArray(tags)) saveToLocalStorage(STORAGE_KEYS.TAGS, tags);
      if (preferences) saveToLocalStorage(STORAGE_KEYS.PREFERENCES, preferences);
      
      console.log('✅ Data imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Import failed:', error);
      return false;
    }
  },

  // Clear all data
  clearData: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear backups too
    Object.keys(localStorage)
      .filter(key => key.startsWith(STORAGE_KEYS.BACKUP_PREFIX))
      .forEach(key => localStorage.removeItem(key));
      
    console.log('🗑️ All data cleared');
  },

  // Get storage statistics
  getStorageInfo: () => {
    const usage = getStorageUsage();
    const metadata = localStorage.getItem(STORAGE_KEYS.METADATA);
    const meta = metadata ? JSON.parse(metadata) as StorageMetadata : null;
    
    return {
      usage,
      lastSaved: meta?.lastSaved,
      version: meta?.version,
      dataSize: meta?.dataSize,
      backupCount: Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_KEYS.BACKUP_PREFIX)).length
    };
  },

  // Force backup creation
  createManualBackup: (): void => {
    const notes = loadFromLocalStorage<Note[]>(STORAGE_KEYS.NOTES, []);
    const tags = loadFromLocalStorage<Tag[]>(STORAGE_KEYS.TAGS, []);
    
    createBackup(STORAGE_KEYS.NOTES, notes);
    createBackup(STORAGE_KEYS.TAGS, tags);
    
    console.log('📦 Manual backup created');
  }
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Action creators
export function useAppActions() {
  const { dispatch } = useApp();

  return useMemo(
    () => ({
      addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) =>
        dispatch({ type: 'ADD_NOTE', payload: note }),

      updateNote: (id: string, changes: Partial<Omit<Note, 'id'>>) =>
        dispatch({ type: 'UPDATE_NOTE', payload: { id, ...changes } }),

      deleteNote: (id: string) => dispatch({ type: 'DELETE_NOTE', payload: { id } }),

      restoreNote: (id: string) => dispatch({ type: 'RESTORE_NOTE', payload: { id } }),

      addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) =>
        dispatch({ type: 'ADD_TAG', payload: tag }),

      updateTag: (id: string, changes: Partial<Omit<Tag, 'id'>>) =>
        dispatch({ type: 'UPDATE_TAG', payload: { id, ...changes } }),

      deleteTag: (id: string) => dispatch({ type: 'DELETE_TAG', payload: { id } }),

      updatePreferences: (changes: Partial<Preferences>) =>
        dispatch({ type: 'UPDATE_PREFERENCES', payload: changes }),

      updateFilters: (changes: Partial<FilterState>) =>
        dispatch({ type: 'UPDATE_FILTERS', payload: changes }),

      selectNote: (id: string | null) =>
        dispatch({ type: 'SELECT_NOTE', payload: { id } }),

      setEditing: (isEditing: boolean) =>
        dispatch({ type: 'SET_EDITING', payload: { isEditing } }),

      importData: (data: { notes: Note[]; tags: Tag[]; preferences: Preferences }) =>
        dispatch({ type: 'IMPORT_DATA', payload: data }),
    }),
    [dispatch]
  );
}

// Selectors
export function useAppSelectors() {
  const { notes, tags, preferences, filters, selectedNoteId, isEditing } = useApp();

  return useMemo(
    () => ({
      getFilteredNotes: () => {
        let filtered = notes;

        // Handle deleted notes
        filtered = filtered.filter((note) => !note.deletedAt);

        // Handle archived notes
        if (!filters.showArchived) {
          filtered = filtered.filter((note) => !note.archived);
        }

        // Handle tag filters
        if (filters.tags.length > 0) {
          filtered = filtered.filter((note) => {
            if (preferences.tagFilterMode === 'ANY') {
              return note.tagIds.some((id) => filters.tags.includes(id));
            }
            return filters.tags.every((id) => note.tagIds.includes(id));
          });
        }

        // Handle untagged filter
        if (filters.showUntagged) {
          filtered = filtered.filter((note) => note.tagIds.length === 0);
        }

        // Handle search
        if (filters.search) {
          const search = filters.search.toLowerCase();
          filtered = filtered.filter(
            (note) =>
              note.title.toLowerCase().includes(search) ||
              note.body.toLowerCase().includes(search)
          );
        }

        // Handle sorting
        filtered.sort((a, b) => {
          if (filters.sortBy === 'title') {
            return filters.sortDirection === 'asc'
              ? a.title.localeCompare(b.title)
              : b.title.localeCompare(a.title);
          }

          const aDate = new Date(a[filters.sortBy]).getTime();
          const bDate = new Date(b[filters.sortBy]).getTime();
          return filters.sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        });

        // Pin notes to top within current sort
        if (filters.showPinned) {
          const pinned = filtered.filter((note) => note.pinned);
          const unpinned = filtered.filter((note) => !note.pinned);
          filtered = [...pinned, ...unpinned];
        }

        return filtered;
      },

      getSelectedNote: () =>
        selectedNoteId ? notes.find((note) => note.id === selectedNoteId) : null,

      getTagsForNote: (noteId: string) => {
        const note = notes.find((n) => n.id === noteId);
        if (!note) return [];
        return tags.filter((tag) => note.tagIds.includes(tag.id));
      },

      isNoteSelected: (noteId: string) => selectedNoteId === noteId,

      isEditing,
    }),
    [notes, tags, preferences, filters, selectedNoteId, isEditing]
  );
}