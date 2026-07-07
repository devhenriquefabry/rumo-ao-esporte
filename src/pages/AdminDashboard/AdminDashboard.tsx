import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { Header } from './components/Header';
import { SearchArea } from './components/SearchArea';
import { ModalityTabs } from './components/ModalityTabs';
import { ListView } from './components/ListView';
import { ExportModal } from './components/ExportModal';
import { MobileFooter } from './components/MobileFooter';
import { useAdminDashboard } from './hooks/useAdminDashboard';
import { useMessaging } from './hooks/useMessaging';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import type { AdminDashboardProps } from './types';

export default function AdminDashboard({ filterStatus }: AdminDashboardProps) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const {
        allStudents, turmas, plans, loading, activeModality, searchTerm, setSearchTerm,
        sortBy, setSortBy, isExportModalOpen, setIsExportModalOpen, selectedColumns, isMobile, filteredStudents,
        handleModalityClick, handleGeneratePDF, toggleColumn, removeRegistrationIds
    } = useAdminDashboard(filterStatus);

    const { handleResendApproval } = useMessaging(turmas);
    const uniqueFilteredRegistrationIds = useMemo(
        () => Array.from(new Set(filteredStudents.map(student => student.regId).filter(Boolean))),
        [filteredStudents]
    );
    const isSelectionEnabled = filterStatus === 'pendente';

    const toggleSelection = (regId: string) => {
        setSelectedIds(prev => prev.includes(regId) ? prev.filter(id => id !== regId) : [...prev, regId]);
    };

    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const visibleSet = new Set(uniqueFilteredRegistrationIds);
            const allVisibleSelected = uniqueFilteredRegistrationIds.length > 0 && uniqueFilteredRegistrationIds.every(id => prev.includes(id));
            if (allVisibleSelected) return prev.filter(id => !visibleSet.has(id));
            return Array.from(new Set([...prev, ...uniqueFilteredRegistrationIds]));
        });
    };

    const handleDeleteSelected = () => {
        const idsToDelete = selectedIds.filter(id => uniqueFilteredRegistrationIds.includes(id));
        if (idsToDelete.length === 0) return;

        showConfirm(
            `Excluir ${idsToDelete.length} cadastro${idsToDelete.length > 1 ? 's' : ''} selecionado${idsToDelete.length > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    setDeletingSelected(true);
                    const batch = writeBatch(db);
                    idsToDelete.forEach(id => {
                        batch.delete(doc(db, 'rumo_ao_esporte_2026_registrations', id));
                    });
                    await batch.commit();
                    removeRegistrationIds(idsToDelete);
                    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
                    showAlert('Cadastros excluídos com sucesso.', 'success');
                } catch (error) {
                    console.error('Erro ao excluir cadastros em lote:', error);
                    showAlert('Erro ao excluir os cadastros selecionados.', 'error');
                } finally {
                    setDeletingSelected(false);
                }
            },
            'error',
            'Excluir em lote'
        );
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fcfcfc', overflow: 'hidden' }}>
            <div style={{ padding: isMobile ? '10px 15px' : '15px 25px 5px 25px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
                <Header
                    filterStatus={filterStatus}
                    isMobile={isMobile}
                    filteredCount={filteredStudents.length}
                    onExportClick={() => setIsExportModalOpen(true)}
                    selectedCount={selectedIds.length}
                    selectionEnabled={isSelectionEnabled}
                    deletingSelected={deletingSelected}
                    onDeleteSelected={handleDeleteSelected}
                />
                <SearchArea isMobile={isMobile} searchTerm={searchTerm} onSearchChange={setSearchTerm} sortBy={sortBy} onSortChange={setSortBy} />
                {isMobile && isSelectionEnabled && selectedIds.length > 0 && (
                    <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={deletingSelected}
                        style={{
                            width: '100%',
                            marginTop: '8px',
                            padding: '11px',
                            border: 'none',
                            borderRadius: '4px',
                            background: deletingSelected ? '#9ca3af' : '#dc2626',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: '0.82rem',
                            cursor: deletingSelected ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {deletingSelected ? 'EXCLUINDO...' : `EXCLUIR SELECIONADOS (${selectedIds.length})`}
                    </button>
                )}
                {!isMobile && <ModalityTabs activeModality={activeModality} allStudents={allStudents} filterStatus={filterStatus} onModalityClick={handleModalityClick} />}
            </div>  

            <ListView
                students={filteredStudents}
                isMobile={isMobile}
                loading={loading}
                turmas={turmas}
                plans={plans}
                onNavigate={(id) => navigate(`/admin/details/${id}`)}
                onResendApproval={handleResendApproval}
                filterStatus={filterStatus}
                selectionEnabled={isSelectionEnabled}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                onToggleSelectAll={toggleSelectAll}
                allVisibleSelected={uniqueFilteredRegistrationIds.length > 0 && uniqueFilteredRegistrationIds.every(id => selectedIds.includes(id))}
            />

            {isMobile && <MobileFooter activeModality={activeModality} allStudents={allStudents} filterStatus={filterStatus} onModalityClick={handleModalityClick} onExportClick={() => setIsExportModalOpen(true)} />}

            <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} activeModality={activeModality} selectedColumns={selectedColumns} onColumnToggle={toggleColumn} onGenerate={(pdfSortBy) => handleGeneratePDF(pdfSortBy)} currentSortBy={sortBy} />
        </div>
    );
}
