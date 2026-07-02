import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, LoaderCircle, RefreshCw, Smartphone, X } from 'lucide-react';
import {
  connectEvolutionInstance,
  getEvolutionInstanceStatus
} from './messagingApi';
import type { EvolutionConnection } from './messagingApi';

interface InstanceConnectionModalProps {
  instanceName: string;
  initialConnection?: EvolutionConnection | null;
  onClose: () => void;
  onConnected: () => void;
}

const qrImageSource = (value: string) => {
  if (!value) return '';
  if (value.startsWith('data:image/')) return value;
  if (value.startsWith('iVBOR') || value.startsWith('/9j/')) return `data:image/png;base64,${value}`;
  return '';
};

export default function InstanceConnectionModal({
  instanceName,
  initialConnection,
  onClose,
  onConnected
}: InstanceConnectionModalProps) {
  const [connection, setConnection] = useState<EvolutionConnection | null>(initialConnection || null);
  const [loadingQr, setLoadingQr] = useState(!initialConnection?.qrCode);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  const qrSource = useMemo(() => qrImageSource(connection?.qrCode || ''), [connection?.qrCode]);
  const connected = connection?.status === 'open';

  const refreshQr = useCallback(async () => {
    try {
      setLoadingQr(true);
      setError('');
      const nextConnection = await connectEvolutionInstance(instanceName);
      setConnection(nextConnection);
      if (nextConnection.status === 'open') void onConnectedRef.current();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível gerar o QR Code.');
    } finally {
      setLoadingQr(false);
    }
  }, [instanceName]);

  useEffect(() => {
    if (!initialConnection?.qrCode && initialConnection?.status !== 'open') void refreshQr();
  }, [initialConnection, refreshQr]);

  useEffect(() => {
    if (connected) return;
    const statusTimer = window.setInterval(async () => {
      try {
        const nextConnection = await getEvolutionInstanceStatus(instanceName);
        setConnection((current) => ({ ...current, ...nextConnection, qrCode: current?.qrCode || nextConnection.qrCode }));
        if (nextConnection.status === 'open') void onConnectedRef.current();
      } catch {
        // A próxima atualização tenta novamente sem interromper a leitura do QR.
      }
    }, 3000);
    const qrTimer = window.setInterval(() => void refreshQr(), 25000);
    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(qrTimer);
    };
  }, [connected, instanceName, refreshQr]);

  const copyPairingCode = async () => {
    if (!connection?.pairingCode) return;
    await navigator.clipboard.writeText(connection.pairingCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="instance-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="instance-connect-modal" role="dialog" aria-modal="true" aria-labelledby="instance-connect-title" onClick={(event) => event.stopPropagation()}>
        <div className="instance-modal-header">
          <div>
            <span className={`connection-live-dot ${connected ? 'online' : ''}`} />
            <h3 id="instance-connect-title">Conectar {instanceName}</h3>
          </div>
          <button type="button" onClick={onClose} title="Fechar"><X size={20} /></button>
        </div>

        <div className="instance-connect-content">
          {connected ? (
            <div className="instance-connected-state">
              <CheckCircle2 size={54} />
              <h4>WhatsApp conectado</h4>
              <p>A instância já está pronta para os disparos.</p>
              <button type="button" className="message-primary-button" onClick={onClose}>Concluir</button>
            </div>
          ) : (
            <>
              <div className="instance-qr-frame">
                {loadingQr && !qrSource ? <LoaderCircle className="spin" size={38} /> : null}
                {!loadingQr && qrSource ? <img src={qrSource} alt="QR Code para conectar o WhatsApp" /> : null}
                {!loadingQr && !qrSource ? <Smartphone size={48} /> : null}
              </div>
              <div className="instance-connect-copy">
                <strong>Escaneie pelo WhatsApp</strong>
                <span>Aparelhos conectados → Conectar um aparelho</span>
              </div>

              {connection?.pairingCode && (
                <button type="button" className="pairing-code" onClick={copyPairingCode}>
                  <span>{connection.pairingCode}</span>
                  <Copy size={17} />
                  {copied ? 'Copiado' : 'Copiar código'}
                </button>
              )}

              {error && <div className="message-alert error instance-modal-alert">{error}</div>}

              <div className="instance-modal-actions">
                <span><LoaderCircle className="spin" size={15} /> Aguardando conexão</span>
                <button type="button" className="message-secondary-button" onClick={refreshQr} disabled={loadingQr}>
                  <RefreshCw className={loadingQr ? 'spin' : ''} size={17} /> Atualizar QR
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
