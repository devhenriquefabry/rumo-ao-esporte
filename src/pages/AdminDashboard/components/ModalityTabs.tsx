import React from 'react';
import type { Student } from '../types';

interface ModalityTabsProps {
    activeModality: string | null;
    allStudents: Student[];
    filterStatus?: string;
    onModalityClick: (mod: string) => void;
}

export const ModalityTabs: React.FC<ModalityTabsProps> = ({ activeModality, allStudents, filterStatus, onModalityClick }) => {
    const count = allStudents.filter(s => {
        const isArchived = s.contractStatus === 'desativado' || s.status === 'desativado';

        if (filterStatus === 'desativados') {
            return isArchived;
        }

        if (isArchived) return false;
        return filterStatus === 'pendente' ? s.contractStatus !== 'aprovado' : s.contractStatus === 'aprovado';
    }).length;

    const isActive = activeModality === null;
    const color = '#00a63a';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '10px',
            marginTop: '12px',
            marginBottom: '8px'
        }}>
            <button
                onClick={() => onModalityClick('')}
                className="touch-feedback"
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: isActive ? color : '#f8f9fa',
                    border: `2px solid ${isActive ? color : '#eee'}`,
                    borderRadius: '10px',
                    color: isActive ? '#fff' : '#444',
                    cursor: 'pointer',
                    padding: '10px 16px',
                    transition: 'all 0.2s ease',
                    minHeight: '48px'
                }}
            >
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    lineHeight: '1.2',
                    letterSpacing: '0.02em'
                }}>
                    TODOS
                </div>
                <div style={{
                    fontSize: '1rem',
                    fontWeight: '800',
                    opacity: isActive ? 1 : 0.7
                }}>
                    {count}
                </div>
            </button>
        </div>
    );
};
