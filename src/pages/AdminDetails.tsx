import { useState } from 'react';
import StudentDetailsSection from '../components/StudentDetailsSection';
import ResponsibleDetailsSection from '../components/ResponsibleDetailsSection';
import FinancialHistorySection from '../components/FinancialHistorySection';
import StudentCredentialsSection from '../components/admin/StudentCredentialsSection';
import ApprovalModal from '../components/admin/ApprovalModal';
import TransferModal from '../components/admin/TransferModal';
import AddModalityModal from '../components/admin/AddModalityModal';
import DeleteOverlay from '../components/admin/DeleteOverlay';
import AdminActionButtons from '../components/admin/AdminActionButtons';
import { useAdminDetails } from '../hooks/useAdminDetails';
import { AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react';
import '../App.css';
import { useAdminPermissions } from '../hooks/useAdminPermissions';

export default function AdminDetails() {
    const { canEdit } = useAdminPermissions();
    const [activeTab, setActiveTab] = useState<'overview' | 'galerie'>('overview');

    const {
        data, setData,
        loading,
        isEditing, setIsEditing,
        deleteProgress, showDeleteOverlay, setShowDeleteOverlay, deleteStatus, handleDelete,
        turmas, availableTurmas,
        showTransferModal, setShowTransferModal, selectedTurmaId, setSelectedTurmaId, isTransferring, handleTransfer, openTransferModal,
        showApprovalModal, setShowApprovalModal, showSuccessModal, setShowSuccessModal, plans, approvalConfig, setApprovalConfig, isProcessingApproval,
        confirmApprove, handleApprove, handleSendWhatsApp,
        showAddModalityModal, setShowAddModalityModal, isCreatingModality, handleAddModality,
        handleRemoveModality,
        handleDeactivate,
        handleReactivate,
        generateCard,
        workerUrl,
        allRegistrations,
        saveNow
    } = useAdminDetails();

    // Enforce Read-Only at higher level
    // If canEdit is false, isEditing MUST be false for UI rendering.
    const safeIsEditing = canEdit && isEditing;

    if (loading) return <div className="loading-container">Carregando detalhes...</div>;
    if (!data) return <div className="error-container">Nada encontrado.</div>;

    const assignedTurma = (data?.alunos && data.alunos[0].turmaId)
        ? turmas.find(t => t.id === data.alunos[0].turmaId)
        : null;

    return (
        <div className="admin-details-page page-enter" style={{ width: '100%', padding: '0 5px', boxSizing: 'border-box', paddingBottom: '150px' }}>
            <style>{`
                @media (max-width: 1024px) {
                    .admin-details-page { padding: 0 5px !important; }
                    .admin-details-grid { gap: 8px !important; }
                }
            `}</style>
            {/* Delete Progress Overlay */}
            <DeleteOverlay
                show={showDeleteOverlay}
                status={deleteStatus}
                progress={deleteProgress}
                onCancel={() => setShowDeleteOverlay(false)}
                onConfirm={handleDelete}
            />

            {/* Remanejar Modal */}
            <TransferModal
                show={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onConfirm={handleTransfer}
                isTransferring={isTransferring}
                data={data}
                assignedTurma={assignedTurma}
                availableTurmas={availableTurmas}
                selectedTurmaId={selectedTurmaId}
                setSelectedTurmaId={setSelectedTurmaId}
            />

            {/* Add Modality Modal */}
            <AddModalityModal
                show={showAddModalityModal}
                onClose={() => setShowAddModalityModal(false)}
                onConfirm={handleAddModality}
                isProcessing={isCreatingModality}
                currentModalities={[data.modalidade]}
                turmas={turmas}
                plans={plans}
            />


            {/* Config Approval Modal */}
            <ApprovalModal
                show={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                onConfirm={confirmApprove}
                isProcessing={isProcessingApproval}
                approvalConfig={approvalConfig}
                setApprovalConfig={setApprovalConfig}
                turmas={turmas}
                plans={plans}
                data={data}
            />

            {/* Success Modal */}
            {showSuccessModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '20px'
                }}>
                    <div className="animate-scale-in" style={{
                        background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '16px', padding: '30px',
                        textAlign: 'center', position: 'relative'
                    }}>
                        <div style={{
                            width: '70px', height: '70px', background: '#d1e7dd', color: '#198754',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px auto'
                        }}>
                            <CheckCircle size={40} />
                        </div>
                        <h2 style={{ color: '#198754', margin: '0 0 10px 0' }}>Cadastro Aprovado!</h2>
                        <p style={{ color: '#666', marginBottom: '25px', lineHeight: '1.5' }}>
                            O aluno foi oficializado no sistema.<br />
                        </p>

                        <button
                            onClick={handleSendWhatsApp}
                            style={{
                                width: '100%',
                                background: '#25D366',
                                color: '#fff',
                                border: 'none',
                                padding: '14px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                marginBottom: '15px',
                                boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)'
                            }}
                        >
                            <MessageCircle size={22} />
                            ENVIAR CONFIRMAÇÃO (WHATSAPP)
                        </button>

                        <button
                            onClick={() => { setShowSuccessModal(false); window.location.href = '/admin/dashboard'; }}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                color: '#666',
                                border: '1px solid #ddd',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Fechar e Voltar ao Painel
                        </button>
                    </div>
                </div>
            )}

            {/* APPROVAL BANNER - Simplified Alert */}
            {data.contractStatus !== 'aprovado' && data.contractStatus !== 'desativado' && (
                <div className="approval-banner" style={{
                    background: '#fff3cd',
                    borderLeft: '4px solid #ffc107',
                    color: '#856404',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <div style={{ color: '#ffc107', display: 'flex' }}>
                        <AlertTriangle />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                        CADASTRO PENDENTE: As carteirinhas só estarão disponíveis após a aprovação deste registro.
                    </span>
                </div>
            )}
            <div className="admin-details-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'stretch' }}>
                {
                    Array.isArray(data.alunos) && data.alunos.map((aluno: any, index: number) => (
                        <StudentDetailsSection
                            key={index}
                            aluno={aluno}
                            index={index}
                            data={data}
                            setData={setData}
                            turmas={turmas}
                            generateStudentCardPDF={(s: any) => generateCard(s)}
                            navigate={(path: string) => window.location.href = path}
                            isEditing={safeIsEditing}
                            canEdit={canEdit} // Pass permission
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            onTransfer={openTransferModal}
                            allRegistrations={allRegistrations}
                            onRemoveModality={handleRemoveModality}
                        />
                    ))
                }

                {activeTab === 'overview' && (
                    <>
                        <ResponsibleDetailsSection data={data} setData={setData} isEditing={safeIsEditing} />

                        {/* Main Financial Section for CURRENT modality */}
                        {data.responsavel?.cpf && (
                            <FinancialHistorySection
                                id={data.id}
                                cpf={data.responsavel.cpf}
                                workerUrl={workerUrl}
                                plans={plans}
                                currentPlanId={data.planId}
                                contractStatus={data.contractStatus}
                                onAddModality={() => setShowAddModalityModal(true)}
                                allRegistrations={allRegistrations}
                                canEdit={canEdit}
                                filterModality={data.modalidade} // Strict filtering for this block
                            />
                        )}

                        {/* Sibling Registrations (Other Modalities) */}
                        {allRegistrations.filter(r => r.id !== data.id).map(reg => (
                            <div key={reg.id} style={{
                                marginTop: '10px',
                                padding: '15px',
                                background: '#f8f9fa',
                                borderRadius: '12px',
                                border: '1px dashed #00a63a',
                                opacity: 0.95
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00a63a' }}></div>
                                        <h4 style={{ margin: 0, color: '#333', textTransform: 'uppercase' }}>
                                            {reg.alunos?.[0]?.nome ? `${reg.alunos[0].nome} - ` : ''}{reg.modalidade}
                                        </h4>
                                    </div>
                                    <button
                                        onClick={() => window.location.href = `/admin/details/${reg.id}`}
                                        style={{
                                            background: '#fff', color: '#00a63a', border: '1px solid #00a63a',
                                            padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        VER PERFIL COMPLETO
                                    </button>
                                </div>

                                <FinancialHistorySection
                                    id={reg.id}
                                    cpf={data.responsavel.cpf}
                                    workerUrl={workerUrl}
                                    plans={plans}
                                    currentPlanId={reg.planId}
                                    contractStatus={reg.contractStatus}
                                    allRegistrations={allRegistrations}
                                    canEdit={canEdit}
                                    filterModality={reg.modalidade}
                                />
                            </div>
                        ))}

                        <StudentCredentialsSection data={data} setData={setData} />
                    </>
                )}
            </div>

            {/* Fixed Bottom Action Bar */}
            <AdminActionButtons
                contractStatus={data.contractStatus}
                isEditing={safeIsEditing}
                onToggleEdit={() => {
                    if (!canEdit) return;
                    if (isEditing) {
                        saveNow(); // Manually save when exiting edit mode
                        setIsEditing(false);
                    } else {
                        setIsEditing(true);
                    }
                }}
                onApprove={handleApprove}
                onDelete={handleDelete}
                onDeactivate={handleDeactivate}
                onReactivate={handleReactivate}
                canEdit={canEdit}
            />
        </div>
    );
}
