import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import { Header } from './components/Header';
import { SearchArea } from './components/SearchArea';
import { ModalityTabs } from './components/ModalityTabs';
import { ListView } from './components/ListView';
import { ExportModal } from './components/ExportModal';
import { BulkApproveModal } from './components/BulkApproveModal';
import { MobileFooter } from './components/MobileFooter';
import { useAdminDashboard } from './hooks/useAdminDashboard';
import { useMessaging } from './hooks/useMessaging';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import { findOrCreateTurma } from '../../utils/turmaService';
import {
    DEFAULT_PAYMENT_PROVIDER_CONFIG,
    getPaymentProviderConfig,
    withPaymentProviderPayload,
    withPaymentProviderQuery
} from '../../utils/paymentProviderConfig';
import type { AdminDashboardProps } from './types';

export default function AdminDashboard({ filterStatus }: AdminDashboardProps) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
    const [bulkApproving, setBulkApproving] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    const {
        allStudents, turmas, plans, loading, activeModality, searchTerm, setSearchTerm,
        sortBy, setSortBy, isExportModalOpen, setIsExportModalOpen, selectedColumns, isMobile, filteredStudents,
        handleModalityClick, handleGeneratePDF, toggleColumn, removeRegistrationIds, patchRegistrations
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

    const handleBulkApprove = async (planId: string, paymentDay: number, gerarCobranca: boolean) => {
        const idsToApprove = selectedIds.filter(id => uniqueFilteredRegistrationIds.includes(id));
        if (idsToApprove.length === 0 || !planId) return;

        setBulkApproving(true);
        setBulkProgress({ current: 0, total: idsToApprove.length });

        let paymentConfig = DEFAULT_PAYMENT_PROVIDER_CONFIG;
        if (gerarCobranca) {
            try {
                paymentConfig = await getPaymentProviderConfig();
            } catch (e) {
                console.error('Erro ao carregar config de pagamento:', e);
            }
        }

        const selectedPlan = plans.find(p => p.id === planId);
        const mensalidadeZero = (selectedPlan?.valores?.mensalidade?.ateVencimento || 0) === 0;
        const patches: Record<string, { contractStatus: string; planId: string; turmaId: string }> = {};
        const falhas: string[] = [];

        for (let i = 0; i < idsToApprove.length; i++) {
            const regId = idsToApprove[i];
            const student = allStudents.find(s => s.regId === regId);
            try {
                const turmaId = await findOrCreateTurma(student?.modalidade || '', student?.aluno?.dataNascimento || '');

                // IMPORTANTE: nunca usar dot-notation em indice de array (ex: 'alunos.0.turmaId').
                // O Firestore converte o array em mapa e descarta os demais campos do aluno.
                // Lemos o array atual, atualizamos e gravamos o array inteiro.
                const regRef = doc(db, 'rumo_ao_esporte_2026_registrations', regId);
                const regSnap = await getDoc(regRef);
                const regData: any = regSnap.data() || {};
                const rawAlunos = regData.alunos;
                const alunosArray = Array.isArray(rawAlunos)
                    ? [...rawAlunos]
                    : (rawAlunos && typeof rawAlunos === 'object'
                        ? Object.keys(rawAlunos).sort((a, b) => Number(a) - Number(b)).map(k => rawAlunos[k])
                        : []);
                if (alunosArray.length === 0) {
                    alunosArray.push({ ...(student?.aluno || {}) });
                }
                alunosArray[0] = { ...alunosArray[0], turmaId: turmaId || null };

                await updateDoc(regRef, {
                    contractStatus: 'aprovado',
                    planId,
                    paymentDay,
                    turmaId: turmaId || null,
                    approvedAt: new Date().toISOString(),
                    alunos: alunosArray
                });

                if (gerarCobranca && selectedPlan && workerUrl && !mensalidadeZero) {
                    try {
                        const carnetPayload = withPaymentProviderPayload({
                            registrationId: regId,
                            responsibleName: student?.responsavel?.nome || '',
                            responsibleCpf: student?.responsavel?.cpf || '',
                            responsibleEmail: student?.responsavel?.email || '',
                            responsiblePhone: student?.responsavel?.telefonePrincipal || student?.responsavel?.celular || '',
                            childName: student?.aluno?.nome || '',
                            modalidade: student?.modalidade || '',
                            matriculaValue: selectedPlan.valores?.matricula || 0,
                            mensalidadeValue: selectedPlan.valores?.mensalidade?.aposVencimento || 0,
                            descontoAntecipado: (selectedPlan.valores?.mensalidade?.aposVencimento || 0) - (selectedPlan.valores?.mensalidade?.ateVencimento || 0),
                            paymentDay,
                            jurosMensais: selectedPlan.jurosMensais || 0,
                            multa: selectedPlan.multa || 0
                        }, paymentConfig);

                        await fetch(`${workerUrl}${withPaymentProviderQuery('/generate-carnet', paymentConfig)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(carnetPayload)
                        });
                    } catch (carnetError) {
                        console.error('Erro ao gerar carnê para', regId, carnetError);
                    }
                }

                patches[regId] = { contractStatus: 'aprovado', planId, turmaId };
            } catch (error) {
                console.error('Erro ao aprovar cadastro', regId, error);
                falhas.push(student?.aluno?.nome || regId);
            } finally {
                setBulkProgress({ current: i + 1, total: idsToApprove.length });
            }
        }

        patchRegistrations(patches);
        setSelectedIds(prev => prev.filter(id => !idsToApprove.includes(id)));
        setBulkApproving(false);
        setShowBulkApproveModal(false);

        const aprovados = idsToApprove.length - falhas.length;
        if (falhas.length > 0) {
            showAlert(`${aprovados} de ${idsToApprove.length} aprovado(s). Falha em: ${falhas.join(', ')}`, 'error');
        } else {
            showAlert(`${aprovados} cadastro(s) aprovado(s) com sucesso!`, 'success');
        }
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
                    onApproveSelected={() => setShowBulkApproveModal(true)}
                />
                <SearchArea isMobile={isMobile} searchTerm={searchTerm} onSearchChange={setSearchTerm} sortBy={sortBy} onSortChange={setSortBy} />
                {isMobile && isSelectionEnabled && selectedIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setShowBulkApproveModal(true)}
                            style={{
                                flex: 1,
                                padding: '11px',
                                border: 'none',
                                borderRadius: '4px',
                                background: '#00a63a',
                                color: '#fff',
                                fontWeight: 900,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            {`APROVAR (${selectedIds.length})`}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteSelected}
                            disabled={deletingSelected}
                            style={{
                                flex: 1,
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
                            {deletingSelected ? 'EXCLUINDO...' : `EXCLUIR (${selectedIds.length})`}
                        </button>
                    </div>
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

            <BulkApproveModal
                isOpen={showBulkApproveModal}
                onClose={() => setShowBulkApproveModal(false)}
                selectedCount={selectedIds.filter(id => uniqueFilteredRegistrationIds.includes(id)).length}
                plans={plans}
                isProcessing={bulkApproving}
                progress={bulkProgress}
                onConfirm={handleBulkApprove}
            />
        </div>
    );
}
