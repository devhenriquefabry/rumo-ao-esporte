
import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, FileText, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { StudentData } from '../../utils/financialTypes';

type SortField = 'student' | 'description' | 'value' | 'dueDate' | 'status';
type SortDirection = 'asc' | 'desc';

interface ManualChargesModalProps {
    isOpen: boolean;
    onClose: () => void;
    registrations: StudentData[];
}

export const ManualChargesModal: React.FC<ManualChargesModalProps> = ({ isOpen, onClose, registrations }) => {
    const [charges, setCharges] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modalityFilter, setModalityFilter] = useState('all');
    const [sortField, setSortField] = useState<SortField>('dueDate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchManualCharges();
        }
    }, [isOpen]);

    const fetchManualCharges = async () => {
        setLoading(true);
        try {
            // We fetch all manual charges. Since they are likely not tens of thousands, we can filter in memory or use range query.
            // Using range query for 'MANUAL_' prefix:
            const q = query(
                collection(db, 'financial_payments'),
                where('externalReference', '>=', 'MANUAL_'),
                where('externalReference', '<=', 'MANUAL_\uf8ff')
            );

            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by dateCreated desc manually since we might be using multiple where's and orderby in firestore requires composite index
            data.sort((a: any, b: any) => {
                const dateA = new Date(a.dateCreated || a.lastUpdate || 0).getTime();
                const dateB = new Date(b.dateCreated || b.lastUpdate || 0).getTime();
                return dateB - dateA;
            });

            setCharges(data);
        } catch (error) {
            console.error("Error fetching manual charges:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredAndSortedCharges = useMemo(() => {
        const filtered = charges.filter(charge => {
            const student = registrations.find(r => r.id === charge.studentId);
            const studentName = student?.alunos[0]?.nome || 'Desconhecido';
            const modality = student?.modalidade || 'Outra';

            const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                charge.description?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
            const matchesModality = modalityFilter === 'all' || modality === modalityFilter;

            return matchesSearch && matchesStatus && matchesModality;
        });

        return [...filtered].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortField) {
                case 'student':
                    valA = registrations.find(r => r.id === a.studentId)?.alunos[0]?.nome || '';
                    valB = registrations.find(r => r.id === b.studentId)?.alunos[0]?.nome || '';
                    break;
                case 'description':
                    valA = a.description || '';
                    valB = b.description || '';
                    break;
                case 'value':
                    valA = a.value || 0;
                    valB = b.value || 0;
                    break;
                case 'dueDate':
                    valA = a.dueDate || '';
                    valB = b.dueDate || '';
                    break;
                case 'status':
                    valA = a.status || '';
                    valB = b.status || '';
                    break;
                default:
                    valA = a.dateCreated || '';
                    valB = b.dateCreated || '';
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [charges, searchTerm, statusFilter, modalityFilter, registrations, sortField, sortDirection]);

    if (!isOpen) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RECEIVED':
            case 'CONFIRMED':
            case 'RECEIVED_IN_CASH':
            case 'DONE':
                return { bg: '#e8f5e9', text: '#2e7d32' };
            case 'OVERDUE':
                return { bg: '#ffebee', text: '#c62828' };
            case 'PENDING':
                return { bg: '#fff3e0', text: '#ef6c00' };
            default:
                return { bg: '#f5f5f5', text: '#666' };
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'RECEIVED': return 'RECEBIDO';
            case 'CONFIRMED': return 'CONFIRMADO';
            case 'RECEIVED_IN_CASH': return 'PAGO EM DINHEIRO';
            case 'DONE': return 'CONCLUÍDO';
            case 'OVERDUE': return 'VENCIDO';
            case 'PENDING': return 'PENDENTE';
            default: return status;
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff',
                width: isMobile ? '100%' : '100%',
                maxWidth: '1000px',
                height: isMobile ? '100%' : 'auto',
                maxHeight: isMobile ? '100%' : '90vh',
                borderRadius: isMobile ? '0' : '24px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{
                    padding: isMobile ? '20px' : '25px 30px',
                    borderBottom: '1px solid #eee',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f8fafc'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.4rem', fontWeight: '800' }}>
                            LANÇAMENTOS MANUAIS
                        </h2>
                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                            Histórico de cobranças avulsas geradas pelo sistema
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#fff', border: '1px solid #e2e8f0', padding: '10px',
                        borderRadius: '12px', cursor: 'pointer', color: '#64748b'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div style={{
                    padding: isMobile ? '15px' : '20px 30px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '12px',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Buscar aluno ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 15px 12px 45px', border: '1px solid #e2e8f0',
                                borderRadius: '12px', fontSize: '0.9rem', outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                fontSize: '0.85rem', fontWeight: '600', color: '#475569', outline: 'none',
                                background: '#fff'
                            }}
                        >
                            <option value="all">Status</option>
                            <option value="PENDING">Pendente</option>
                            <option value="RECEIVED">Recebido</option>
                            <option value="OVERDUE">Vencido</option>
                        </select>

                        <select
                            value={modalityFilter}
                            onChange={(e) => setModalityFilter(e.target.value)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                fontSize: '0.85rem', fontWeight: '600', color: '#475569', outline: 'none',
                                background: '#fff'
                            }}
                        >
                            <option value="all">Modalidade</option>
                            <option value="futebol">Futebol</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '50px' }}>
                            <div className="spinner" style={{ margin: '0 auto 15px', width: '40px', height: '40px', border: '3px solid #f1f5f9', borderTop: '3px solid #007d2f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ color: '#64748b' }}>Carregando lançamentos...</p>
                        </div>
                    ) : filteredAndSortedCharges.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                            <FileText size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>Nenhum lançamento manual encontrado.</p>
                        </div>
                    ) : isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredAndSortedCharges.map(charge => {
                                const student = registrations.find(r => r.id === charge.studentId);
                                const statusStyle = getStatusColor(charge.status);
                                return (
                                    <div key={charge.id} style={{
                                        background: '#fff', border: '1px solid #eef2f6', borderRadius: '16px',
                                        padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '1rem' }}>{student?.alunos[0]?.nome || 'Desconhecido'}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '2px' }}>{student?.modalidade || 'N/A'}</div>
                                            </div>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '900',
                                                background: statusStyle.bg, color: statusStyle.text
                                            }}>
                                                {getStatusLabel(charge.status)}
                                            </span>
                                        </div>

                                        <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                                            {charge.description || 'Lançamento Avulso'}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Valor / Vencimento</div>
                                                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.9rem' }}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.value)}
                                                    <span style={{ margin: '0 8px', color: '#cbd5e1', fontWeight: 'normal' }}>•</span>
                                                    {charge.dueDate ? new Date(charge.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                </div>
                                            </div>
                                            {charge.invoiceUrl && (
                                                <a href={charge.invoiceUrl} target="_blank" rel="noreferrer" style={{
                                                    background: '#007d2f', color: '#fff', padding: '8px 12px', borderRadius: '8px',
                                                    fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px'
                                                }}>
                                                    <ExternalLink size={14} /> Link
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                    <th
                                        onClick={() => handleSort('student')}
                                        style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            Aluno / Modalidade <SortIcon field="student" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('description')}
                                        style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            Descrição <SortIcon field="description" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('value')}
                                        style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            Valor <SortIcon field="value" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('dueDate')}
                                        style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            Vencimento <SortIcon field="dueDate" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('status')}
                                        style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            Status <SortIcon field="status" />
                                        </div>
                                    </th>
                                    <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedCharges.map(charge => {
                                    const student = registrations.find(r => r.id === charge.studentId);
                                    const statusStyle = getStatusColor(charge.status);

                                    return (
                                        <tr key={charge.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '15px 10px' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b' }}>{student?.alunos[0]?.nome || 'Desconhecido'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>{student?.modalidade || 'N/A'}</div>
                                            </td>
                                            <td style={{ padding: '15px 10px', maxWidth: '200px' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#475569' }}>{charge.description || 'Lançamento Avulso'}</div>
                                            </td>
                                            <td style={{ padding: '15px 10px' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.value)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px 10px' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                    {charge.dueDate ? new Date(charge.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px 10px' }}>
                                                <span style={{
                                                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800',
                                                    background: statusStyle.bg, color: statusStyle.text
                                                }}>
                                                    {getStatusLabel(charge.status)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px 10px' }}>
                                                {charge.invoiceUrl && (
                                                    <a href={charge.invoiceUrl} target="_blank" rel="noreferrer" style={{
                                                        color: '#007d2f', display: 'flex', alignItems: 'center', gap: '5px',
                                                        fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'none'
                                                    }}>
                                                        <ExternalLink size={14} /> Link
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: isMobile ? '15px 20px' : '20px 30px',
                    background: '#f8fafc',
                    borderTop: '1px solid #eee',
                    textAlign: isMobile ? 'center' : 'right'
                }}>
                    <button onClick={onClose} style={{
                        width: isMobile ? '100%' : 'auto',
                        padding: '12px 25px', borderRadius: '12px', border: 'none',
                        background: '#334155', color: '#fff', fontWeight: '700', cursor: 'pointer'
                    }}>
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
};
