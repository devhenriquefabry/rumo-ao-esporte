import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { planService, type Plan } from '../utils/planService';
import { SyncService } from '../utils/SyncService';
import { syncStudentFinancialData } from '../utils/financialSync';
import { logAccess } from '../utils/accessLogService';

const workerUrl = import.meta.env.VITE_WORKER_URL;

interface ScanResult {
    status: 'allowed' | 'denied' | 'error';
    title: string;
    subtitle: string;
    student?: any;
    parent?: any;
    photo?: string;
    planName?: string;
    turmaName?: string;
}

export function useGlobalQRScanner() {
    const [modalData, setModalData] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [plans, setPlans] = useState<Plan[]>([]);

    const lastKeyTimeRef = useRef<number>(0);
    const beepRef = useRef<HTMLAudioElement | null>(null);

    // Initialize beep sound and load plans
    useEffect(() => {
        beepRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        beepRef.current.volume = 0.5;

        // Load plans for name resolution
        planService.getPlans().then(setPlans).catch(console.error);
    }, []);

    const playBeep = useCallback(() => {
        if (beepRef.current) {
            beepRef.current.currentTime = 0;
            beepRef.current.play().catch(e => console.error("Audio play error", e));
        }
    }, []);

    // Get turma name by ID
    const getTurmaName = useCallback(async (turmaId: string): Promise<string> => {
        if (!turmaId) return '';
        try {
            const turmaDoc = await getDoc(doc(db, 'turmas', turmaId));
            if (turmaDoc.exists()) {
                return turmaDoc.data()?.nome || turmaId;
            }
        } catch (e) {
            console.error("Error fetching turma:", e);
        }
        return turmaId;
    }, []);

    const processStudentAccess = useCallback(async (student: any, parent: any, registrationId: string): Promise<ScanResult> => {
        const isOverdue = parent.status === 'atrasado'; // Based on financialSync status
        const pendingDesc = parent.financialPendingDescription;
        const isApproved = parent.contractStatus === 'aprovado';

        let status: 'allowed' | 'denied' = 'allowed';
        let title = 'ALUNO EM DIA COM O CLUBE';
        let subtitle = 'Tudo certo com a matrícula.';

        if (!isApproved) {
            status = 'denied';
            title = 'ACESSO NEGADO';
            subtitle = 'Matrícula não aprovada ou inativa.';
        } else if (isOverdue) {
            status = 'denied';
            title = 'PENDÊNCIA FINANCEIRA';
            subtitle = pendingDesc || 'Verifique o financeiro.';
        }

        // Resolve plan name
        const planId = parent.planId || student.planId;
        const plan = plans.find(p => p.id === planId);
        const planName = plan?.nome || 'Sem plano definido';

        // Resolve turma name
        const turmaId = student.turmaId || parent.turmaId;
        const turmaName = await getTurmaName(turmaId);

        // Sync and fetch payments from Asaas
        let payments: any[] = [];
        try {
            const cpf = parent.responsavel?.cpf || '';
            const studentName = student.nome || '';
            const modality = parent.modalidade || '';

            if (cpf && workerUrl && registrationId) {
                console.log('[GlobalScanner] Syncing payments for:', registrationId);
                await syncStudentFinancialData(registrationId, cpf, studentName, modality, workerUrl);
            }

            const cachedPayments = await SyncService.getCachedPayments(registrationId);
            if (cachedPayments && Array.isArray(cachedPayments)) {
                payments = cachedPayments;
                console.log('[GlobalScanner] Found', payments.length, 'payments');
            }
        } catch (e) {
            console.error('[GlobalScanner] Error fetching payments:', e);
        }

        // Log the access attempt
        logAccess({
            studentName: student.nome,
            registrationId: registrationId,
            status: status === 'allowed' ? 'allowed' : 'denied',
            reason: status === 'denied' ? `${title}: ${subtitle}` : undefined,
            modality: parent.modalidade,
            photoUrl: student.fotoUrl
        });

        return {
            status,
            title,
            subtitle,
            student,
            parent: { ...parent, payments },
            photo: student.fotoUrl,
            planName,
            turmaName: turmaName || 'Não alocado'
        };
    }, [plans, getTurmaName]);

    const handleSearch = useCallback(async (qrContent: string) => {
        setLoading(true);
        setModalData(null);

        try {
            const parts = qrContent.split('|');
            let foundStudent: any = null;
            let parentData: any = null;
            let registrationId = '';

            if (parts.length >= 3) {
                const [cpfRaw, nascRaw, nome] = parts;

                // Normalize CPF
                const cpfClean = cpfRaw.replace(/\D/g, '');
                const cpfFormatted = cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

                // Normalize date
                let nascISO = nascRaw;
                let nascBR = nascRaw;
                if (nascRaw.includes('/')) {
                    const [day, month, year] = nascRaw.split('/');
                    nascISO = `${year} -${month.padStart(2, '0')} -${day.padStart(2, '0')} `;
                    nascBR = nascRaw;
                } else if (nascRaw.includes('-')) {
                    const [year, month, day] = nascRaw.split('-');
                    nascBR = `${day} /${month}/${year} `;
                    nascISO = nascRaw;
                }

                console.log("[GlobalScanner] Searching for:", { nome, cpfClean, nascBR });

                const allRegs = await getDocs(collection(db, "arena_simonesia_2026_registrations"));

                allRegs.forEach(docSnap => {
                    if (foundStudent) return;

                    const data = docSnap.data();

                    if (data.alunos && Array.isArray(data.alunos)) {
                        for (const aluno of data.alunos) {
                            const alunoCpf = aluno.cpf || '';
                            const alunoCpfClean = alunoCpf.replace(/\D/g, '');
                            const alunoNasc = aluno.dataNascimento || '';

                            const cpfMatches = alunoCpfClean === cpfClean || alunoCpf === cpfFormatted || alunoCpf === cpfRaw;
                            const nascMatches = alunoNasc === nascBR || alunoNasc === nascISO || alunoNasc === nascRaw;

                            if (cpfMatches && nascMatches) {
                                console.log("[GlobalScanner] ✓ Student FOUND:", aluno.nome);
                                foundStudent = aluno;
                                parentData = data;
                                registrationId = docSnap.id;
                                return;
                            }

                            if (!foundStudent && aluno.nome?.toLowerCase().trim() === nome?.toLowerCase().trim()) {
                                foundStudent = aluno;
                                parentData = data;
                                registrationId = docSnap.id;
                            }
                        }
                    }

                    if (!foundStudent) {
                        const respCpf = data.responsavel?.cpf || '';
                        const respCpfClean = respCpf.replace(/\D/g, '');

                        if (respCpfClean === cpfClean) {
                            const aluno = data.alunos?.find((a: any) =>
                                a.nome?.toLowerCase().trim() === nome?.toLowerCase().trim()
                            );
                            if (aluno) {
                                foundStudent = aluno;
                                parentData = data;
                                registrationId = docSnap.id;
                            }
                        }
                    }
                });
            }

            if (foundStudent && parentData && registrationId) {
                const result = await processStudentAccess(foundStudent, parentData, registrationId);
                setModalData(result);
            } else if (foundStudent && parentData) {
                const result = await processStudentAccess(foundStudent, parentData, '');
                setModalData(result);
            } else {
                setModalData({
                    status: 'error',
                    title: 'NÃO ENCONTRADO',
                    subtitle: 'CPF ou aluno não encontrado no sistema.'
                });
            }

        } catch (error) {
            console.error("[GlobalScanner] Error:", error);
            setModalData({
                status: 'error',
                title: 'ERRO',
                subtitle: 'Erro ao buscar dados. Tente novamente.'
            });
        } finally {
            setLoading(false);
        }
    }, [processStudentAccess]);

    const handleScanSuccess = useCallback(async (decodedText: string) => {
        if (!loading && !modalData && isEnabled) {
            console.log("[GlobalScanner] Scanned:", decodedText);
            playBeep();
            handleSearch(decodedText);
        }
    }, [loading, modalData, isEnabled, playBeep, handleSearch]);

    useEffect(() => {
        const handleManualScan = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const { student, parent, registrationId } = customEvent.detail || {};
            if (student && parent) {
                if (!loading && !modalData && isEnabled) {
                    setLoading(true);
                    setModalData(null);
                    try {
                        const result = await processStudentAccess(student, parent, registrationId || '');
                        setModalData(result);
                    } catch (error) {
                        console.error("[GlobalScanner] Manual Scan Error:", error);
                        setModalData({
                            status: 'error',
                            title: 'ERRO',
                            subtitle: 'Erro ao processar acesso manual. Tente novamente.'
                        });
                    } finally {
                        setLoading(false);
                    }
                }
            }
        };

        window.addEventListener('trigger-manual-scan', handleManualScan);
        return () => window.removeEventListener('trigger-manual-scan', handleManualScan);
    }, [loading, modalData, isEnabled, processStudentAccess]);

    // Global keyboard listener for HID barcode scanners
    useEffect(() => {
        let buffer = '';

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if modal is open, loading, or disabled
            if (modalData || loading || !isEnabled) return;

            // Ignore if user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const now = Date.now();
            const timeSinceLastKey = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            // Reset buffer if too much time passed (user is typing manually)
            if (timeSinceLastKey > 100) {
                buffer = '';
            }

            if (e.key === 'Enter') {
                // Process if buffer looks like a QR code (contains | separator)
                if (buffer.trim().length >= 5 && buffer.includes('|')) {
                    e.preventDefault();
                    console.log('[GlobalScanner] HID captured:', buffer.trim());
                    handleScanSuccess(buffer.trim());
                }
                buffer = '';
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [modalData, loading, isEnabled, handleScanSuccess]);

    const closeModal = useCallback(() => {
        setModalData(null);
    }, []);

    return {
        modalData,
        loading,
        closeModal,
        isEnabled,
        setIsEnabled
    };
}

export default useGlobalQRScanner;
