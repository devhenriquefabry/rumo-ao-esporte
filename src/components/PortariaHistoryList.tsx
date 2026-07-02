import { useState, useEffect } from 'react';
import { getRecentLogs } from '../utils/accessLogService';
import type { AccessLog } from '../utils/accessLogService';
import { Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function PortariaHistoryList() {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        const data = await getRecentLogs(50);
        setLogs(data);
        setLoading(false);
    };

    const handleDelete = async (id: string | undefined) => {
        if (!id) return;
        if (window.confirm('Tem certeza que deseja excluir este registro?')) {
            const success = await import('../utils/accessLogService').then(m => m.deleteAccessLog(id));
            if (success) {
                setLogs(prev => prev.filter(log => log.id !== id));
            } else {
                alert('Erro ao excluir registro.');
            }
        }
    };

    useEffect(() => {
        fetchLogs();
        // Refresh every 30 seconds
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && logs.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Carregando histórico...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
            {logs.map((log) => (
                <div key={log.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    borderLeft: `5px solid ${log.status === 'allowed' ? '#22c55e' : '#ef4444'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundImage: `url(${log.photoUrl || '/placeholder.png'})`,
                        backgroundColor: '#e2e8f0',
                        flexShrink: 0,
                        border: '2px solid #fff',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            color: '#1e293b',
                            textTransform: 'uppercase',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {log.studentName}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <div style={{
                                fontSize: '0.8rem',
                                fontWeight: '800',
                                color: log.status === 'allowed' ? '#15803d' : '#b91c1c',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: log.status === 'allowed' ? '#dcfce7' : '#fee2e2',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                letterSpacing: '0.5px'
                            }}>
                                <Clock size={14} />
                                ACESSO EM {log.timestamp instanceof Date ? `${log.timestamp.toLocaleDateString('pt-BR')} ÀS ${log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '---'}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>• {log.modality}</span>
                        </div>
                        {log.status === 'denied' && log.reason && (
                            <div style={{
                                fontSize: '0.7rem',
                                color: '#ef4444',
                                marginTop: '2px',
                                fontStyle: 'italic',
                                fontWeight: '500'
                            }}>
                                {log.reason}
                            </div>
                        )}
                    </div>

                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        {log.status === 'allowed' ? (
                            <CheckCircle size={20} color="#22c55e" />
                        ) : (
                            <XCircle size={20} color="#ef4444" />
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(log.id);
                            }}
                            title="Excluir Registro"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#cbd5e1',
                                borderRadius: '4px',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.background = '#fee2e2';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#cbd5e1';
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
            {logs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic' }}>
                    Nenhum acesso registrado recentemente.
                </div>
            )}
        </div>
    );
}
