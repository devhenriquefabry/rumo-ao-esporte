import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StudentData } from '../../utils/financialTypes';
import { StatusBadge } from './StatusBadge';

interface RegistrationCardProps {
    registration: StudentData;
    onSelect: (reg: StudentData) => void;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    readOnly?: boolean;
}

export const RegistrationCard: React.FC<RegistrationCardProps> = ({ registration, onSelect, isSelected, onToggleSelect, readOnly }) => {
    const navigate = useNavigate();
    const r = registration;

    return (
        <div style={{
            background: isSelected ? '#fff9f0' : '#fff',
            padding: '20px',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            borderLeft: '4px solid #00a63a',
            transition: 'background 0.2s'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {!readOnly && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(r.id)}
                            style={{
                                transform: 'scale(1.5)',
                                cursor: 'pointer',
                                flexShrink: 0,
                                margin: '0 8px 0 5px',
                                accentColor: '#00a63a',
                                display: 'block !important',
                                WebkitAppearance: 'checkbox',
                                appearance: 'checkbox'
                            }}
                        />
                    )}
                    {/* Student Photo */}
                    <div style={{
                        width: '45px',
                        height: '45px',
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

                    <div style={{ flex: 1 }}>
                        <div
                            onClick={() => navigate(`/admin/details/${r.id}`)}
                            style={{
                                fontWeight: '800',
                                color: '#00a63a',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textTransform: 'uppercase',
                                fontSize: '1rem',
                                lineHeight: 1.2
                            }}
                        >
                            {r.alunos[0]?.nome || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                            RESP: {r.responsavel.nome.toUpperCase()}
                        </div>
                    </div>
                </div>
                <StatusBadge status={r.status} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', padding: '10px 15px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    Modalidade: <strong>{r.modalidade.toUpperCase()}</strong>
                </div>
                <div style={{ fontWeight: '900', color: '#333', fontSize: '1rem' }}>
                    {r.amount
                        ? (r.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'
                    }
                </div>
            </div>

            <button
                onClick={() => onSelect(r)}
                style={{
                    width: '100%', padding: '12px', background: readOnly ? '#f0f0f0' : '#00a63a', color: readOnly ? '#666' : '#fff',
                    border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
            >
                {readOnly ? 'VISUALIZAR' : 'GERENCIAR'} <ChevronRight size={18} />
            </button>
        </div>
    );
};
