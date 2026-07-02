import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { Student, Turma } from '../types';
import type { Plan } from '../../../utils/planService';

interface DesktopTableProps {
    students: Student[];
    turmas: Turma[];
    plans: Plan[];
    onNavigate: (regId: string) => void;

    onResendApproval: (item: Student) => void;
    filterStatus?: string;
    selectionEnabled?: boolean;
    selectedIds?: string[];
    onToggleSelection?: (regId: string) => void;
    onToggleSelectAll?: () => void;
    allVisibleSelected?: boolean;
}

export const DesktopTable: React.FC<DesktopTableProps> = ({
    students,
    turmas,
    plans,
    onNavigate,
    onResendApproval,
    filterStatus,
    selectionEnabled = false,
    selectedIds = [],
    onToggleSelection,
    onToggleSelectAll,
    allVisibleSelected = false
}) => {
    const isDesativados = filterStatus === 'desativados';
    const columns = ['Foto', 'Aluno / Responsável', 'Nascimento', 'Plano', 'Turma', 'Pendência', 'Contato', 'Ações'];
    const displayedColumns = isDesativados ? columns.filter(c => c !== 'Pendência') : columns;

    return (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa' }}>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                        {selectionEnabled && (
                            <th style={{ width: '110px', padding: '8px 12px', textAlign: 'center', color: '#007d2f', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={onToggleSelectAll}
                                    aria-label="Selecionar todos os cadastros"
                                    style={{ width: '16px', height: '16px', accentColor: '#007d2f', cursor: 'pointer', verticalAlign: 'middle', marginRight: '6px' }}
                                />
                                Selecionar
                            </th>
                        )}
                        {displayedColumns.map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Ações' ? 'right' : (h === 'Pendência' || h === 'Contato' ? 'center' : 'left'), color: '#666', fontWeight: 'bold', fontSize: '0.75rem' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {students.map((item, index) => {
                        const turma = turmas.find(t => t.id === item.aluno?.turmaId);
                        const plan = plans.find(p => p.id === item.planId);
                        const selected = selectedIds.includes(item.regId);
                        return (
                            <tr key={item.uniqueId} style={{ borderBottom: '1px solid #eee', backgroundColor: selected ? '#e9f8ef' : (index % 2 === 0 ? '#fff' : '#fafafa') }}>
                                {selectionEnabled && (
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '5px 8px', border: '1px solid #007d2f', color: '#007d2f', background: selected ? '#d7f5e1' : '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => onToggleSelection?.(item.regId)}
                                                aria-label={`Selecionar cadastro de ${item.aluno?.nome || 'aluno'}`}
                                                style={{ width: '16px', height: '16px', accentColor: '#007d2f', cursor: 'pointer' }}
                                            />
                                            OK
                                        </label>
                                    </td>
                                )}
                                <td style={{ padding: '8px 12px' }}>{item.aluno?.fotoUrl ? <img src={item.aluno.fotoUrl} style={{ width: '35px', height: '35px', borderRadius: '4px', objectFit: 'cover' }} /> : <div style={{ width: '35px', height: '35px', background: '#f8f9fa' }} />}</td>
                                <td style={{ padding: '8px 12px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.aluno?.nome || 'Sem Aluno'}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Resp: {item.responsavel?.nome || '-'}</div>
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>{item.aluno?.dataNascimento || '-'}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>{plan?.nome || '-'}</td>
                                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', background: '#f8f9fa', color: '#007d2f', border: '1px solid #eee' }}>{turma?.nome || item.modalidade || 'N/A'}</span></td>
                                {!isDesativados && (
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <div style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800', background: item.financialPendingAmount > 0 ? '#fff5f5' : '#f8f9fa', color: item.financialPendingAmount > 0 ? '#c53030' : '#666', border: `1px solid ${item.financialPendingAmount > 0 ? '#feb2b2' : '#eee'}`, textTransform: 'uppercase' }}>
                                            {item.financialPendingAmount > 0 ? 'PENDENTE' : 'EM DIA'}
                                        </div>
                                    </td>
                                )}
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.responsavel?.telefonePrincipal ? <a href={`https://wa.me/55${item.responsavel.telefonePrincipal.replace(/\D/g, '')}`} target="_blank" style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#25D366', color: '#fff', textDecoration: 'none', fontSize: '0.65rem', fontWeight: 'bold' }}>WhatsApp</a> : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                        {item.contractStatus === 'aprovado' && <button onClick={() => onResendApproval(item)} style={{ padding: '6px', background: '#f8f9fa', color: '#007d2f', border: '1px solid #eee', borderRadius: '4px' }}><MessageCircle size={14} /></button>}
                                        <button onClick={() => onNavigate(item.regId)} style={{ padding: '5px 10px', background: '#fff', color: '#007d2f', border: '1px solid #007d2f', borderRadius: '4px', fontWeight: '600', fontSize: '0.7rem' }}>Detalhes</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
