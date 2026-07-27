import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isRunningAsInstalledApp, OPEN_PWA_INSTALL_EVENT } from '../utils/pwaInstall';
import './PWAInstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
}

const DISMISS_STORAGE_KEY = 'rae_pwa_install_dismissed_at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const isIOSDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const wasRecentlyDismissed = () => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
};

export default function PWAInstallPrompt() {
    const location = useLocation();
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(isRunningAsInstalledApp);
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(wasRecentlyDismissed);
    const [showInstructions, setShowInstructions] = useState(false);

    const isStudentRoute = location.pathname.startsWith('/aluno');
    const hasPortalNavigation = ![
        '/aluno/login',
        '/aluno/contrato-obrigatorio'
    ].includes(location.pathname);
    const isIOS = isIOSDevice();

    useEffect(() => {
        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);

            if (!wasRecentlyDismissed()) {
                setIsVisible(true);
            }
        };

        const handleAppInstalled = () => {
            localStorage.removeItem(DISMISS_STORAGE_KEY);
            setInstallPrompt(null);
            setIsInstalled(true);
            setIsVisible(false);
            setShowInstructions(false);
        };

        const handleOpenInstall = () => {
            if (isRunningAsInstalledApp()) return;
            setIsDismissed(false);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener(OPEN_PWA_INSTALL_EVENT, handleOpenInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener(OPEN_PWA_INSTALL_EVENT, handleOpenInstall);
        };
    }, []);

    const shouldShowIOSBanner = isIOS && !isInstalled && !isDismissed;

    const dismiss = () => {
        localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
        setIsDismissed(true);
        setIsVisible(false);
        setShowInstructions(false);
    };

    const install = async () => {
        if (!installPrompt) {
            setShowInstructions(true);
            return;
        }

        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;

        if (choice.outcome === 'accepted') {
            setIsVisible(false);
        } else {
            dismiss();
        }

        setInstallPrompt(null);
    };

    if (!isStudentRoute || isInstalled || (!isVisible && !shouldShowIOSBanner)) return null;

    return (
        <>
            <aside
                className={`pwa-install-card${hasPortalNavigation ? ' pwa-install-card--above-nav' : ''}`}
                aria-label="Instalar aplicativo Rumo ao Esporte"
                aria-live="polite"
            >
                <button
                    type="button"
                    className="pwa-install-card__close"
                    onClick={dismiss}
                    aria-label="Lembrar mais tarde"
                >
                    <X size={18} />
                </button>

                <img
                    className="pwa-install-card__icon"
                    src="/pwa/icon-192.png"
                    alt=""
                    aria-hidden="true"
                />

                <div className="pwa-install-card__content">
                    <strong>Rumo ao Esporte no seu celular</strong>
                    <span>Pagamentos e carteirinha sempre à mão.</span>
                    <button type="button" className="pwa-install-card__action" onClick={install}>
                        <Download size={18} />
                        {installPrompt ? 'Instalar aplicativo' : 'Ver como instalar'}
                    </button>
                </div>
            </aside>

            {showInstructions && (
                <div className="pwa-install-modal" role="presentation" onClick={dismiss}>
                    <section
                        className="pwa-install-modal__dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pwa-install-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="pwa-install-modal__close"
                            onClick={dismiss}
                            aria-label="Fechar instruções"
                        >
                            <X size={20} />
                        </button>

                        <img src="/pwa/icon-192.png" alt="" aria-hidden="true" />
                        <h2 id="pwa-install-title">Instale o Rumo ao Esporte</h2>
                        <p>
                            {isIOS
                                ? 'No Safari, siga estes passos para criar o atalho na tela inicial:'
                                : 'No navegador do celular, siga estes passos para criar o atalho na tela inicial:'}
                        </p>

                        <ol>
                            <li>
                                {isIOS ? <Share size={22} /> : <MoreVertical size={22} />}
                                <span>{isIOS ? 'Toque em Compartilhar.' : 'Abra o menu do navegador.'}</span>
                            </li>
                            <li>
                                <SquarePlus size={22} />
                                <span>
                                    {isIOS
                                        ? 'Escolha “Adicionar à Tela de Início”.'
                                        : 'Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.'}
                                </span>
                            </li>
                            <li>
                                <Download size={22} />
                                <span>Confirme em “Adicionar” ou “Instalar”.</span>
                            </li>
                        </ol>

                        <button type="button" className="pwa-install-modal__done" onClick={dismiss}>
                            Entendi
                        </button>
                    </section>
                </div>
            )}
        </>
    );
}
