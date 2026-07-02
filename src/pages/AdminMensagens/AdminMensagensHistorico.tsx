import { useState, useEffect } from 'react';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { RefreshCw, CheckCircle2, XCircle, X, ExternalLink, Calendar, User, MessageCircle, AlertTriangle } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// ─── Modal de Detalhes ────────────────────────────────────────────────
function MessageDetailsModal({ log, onClose }: { log: any; onClose: () => void }) {
    if (!log) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '0', maxWidth: '600px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 700 }}>Detalhes da Mensagem</h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        {log.alunoNome && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                {log.alunoFotoUrl ? (
                                    <img src={log.alunoFotoUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' }} />
                                ) : (
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={22} color="#94a3b8" />
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Aluno</div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{log.alunoNome}</div>
                                </div>
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}><User size={14} /> Destinatário</label>
                            <div style={valueStyle}>{log.destinatario}</div>
                        </div>
                        <div>
                            <label style={labelStyle}><Calendar size={14} /> Data/Hora</label>
                            <div style={valueStyle}>{new Date(log.dataHora).toLocaleString('pt-BR')}</div>
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <span style={{ 
                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                background: log.status === 'SUCESSO' ? '#eafaf1' : '#fff5f5',
                                color: log.status === 'SUCESSO' ? '#1e8449' : '#007d2f',
                                display: 'inline-flex', alignItems: 'center', gap: '5px'
                            }}>
                                {log.status === 'SUCESSO' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                {log.status}
                            </span>
                        </div>
                        <div>
                            <label style={labelStyle}>Tipo</label>
                            <div style={valueStyle}>{log.tipo || 'TEXTO'}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}><MessageCircle size={14} /> Conteúdo da Mensagem</label>
                        <div style={{ 
                            background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1fr solid #e2e8f0',
                            fontSize: '0.95rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                            fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                            {log.mensagem}
                        </div>
                    </div>

                    {log.erro && (
                        <div style={{ background: '#fff1f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                            <label style={{ ...labelStyle, color: '#be123c' }}><AlertTriangle size={14} /> Erro de Envio</label>
                            <div style={{ fontSize: '0.9rem', color: '#9f1239', fontWeight: 500 }}>
                                {log.erro}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' };
const valueStyle: React.CSSProperties = { fontSize: '1rem', color: '#1e293b', fontWeight: 500 };

export default function AdminMensagensHistorico() {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'whatsapp_logs'),
            orderBy('dataHora', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(data);
            setLoading(false);
            setIsLive(true);
        }, (err) => {
            console.error('onSnapshot error:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadData = () => {
        // onSnapshot já é em tempo real, mas mantemos o botão para forçar scroll ao topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <PageContainer>
            <PageTitle
                title="HISTÓRICO DE MENSAGENS"
                subtitle="Acompanhe o status de todos os disparos de mensagens realizados pelo sistema."
            />

            <div style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                padding: '28px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>Últimos Envios</h3>
                        {isLive && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                background: '#ecfdf5', color: '#059669', fontSize: '0.72rem',
                                fontWeight: 700, padding: '3px 8px', borderRadius: '99px',
                                border: '1px solid #a7f3d0', textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                                Ao vivo
                            </span>
                        )}
                    </div>
                    <button 
                        onClick={loadData}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px', 
                            padding: '8px 16px', borderRadius: '8px', border: '1px solid #ddd',
                            background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#666'
                        }}
                    >
                        <RefreshCw size={16} />
                        Topo
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Destinatário</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Mensagem</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Data/Hora</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                                        {loading ? 'Buscando logs...' : 'Nenhuma mensagem enviada recentemente.'}
                                    </td>
                                </tr>
                            ) : (
                                history.map(log => (
                                    <tr 
                                        key={log.id} 
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {log.alunoFotoUrl ? (
                                                    <img
                                                        src={log.alunoFotoUrl}
                                                        alt=""
                                                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e2e8f0' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #e2e8f0' }}>
                                                        <User size={14} color="#94a3b8" />
                                                    </div>
                                                )}
                                                <div>
                                                    {log.alunoNome && <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.88rem', lineHeight: 1.2 }}>{log.alunoNome}</div>}
                                                    <div style={{ fontWeight: log.alunoNome ? 400 : 600, color: '#64748b', fontSize: log.alunoNome ? '0.75rem' : '0.9rem' }}>{log.destinatario}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ 
                                                maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', 
                                                whiteSpace: 'nowrap', color: '#444' 
                                            }} title={log.mensagem}>
                                                {log.mensagem}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ 
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                                    background: log.status === 'SUCESSO' ? '#eafaf1' : '#fff5f5',
                                                    color: log.status === 'SUCESSO' ? '#1e8449' : '#007d2f',
                                                    width: 'fit-content'
                                                }}>
                                                    {log.status === 'SUCESSO' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                    {log.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px', color: '#64748b' }}>
                                            {new Date(log.dataHora).toLocaleString('pt-BR')}
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>
                                            <button 
                                                style={{ background: 'none', border: 'none', color: '#007d2f', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                                            >
                                                Detalhes <ExternalLink size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedLog && (
                <MessageDetailsModal 
                    log={selectedLog} 
                    onClose={() => setSelectedLog(null)} 
                />
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </PageContainer>
    );
}
