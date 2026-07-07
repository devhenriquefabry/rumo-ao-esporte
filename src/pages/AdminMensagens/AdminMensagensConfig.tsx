import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
// Firebase Storage causou erro de CORS no localhost, voltando para Cloudflare Proxy
import { useDialog } from '../../context/CustomDialogContext';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { SaveIcon, Wifi, WifiOff, Send, X, CheckCircle, RefreshCw } from 'lucide-react';
import { ensureInstance, sendWhatsApp } from './whatsappUtils';

// URL da Evolution API
const WHATSAPP_SERVICE_URL = (import.meta.env.VITE_WHATSAPP_URL as string) || 'https://evolution-api-im3d.onrender.com';
const INSTANCE_NAME = 'rae_instance';

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.82rem', fontWeight: 700,
    color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px'
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', border: '1.5px solid #e0e0e0',
    borderRadius: '8px', fontSize: '0.95rem', transition: 'border-color 0.2s', outline: 'none'
};
const hintStyle: React.CSSProperties = {
    margin: '6px 0 0', fontSize: '0.79rem', color: '#bbb'
};

interface WhatsAppConfig {
    apiKey: string;
    senderPhone: string;
    testPhone: string;
    modoTeste: boolean;
    imageUrl: string;
    pendingImageUrl: string;
}

const EMPTY_CONFIG: WhatsAppConfig = { apiKey: '', senderPhone: '', testPhone: '', modoTeste: false, imageUrl: '', pendingImageUrl: '' };

