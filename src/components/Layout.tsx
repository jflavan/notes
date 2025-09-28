import React from 'react';
import { useApp } from '../contexts/AppContext';
import SearchBar from './SearchBar';
import TagFilter from './TagFilter';
import NoteList from './NoteList';
import NoteEditor from './NoteEditor';
import styles from './Layout.module.css';

const Layout: React.FC = () => {
  const { selectedNoteId } = useApp();
  
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <SearchBar />
        <TagFilter />
        <NoteList />
      </aside>
      <main className={styles.main}>
        {selectedNoteId ? (
          <NoteEditor />
        ) : (
          <div className={styles.empty}>
            <p>Select a note to view or edit</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;