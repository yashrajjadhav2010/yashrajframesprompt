/**
 * YASHRAJ FRAMES – AI STUDIO
 * Progressive Web App (PWA) Registration, Install Prompt & Connectivity Controller
 */

import { registerSW } from 'virtual:pwa-register';

export function initPwaSupport(options = {}) {
  const {
    installButtons = [],
    iosGuideModal = null,
    iosGuideCloseBtn = null,
    iosGuideGotItBtn = null,
    offlineIndicator = null,
    onToast = null
  } = options;

  let deferredPrompt = null;
  let isInstalled = false;
  let isIOS = false;

  if (typeof window !== 'undefined') {
    isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    const ua = (window.navigator.userAgent || '').toLowerCase();
    isIOS = /iphone|ipad|ipod/.test(ua);

    try {
      registerSW({
        immediate: true,
        onOfflineReady() {
          if (typeof onToast === 'function') {
            onToast('Yashraj Frames is ready for offline studio browsing');
          }
        },
        onRegisterError(err) {
          console.warn('PWA service worker registration skipped:', err);
        }
      });
    } catch (err) {
      console.warn('PWA SW setup error:', err);
    }
  }

  const updateInstallButtonsUI = () => {
    const canShow = !isInstalled && (Boolean(deferredPrompt) || isIOS);
    installButtons.forEach((btn) => {
      if (!btn) return;
      btn.style.display = canShow ? '' : 'none';
      const labelEl = btn.querySelector('[data-pwa-install-label]');
      if (labelEl) {
        labelEl.textContent = isIOS && !deferredPrompt ? 'Install on iOS' : 'Install App';
      }
    });
  };

  const updateOnlineUI = () => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (offlineIndicator) {
      offlineIndicator.style.display = online ? 'none' : 'flex';
    }
  };

  const openIosGuide = () => {
    if (iosGuideModal) {
      iosGuideModal.classList.add('active');
    }
  };

  const closeIosGuide = () => {
    if (iosGuideModal) {
      iosGuideModal.classList.remove('active');
    }
  };

  const triggerInstall = async () => {
    if (isInstalled) return false;
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          isInstalled = true;
          deferredPrompt = null;
          updateInstallButtonsUI();
          if (typeof onToast === 'function') {
            onToast('Installing Yashraj Frames AI Studio...');
          }
          return true;
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
      return false;
    }
    if (isIOS) {
      openIosGuide();
      return true;
    }
    return false;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      updateInstallButtonsUI();
    });

    window.addEventListener('appinstalled', () => {
      isInstalled = true;
      deferredPrompt = null;
      updateInstallButtonsUI();
      if (typeof onToast === 'function') {
        onToast('Yashraj Frames installed to home screen!');
      }
    });

    const displayModeMq = window.matchMedia('(display-mode: standalone)');
    if (typeof displayModeMq.addEventListener === 'function') {
      displayModeMq.addEventListener('change', (e) => {
        if (e.matches) {
          isInstalled = true;
          deferredPrompt = null;
          updateInstallButtonsUI();
        }
      });
    }

    window.addEventListener('online', () => {
      updateOnlineUI();
      if (typeof onToast === 'function') {
        onToast('Back online — syncing studio cloud');
      }
    });

    window.addEventListener('offline', () => {
      updateOnlineUI();
    });
  }

  installButtons.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      void triggerInstall();
    });
  });

  if (iosGuideCloseBtn) {
    iosGuideCloseBtn.addEventListener('click', closeIosGuide);
  }
  if (iosGuideGotItBtn) {
    iosGuideGotItBtn.addEventListener('click', closeIosGuide);
  }
  if (iosGuideModal) {
    iosGuideModal.addEventListener('click', (e) => {
      if (e.target === iosGuideModal) closeIosGuide();
    });
  }

  updateInstallButtonsUI();
  updateOnlineUI();

  return {
    triggerInstall,
    closeIosGuide,
    isInstalled: () => isInstalled,
    isInstallable: () => Boolean(deferredPrompt),
    isIOS: () => isIOS
  };
}
