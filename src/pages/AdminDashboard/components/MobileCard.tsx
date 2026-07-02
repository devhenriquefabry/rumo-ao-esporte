import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { Student, Turma } from '../types';

interface MobileCardProps {
    item: Student;
    turmas: Turma[];
    onNavigate: (regId: string) => void;
    onResendApproval: (item: Student) => void;
    filterStatus?: string;
    selectionEnabled?: boolean;
    selected?: boolean;
    onToggleSelection?: (regId: string) => void;
}

export const MobileCard: React.FC<MobileCardProps> = ({
    item,
    turmas,
    onNavigate,
    onResendApproval,
    filterStatus,
    selectionEnabled = false,
    selected = false,
    onToggleSelection
}) => {
    const student = item.aluno;
    const turma = turmas.find(t => t.id === student?.turmaId);
    const isDesativados = filterStatus === 'desativados';

    return (
        <div style={{ background: selected ? '#e9f8ef' : '#fff', borderRadius: '6px', padding: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: selected ? '1px solid #007d2f' : '1px solid #eee' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                {selectionEnabled && (
                    <label style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', paddingTop: '10px' }}>
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleSelection?.(item.regId)}
                            aria-label={`Selecionar cadastro de ${student?.nome || 'aluno'}`}
                            style={{ width: '18px', height: '18px', accentColor: '#007d2f' }}
                        />
                    </label>
                )}
                {student?.fotoUrl ? <img src={student.fotoUrl} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', background: '#f8f9fa' }} />}
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{student?.nome || 'Sem Aluno'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>Resp: {item.responsavel?.nome || '-'}</div>
                    <div style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', background: '#f8f9fa', color: '#007d2f', border: '1px solid #eee', marginTop: '6px', display: 'inline-block' }}>
                        {turma?.nome || item.modalidade || 'N/A'}
                    </div>
                </div>

                {!isDesativados && (
                    <div style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '900', background: item.financialPendingAmount > 0 ? '#fff5f5' : '#f0fdf4', color: item.financialPendingAmount > 0 ? '#c53030' : '#15803d', border: `1px solid ${item.financialPendingAmount > 0 ? '#feb2b2' : '#bbf7d0'}` }}>
                        {item.financialPendingAmount > 0 ? 'PENDENTE' : 'EM DIA'}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                <button onClick={() => onNavigate(item.regId)} style={{ padding: '6px', background: '#fff', color: '#007d2f', border: '1px solid #007d2f', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Detalhes</button>
                {item.responsavel?.telefonePrincipal ? (
                    <a href={`https://wa.me/55${item.responsavel.telefonePrincipal.replace(/\D/g, '')}`} target="_blank" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: '#25D366', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none' }}>WhatsApp</a>
                ) : <div style={{ color: '#ccc', fontSize: '0.75rem', background: '#f9f9f9', borderRadius: '4px', border: '1px dashed #ddd', textAlign: 'center' }}>Sem Telefone</div>}
            </div>
            {
                item.contractStatus === 'aprovado' && (
                    <button onClick={() => onResendApproval(item)} style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#f8f9fa', color: '#007d2f', border: '1px solid #eee', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <MessageCircle size={14} /> Reenviar Aprovação
                    </button>
                )
            }
        </div >
    );
};
