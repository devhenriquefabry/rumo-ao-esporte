import { useState, useEffect } from 'react';
import { getStudentLogs } from '../utils/accessLogService';
import type { AccessLog } from '../utils/accessLogService';
import { XCircle, Calendar, ShieldCheck } from 'lucide-react';

interface Props {
    registrationId: string | string[];
}

export default function StudentAccessHistory({ registrationId }: Props) {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const ids = Array.isArray(registrationId) ? registrationId : [registrationId];

            const allLogsPromises = ids.map(id => getStudentLogs(id));
            const results = await Promise.all(allLogsPromises);

            // Flatten and sort by timestamp descending
            const merged = results.flat().sort((a, b) => {
                const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
                const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
                return dateB - dateA;
            });

            setLogs(merged);
            setLoading(false);
        };
        fetchLogs();
    }, [registrationId]);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Carregando histórico...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {logs.map((log) => (
                <div key={log.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '15px',
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: log.status === 'allowed' ? '#f0fdf4' : '#fef2f2',
                                color: log.status === 'allowed' ? '#16a34a' : '#dc2626'
                            }}>
                                {log.status === 'allowed' ? <ShieldCheck size={18} /> : <XCircle size={18} />}
                            </div>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b' }}>
                                    {log.status === 'allowed' ? 'ACESSO LIBERADO' : 'ACESSO NEGADO'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {log.modality}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>
                                {log.timestamp instanceof Date ? log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                {log.timestamp instanceof Date ? log.timestamp.toLocaleDateString('pt-BR') : ''}
                            </div>
                        </div>
                    </div>
                    {log.status === 'denied' && log.reason && (
                        <div style={{
                            fontSize: '0.8rem',
                            color: '#dc2626',
                            background: '#fef2f2',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            marginTop: '4px',
                            fontWeight: '500'
                        }}>
                            Motivo: {log.reason}
                        </div>
                    )}
                </div>
            ))}
            {logs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <Calendar size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <div style={{ fontSize: '0.9rem' }}>Nenhum registro de acesso encontrado.</div>
                </div>
            )}
        </div>
    );
}
