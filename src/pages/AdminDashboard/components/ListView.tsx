import React, { useState } from 'react';
import { DesktopTable } from './DesktopTable';
import { MobileCard } from './MobileCard';
import type { Student, Turma } from '../types';
import type { Plan } from '../../../utils/planService';

interface ListViewProps {
    students: Student[];
    isMobile: boolean;
    loading: boolean;
    turmas: Turma[];
    plans: Plan[];
    onNavigate: (regId: string) => void;
    onResendApproval: (item: Student) => void;
    activeModality: string | null;
    filterStatus?: string;
    selectionEnabled?: boolean;
    selectedIds?: string[];
    onToggleSelection?: (regId: string) => void;
    onToggleSelectAll?: () => void;
    allVisibleSelected?: boolean;
}

export const ListView: React.FC<ListViewProps> = ({
    students,
    isMobile,
    loading,
    turmas,
    plans,
    onNavigate,
    onResendApproval,
    activeModality,
    filterStatus,
    selectionEnabled = false,
    selectedIds = [],
    onToggleSelection,
    onToggleSelectAll,
    allVisibleSelected = false
}) => {
    const [visibleCount, setVisibleCount] = useState(20);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && visibleCount < students.length) {
            setVisibleCount(prev => prev + 20);
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '200px', alignItems: 'center' }}><div className="spin" style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #007d2f', borderRadius: '50%' }}></div></div>;

    if (!activeModality && filterStatus !== 'desativados') return <div style={{ padding: '40px', textAlign: 'center' }}><img src="/logo-dashboard.png" style={{ maxWidth: '500px', width: '80%', opacity: 0.2 }} /></div>;

    if (students.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nenhum registro encontrado.</div>;

    return (
        <div onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px' : '0 25px 20px 25px', WebkitOverflowScrolling: 'touch' }}>
            {!isMobile && selectionEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderBottom: 'none', color: '#007d2f', fontWeight: 800 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={onToggleSelectAll}
                            style={{ width: '16px', height: '16px', accentColor: '#007d2f' }}
                        />
                        Selecionar todos os cadastros filtrados
                    </label>
                    <span>{selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}</span>
                </div>
            )}
            {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '140px' }}>
                    {selectionEnabled && (
                        <button
                            type="button"
                            onClick={onToggleSelectAll}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                background: allVisibleSelected ? '#e9f8ef' : '#fff',
                                color: '#007d2f',
                                fontWeight: 800,
                                borderRadius: '4px'
                            }}
                        >
                            {allVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                    )}
                    {students.slice(0, visibleCount).map(item => (
                        <MobileCard
                            key={item.uniqueId}
                            item={item}
                            turmas={turmas}
                            onNavigate={onNavigate}
                            onResendApproval={onResendApproval}
                            filterStatus={filterStatus}
                            selectionEnabled={selectionEnabled}
                            selected={selectedIds.includes(item.regId)}
                            onToggleSelection={onToggleSelection}
                        />
                    ))}
                </div>
            ) : (
                <DesktopTable
                    students={students.slice(0, visibleCount)}
                    turmas={turmas}
                    plans={plans}
                    onNavigate={onNavigate}
                    onResendApproval={onResendApproval}
                    filterStatus={filterStatus}
                    selectionEnabled={selectionEnabled}
                    selectedIds={selectedIds}
                    onToggleSelection={onToggleSelection}
                    onToggleSelectAll={onToggleSelectAll}
                    allVisibleSelected={allVisibleSelected}
                />
            )}
        </div>
    );
};
