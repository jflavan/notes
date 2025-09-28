import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp, useAppActions, useAppSelectors } from '../contexts/AppContext';
import styles from './NoteEditor.module.css';

const NoteEditor: React.FC = () => {
  const { tags } = useApp();
  const { updateNote, deleteNote } = useAppActions();
  const { getSelectedNote } = useAppSelectors();
  const selectedNote = getSelectedNote();
  // const noteTags = selectedNote ? getTagsForNote(selectedNote.id) : [];
  const titleRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // Auto-save when note changes
  const handleChange = useCallback(
    (changes: Partial<{ title: string; body: string; tagIds: string[] }>) => {
      if (!selectedNote) return;

      // Don't trigger updates for empty title changes on a new note
      if (changes.title !== undefined && !selectedNote.title && !changes.title.trim()) {
        return;
      }

      // Update the note immediately for UI responsiveness
      updateNote(selectedNote.id, changes);
      
      // Show saving indicator
      setIsSaving(true);

      // Clear any pending save status update
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      // Update save status after a delay
      saveTimeoutRef.current = window.setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 500);
    },
    [selectedNote, updateNote]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (selectedNote) {
          updateNote(selectedNote.id, {});
          setLastSaved(new Date());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, updateNote]);

  // Focus title on new note
  useEffect(() => {
    if (selectedNote && !selectedNote.title && titleRef.current) {
      titleRef.current.focus();
    }
  }, [selectedNote]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!selectedNote) return null;

  const handleDelete = () => {
    if (
      window.confirm(
        'Are you sure you want to move this note to trash? You can restore it later from the trash.'
      )
    ) {
      deleteNote(selectedNote.id);
    }
  };

  const toggleTag = (tagId: string) => {
    const newTagIds = selectedNote.tagIds.includes(tagId)
      ? selectedNote.tagIds.filter((id) => id !== tagId)
      : [...selectedNote.tagIds, tagId];
    handleChange({ tagIds: newTagIds });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <input
          ref={titleRef}
          type="text"
          value={selectedNote.title}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Note title"
          className={styles.titleInput}
          aria-label="Note title"
        />
        <div className={styles.actions}>
          <div className={styles.saveStatus}>
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              lastSaved && (
                <span>
                  Saved{' '}
                  {lastSaved.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )
            )}
          </div>
          <button
            onClick={handleDelete}
            className={styles.deleteButton}
            aria-label="Move to trash"
          >
            🗑️ Move to Trash
          </button>
        </div>
      </div>

      <div className={styles.tagSection}>
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`${styles.tagButton} ${
                selectedNote.tagIds.includes(tag.id) ? styles.selected : ''
              }`}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
            >
              <span className={styles.tagDot} />
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={selectedNote.body}
        onChange={(e) => handleChange({ body: e.target.value })}
        placeholder="Start writing..."
        className={styles.bodyInput}
        aria-label="Note content"
      />
    </div>
  );
};

export default NoteEditor;