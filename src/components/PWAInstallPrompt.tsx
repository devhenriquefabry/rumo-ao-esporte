import { useEffect, useState, type ReactNode } from 'react';
import {
    Check,
    Compass,
    Copy,
    Download,
    ExternalLink,
    MonitorDown,
    MoreVertical,
    Share,
    SquarePlus,
    X
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
    OPEN_PWA_INSTALL_EVENT,
    PWA_PROMPT_READY_EVENT,
    getDeferredInstallPrompt,
    getPlatformInfo,
    isRunningAsInstalledApp,
    promptNativeInstall
} from '../utils/pwaInstall';
import './PWAInstallPrompt.css';

const DISMISS_STORAGE_KEY = 'rae_pwa_install_dismissed_at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const wasRecentlyDismissed = () => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY));
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DURATION_MS;
};

interface InstallStep {
    icon: ReactNode;
    text: string;
}

interface Instructions {
    title: string;
    intro: string;
    steps: InstallStep[];
    /** Navegador embutido (WhatsApp/Instagram): a instalação só funciona fora dele. */
    needsExternalBrowser: boolean;
}

const buildInstructions = (): Instructions => {
    const { os, browser, isInAppBrowser } = getPlatformInfo();

    if (isInAppBrowser) {
        const externalBrowser = os === 'ios' ? 'Safari' : 'Chrome';

        return {
            title: `Abra no ${externalBrowser} para instalar`,
            intro: `Você está dentro do navegador de outro aplicativo (WhatsApp, Instagram...), e ele não instala aplicativos. Abra o site no ${externalBrowser} e o botão volta a funcionar.`,
            steps: [
                { icon: <Copy size={22} />, text: 'Toque em "Copiar link do app" abaixo.' },
                {
                    icon: <MoreVertical size={22} />,
                    text: os === 'ios'
                        ? 'Toque no menu (•••) e escolha "Abrir no Safari".'
                        : 'Toque no menu (⋮) e escolha "Abrir no Chrome" — ou cole o link no Chrome.'
                },
                { icon: <Download size={22} />, text: 'Já no navegador, entre no menu MENU e toque em "Instalar App".' }
            ],
            needsExternalBrowser: true
        };
    }

    if (os === 'ios') {
        if (browser !== 'safari') {
            return {
                title: 'Instale pelo Safari',
                intro: 'No iPhone e no iPad, só o Safari cria o atalho do app na tela de início.',
                steps: [
                    { icon: <Compass size={22} />, text: 'Abra rumoaoesporte.com.br no Safari.' },
                    { icon: <Share size={22} />, text: 'Toque no botão Compartilhar (quadrado com a seta para cima).' },
                    { icon: <SquarePlus size={22} />, text: 'Escolha "Adicionar à Tela de Início" e confirme em "Adicionar".' }
                ],
                needsExternalBrowser: false
            };
        }

        return {
            title: 'Instale o Rumo ao Esporte',
            intro: 'No Safari, siga estes 3 passos para deixar o app na tela de início do seu iPhone:',
            steps: [
                { icon: <Share size={22} />, text: 'Toque no botão Compartilhar, na barra de baixo do Safari.' },
                { icon: <SquarePlus size={22} />, text: 'Deslize a lista e escolha "Adicionar à Tela de Início".' },
                { icon: <Check size={22} />, text: 'Toque em "Adicionar", no canto superior direito.' }
            ],
            needsExternalBrowser: false
        };
    }

    if (os === 'android') {
        if (browser === 'samsung') {
            return {
                title: 'Instale o Rumo ao Esporte',
                intro: 'No Samsung Internet, siga estes passos:',
                steps: [
                    { icon: <MoreVertical size={22} />, text: 'Toque no menu (☰) do navegador.' },
                    { icon: <SquarePlus size={22} />, text: 'Escolha "Adicionar página a" e depois "Tela inicial".' },
                    { icon: <Check size={22} />, text: 'Confirme em "Adicionar".' }
                ],
                needsExternalBrowser: false
            };
        }

        if (browser === 'firefox') {
            return {
                title: 'Instale o Rumo ao Esporte',
                intro: 'No Firefox, siga estes passos:',
                steps: [
                    { icon: <MoreVertical size={22} />, text: 'Toque no menu (⋮) do navegador.' },
                    { icon: <SquarePlus size={22} />, text: 'Escolha "Instalar" ou "Adicionar à tela inicial".' },
                    { icon: <Check size={22} />, text: 'Confirme em "Adicionar".' }
                ],
                needsExternalBrowser: false
            };
        }

        return {
            title: 'Instale o Rumo ao Esporte',
            intro: 'Pelo menu do Chrome você cria o atalho do app na tela do celular:',
            steps: [
                { icon: <MoreVertical size={22} />, text: 'Toque no menu (⋮), no canto superior direito.' },
                { icon: <SquarePlus size={22} />, text: 'Escolha "Instalar aplicativo" ou "Adicionar à tela inicial".' },
                { icon: <Check size={22} />, text: 'Confirme em "Instalar".' }
            ],
            needsExternalBrowser: false
        };
    }

    return {
        title: 'Instale o Rumo ao Esporte',
        intro: 'No computador, o Chrome e o Edge instalam o app pela barra de endereço:',
        steps: [
            { icon: <MonitorDown size={22} />, text: 'Clique no ícone de instalar, à direita da barra de endereço.' },
            { icon: <MoreVertical size={22} />, text: 'Ou abra o menu (⋮) e escolha "Instalar Rumo ao Esporte".' },
            { icon: <Check size={22} />, text: 'Confirme em "Instalar".' }
        ],
        needsExternalBrowser: false
    };
};

