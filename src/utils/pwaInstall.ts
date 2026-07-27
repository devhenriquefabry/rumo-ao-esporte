export const OPEN_PWA_INSTALL_EVENT = 'rae:open-install';

export const isRunningAsInstalledApp = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

    return window.matchMedia('(display-mode: standalone)').matches
        || navigatorWithStandalone.standalone === true;
};

export const openPWAInstallPrompt = () => {
    window.dispatchEvent(new CustomEvent(OPEN_PWA_INSTALL_EVENT));
};
