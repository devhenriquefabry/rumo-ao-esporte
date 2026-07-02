
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import { planService } from '../utils/planService';
import { generateStudentCardPDF } from '../utils/pdfGenerator';
import { normalizeModality, calculateClass } from '../utils/turmasConstants';
import { AlertTriangle } from 'lucide-react';
import { useFinancialOperations } from '../pages/AdminFinanceiroComponents/useFinancialOperations';
import { SyncService } from '../utils/SyncService';
import { getRegistrationById, getRegistrationsFromSource } from '../utils/registrationSource';

export function useAdminDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const { setLoading: setGlobalLoading } = useLoading();
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Deletion State
    const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
    const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<'confirming' | 'fetching' | 'deleting' | 'success' | 'error'>('confirming');

    // Transfer State
    const [turmas, setTurmas] = useState<{ id: string, nome: string, horario: string, modalidade: string, dias?: string }[]>([]);
    const [availableTurmas, setAvailableTurmas] = useState<any[]>([]);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedTurmaId, setSelectedTurmaId] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    // Approval State
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [approvalConfig, setApprovalConfig] = useState({
        turmaId: 'auto',
        planId: '',
        paymentDay: 10,
        generateContract: true,
        prorate: true
    });
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);

    const setRegistrationsStable = useCallback((updateFn: any) => {
        setData((prevValue: any) => {
            if (!prevValue) return prevValue;
            if (typeof updateFn === 'function') {
                const updatedList = updateFn([prevValue]);
                return updatedList[0] || prevValue;
            }
            return prevValue;
        });
    }, []);

    const { syncSingleRegistration } = useFinancialOperations({
        workerUrl,
        setRegistrations: setRegistrationsStable
    });

    const hasInternalSyncedRef = useRef(false);

    const initialLoadRef = useRef(true);

    // Fetch Data
    // Fetch Data
    const fetchStudentData = useCallback(async (targetId?: string) => {
        const fetchId = targetId || id;
        if (!fetchId) return;

        try {
            const record = await getRegistrationById(fetchId);
            if (record) {
                let docData: any = { id: record.id, ...record.data };

                // Auto-fetch payment details if missing
                if (docData.paymentId && (!docData.amount || !docData.billingType || !docData.invoiceUrl)) {
                    try {
                        if (workerUrl) {
                            const response = await fetch(`${workerUrl}/payment-status?paymentId=${docData.paymentId}`);
                            const result = await response.json();
                            if (result.payment) {
                                docData = {
                                    ...docData,
                                    billingType: docData.billingType || result.payment.billingType,
                                    amount: docData.amount || (result.payment.value ? Math.round(result.payment.value * 100) : 0),
                                    invoiceUrl: docData.invoiceUrl || result.payment.invoiceUrl,
                                    paymentStatus: result.payment.status
                                };
                            }
                        }
                    } catch (err) {
                        console.error("Error auto-fetching payment details:", err);
                    }
                }

                // Auto-assign default plan if missing
                if (!docData.planId) {
                    try {
                        const defaultPlan = await planService.getDefaultPlan();
                        if (defaultPlan) {
                            docData.planId = defaultPlan.id;
                            console.log(`Auto-assigned default plan ${defaultPlan.nome} to ${docData.id}`);
                        }
                    } catch (err) {
                        console.error("Error auto-assigning default plan:", err);
                    }
                }

                setData(docData);

                // Fetch siblings based on CPF or Name/Birth
                const studentCpf = docData.alunos?.[0]?.cpf?.replace(/\D/g, '');
                const studentName = docData.alunos?.[0]?.nome;
                const studentBirth = docData.alunos?.[0]?.dataNascimento;
                const respCpf = docData.responsavel?.cpf;

                if (respCpf) {
                    try {
                        const siblingRecords = await getRegistrationsFromSource('arena', false);
                        const siblings = siblingRecords
                            .map(item => ({ id: item.id, ...item.data as any }))
                            .filter(d => {
                                const dRespCpf = d.responsavel?.cpf;
                                if (dRespCpf !== respCpf) return false;

                                const dStudent = d.alunos?.[0];
                                if (!dStudent) return false;

                                // Match by Student CPF
                                if (studentCpf && dStudent.cpf?.replace(/\D/g, '') === studentCpf) return true;

                                // Match by Name + Birth
                                if (studentName && studentBirth &&
                                    dStudent.nome === studentName &&
                                    dStudent.dataNascimento === studentBirth) return true;

                                return false;
                            });

                        // Ensure list contains current registration
                        if (!siblings.find(s => s.id === docData.id)) {
                            siblings.push(docData);
                        }

                        setAllRegistrations(siblings);
                    } catch (err) {
                        console.error("Error fetching siblings:", err);
                    }
                }
            } else {
                showAlert('Cadastro não encontrado.', 'error');
                navigate('/admin/dashboard');
            }
        } catch (error) {
            console.error("Error fetching details:", error);
            showAlert('Erro ao buscar dados.', 'error');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, workerUrl]); // Removed showAlert from deps to avoid loops if not stable

    useEffect(() => {
        fetchStudentData();
    }, [fetchStudentData]);

    // Auto-sync financial data on load if CPF exists
    useEffect(() => {
        if (data && data.responsavel?.cpf && !loading && !hasInternalSyncedRef.current) {
            hasInternalSyncedRef.current = true;
            const autoSync = async () => {
                try {
                    await syncSingleRegistration(data);
                } catch (err) {
                    console.error("Auto-sync failed on details load:", err);
                }
            };
            autoSync();
        }
    }, [data?.id, loading, syncSingleRegistration]);

    // Manual Save
    const saveNow = async () => {
        if (!id || !data) return;
        try {
            setGlobalLoading(true, 'Salvando alteraÃ§Ãµes...');
            const docRef = doc(db, 'arena_simonesia_2026_registrations', id);
            const { id: _, ...updateData } = data;
            await updateDoc(docRef, updateData);
            showAlert('AlteraÃ§Ãµes salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            showAlert('Erro ao salvar alteraÃ§Ãµes.', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    // Auto-save debounced
    useEffect(() => {
        if (initialLoadRef.current) {
            initialLoadRef.current = false;
            return;
        }
        if (!id || !data || isEditing) return; // Don't auto-save while editing to avoid focus/jump issues

        const autoSave = async () => {
            try {
                const docRef = doc(db, 'arena_simonesia_2026_registrations', id);
                const { id: _, ...updateData } = data;
                await updateDoc(docRef, updateData);
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        };

        const debounce = setTimeout(autoSave, 2000);
        return () => clearTimeout(debounce);
    }, [data, id, isEditing]);

    // Fetch Aux Data (Turmas/Plans)
    useEffect(() => {
        const loadAux = async () => {
            try {
                const qTurmas = query(collection(db, 'turmas'), orderBy('modalidade'), orderBy('horario'));
                const snapTurmas = await getDocs(qTurmas);
                const listTurmas = snapTurmas.docs.filter(d => d.data().ativo !== false).map(d => ({
                    id: d.id,
                    nome: d.data().nome,
                    horario: d.data().horario,
                    modalidade: d.data().modalidade,
                    dias: d.data().dias
                }));
                setTurmas(listTurmas);

                const listPlans = await planService.getPlans();
                setPlans(listPlans);
            } catch (e) {
                console.error('Error fetching aux data:', e);
            }
        };
        loadAux();
    }, []);

    // Approval Handlers
    const handleApprove = () => {
        if (!id || !data) return;
        setApprovalConfig(prev => ({ ...prev, planId: data.planId || '' }));
        setShowApprovalModal(true);
    };

    const confirmApprove = async () => {
        if (!approvalConfig.turmaId && !approvalConfig.planId) {
            showAlert('Por favor, selecione uma turma e um plano.', 'error');
            return;
        }

        // Determinar a turma: se houver seleÃ§Ã£o manual (modalidade: 'turma'), usa o ID selecionado.
        // Se a modalidade for 'payment' (apenas plano) ou o usuÃ¡rio tiver escolhido "Matricular Manualmente" sem selecionar, pode ser null.
        // Pela lÃ³gica original, se o usuÃ¡rio seleciona uma turma no select, usamos ela.
        let finalTurmaId = approvalConfig.turmaId;

        setIsProcessingApproval(true);
        setGlobalLoading(true, 'Aprovando cadastro e gerando contrato...', 0);
        const startTime = Date.now();

        try {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Garantir loading visual de 5s

            // 1. Atualizar documento principal no Firestore
            // Se a turma for 'auto', tenta determinar a melhor turma
            if (finalTurmaId === 'auto') {
                const student = data.alunos[0];
                const mod = normalizeModality(data.modalidade || '');
                const isNatacaoOrHidro = mod === 'NataÃ§Ã£o' || mod === 'HidroginÃ¡stica';

                if (isNatacaoOrHidro) {
                    finalTurmaId = student.turmaId || '';
                } else {
                    const calc = calculateClass(data.modalidade, student.dataNascimento);
                    const bestMatch = turmas.find(t =>
                        t.modalidade === data.modalidade &&
                        t.nome.toLowerCase().includes(calc.id.replace('sub-', ''))
                    );
                    if (bestMatch) {
                        finalTurmaId = bestMatch.id;
                    } else {
                        finalTurmaId = student.turmaId || '';
                    }
                }
            }

            const publicSignature = typeof data.confirmacao?.assinaturaDigital === 'string' && data.confirmacao.assinaturaDigital.startsWith('data:image');
            const signatureDate = data.confirmacao?.dataAssinatura || new Date().toISOString();
            const docRef = doc(db, 'arena_simonesia_2026_registrations', id as string);
            const updatePayload = {
                contractStatus: 'aprovado',
                paymentDay: approvalConfig.paymentDay,
                planId: approvalConfig.planId,
                turmaId: finalTurmaId || null,
                contractGenerated: approvalConfig.generateContract || publicSignature,
                approvedAt: new Date().toISOString()
            };

            const updatedAlunos = [...data.alunos].map((aluno: any, index: number) => ({
                ...aluno,
                turmaId: index === 0 ? finalTurmaId : aluno.turmaId,
                ...(publicSignature ? {
                    signatureData: aluno.signatureData || data.confirmacao.assinaturaDigital,
                    signedAt: aluno.signedAt || signatureDate
                } : {})
            }));

            await updateDoc(docRef, {
                ...updatePayload,
                alunos: updatedAlunos
            });

            setData((prev: any) => ({ ...prev, ...updatePayload, alunos: updatedAlunos }));

            // 2. Gerar boletos no Asaas via /generate-carnet
            const selectedPlan = plans.find(p => p.id === approvalConfig.planId);
            const mensalidadeZero = (selectedPlan?.valores?.mensalidade?.ateVencimento || 0) === 0;

            if (selectedPlan && workerUrl && !mensalidadeZero) {
                try {
                    const carnetPayload = {
                        registrationId: id,
                        responsibleName: data.responsavel?.nome || '',
                        responsibleCpf: data.responsavel?.cpf || '',
                        responsibleEmail: data.responsavel?.email || '',
                        responsiblePhone: data.responsavel?.telefonePrincipal || '',
                        childName: data.alunos?.[0]?.nome || '',
                        modalidade: data.modalidade || '',
                        // Valores do plano (em centavos)
                        matriculaValue: selectedPlan.valores?.matricula || 0,
                        mensalidadeValue: selectedPlan.valores?.mensalidade?.aposVencimento || 0,
                        descontoAntecipado: (selectedPlan.valores?.mensalidade?.aposVencimento || 0) - (selectedPlan.valores?.mensalidade?.ateVencimento || 0),
                        paymentDay: approvalConfig.paymentDay,
                        jurosMensais: selectedPlan.jurosMensais || 0,
                        multa: selectedPlan.multa || 0
                    };

                    const carnetRes = await fetch(`${workerUrl}/generate-carnet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(carnetPayload)
                    });
                    const carnetResult = await carnetRes.json();

                    if (!carnetResult.success) {
                        console.error('Erro ao gerar carnÃª:', carnetResult.error);
                        // Não bloqueia a aprovaÃ§Ã£o, apenas loga o erro
                    } else {
                        console.log('CarnÃª gerado com sucesso:', carnetResult.payments?.length, 'cobranÃ§as');

                        // --- PRORATION LOGIC ---
                        if (approvalConfig.prorate && carnetResult.payments && carnetResult.payments.length > 0) {
                            try {
                                // Find the first installment (closest to now)
                                const payments = [...carnetResult.payments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                                const firstPayment = payments[0];

                                if (firstPayment && firstPayment.id) {
                                    const today = new Date();
                                    const currentDay = today.getDate();
                                    const remainingDays = Math.max(1, 30 - currentDay);

                                    // Calculate prorated value based on full monthly value (already in cents)
                                    const fullMonthlyCentavos = selectedPlan.valores?.mensalidade?.ateVencimento || 0;
                                    const proratedCentavos = Math.round((fullMonthlyCentavos / 30) * remainingDays);

                                    console.log(`[PRORATE] Adjusting first payment ${firstPayment.id} from ${fullMonthlyCentavos} to ${proratedCentavos} cents (${remainingDays} days left)`);

                                    // Worker call to update payment value
                                    await fetch(`${workerUrl}/payments/${firstPayment.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            value: proratedCentavos / 100 // Worker expects Reais
                                        })
                                    });

                                    // Update Firestore Cache via SyncService
                                    await SyncService.savePaymentToFirestore({
                                        ...firstPayment,
                                        value: proratedCentavos / 100
                                    }, id as string);
                                }
                            } catch (prorateError) {
                                console.error('Erro ao realizar prorrateio:', prorateError);
                            }
                        }
                    }
                } catch (carnetError) {
                    console.error('Erro na geraÃ§Ã£o do carnÃª:', carnetError);
                    // Não bloqueia a aprovaÃ§Ã£o
                }
            }

            setShowApprovalModal(false);
            setShowSuccessModal(true);

        } catch (error) {
            console.error('Error approving:', error);
            showAlert('Erro ao aprovar contrato.', 'error');
        } finally {
            const elapsed = Date.now() - startTime;
            const remaining = 5000 - elapsed;
            if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

            setIsProcessingApproval(false);
            setGlobalLoading(false);
        }
    };

    const handleSendWhatsApp = () => {
        const rawPhone = data.responsavel?.telefonePrincipal || data.responsavel?.celular || data.responsavel?.telefone || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');

        if (!cleanPhone) {
            showAlert('Telefone do responsável não encontrado para envio.', 'error');
            return;
        }

        const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        const student = data.alunos[0];
        const assignedTurma = turmas.find(t => t.id === student.turmaId);

        const nomeResponsavel = (data.responsavel.nome || '').split(' ')[0].trim();
        const nomeAluno = (student.nome || '').trim();
        const cpfNumbers = (data.responsavel.cpf || '').replace(/\D/g, '');

        const currentPassword = data.senha || cpfNumbers;

        // Usando array e join para garantir quebras de linha consistentes
        const lines = [
            `Olá ${nomeResponsavel}, tudo bem?`,
            '',
            `O cadastro do aluno(a) *${nomeAluno}* foi *APROVADO* com sucesso na Arena Simonésia!`,
            ''
        ];

        if (assignedTurma) {
            lines.push(`*DETALHES DA TURMA:*`);
            lines.push(`Turma: ${assignedTurma.nome.trim()}`);
            if (assignedTurma.dias) {
                const diasStr = Array.isArray(assignedTurma.dias) ? assignedTurma.dias.join(', ') : assignedTurma.dias;
                lines.push(`Dias: ${diasStr}`);
            }
            lines.push(`Horário: ${assignedTurma.horario.trim()}`);
            lines.push('');
        }

        lines.push(`*ACESSO À ÁREA DO ALUNO:*`);
        lines.push(`Você já pode acessar sua área restrita para visualizar a carteirinha e os boletos.`);
        lines.push(`Link: https://arenasimonesia.web.app/aluno/login`);
        lines.push(`Login: ${data.responsavel?.email?.trim() || ''}`);
        lines.push(`Senha: ${currentPassword}`);
        lines.push('');
        if (!student.signatureData) {
            lines.push(`*PRÓXIMO PASSO:*`);
            lines.push(`Ao acessar, você será direcionado para assinar o contrato digitalmente. É rápido e necessário para liberar seu acesso total.`);
            lines.push('');
        }
        lines.push(`Atenciosamente,`);
        lines.push(`Equipe Arena Simonésia`);
        lines.push('');
        lines.push(`Dúvidas? Entre em contato: +55 33 8414-4053`);

        const msg = lines.join('\n');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Transfer Handlers
    const [transferTarget, setTransferTarget] = useState<any>(null);

    const openTransferModal = (reg?: any) => {
        const target = reg || data;
        if (!target || !target.alunos || target.alunos.length === 0) return;

        setTransferTarget(target);

        const currentTurmaId = target.alunos?.[0]?.turmaId || target.turmaId;
        const available = turmas.filter(t =>
            (!target.modalidade || (normalizeModality(t.modalidade) === normalizeModality(target.modalidade))) &&
            t.id !== currentTurmaId
        );

        setAvailableTurmas(available);
        setSelectedTurmaId('');
        setShowTransferModal(true);
    };

    const handleTransfer = async () => {
        if (!transferTarget || !selectedTurmaId) return;
        try {
            setIsTransferring(true);
            const docRef = doc(db, 'arena_simonesia_2026_registrations', transferTarget.id);

            const updatedAlunos = [...transferTarget.alunos];
            updatedAlunos[0] = { ...updatedAlunos[0], turmaId: selectedTurmaId };

            await updateDoc(docRef, { alunos: updatedAlunos });

            if (transferTarget.id === id) {
                setData({ ...data, alunos: updatedAlunos });
            }

            // Sync siblings
            fetchStudentData(id);

            setShowTransferModal(false);
            setTransferTarget(null);
            showAlert("Aluno realocado com sucesso!", "success");

        } catch (e) {
            console.error(e);
            showAlert("Erro ao realocar aluno.", "error");
        } finally {
            setIsTransferring(false);
        }
    };


    // Add Modality Handlers
    const [showAddModalityModal, setShowAddModalityModal] = useState(false);
    const [isCreatingModality, setIsCreatingModality] = useState(false);

    const handleAddModality = async (config: { modality: string, turmaId: string, planId: string }) => {
        if (!data || !id) return;
        setIsCreatingModality(true);
        try {
            // 1. Create new registration document
            const newId = `${id}_${config.modality}_${Date.now()}`;
            const newRegRef = doc(db, 'arena_simonesia_2026_registrations', newId);

            // Clone data but reset specific fields
            const {
                id: _,
                status: __,
                contractStatus: ___,
                paymentId: ____,
                amount: _____,
                billingType: ______,
                invoiceUrl: _______,
                paymentDay: ________,
                planId: _________,
                turmaId: __________,
                approvedAt: ___________,
                contractGenerated: ____________,
                contractUrl: _____________,
                signatureData: ______________,
                ...clonedData
            } = data;

            // Update aluno with new turmaId if provided
            const updatedAlunos = [...clonedData.alunos];
            if (updatedAlunos[0]) {
                updatedAlunos[0] = { ...updatedAlunos[0], turmaId: config.turmaId };
            }

            const newRegData = {
                ...clonedData,
                alunos: updatedAlunos,
                modalidade: config.modality,
                status: 'pendente', // Status financeiro geral
                contractStatus: 'aprovado', // JÃ¡ aprovado conforme pedido
                contractGenerated: true,    // Gerar contrato
                dateCreated: new Date().toISOString(),
                approvedAt: new Date().toISOString(),
                planId: config.planId,
                turmaId: config.turmaId,
                paymentDay: 10, // PadrÃ£o
                originalRegistrationId: id
            };

            // If it's football, reset categoriaFutebol or calculate based on birth
            if (config.modality === 'futebol') {
                const ageResult = calculateClass('futebol', data.alunos[0].dataNascimento);
                newRegData.categoriaFutebol = ageResult.id;
            }

            await setDoc(newRegRef, newRegData);

            setShowAddModalityModal(false);
            showAlert("Novo registro criado e aprovado com sucesso! Redirecionando...", "success");

            // 2. Refresh the current page's siblings
            fetchStudentData(id);

            setIsCreatingModality(false);
            // We no longer navigate away

        } catch (e) {
            console.error('Error adding modality:', e);
            showAlert("Erro ao adicionar modalidade.", "error");
        } finally {
            setIsCreatingModality(false);
        }
    };

    const handleRemoveModality = async (regId: string, modalityName: string) => {
        if (!window.confirm(`Tem certeza que deseja remover este aluno da modalidade ${modalityName.toUpperCase()}? Esta aÃ§Ã£o excluirÃ¡ este registro permanentemente.`)) return;

        try {
            const docRef = doc(db, 'arena_simonesia_2026_registrations', regId);
            await deleteDoc(docRef);
            showAlert("Modalidade removida com sucesso.", "success");

            // If we removed the one we are currently viewing, navigate to dashboard or another sibling
            if (regId === id) {
                const other = allRegistrations.find(r => r.id !== regId);
                if (other) {
                    navigate(`/admin/details/${other.id}`);
                } else {
                    navigate('/admin/dashboard');
                }
            } else {
                // Just refresh the list
                setAllRegistrations(prev => prev.filter(r => r.id !== regId));
            }
        } catch (e) {
            console.error('Error removing modality:', e);
            showAlert("Erro ao remover modalidade.", 'error');
        }
    };

    // Delete Handlers
    // Deactivate Handler
    const handleDeactivate = () => {
        if (!id || !data) return;
        showConfirm(
            <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#c62828', marginTop: 0 }}>Desativar MatrÃ­cula?</h3>
                <p>O aluno será movido para a seÃ§Ã£o de <strong>Desativados</strong>.</p>
                <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '8px', border: '1px solid #ffe0b2', marginTop: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: '#e65100', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={20} /> O QUE ACONTECERÃ:
                    </div>
                    <ul style={{ margin: '5px 0 0 20px', color: '#e65100', fontSize: '0.9rem' }}>
                        <li>O aluno será removido da turma atual.</li>
                        <li><strong>Todas as faturas pendentes ou atrasadas no Asaas serÃ£o EXCLUÃDAS.</strong></li>
                        <li>O contrato do aluno será arquivado.</li>
                        <li>O acesso do aluno será bloqueado.</li>
                    </ul>
                </div>
            </div>,
            async () => {
                setGlobalLoading(true, 'Desativando e limpando faturas...');
                try {
                    const cpf = data.responsavel?.cpf?.replace(/\D/g, '');
                    if (cpf && workerUrl) {
                        const custResponse = await fetch(`${workerUrl}/customers-by-cpf/${cpf}`);
                        const custData = await custResponse.json();

                        const customers = [];
                        if (custData.customers && Array.isArray(custData.customers)) customers.push(...custData.customers);
                        else if (custData.customer) customers.push(custData.customer);

                        for (const customer of customers) {
                            if (!customer?.id) continue;
                            const payResponse = await fetch(`${workerUrl}/payments?customer=${customer.id}&limit=100`);
                            const payData = await payResponse.json();
                            const payments = payData.data || [];

                            const normalizedStudentName = data.alunos?.[0]?.nome?.toUpperCase().trim();
                            const normalizedModality = (data.modalidade || '').toUpperCase().trim();

                            const paymentsToDelete = payments.filter((p: any) => {
                                const isUnpaid = ['PENDING', 'OVERDUE'].includes(p.status);
                                if (!isUnpaid) return false;

                                const desc = (p.description || '').toUpperCase();
                                const nameMatch = desc.includes(normalizedStudentName);
                                const modalityMatch = desc.includes(normalizedModality) || desc.includes(`(${normalizedModality})`);

                                return (nameMatch && modalityMatch) || p.externalReference?.includes(`MANUAL_${id}`);
                            });

                            for (const p of paymentsToDelete) {
                                await fetch(`${workerUrl}/payments/${p.id}`, { method: 'DELETE' });
                                await SyncService.deletePaymentFromFirestore(p.id);
                            }
                        }
                    }

                    const docRef = doc(db, 'arena_simonesia_2026_registrations', id);
                    await updateDoc(docRef, {
                        contractStatus: 'desativado',
                        status: 'desativado',
                        turmaId: null,
                        'alunos.0.turmaId': null
                    });

                    showAlert('Aluno desativado com sucesso.', 'success');
                    fetchStudentData(id);
                } catch (error: any) {
                    console.error('Error deactivating:', error);
                    showAlert('Erro ao desativar: ' + error.message, 'error');
                } finally {
                    setGlobalLoading(false);
                }
            }
        );
    };

    // Reactivate Handler
    const handleReactivate = () => {
        if (!id || !data) return;
        showConfirm(
            <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#198754', marginTop: 0 }}>Reativar Aluno?</h3>
                <p>O aluno voltarÃ¡ a ficar <strong>Ativo</strong> no sistema.</p>
                <p>Deseja gerar novamente as faturas (Refaturar) para este aluno?</p>
            </div>,
            async () => {
                setGlobalLoading(true, 'Reativando...');
                try {
                    const docRef = doc(db, 'arena_simonesia_2026_registrations', id);
                    await updateDoc(docRef, {
                        contractStatus: 'aprovado',
                        status: 'pendente'
                    });

                    showAlert('Aluno reativado!', 'success');

                    const shouldRefaturar = window.confirm('Gostaria de gerar os boletos (carnÃª) agora?');
                    if (shouldRefaturar) {
                        const selectedPlan = plans.find(p => p.id === data.planId);
                        if (selectedPlan && workerUrl) {
                            const carnetPayload = {
                                registrationId: id,
                                responsibleName: data.responsavel?.nome || '',
                                responsibleCpf: data.responsavel?.cpf || '',
                                responsibleEmail: data.responsavel?.email || '',
                                responsiblePhone: data.responsavel?.telefonePrincipal || '',
                                childName: data.alunos?.[0]?.nome || '',
                                modalidade: data.modalidade || '',
                                matriculaValue: selectedPlan.valores?.matricula || 0,
                                mensalidadeValue: selectedPlan.valores?.mensalidade?.aposVencimento || 0,
                                descontoAntecipado: (selectedPlan.valores?.mensalidade?.aposVencimento || 0) - (selectedPlan.valores?.mensalidade?.ateVencimento || 0),
                                paymentDay: data.paymentDay || 10,
                                jurosMensais: selectedPlan.jurosMensais || 0,
                                multa: selectedPlan.multa || 0
                            };

                            const res = await fetch(`${workerUrl}/generate-carnet`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(carnetPayload)
                            });
                            const result = await res.json();
                            if (result.success) showAlert('Novas faturas geradas com sucesso!', 'success');
                        }
                    }

                    fetchStudentData(id);
                } catch (error: any) {
                    console.error('Error reactivating:', error);
                    showAlert('Erro ao reativar: ' + error.message, 'error');
                } finally {
                    setGlobalLoading(false);
                }
            }
        );
    };

    const handleDelete = () => {
        if (!id) return;
        showConfirm(
            <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#c62828', marginTop: 0 }}>Excluir Cadastro e Faturas?</h3>
                <p>Esta aÃ§Ã£o Ã© irreversÃ­vel.</p>
                <div style={{ background: '#ffebee', padding: '10px', borderRadius: '8px', border: '1px solid #ffcdd2', marginTop: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: '#b71c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={20} /> ATENÃ‡ÃƒO
                    </div>
                    <ul style={{ margin: '5px 0 0 20px', color: '#c62828', fontSize: '0.9rem' }}>
                        <li>O cadastro do aluno será excluÃ­do.</li>
                        <li><strong>Todas as faturas pendentes ou atrasadas no Asaas serÃ£o excluÃ­das.</strong></li>
                        <li>Faturas já pagas permanecerÃ£o no Asaas (mas sem vÃ­nculo).</li>
                    </ul>
                </div>
            </div>,
            async () => {
                setShowDeleteOverlay(true);
                setDeleteStatus('fetching');
                try {
                    const cpf = data.responsavel?.cpf?.replace(/\D/g, '');
                    if (!cpf) throw new Error('CPF não encontrado.');

                    const custResponse = await fetch(`${workerUrl}/customers-by-cpf/${cpf}`);
                    const custData = await custResponse.json();

                    if (custData.customer && custData.customer.id) {
                        const payResponse = await fetch(`${workerUrl}/payments?customer=${custData.customer.id}&limit=100`);
                        const payData = await payResponse.json();
                        const payments = payData.data || [];

                        const paymentsToDelete = payments.filter((p: any) =>
                            ['PENDING', 'OVERDUE'].includes(p.status)
                        );

                        setDeleteProgress({ current: 0, total: paymentsToDelete.length });
                        setDeleteStatus('deleting');

                        for (let i = 0; i < paymentsToDelete.length; i++) {
                            const p = paymentsToDelete[i];
                            await fetch(`${workerUrl}/payments/${p.id}`, { method: 'DELETE' });
                            setDeleteProgress({ current: i + 1, total: paymentsToDelete.length });
                        }
                    }

                    await deleteDoc(doc(db, 'arena_simonesia_2026_registrations', id));

                    setDeleteStatus('success');
                    setTimeout(() => {
                        navigate('/admin/dashboard');
                    }, 3000);

                } catch (error) {
                    console.error('Error deleting:', error);
                    setDeleteStatus('error');
                    showAlert('Erro ao excluir: ' + error, 'error');
                    setTimeout(() => setShowDeleteOverlay(false), 3000);
                }
            }
        );
    };

    return {
        data, setData,
        loading,
        isEditing, setIsEditing,
        deleteProgress, showDeleteOverlay, setShowDeleteOverlay, deleteStatus, setDeleteStatus, handleDelete,
        turmas, availableTurmas,
        showTransferModal, setShowTransferModal, selectedTurmaId, setSelectedTurmaId, isTransferring, handleTransfer, openTransferModal,
        showApprovalModal, setShowApprovalModal, showSuccessModal, setShowSuccessModal, plans, approvalConfig, setApprovalConfig, isProcessingApproval,
        confirmApprove, handleApprove, handleSendWhatsApp,
        showAddModalityModal, setShowAddModalityModal, isCreatingModality, handleAddModality,
        handleRemoveModality,
        handleDeactivate,
        handleReactivate,
        generateCard: (student: any) => generateStudentCardPDF(student, data.responsavel, showAlert),
        workerUrl,
        allRegistrations,
        saveNow
    };
}