/** iOS nunca dispara beforeinstallprompt: o convite lá é sempre manual, via Safari. */
const isIOSSafariEligible = () => {
    const { os, browser, isInAppBrowser } = getPlatformInfo();
    return os === 'ios' && browser === 'safari' && !isInAppBrowser;
};

export default function PWAInstallPrompt() {
    const location = useLocation();
    const [canInstallNatively, setCanInstallNatively] = useState(() => Boolean(getDeferredInstallPrompt()));
    const [isInstalled, setIsInstalled] = useState(isRunningAsInstalledApp);
    const [isBannerVisible, setIsBannerVisible] = useState(false);
    const [instructions, setInstructions] = useState<Instructions | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    const isStudentRoute = location.pathname.startsWith('/aluno');
    const hasPortalNavigation = ![
        '/aluno/login',
        '/aluno/contrato-obrigatorio'
    ].includes(location.pathname);

    const dismissBanner = () => {
        localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
        setIsBannerVisible(false);
    };

    const showInstructions = () => {
        setLinkCopied(false);
        setInstructions(buildInstructions());
    };

    /** Instala de verdade quando o navegador permite; senão ensina o caminho manual. */
    const startInstall = async () => {
        setIsBannerVisible(false);

        const outcome = await promptNativeInstall();

        if (outcome === 'unavailable') {
            showInstructions();
            return;
        }

        setCanInstallNatively(Boolean(getDeferredInstallPrompt()));

        if (outcome === 'accepted') {
            localStorage.removeItem(DISMISS_STORAGE_KEY);
        }
    };

    useEffect(() => {
        const handlePromptReady = () => {
            setCanInstallNatively(true);

            if (!wasRecentlyDismissed() && !isRunningAsInstalledApp()) {
                setIsBannerVisible(true);
            }
        };

        const handleAppInstalled = () => {
            localStorage.removeItem(DISMISS_STORAGE_KEY);
            setCanInstallNatively(false);
            setIsInstalled(true);
            setIsBannerVisible(false);
            setInstructions(null);
        };

        // O menu do portal pede a instalação por este evento.
        const handleOpenInstall = () => {
            if (isRunningAsInstalledApp()) {
                setIsInstalled(true);
                return;
            }

            void startInstall();
        };

        window.addEventListener(PWA_PROMPT_READY_EVENT, handlePromptReady);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener(OPEN_PWA_INSTALL_EVENT, handleOpenInstall);

        // O evento pode ter chegado antes deste componente montar (script do index.html).
        const shouldOfferOnMount = getDeferredInstallPrompt() || isIOSSafariEligible();

        if (shouldOfferOnMount && !wasRecentlyDismissed() && !isRunningAsInstalledApp()) {
            setIsBannerVisible(true);
        }

        return () => {
            window.removeEventListener(PWA_PROMPT_READY_EVENT, handlePromptReady);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener(OPEN_PWA_INSTALL_EVENT, handleOpenInstall);
        };
    }, []);

    const copyAppLink = async () => {
        const link = `${window.location.origin}/aluno/dashboard`;

        try {
            await navigator.clipboard.writeText(link);
            setLinkCopied(true);
        } catch {
            window.prompt('Copie o link do app:', link);
        }
    };

    if (isInstalled) return null;

    const showBanner = isStudentRoute && isBannerVisible && (canInstallNatively || isIOSSafariEligible());

    if (!showBanner && !instructions) return null;

    return (
        <>
            {showBanner && (
                <aside
                    className={`pwa-install-card${hasPortalNavigation ? ' pwa-install-card--above-nav' : ''}`}
                    aria-label="Instalar aplicativo Rumo ao Esporte"
                    aria-live="polite"
                >
                    <button
                        type="button"
                        className="pwa-install-card__close"
                        onClick={dismissBanner}
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
                        <button type="button" className="pwa-install-card__action" onClick={startInstall}>
                            <Download size={18} />
                            {canInstallNatively ? 'Instalar aplicativo' : 'Ver como instalar'}
                        </button>
                    </div>
                </aside>
            )}

            {instructions && (
                <div className="pwa-install-modal" role="presentation" onClick={() => setInstructions(null)}>
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
                            onClick={() => setInstructions(null)}
                            aria-label="Fechar instruções"
                        >
                            <X size={20} />
                        </button>

                        <img src="/pwa/icon-192.png" alt="" aria-hidden="true" />
                        <h2 id="pwa-install-title">{instructions.title}</h2>
                        <p>{instructions.intro}</p>

                        <ol>
                            {instructions.steps.map((step, index) => (
                                <li key={index}>
                                    {step.icon}
                                    <span>{step.text}</span>
                                </li>
                            ))}
                        </ol>

                        {instructions.needsExternalBrowser && (
                            <button type="button" className="pwa-install-modal__copy" onClick={copyAppLink}>
                                {linkCopied ? <Check size={18} /> : <ExternalLink size={18} />}
                                {linkCopied ? 'Link copiado!' : 'Copiar link do app'}
                            </button>
                        )}

                        <button
                            type="button"
                            className="pwa-install-modal__done"
                            onClick={() => setInstructions(null)}
                        >
                            Entendi
                        </button>
                    </section>
                </div>
            )}
        </>
    );
}
