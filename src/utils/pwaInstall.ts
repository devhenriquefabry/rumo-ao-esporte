export const OPEN_PWA_INSTALL_EVENT = 'rae:open-install';
export const PWA_PROMPT_READY_EVENT = 'rae:install-prompt-ready';

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
    interface Window {
        // Preenchido pelo script inline do index.html, que roda antes do bundle:
        // sem isso o evento pode chegar antes do React montar e ser perdido.
        __raeInstallPrompt?: BeforeInstallPromptEvent | null;
    }
}

export type MobileOS = 'ios' | 'android' | 'desktop';
export type BrowserName = 'safari' | 'chrome' | 'firefox' | 'samsung' | 'edge' | 'opera' | 'inapp' | 'other';

export interface PlatformInfo {
    os: MobileOS;
    browser: BrowserName;
    /** Navegador embutido de outro app (WhatsApp, Instagram, Facebook...): não instala PWA. */
    isInAppBrowser: boolean;
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

const detectInAppBrowser = (agent: string) =>
    /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|LinkedInApp|Pinterest|; ?wv\)/i.test(agent);

const detectOS = (agent: string): MobileOS => {
    if (/iphone|ipad|ipod/i.test(agent)) return 'ios';
    if (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
    if (/android/i.test(agent)) return 'android';
    return 'desktop';
};

const detectBrowser = (agent: string, isInApp: boolean): BrowserName => {
    if (isInApp) return 'inapp';
    if (/SamsungBrowser/i.test(agent)) return 'samsung';
    if (/EdgA?\/|Edge\//i.test(agent)) return 'edge';
    if (/OPR\/|OPT\/|Opera/i.test(agent)) return 'opera';
    if (/FxiOS|Firefox/i.test(agent)) return 'firefox';
    if (/CriOS|Chrome/i.test(agent)) return 'chrome';
    if (/Safari/i.test(agent)) return 'safari';
    return 'other';
};

export const getPlatformInfo = (): PlatformInfo => {
    const agent = ua();
    const isInAppBrowser = detectInAppBrowser(agent);

    return {
        os: detectOS(agent),
        browser: detectBrowser(agent, isInAppBrowser),
        isInAppBrowser
    };
};

export const isRunningAsInstalledApp = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const standaloneModes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];

    return standaloneModes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)
        || navigatorWithStandalone.standalone === true;
};

export const getDeferredInstallPrompt = () => window.__raeInstallPrompt ?? null;

export const clearDeferredInstallPrompt = () => {
    window.__raeInstallPrompt = null;
};

/**
 * Dispara a caixa nativa de instalação do navegador (Chrome/Edge/Samsung no
 * Android e no desktop). Retorna 'unavailable' quando o navegador não expõe o
 * evento — iOS/Safari sempre cai nesse caso e precisa das instruções manuais.
 */
export const promptNativeInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const deferredPrompt = getDeferredInstallPrompt();

    if (!deferredPrompt) return 'unavailable';

    try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        // O evento só pode ser usado uma vez; o navegador manda outro se recusarem.
        clearDeferredInstallPrompt();

        return choice.outcome;
    } catch {
        clearDeferredInstallPrompt();
        return 'unavailable';
    }
};

export const openPWAInstallPrompt = () => {
    window.dispatchEvent(new CustomEvent(OPEN_PWA_INSTALL_EVENT));
};
