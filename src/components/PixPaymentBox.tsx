import { useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, RefreshCw } from 'lucide-react';

const workerUrl = import.meta.env.VITE_WORKER_URL;

interface PixPaymentBoxProps {
    paymentId: string;
    /** Código EMV copia e cola, quando já veio no cache. */
    pixQrCode?: string;
    /** Imagem do QR em base64, quando o provedor devolve pronta. */
    pixQrCodeUrl?: string;
    /** No admin, o texto muda de "pagar" para "copiar e enviar pro responsável". */
    isAdmin?: boolean;
}

/**
 * Duas formas de pagar por PIX na tela do responsável: ver o QR Code ou copiar
 * o código. O código EMV nem sempre está no cache local, então buscamos a
 * fatura sob demanda no primeiro clique.
 */
export function PixPaymentBox({ paymentId, pixQrCode, pixQrCodeUrl, isAdmin = false }: PixPaymentBoxProps) {
    const [code, setCode] = useState<string>(pixQrCode || '');
    const [qrImage, setQrImage] = useState<string>(
        pixQrCodeUrl ? `data:image/png;base64,${pixQrCodeUrl}` : ''
    );
    const [showQr, setShowQr] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    /** Busca o código na fatura quando ele não veio junto do cache. */
    const ensureCode = async (): Promise<string> => {
        if (code) return code;

        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${workerUrl}/payments/${paymentId}`);
            const data = await res.json();
            const fetched = data?.payment?.pixQrCode || '';
            if (!fetched) throw new Error('indisponivel');

            setCode(fetched);
            const image = data?.payment?.pixQrCodeUrl;
            if (image) setQrImage(`data:image/png;base64,${image}`);
            return fetched;
        } catch {
            setError('Não foi possível carregar o código PIX agora. Tente novamente em instantes.');
            return '';
        } finally {
            setLoading(false);
        }
    };

    const handleShowQr = async () => {
        if (showQr) {
            setShowQr(false);
            return;
        }

        const emv = await ensureCode();
        if (!emv) return;

        if (!qrImage) {
            try {
                // A Cora devolve o código mas nem sempre a imagem: geramos localmente.
                setQrImage(await QRCode.toDataURL(emv, { width: 320, margin: 1 }));
            } catch {
                setError('Não foi possível gerar o QR Code.');
                return;
            }
        }
        setShowQr(true);
    };

    const handleCopy = async () => {
        const emv = await ensureCode();
        if (!emv) return;

        try {
            await navigator.clipboard.writeText(emv);
        } catch {
            // Navegadores sem permissão de clipboard: seleção manual como alternativa.
            const field = document.createElement('textarea');
            field.value = emv;
            document.body.appendChild(field);
            field.select();
            document.execCommand('copy');
            document.body.removeChild(field);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const buttonBase: React.CSSProperties = {
        flex: '1 1 200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 16px',
        borderRadius: '10px',
        cursor: loading ? 'wait' : 'pointer',
        fontWeight: 700,
        fontSize: '0.8rem',
        transition: 'all 0.2s'
    };

    return (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px', fontWeight: 600 }}>
                {isAdmin ? 'Copie o código PIX para enviar ao responsável:' : 'Pague com PIX de duas formas:'}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                    onClick={handleShowQr}
                    disabled={loading}
                    style={{
                        ...buttonBase,
                        background: showQr ? '#e6f7ef' : '#00a63a',
                        color: showQr ? '#00a63a' : '#fff',
                        border: showQr ? '1px solid #00a63a' : '1px solid transparent',
                        boxShadow: showQr ? 'none' : '0 2px 8px rgba(0, 166, 58, 0.28)'
                    }}
                >
                    {loading ? <RefreshCw size={16} className="spin" /> : <QrCode size={16} />}
                    {showQr ? 'OCULTAR QR CODE' : 'QR CODE PARA PAGAMENTO'}
                </button>

                <button
                    onClick={handleCopy}
                    disabled={loading}
                    style={{
                        ...buttonBase,
                        background: copied ? '#e6f7ef' : '#fff',
                        color: copied ? '#00a63a' : '#17428f',
                        border: `1px solid ${copied ? '#00a63a' : '#17428f'}`
                    }}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'CÓDIGO COPIADO!' : 'CÓDIGO COPIA E COLA'}
                </button>
            </div>

            {error && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#c62828' }}>
                    {error}
                </div>
            )}

            {showQr && qrImage && (
                <div style={{ marginTop: '14px', textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '14px',
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
                    }}>
                        <img src={qrImage} alt="QR Code para pagamento via PIX" style={{ width: '210px', height: '210px', display: 'block' }} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '10px', lineHeight: 1.5 }}>
                        Abra o app do seu banco, escolha <strong>PIX &gt; Ler QR Code</strong><br />
                        e aponte a câmera para o código acima.
                    </div>
                </div>
            )}

            {copied && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#00a63a', lineHeight: 1.5 }}>
                    {isAdmin
                        ? 'Código copiado! É só colar na conversa do WhatsApp com o responsável.'
                        : <>Código copiado! Abra o app do seu banco e escolha <strong>PIX &gt; Copia e Cola</strong>.</>}
                </div>
            )}
        </div>
    );
}
