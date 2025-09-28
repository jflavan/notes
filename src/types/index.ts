export interface Note {
  id: string;
  title: string;
  body: string;
  tagIds: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  tagFilterMode: 'ANY' | 'ALL';
}

export interface AppData {
  version: number;
  notes: Note[];
  tags: Tag[];
  preferences: Preferences;
}

export type StorageKey = 
  | 'app.notes.v1'
  | 'app.tags.v1'
  | 'app.preferences.v1'
  | 'app.meta.v1';

export interface StorageError {
  type: 'quota_exceeded' | 'parse_error' | 'write_error';
  message: string;
  key?: StorageKey;
}

export type SortOption = 'updatedAt' | 'createdAt' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  search: string;
  tags: string[];
  showArchived: boolean;
  showPinned: boolean;
  showUntagged: boolean;
  sortBy: SortOption;
  sortDirection: SortDirection;
}