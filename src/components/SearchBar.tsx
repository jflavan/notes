import React, { useEffect, useRef } from 'react';
import { useApp, useAppActions } from '../contexts/AppContext';
import styles from './SearchBar.module.css';

const SearchBar: React.FC = () => {
  const { filters } = useApp();
  const { updateFilters } = useAppActions();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ search: e.target.value });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search notes..."
        value={filters.search}
        onChange={handleChange}
        className={styles.input}
        aria-label="Search notes"
      />
      {filters.search && (
        <button
          onClick={() => updateFilters({ search: '' })}
          className={styles.clear}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default SearchBar;