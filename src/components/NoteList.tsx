import React, { useEffect } from 'react';
import { useApp, useAppActions, useAppSelectors } from '../contexts/AppContext';
import type { Note } from '../types';
import styles from './NoteList.module.css';

const NoteListItem: React.FC<{
  note: Note;
  tags: { id: string; name: string; color?: string }[];
  isSelected: boolean;
}> = ({ note, tags, isSelected }) => {
  const { updateNote, selectNote } = useAppActions();

  const handleClick = () => {
    selectNote(note.id);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNote(note.id, { pinned: !note.pinned });
  };

  const handleToggleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNote(note.id, { archived: !note.archived });
  };

  return (
    <div
      className={`${styles.noteItem} ${isSelected ? styles.selected : ''} ${
        note.pinned ? styles.pinned : ''
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
    >
      <div className={styles.noteHeader}>
        <h3 className={styles.noteTitle}>{note.title || 'Untitled'}</h3>
        <div className={styles.noteActions}>
          <button
            onClick={handleTogglePin}
            className={`${styles.actionButton} ${note.pinned ? styles.active : ''}`}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            📌
          </button>
          <button
            onClick={handleToggleArchive}
            className={`${styles.actionButton} ${note.archived ? styles.active : ''}`}
            aria-label={note.archived ? 'Unarchive note' : 'Archive note'}
            title={note.archived ? 'Unarchive note' : 'Archive note'}
          >
            📦
          </button>
        </div>
      </div>

      {note.body && (
        <p className={styles.notePreview}>
          {note.body.length > 100 ? `${note.body.slice(0, 100)}...` : note.body}
        </p>
      )}

      {tags.length > 0 && (
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={styles.tag}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className={styles.noteFooter}>
        <span className={styles.timestamp}>
          {new Date(note.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

const NoteList: React.FC = () => {
  const { tags } = useApp();
  const { addNote } = useAppActions();
  const { getFilteredNotes, isNoteSelected } = useAppSelectors();
  const filteredNotes = getFilteredNotes();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields or textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'n' to create new note
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        addNote({
          title: '',
          body: '',
          tagIds: [],
          pinned: false,
          archived: false,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNote]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          onClick={() =>
            addNote({
              title: '',
              body: '',
              tagIds: [],
              pinned: false,
              archived: false,
            })
          }
          className={styles.newNoteButton}
        >
          + New Note
        </button>
        <span className={styles.count}>
          {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.list}>
        {filteredNotes.length === 0 ? (
          <div className={styles.empty}>
            <p>No notes found</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              tags={tags.filter((tag) => note.tagIds.includes(tag.id))}
              isSelected={isNoteSelected(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NoteList;