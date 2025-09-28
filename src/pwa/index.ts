// Service Worker Registration and PWA Utilities
export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    'beforeinstallprompt': BeforeInstallPromptEvent;
  }
  
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
}

class PWAManager {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private isOnline = navigator.onLine;
  private callbacks: Set<(online: boolean) => void> = new Set();

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('🎯 PWA install prompt available');
      e.preventDefault();
      this.installPrompt = e;
      this.notifyInstallAvailable();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.installPrompt = null;
      this.notifyAppInstalled();
    });

    // Listen for online/offline changes
    window.addEventListener('online', () => {
      console.log('🌐 App is now online');
      this.isOnline = true;
      this.notifyOnlineStatusChange(true);
    });

    window.addEventListener('offline', () => {
      console.log('📱 App is now offline');
      this.isOnline = false;
      this.notifyOnlineStatusChange(false);
    });

    // Listen for service worker updates
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
        this.notifyUpdateAvailable();
      }
    });
  }

  // Register service worker
  async registerServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service workers not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('✅ Service worker registered:', this.registration.scope);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 New service worker available');
              this.notifyUpdateAvailable();
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
      return false;
    }
  }

  // Check if app can be installed
  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  // Show install prompt
  async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      console.warn('⚠️ Install prompt not available');
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const { outcome } = await this.installPrompt.userChoice;
      
      console.log('📱 Install prompt result:', outcome);
      
      if (outcome === 'accepted') {
        this.installPrompt = null;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Install prompt failed:', error);
      return false;
    }
  }

  // Check if app is installed
  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           (window.navigator as any).standalone === true;
  }

  // Get online status
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Subscribe to online status changes
  onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // Update service worker
  async updateServiceWorker(): Promise<void> {
    if (!this.registration) {
      console.warn('⚠️ No service worker registration found');
      return;
    }

    try {
      await this.registration.update();
      console.log('🔄 Service worker update initiated');
    } catch (error) {
      console.error('❌ Service worker update failed:', error);
    }
  }

  // Skip waiting for new service worker
  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }

  // Request persistent storage
  async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator && 'persist' in navigator.storage)) {
      console.warn('⚠️ Persistent storage not supported');
      return false;
    }

    try {
      const isPersistent = await navigator.storage.persist();
      console.log(isPersistent ? '✅ Persistent storage granted' : '⚠️ Persistent storage denied');
      return isPersistent;
    } catch (error) {
      console.error('❌ Persistent storage request failed:', error);
      return false;
    }
  }

  // Get storage usage
  async getStorageUsage(): Promise<{ usage: number; quota: number } | null> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    } catch (error) {
      console.error('❌ Storage estimate failed:', error);
      return null;
    }
  }

  // Notification methods
  private notifyInstallAvailable() {
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  }

  private notifyAppInstalled() {
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  }

  private notifyUpdateAvailable() {
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  }

  private notifyOnlineStatusChange(online: boolean) {
    this.callbacks.forEach(callback => callback(online));
    window.dispatchEvent(new CustomEvent('pwa-online-status', { 
      detail: { online } 
    }));
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Initialize PWA on load
export async function initializePWA(): Promise<void> {
  console.log('🚀 Initializing PWA...');
  
  // Register service worker
  const swRegistered = await pwaManager.registerServiceWorker();
  
  // Request persistent storage
  await pwaManager.requestPersistentStorage();
  
  // Log PWA status
  console.log('📱 PWA Status:', {
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerRegistered: swRegistered,
    canInstall: pwaManager.canInstall(),
    isInstalled: pwaManager.isInstalled(),
    isOnline: pwaManager.getOnlineStatus()
  });
}

// Export utilities
export { PWAManager };
export default pwaManager;
