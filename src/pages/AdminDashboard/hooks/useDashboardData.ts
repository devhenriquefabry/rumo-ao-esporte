import { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../firebase';
import { planService, type Plan } from '../../../utils/planService';
import type { Student, Turma } from '../types';

export function useDashboardData() {
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRegs = async () => {
            try {
                // Fetch Turmas
                const tSnap = await getDocs(query(collection(db, "turmas")));
                setTurmas(tSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Turma))
                    .filter(turma => (((turma as any).modalidade || '') as string).toLowerCase().includes('futebol')));

                // Fetch Plans
                const plansList = await planService.getPlans();
                setPlans(plansList.filter(plan => (plan.modalidade || '').toLowerCase().includes('futebol')));

                const querySnapshot = await getDocs(query(collection(db, "rumo_ao_esporte_2026_registrations")));
                const rawData = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((reg: any) => (reg.modalidade || '').toLowerCase().includes('futebol'));

                const flatList: Student[] = [];
                rawData.forEach((reg: any) => {
                    const baseData = {
                        regId: reg.id,
                        responsavel: reg.responsavel,
                        modalidade: reg.modalidade,
                        createdAt: reg.createdAt,
                        status: reg.status,
                        contractStatus: reg.contractStatus,
                        planId: reg.planId,
                        financialPendingAmount: reg.financialPendingAmount || 0,
                        financialPendingDescription: reg.financialPendingDescription || 'Sem informação',
                        financialInvoiceUrl: reg.financialInvoiceUrl || '',
                        financialReceivedAmount: reg.financialReceivedAmount || 0,
                        associadoUba: reg.associadoUba,
                        senha: reg.senha
                    };

                    if (reg.alunos && reg.alunos.length > 0) {
                        reg.alunos.forEach((aluno: any, index: number) => {
                            flatList.push({ ...baseData, uniqueId: `${reg.id}_${index}`, aluno });
                        });
                    } else {
                        // Fallback para registros antigos ou desativados sem array de alunos
                        const fallbackAluno = {
                            nome: reg.nome || reg.responsavel?.nome || 'Sem Aluno',
                            fotoUrl: reg.fotoUrl || '',
                            dataNascimento: reg.dataNascimento || '',
                            turmaId: reg.turmaId || null
                        };
                        flatList.push({ ...baseData, uniqueId: reg.id, aluno: fallbackAluno });
                    }
                });

                flatList.sort((a, b) => (a.aluno?.nome || '').localeCompare(b.aluno?.nome || ''));
                setAllStudents(flatList);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRegs();
    }, []);

    const removeRegistrationIds = (ids: string[]) => {
        const idSet = new Set(ids);
        setAllStudents(prev => prev.filter(student => !idSet.has(student.regId)));
    };

    return { allStudents, turmas, plans, loading, removeRegistrationIds };
}
