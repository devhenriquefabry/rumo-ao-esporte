import React from 'react';
import { Users, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StudentData } from '../../utils/financialTypes';
import { StatusBadge } from './StatusBadge';
import type { Plan } from '../../utils/planService';

interface RegistrationListProps {
    loading: boolean;
    filtered: StudentData[];
    visibleCount: number;
    onSelect: (reg: StudentData) => void;
    plans: Plan[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: (ids: string[]) => void;
    readOnly?: boolean;
}

export const RegistrationList: React.FC<RegistrationListProps> = ({
    loading,
    filtered,
    visibleCount,
    onSelect,
    plans,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    readOnly
}) => {
    const navigate = useNavigate();

    const currentlyVisibleIds = filtered.slice(0, visibleCount).map(r => r.id);
    const isAllVisibleSelected = currentlyVisibleIds.length > 0 && currentlyVisibleIds.every(id => selectedIds.includes(id));

    return (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                    <tr>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {!readOnly && (
                                    <input
                                        type="checkbox"
                                        checked={isAllVisibleSelected}
                                        onChange={() => onToggleSelectAll(currentlyVisibleIds)}
                                        style={{
                                            transform: 'scale(1.2)',
                                            cursor: 'pointer',
                                            display: 'block !important',
                                            WebkitAppearance: 'checkbox',
                                            appearance: 'checkbox'
                                        }}
                                    />
                                )}
                                Aluno / Responsável
                            </div>
                        </th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>Modalidade</th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>Plano</th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>Situação</th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>Pendência</th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600' }}>Valor</th>
                        <th style={{ padding: '15px 20px', color: '#666', fontWeight: '600', textAlign: 'right' }}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Carregando faturas...</td></tr>
                    ) : filtered.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Nenhum registro encontrado.</td></tr>
                    ) : filtered.slice(0, visibleCount).map(r => (
                        <tr key={r.id} style={{
                            borderBottom: '1px solid #f0f0f0',
                            background: selectedIds.includes(r.id) ? '#fff9f0' : 'transparent',
                            transition: 'background 0.2s'
                        }}>
                            <td style={{ padding: '15px 20px', minWidth: '320px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {!readOnly && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(r.id)}
                                            onChange={() => onToggleSelect(r.id)}
                                            style={{
                                                transform: 'scale(1.5)',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                                marginRight: '10px',
                                                accentColor: '#007d2f',
                                                zIndex: 2,
                                                display: 'block !important',
                                                WebkitAppearance: 'checkbox',
                                                appearance: 'checkbox'
                                            }}
                                        />
                                    )}

                                    {/* Student Photo */}
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: '#f0f0f0',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid #f0f0f0'
                                    }}>
                                        {r.alunos[0]?.fotoUrl ? (
                                            <img src={r.alunos[0].fotoUrl} alt={r.alunos[0].nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Users size={20} color="#ccc" />
                                        )}
                                    </div>

                                    <div>
                                        <div
                                            onClick={() => navigate(`/admin/details/${r.id}`)}
                                            style={{
                                                fontWeight: '800',
                                                color: '#007d2f',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px'
                                            }}
                                        >
                                            {r.alunos[0]?.nome || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' }}>
                                            Resp: {r.responsavel.nome.toUpperCase().split(' ')[0]}... ({r.responsavel.cpf})
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td style={{ padding: '15px 20px', whiteSpace: 'nowrap' }}>
                                <span style={{ textTransform: 'capitalize' }}>{r.modalidade}</span>
                            </td>
                            <td style={{ padding: '15px 20px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#555' }}>
                                    {plans.find(p => p.id === r.planId)?.nome || '-'}
                                </span>
                            </td>
                            <td style={{ padding: '15px 20px', whiteSpace: 'nowrap' }}>
                                <StatusBadge status={r.status} />
                            </td>
                            <td style={{ padding: '15px 20px', maxWidth: '250px' }}>
                                {/* PENDÊNCIA / DESCRIÇÃO */}
                                <div style={{
                                    color: r.status === 'atrasado' ? '#c62828' : '#666',
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }} title={r.financialPendingDescription}>
                                    {r.financialPendingDescription !== undefined
                                        ? (r.financialPendingDescription || 'NENHUMA PENDÊNCIA')
                                        : <span style={{ color: '#aaa', fontStyle: 'italic' }}>Calculando...</span>
                                    }
                                </div>
                            </td>
                            <td style={{ padding: '15px 20px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* VALOR + ÍCONE DE FATURA */}
                                <div style={{ minWidth: '80px' }}>
                                    {['pago', 'confirmed', 'received', 'received_in_cash', 'done'].includes(r.status?.toLowerCase())
                                        ? (r.financialLastPaymentValue !== undefined
                                            ? (r.financialLastPaymentValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                            : (r.financialReceivedAmount !== undefined
                                                ? (r.financialReceivedAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : <span style={{ color: '#aaa' }}>R$ 0,00</span>
                                            )
                                        )
                                        : (r.financialPendingAmount !== undefined
                                            ? (r.financialPendingAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                            : <span style={{ color: '#aaa' }}>...</span>
                                        )
                                    }
                                </div>

                                {r.financialInvoiceUrl && (
                                    <a
                                        href={r.financialInvoiceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Ver Fatura"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: '#fff3e0',
                                            color: '#e65100',
                                            border: '1px solid #ffe0b2',
                                            transition: 'transform 0.2s',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FileText size={16} />
                                    </a>
                                )}
                            </td>
                            <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                                <button
                                    onClick={() => onSelect(r)}
                                    style={{
                                        background: readOnly ? '#f0f0f0' : '#f5f5f5',
                                        border: 'none',
                                        padding: '8px 15px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        color: readOnly ? '#666' : '#007d2f',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    {readOnly ? 'Visualizar' : 'Gerenciar'} <ChevronRight size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