// ─── Modal de Teste Rápido ─────────────────────────────────────────────
function TesteModal({ config, onClose }: { config: WhatsAppConfig; onClose: () => void }) {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [log, setLog] = useState('');

    const send = async () => {
        if (!phone.trim()) return;
        setStatus('sending');
        setLog('');
        try {
            const tempConfig = {
                ...config,
                testPhone: phone.trim().replace(/\D/g, ''),
                modoTeste: true 
            };
            
            const res = await sendWhatsApp(phone, "Teste rápido!", tempConfig, true);
            
            if (res.success) {
                setStatus('success');
                setLog('Mensagem enviada com sucesso! Verifique o WhatsApp.');
            } else {
                setStatus('error');
                setLog(res.log || 'Erro na API');
            }
        } catch (e: any) {
            setStatus('error');
            setLog(e.message);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
                    <X size={20} />
                </button>

                <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🧪</div>
                <h3 style={{ margin: '0 0 4px', color: '#222', fontSize: '1.1rem' }}>Teste Rápido (Evolution API)</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.86rem', color: '#999' }}>
                    Informe um número para ver se o envio está funcionando.
                </p>

                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Número de destino (com DDD)
                </label>
                <input
                    type="tel"
                    placeholder="Ex: 5533998200000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    disabled={status === 'sending'}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '8px', fontSize: '1rem', marginBottom: '14px', outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.2s' }}
                    autoFocus
                />

                {status !== 'idle' && (
                    <div style={{
                        padding: '12px 16px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.87rem',
                        background: status === 'success' ? '#eafaf1' : status === 'error' ? '#eef8ff' : '#f5f5f5',
                        color: status === 'success' ? '#1e8449' : status === 'error' ? '#00a63a' : '#888',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        border: `1px solid ${status === 'success' ? '#abebc6' : status === 'error' ? '#f5b7b1' : '#eee'}`
                    }}>
                        {status === 'success' && <CheckCircle size={16} color="#27ae60" />}
                        {status === 'sending' ? '⏳ Enviando...' : log}
                    </div>
                )}

                <button
                    onClick={send}
                    disabled={status === 'sending' || !phone.trim()}
                    style={{
                        width: '100%', padding: '13px', background: (!phone.trim() || status === 'sending') ? '#ddd' : '#00a63a',
                        color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem',
                        cursor: (!phone.trim() || status === 'sending') ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s'
                    }}
                >
                    <Send size={16} />
                    {status === 'sending' ? 'Enviando...' : 'Testar Agora'}
                </button>
            </div>
        </div>
    );
}

// ─── Página Principal ────────────────────────────────────────────────────
export default function AdminMensagensConfig() {
    const [config, setConfig] = useState<WhatsAppConfig>(EMPTY_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [instanceStatus, setInstanceStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'PENDING' | 'CHECKING'>('CHECKING');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [showTeste, setShowTeste] = useState(false);
    const { showAlert } = useDialog();

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'system_settings', 'whatsapp'));
                if (snap.exists()) {
                    const data = snap.data();
                    const newConfig: WhatsAppConfig = {
                        apiKey: data.apiKey || (import.meta.env.VITE_WHATSAPP_API_KEY as string) || '',
                        senderPhone: data.senderPhone || '',
                        testPhone: data.testPhone || '',
                        modoTeste: data.modoTeste === true,
                        imageUrl: data.imageUrl || '',
                        pendingImageUrl: data.pendingImageUrl || ''
                    };
                    setConfig(newConfig);
                    if (newConfig.apiKey) checkStatus(newConfig.apiKey);
                } else {
                    const envKey = (import.meta.env.VITE_WHATSAPP_API_KEY as string) || '';
                    if (envKey) {
                        setConfig({ ...EMPTY_CONFIG, apiKey: envKey });
                        checkStatus(envKey);
                    }
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const checkStatus = async (key: string) => {
        setInstanceStatus('CHECKING');
        try {
            const res = await fetch(`${WHATSAPP_SERVICE_URL}/instance/connectionState/${INSTANCE_NAME}`, {
                headers: { 'apikey': key }
            });
            
            if (res.status === 401 || res.status === 403) {
                setInstanceStatus('DISCONNECTED');
                showAlert('Chave de API (Global) inválida ou não autorizada. Verifique no Render!', 'error');
                return;
            }

            if (res.status === 404) {
                const created = await ensureInstance(key);
                if (created) {
                    setInstanceStatus('DISCONNECTED');
                    fetchQR(key);
                } else {
                    setInstanceStatus('DISCONNECTED');
                }
                return;
            }

            const json = await res.json();
            if (json.instance?.state === 'open') {
                setInstanceStatus('CONNECTED');
                setQrCode(null);
            } else {
                setInstanceStatus('DISCONNECTED');
                fetchQR(key);
            }
        } catch (e) {
            console.error('Erro ao verificar status:', e);
            setInstanceStatus('DISCONNECTED');
        }
    };

    const fetchQR = async (key: string) => {
        try {
            const res = await fetch(`${WHATSAPP_SERVICE_URL}/instance/connect/${INSTANCE_NAME}`, {
                headers: { 'apikey': key }
            });
            const json = await res.json();
            if (json.base64) {
                setQrCode(json.base64);
            }
        } catch (e) {
            console.error('Erro ao buscar QR Code', e);
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'system_settings', 'whatsapp'), {
                ...config,
                serviceUrl: WHATSAPP_SERVICE_URL,
                updatedAt: new Date().toISOString()
            });
            showAlert('Configurações salvas na nuvem!', 'success');
            checkStatus(config.apiKey);
        } catch {
            showAlert('Erro ao salvar no Firestore.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const set = (field: keyof WhatsAppConfig, value: any) =>
        setConfig(prev => ({ ...prev, [field]: value }));

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'pendingImageUrl') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSaving(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX = 1200; // Aumentado um pouco
                    if (width > height) {
                        if (width > MAX) { height *= MAX / width; width = MAX; }
                    } else {
                        if (height > MAX) { width *= MAX / height; height = MAX; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    // Converte para Blob para upload
                    canvas.toBlob(async (blob) => {
                        if (!blob) throw new Error('Falha ao gerar blob');
                        
                        try {
                            const res = await fetch(`${WHATSAPP_SERVICE_URL}/upload`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'image/jpeg' },
                                body: blob
                            });
                            
                            if (!res.ok) throw new Error('Falha no upload para o Cloudflare');
                            
                            const json = await res.json();
                            if (json.url) {
                                set(field, json.url);
                                showAlert('Imagem enviada para o Cloudflare com sucesso!', 'success');
                            }
                        } catch (err: any) {
                            showAlert('Erro no upload: ' + err.message, 'error');
                        } finally {
                            setSaving(false);
                        }
                    }, 'image/jpeg', 0.85);
                };
            };
        } catch (err: any) {
            showAlert('Erro: ' + err.message, 'error');
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}><RefreshCw className="animate-spin" /> Carregando...</div>;

    const statusColors = { CONNECTED: '#1e8449', DISCONNECTED: '#00a63a', PENDING: '#f39c12', CHECKING: '#999' };
    const statusLabels = { CONNECTED: 'CONECTADO', DISCONNECTED: 'DESCONECTADO', PENDING: 'AGUARDANDO QR', CHECKING: 'VERIFICANDO...' };

    return (
        <PageContainer>
            <PageTitle
                title="WHATSAPP - EVOLUTION API"
                subtitle="Gerencie o servidor gratuito no Render e conecte sua instância."
            />

            {showTeste && (
                <TesteModal config={config} onClose={() => setShowTeste(false)} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '700px' }}>

                {/* Status da Instância */}
                <div style={{
                    background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                    borderLeft: `6px solid ${statusColors[instanceStatus]}`
                }}>
                    <div>
                        <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status da Instância (`{INSTANCE_NAME}`)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: statusColors[instanceStatus], display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {instanceStatus === 'CONNECTED' ? <Wifi size={20} /> : <WifiOff size={20} />}
                            {statusLabels[instanceStatus]}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                            {WHATSAPP_SERVICE_URL}
                        </div>
                    </div>
                    <button
                        onClick={() => checkStatus(config.apiKey)}
                        disabled={instanceStatus === 'CHECKING'}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '10px 18px', background: '#f8f8f8', border: '1.5px solid #ddd',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem',
                            fontWeight: 600, color: '#555', transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={15} className={instanceStatus === 'CHECKING' ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>

                {qrCode && instanceStatus !== 'CONNECTED' && (
                    <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '28px', textAlign: 'center', border: '2px dashed #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <img 
                                src={qrCode} 
                                alt="WhatsApp QR Code" 
                                style={{ width: '240px', height: '240px', border: '8px solid #f8f9fa', borderRadius: '12px' }} 
                            />
                        </div>
                        <h4 style={{ margin: '0 0 10px', color: '#333' }}>Escaneie o QR Code</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', maxWidth: '300px', marginInline: 'auto' }}>
                            Abra o WhatsApp no seu celular, vá em **Aparelhos Conectados** e clique em **Conectar um Aparelho**.
                        </p>
                    </div>
                )}

                {/* Configurações de API */}
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '28px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SaveIcon size={18} color="#00a63a" /> Credenciais da API
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={labelStyle}>API Key (Global)</label>
                            <input
                                type="password"
                                placeholder="Sua senha do Evolution API configurada no Render"
                                value={config.apiKey}
                                onChange={e => set('apiKey', e.target.value)}
                                style={inputStyle}
                            />
                            <p style={hintStyle}>Esta chave é necessária para autenticar todos os comandos.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '10px' }}>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #eee' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Número de Teste</label>
                                <input
                                    type="tel"
                                    placeholder="5533998200546"
                                    value={config.testPhone}
                                    onChange={e => set('testPhone', e.target.value)}
                                    style={inputStyle}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#999' }}>As mensagens no modo teste ou individuais para teste serão enviadas para este número.</p>
                            </div>

                            <div style={{ background: config.modoTeste ? '#fff9f9' : '#f8fafc', padding: '16px', borderRadius: '10px', border: `1px solid ${config.modoTeste ? '#ffebeb' : '#eee'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="modoTeste"
                                        checked={config.modoTeste}
                                        onChange={e => setConfig(prev => ({ ...prev, modoTeste: e.target.checked }))}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="modoTeste" style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Ativar Modo Teste Geral</label>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: config.modoTeste ? '#00a63a' : '#999', fontWeight: config.modoTeste ? 700 : 400 }}>
                                    {config.modoTeste ? '⚠️ Todas as mensagens saídas do sistema serão redirecionadas para o número de teste.' : 'Mensagens saem normalmente para os clientes.'}
                                </p>
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Imagem de Cobrança (Atrasados)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="/atrasada.png ou link Base64"
                                    value={config.imageUrl}
                                    onChange={e => set('imageUrl', e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <label style={{ 
                                    padding: '8px 16px', background: '#f1f1f1', borderRadius: '8px', 
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', 
                                    fontSize: '0.8rem', fontWeight: 600, border: '1px solid #ddd' 
                                }}>
                                    <SaveIcon size={14} /> Subir
                                    <input 
                                        type="file" 
                                        hidden 
                                        accept="image/*" 
                                        onChange={(e) => handleFileUpload(e, 'imageUrl')} 
                                        disabled={saving}
                                    />
                                </label>
                            </div>
                            {config.imageUrl && (
                                <div style={{ marginTop: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff', textAlign: 'center' }}>
                                    <img 
                                        src={config.imageUrl} 
                                        alt="Prévia Atrasada" 
                                        style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '4px' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Imagem de Cobrança (Pendentes)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Link da imagem ou Base64"
                                    value={config.pendingImageUrl}
                                    onChange={e => set('pendingImageUrl', e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <label style={{ 
                                    padding: '8px 16px', background: '#f1f1f1', borderRadius: '8px', 
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', 
                                    fontSize: '0.8rem', fontWeight: 600, border: '1px solid #ddd' 
                                }}>
                                    <SaveIcon size={14} /> Subir
                                    <input 
                                        type="file" 
                                        hidden 
                                        accept="image/*" 
                                        onChange={(e) => handleFileUpload(e, 'pendingImageUrl')} 
                                        disabled={saving}
                                    />
                                </label>
                            </div>
                            {config.pendingImageUrl && (
                                <div style={{ marginTop: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff', textAlign: 'center' }}>
                                    <img 
                                        src={config.pendingImageUrl} 
                                        alt="Prévia Pendente" 
                                        style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '4px' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Botões de Ação */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '10px' }}>
                    <button
                        onClick={() => setShowTeste(true)}
                        disabled={instanceStatus !== 'CONNECTED'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: '#fff', border: '2px solid #333', color: '#333', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: instanceStatus !== 'CONNECTED' ? 'not-allowed' : 'pointer', opacity: instanceStatus !== 'CONNECTED' ? 0.5 : 1 }}
                    >
                        <Send size={15} /> Teste Rápido
                    </button>

                    <button
                        onClick={save}
                        disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 30px', background: saving ? '#ddd' : '#00a63a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                    >
                        <SaveIcon size={16} />
                        {saving ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                </div>

            </div>
        </PageContainer>
    );
}

