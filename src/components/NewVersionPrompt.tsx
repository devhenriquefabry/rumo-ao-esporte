import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import './NewVersionPrompt.css';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Avisa que existe uma versão nova publicada e recarrega o app quando o usuário
 * aceita. Sem isso, um app instalado pode continuar rodando o código antigo até
 * o cache do navegador expirar.
 */
export default function NewVersionPrompt() {
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [reloading, setReloading] = useState(false);

    useEffect(() => {
        if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

        let registration: ServiceWorkerRegistration | undefined;
        let cancelled = false;
        let alreadyReloading = false;

        // O service worker novo assumiu o controle: recarrega para rodar o código novo.
        const handleControllerChange = () => {
            if (alreadyReloading) return;
            alreadyReloading = true;
            window.location.reload();
        };

        // Só avisa quando JÁ existe uma versão rodando. Na primeira instalação não
        // há nada a atualizar, então o aviso não deve aparecer.
        const announce = (worker: ServiceWorker | null) => {
            if (!cancelled && worker && navigator.serviceWorker.controller) {
                setWaitingWorker(worker);
            }
        };

        const watchInstallation = (installing: ServiceWorker) => {
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed') announce(installing);
            });
        };

        const checkForUpdate = () => {
            if (document.visibilityState === 'visible') {
                registration?.update().catch(() => { /* offline: tenta na próxima */ });
            }
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                if (cancelled) return;
                registration = reg;

                announce(reg.waiting);
                if (reg.installing) watchInstallation(reg.installing);

                reg.addEventListener('updatefound', () => {
                    if (reg.installing) watchInstallation(reg.installing);
                });
            })
            .catch((error) => {
                console.error('[PWA] Não foi possível registrar o aplicativo.', error);
            });

        // Reabrir o app (ou voltar do segundo plano) é o momento mais provável de
        // existir versão nova esperando.
        document.addEventListener('visibilitychange', checkForUpdate);
        const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

        return () => {
            cancelled = true;
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            document.removeEventListener('visibilitychange', checkForUpdate);
            window.clearInterval(intervalId);
        };
    }, []);

    if (!waitingWorker) return null;

    const applyUpdate = () => {
        setReloading(true);

        waitingWorker.postMessage({ type: 'SKIP_WAITING' });

        // Recarregar cedo demais traz a versão antiga de volta (o worker ainda não
        // terminou de ativar); esperar um tempo fixo deixa o usuário olhando
        // "Atualizando" à toa. Então recarrega assim que o worker ficar ativo,
        // com um limite para o caso de algo travar.
        const startedAt = Date.now();
        const pollId = window.setInterval(() => {
            const activated = waitingWorker.state === 'activated';
            if (activated || Date.now() - startedAt > 10000) {
                window.clearInterval(pollId);
                window.location.reload();
            }
        }, 250);
    };

    return (
        <aside className="rae-update-card" role="status" aria-live="polite">
            <div className="rae-update-card__badge" aria-hidden="true">
                <Sparkles size={22} />
            </div>

            <div className="rae-update-card__content">
                <strong>Nova versão disponível</strong>
                <span>Recarregue para usar a versão mais recente.</span>
            </div>

            <button
                type="button"
                className="rae-update-card__action"
                onClick={applyUpdate}
                disabled={reloading}
            >
                <RefreshCw size={16} className={reloading ? 'rae-update-card__spin' : undefined} />
                {reloading ? 'Atualizando' : 'Recarregar'}
            </button>
        </aside>
    );
}
