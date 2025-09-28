import React, { useEffect } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import { initializePWA } from './pwa';
import PWANotifications from './components/PWANotifications';
// App-specific styles
import './App.css';

// Theme and density manager component
function ThemeManager({ children }: { children: React.ReactNode }) {
  const { preferences } = useApp();

  useEffect(() => {
    function updateTheme() {
      const isDark = preferences.theme === 'dark' ||
        (preferences.theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-density', preferences.density);
    }

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);
    
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [preferences.theme, preferences.density]);

  return <>{children}</>;
}

// Root component with provider
function App() {
  // Initialize PWA functionality
  useEffect(() => {
    initializePWA().catch(error => {
      console.error('Failed to initialize PWA:', error);
    });
  }, []);

  return (
    <AppProvider>
      <div className="app">
        <PWANotifications />
        <ThemeManager>
          <Layout />
        </ThemeManager>
      </div>
    </AppProvider>
  );
}

export default App;
