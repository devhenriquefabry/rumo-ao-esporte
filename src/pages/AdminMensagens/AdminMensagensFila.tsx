import { useState, useEffect } from 'react';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { 
    RefreshCw, 
    Trash2, 
    Pause, 
    Play, 
    Clock, 
    MessageSquare, 
    AlertCircle, 
    CheckCircle2 
} from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';
import { WORKER_URL } from './whatsappUtils';

interface QueueItem {
    key: string;
    phone: string;
    text: string;
    alunoNome?: string;
    enqueuedAt?: string;
}

export default function AdminMensagensFila() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { showAlert, showConfirm } = useDialog();

    const fetchQueue = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`${WORKER_URL}/queue/list`);
            const data = await res.json();
            if (data.success) {
                setQueue(data.items || []);
                setPaused(data.paused);
            }
        } catch (err) {
            console.error('Erro ao buscar fila:', err);
            showAlert('Erro ao conectar com o servidor de fila.', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(() => fetchQueue(true), 10000); // Polling a cada 10s
        return () => clearInterval(interval);
    }, []);

    const handleClearQueue = () => {
        showConfirm('Tem certeza que deseja ZERAR a fila? Todas as mensagens pendentes serão deletadas.', async () => {
            setActionLoading(true);
            try {
                const res = await fetch(`${WORKER_URL}/queue/clear`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showAlert('Fila zerada com sucesso!', 'success');
                    setQueue([]);
                }
            } catch (err) {
                showAlert('Erro ao limpar fila.', 'error');
            } finally {
                setActionLoading(false);
            }
        });
    };

    const handleTogglePause = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`${WORKER_URL}/queue/toggle-pause`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setPaused(data.paused);
                showAlert(data.paused ? 'Envios pausados!' : 'Envios retomados!', 'info');
            }
        } catch (err) {
            showAlert('Erro ao alterar status da fila.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <PageContainer>
            <PageTitle
                title="FILA DE WHATSAPP"
                subtitle="Gerencie as mensagens aguardando processamento pelo sistema."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {/* Stats Card */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '6px solid #4f46e5' }}>
                    <div style={{ background: '#e0e7ff', color: '#4f46e5', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Mensagens na Fila</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b' }}>{queue.length}</div>
                    </div>
                </div>

                {/* Status Card */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: `6px solid ${paused ? '#f59e0b' : '#10b981'}` }}>
                    <div style={{ background: paused ? '#fef3c7' : '#dcfce7', color: paused ? '#d97706' : '#16a34a', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {paused ? <Pause size={28} /> : <Play size={28} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Status do Processador</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: paused ? '#d97706' : '#16a34a' }}>
                            {paused ? 'PAUSADO' : 'EXECUTANDO'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <button 
                    onClick={() => fetchQueue()}
                    disabled={loading || actionLoading}
                    style={{ ...btnBase, background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0' }}
                >
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar
                </button>

                <button 
                    onClick={handleTogglePause}
                    disabled={actionLoading}
                    style={{ ...btnBase, background: paused ? '#10b981' : '#f59e0b', color: '#fff', border: 'none' }}
                >
                    {paused ? <Play size={18} /> : <Pause size={18} />}
                    {paused ? 'Retomar Envios' : 'Pausar Envios'}
                </button>

                <button 
                    onClick={handleClearQueue}
                    disabled={actionLoading || queue.length === 0}
                    style={{ ...btnBase, background: '#ef4444', color: '#fff', border: 'none' }}
                >
                    <Trash2 size={18} /> Limpar Toda a Fila
                </button>
            </div>

            {/* Queue Table */}
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={40} className="spin" style={{ marginBottom: '15px' }} />
                        <p>Carregando fila...</p>
                    </div>
                ) : queue.length === 0 ? (
                    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                        <div style={{ background: '#f8fafc', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle2 size={40} color="#10b981" />
                        </div>
                        <h3 style={{ color: '#1e293b', margin: '0 0 10px' }}>Tudo em dia!</h3>
                        <p style={{ color: '#64748b' }}>Não há mensagens pendentes na fila no momento.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                                    <th style={thStyle}>Aluno / Destinatário</th>
                                    <th style={thStyle}>Conteúdo da Mensagem</th>
                                    <th style={thStyle}>Entrada na Fila</th>
                                </tr>
                            </thead>
                            <tbody>
                                {queue.map((item) => (
                                    <tr key={item.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.alunoNome || 'Sistema'}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.phone}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                <MessageSquare size={14} style={{ marginTop: '3px', flexShrink: 0, color: '#94a3b8' }} />
                                                <div style={{ fontSize: '0.9rem', color: '#334155', maxWidth: '500px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {item.text}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={12} />
                                                {item.enqueuedAt ? new Date(item.enqueuedAt).toLocaleTimeString('pt-BR') : 'N/A'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '15px 24px', background: '#f8fafc', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={14} /> O sistema processa 20 mensagens por minuto quando ativo.
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </PageContainer>
    );
}

const thStyle: React.CSSProperties = { padding: '16px 24px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '16px 24px', verticalAlign: 'middle' };
const btnBase: React.CSSProperties = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    padding: '10px 18px', 
    borderRadius: '10px', 
    fontWeight: 600, 
    fontSize: '0.9rem', 
    cursor: 'pointer',
    transition: 'all 0.2s'
};
