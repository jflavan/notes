import React, { useState } from 'react';
import { useApp, useAppActions } from '../contexts/AppContext';
import type { Tag } from '../types';
import styles from './TagFilter.module.css';

const TagFilter: React.FC = () => {
  const { tags, filters, preferences } = useApp();
  const { updateFilters, updatePreferences, addTag, deleteTag } = useAppActions();
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleTagClick = (tagId: string) => {
    const selectedTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId];
    updateFilters({ tags: selectedTags });
  };

  const handleModeToggle = () => {
    updatePreferences({
      tagFilterMode: preferences.tagFilterMode === 'ANY' ? 'ALL' : 'ANY'
    });
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newTagName.trim();
    if (!trimmedName) return;

    // Check for duplicate tag names (case-insensitive)
    if (tags.some(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A tag with this name already exists');
      return;
    }

    addTag({
      name: trimmedName,
      color: generateRandomColor()
    });
    setNewTagName('');
    setIsCreating(false);
  };

  const handleDeleteTag = (tag: Tag) => {
    if (confirm(`Delete tag "${tag.name}"? This will remove it from all notes.`)) {
      deleteTag(tag.id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Tags</h2>
        <button
          className={styles.modeToggle}
          onClick={handleModeToggle}
          title="Toggle filter mode (ANY/ALL)"
          aria-label={`Current mode: Match ${preferences.tagFilterMode === 'ANY' ? 'any' : 'all'} selected tags`}
        >
          {preferences.tagFilterMode}
        </button>
      </div>

      <div className={styles.tagList}>
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => handleTagClick(tag.id)}
            className={`${styles.tag} ${filters.tags.includes(tag.id) ? styles.selected : ''}`}
            style={{ '--tag-color': tag.color } as React.CSSProperties}
          >
            <span className={styles.tagDot} />
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTag(tag);
              }}
              className={styles.deleteTag}
              aria-label={`Delete tag ${tag.name}`}
            >
              ×
            </button>
          </button>
        ))}
      </div>

      {isCreating ? (
        <form onSubmit={handleCreateTag} className={styles.createForm}>
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name..."
            className={styles.input}
            autoFocus
          />
          <div className={styles.createActions}>
            <button type="submit" className={styles.createButton}>
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewTagName('');
              }}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className={styles.addButton}
        >
          + Add Tag
        </button>
      )}
    </div>
  );
};

// Helper function to generate random colors for new tags
function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 60%, 45%)`;
}

export default TagFilter;