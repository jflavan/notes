import React from 'react';
import { usePWAInstall, useOnlineStatus, usePWAUpdate } from '../pwa/hooks';
import styles from './PWANotifications.module.css';

const PWANotifications: React.FC = () => {
  const { canInstall, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const { updateAvailable, applyUpdate } = usePWAUpdate();

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      console.log('PWA installed successfully');
    }
  };

  const handleUpdate = async () => {
    await applyUpdate();
  };

  return (
    <div className={styles.container}>
      {/* Install notification */}
      {canInstall && (
        <div className={styles.notification + ' ' + styles.install}>
          <div className={styles.content}>
            <div className={styles.icon}>📱</div>
            <div className={styles.text}>
              <strong>Install Notes App</strong>
              <p>Add to your home screen for a better experience</p>
            </div>
            <div className={styles.actions}>
              <button 
                className={styles.button + ' ' + styles.primary} 
                onClick={handleInstall}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update notification */}
      {updateAvailable && (
        <div className={styles.notification + ' ' + styles.update}>
          <div className={styles.content}>
            <div className={styles.icon}>🔄</div>
            <div className={styles.text}>
              <strong>Update Available</strong>
              <p>A new version of the app is ready</p>
            </div>
            <div className={styles.actions}>
              <button 
                className={styles.button + ' ' + styles.primary} 
                onClick={handleUpdate}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className={styles.status + ' ' + styles.offline}>
          <div className={styles.icon}>📱</div>
          <span>You are offline. Changes will sync when you are back online.</span>
        </div>
      )}

      {/* Online indicator (brief) */}
      {isOnline && (
        <div className={styles.status + ' ' + styles.online}>
          <div className={styles.icon}>🌐</div>
          <span>Back online</span>
        </div>
      )}
    </div>
  );
};

export default PWANotifications;
