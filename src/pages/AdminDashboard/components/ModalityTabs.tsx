import React from 'react';
import { MODALIDADES } from '../constants';
import type { Student } from '../types';

interface ModalityTabsProps {
    activeModality: string | null;
    allStudents: Student[];
    filterStatus?: string;
    onModalityClick: (mod: string) => void;
}

const MODALITY_COLORS: Record<string, string> = {
    futebol: '#007d2f',
    desativados: '#607d8b'
};

export const ModalityTabs: React.FC<ModalityTabsProps> = ({ activeModality, allStudents, filterStatus, onModalityClick }) => {
    const modalitiesWithAll = ['TODOS', ...MODALIDADES];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
            marginTop: '12px',
            marginBottom: '8px'
        }}>
            {modalitiesWithAll.map(mod => {
                const isAll = mod === 'TODOS';
                const isActive = isAll ? activeModality === null : activeModality === mod;
                const color = isAll ? '#334155' : (MODALITY_COLORS[mod] || '#666');

                const count = allStudents.filter(s => {
                    const isArchived = s.contractStatus === 'desativado' || s.status === 'desativado';

                    // Filter logic based on the page (filterStatus)
                    if (filterStatus === 'desativados') {
                        if (!isArchived) return false;
                        if (isAll) return true;
                        return s.modalidade?.toLowerCase() === mod.toLowerCase();
                    } else {
                        if (isArchived) return false;
                        const matchesMod = isAll ? true : s.modalidade?.toLowerCase() === mod.toLowerCase();
                        if (!matchesMod) return false;
                        return filterStatus === 'pendente' ? s.contractStatus !== 'aprovado' : s.contractStatus === 'aprovado';
                    }
                }).length;

                return (
                    <button
                        key={mod}
                        onClick={() => onModalityClick(isAll ? '' : mod)}
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
                            lineHeight: '1.2'
                        }}>
                            {mod}
                        </div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: '800',
                            opacity: isActive ? 1 : 0.7
                        }}>
                            {count}
                        </div>
                    </button>
                );
            })}
        </div >
    );
};
