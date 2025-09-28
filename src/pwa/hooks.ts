import { useState, useEffect, useCallback } from 'react';
import { pwaManager } from './index';

// Hook for PWA installation
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setCanInstall(pwaManager.canInstall());
    setIsInstalled(pwaManager.isInstalled());

    const handleInstallAvailable = () => setCanInstall(true);
    const handleInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const success = await pwaManager.showInstallPrompt();
    if (success) {
      setCanInstall(false);
      setIsInstalled(true);
    }
    return success;
  }, []);

  return { canInstall, isInstalled, install };
}

// Hook for online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = pwaManager.onOnlineStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  return isOnline;
}

// Hook for service worker updates
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => setUpdateAvailable(true);
    
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    
    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    await pwaManager.skipWaiting();
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate };
}

// Hook for storage usage
export function useStorageUsage() {
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    const updateUsage = async () => {
      const storageInfo = await pwaManager.getStorageUsage();
      setUsage(storageInfo);
    };

    updateUsage();
    
    // Update every 30 seconds
    const interval = setInterval(updateUsage, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const refreshUsage = useCallback(async () => {
    const storageInfo = await pwaManager.getStorageUsage();
    setUsage(storageInfo);
  }, []);

  return { usage, refreshUsage };
}

// Hook for PWA capabilities detection
export function usePWACapabilities() {
  const [capabilities, setCapabilities] = useState({
    serviceWorker: false,
    pushNotifications: false,
    backgroundSync: false,
    persistentStorage: false,
    webShare: false,
    fileSystemAccess: false
  });

  useEffect(() => {
    setCapabilities({
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      persistentStorage: 'storage' in navigator && 'persist' in navigator.storage,
      webShare: 'share' in navigator,
      fileSystemAccess: 'showOpenFilePicker' in window
    });
  }, []);

  return capabilities;
}
