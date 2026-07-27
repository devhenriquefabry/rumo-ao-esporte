import React from 'react';
import PageTitle from '../../../components/PageTitle';
import { Download, Trash2, CheckCircle2 } from 'lucide-react';
import type { AdminDashboardProps } from '../types';

interface HeaderProps extends AdminDashboardProps {
    isMobile: boolean;
    filteredCount: number;
    onExportClick: () => void;
    selectedCount?: number;
    selectionEnabled?: boolean;
    deletingSelected?: boolean;
    onDeleteSelected?: () => void;
    onApproveSelected?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    filterStatus,
    isMobile,
    filteredCount,
    onExportClick,
    selectedCount = 0,
    selectionEnabled = false,
    deletingSelected = false,
    onDeleteSelected,
    onApproveSelected
}) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '12px' }}>
            <PageTitle
                title={filterStatus === 'pendente' ? "Validar Contratos" : filterStatus === 'desativados' ? "Alunos Desativados" : "Alunos Cadastrados"}
                count={filteredCount}
                subtitle={isMobile ? "" : (filterStatus === 'pendente' ? "Aguardando verificação" : filterStatus === 'desativados' ? "Histórico de alunos inativos" : "Listagem de alunos com contrato aprovado")}
            />

            {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectionEnabled && selectedCount > 0 && (
                        <button
                            onClick={onApproveSelected}
                            className="touch-feedback"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                background: '#00a63a',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontWeight: '800',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            <CheckCircle2 size={14} /> {`APROVAR (${selectedCount})`}
                        </button>
                    )}
                    {selectionEnabled && selectedCount > 0 && (
                        <button
                            onClick={onDeleteSelected}
                            disabled={deletingSelected}
                            className="touch-feedback"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                background: deletingSelected ? '#9ca3af' : '#dc2626',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontWeight: '800',
                                fontSize: '0.8rem',
                                cursor: deletingSelected ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <Trash2 size={14} /> {deletingSelected ? 'EXCLUINDO...' : `EXCLUIR (${selectedCount})`}
                        </button>
                    )}
                    <button
                        onClick={onExportClick}
                        className="touch-feedback"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 14px',
                            background: '#00a63a',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        <Download size={14} /> EXPORTAR
                    </button>
                </div>
            )}
        </div>
    );
};
