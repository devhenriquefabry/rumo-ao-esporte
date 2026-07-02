import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// New turmas structure with explicit target ages
// ALL modalities set to 'futebol' as requested
const NEW_TURMAS = [
    // FUTEBOL - Combined Schedules
    {
        nome: 'Sub-15',
        horario: '18:00',
        dias: ['terça-feira', 'quinta-feira'],
        local: 'Campo 1 / Campo Sintético',
        modalidade: 'futebol',
        faixas: ['sub-15'],
        targetAges: [15, 16, 17]
    },
    {
        nome: 'Sub-9',
        horario: '18:20',
        dias: ['terça-feira', 'quinta-feira'],
        local: 'Chiqueirinho',
        modalidade: 'futebol',
        faixas: ['sub-09'],
        targetAges: [9]
    },
    {
        nome: 'Sub-12/13/14',
        horario: 'Ter 19:20 / Qui 19:10',
        dias: ['terça-feira', 'quinta-feira'],
        local: 'Campo 1',
        modalidade: 'futebol',
        faixas: ['sub-13'],
        targetAges: [12, 13, 14]
    },
    {
        nome: 'Sub-10/11',
        horario: '19:20',
        dias: ['terça-feira', 'quinta-feira'],
        local: 'Chiqueirinho',
        modalidade: 'futebol',
        faixas: ['sub-11'],
        targetAges: [10, 11]
    },
    {
        nome: 'Iniciação Futsal',
        horario: '18:30',
        dias: ['quarta-feira', 'sexta-feira'],
        local: 'Quadra',
        modalidade: 'futebol',
        faixas: ['sub-05', 'baby'],
        targetAges: [2, 3, 4, 5]
    },
    {
        nome: 'Sub-7/8',
        horario: '18:30',
        dias: ['quarta-feira', 'sexta-feira'],
        local: 'Quadra',
        modalidade: 'futebol',
        faixas: ['sub-07'],
        targetAges: [6, 7, 8]
    }
];

// Robust age calculator with logging
const calculateAge = (birthDateInput: any): number => {
    if (!birthDateInput) return -1;

    let birthDate: Date | null = null;

    try {
        if (typeof birthDateInput === 'string') {
            if (birthDateInput.includes('/')) {
                // DD/MM/YYYY
                const parts = birthDateInput.split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    let year = parseInt(parts[2], 10);
                    // Handle 2-digit years heuristically if needed, but usually it's 4
                    if (year < 100) year += 2000;
                    birthDate = new Date(year, month, day);
                }
            } else if (birthDateInput.includes('-')) {
                // YYYY-MM-DD
                // Fix for simple string parsing sometimes being UTC-offset dependent
                const [y, m, d] = birthDateInput.split('-').map(Number);
                birthDate = new Date(y, m - 1, d);
            } else {
                birthDate = new Date(birthDateInput);
            }
        } else if (birthDateInput.toDate) {
            // Firestore Timestamp
            birthDate = birthDateInput.toDate();
        } else if (birthDateInput instanceof Date) {
            birthDate = birthDateInput;
        }

        if (!birthDate || isNaN(birthDate.getTime())) {
            console.warn('Invalid birth date format:', birthDateInput);
            return -1;
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Debug logging for random sampling or errors
        // console.log(`Calc Age: Input=${birthDateInput} -> Parsed=${birthDate.toISOString().split('T')[0]} -> Age=${age}`);

        return age;

    } catch (e) {
        console.error('Error calculating age for:', birthDateInput, e);
        return -1;
    }
};

export const clearAndCreateTurmas = async (): Promise<{ success: boolean; message: string; stats: any }> => {
    try {
        console.log("Starting Migration...");

        // 1. Delete all existing turmas
        const turmasSnap = await getDocs(collection(db, 'turmas'));
        const deletePromises = turmasSnap.docs.map(d => deleteDoc(doc(db, 'turmas', d.id)));
        await Promise.all(deletePromises);
        console.log(`Deleted ${turmasSnap.docs.length} existing turmas`);

        // 2. Create new turmas
        const createdTurmas: { id: string; data: any }[] = [];
        for (const turma of NEW_TURMAS) {
            const docRef = await addDoc(collection(db, 'turmas'), {
                nome: turma.nome,
                horario: turma.horario,
                dias: turma.dias,
                local: turma.local,
                modalidade: turma.modalidade,
                faixas: turma.faixas,
                targetAges: turma.targetAges, // Save to DB for service usage
                responsavel: '',
                createdAt: new Date(),
                ativo: true
            });
            // Store targetAges locally for mapping
            createdTurmas.push({ id: docRef.id, data: { ...turma, targetAges: turma.targetAges } });
        }
        console.log(`Created ${createdTurmas.length} new turmas`);

        // 3. Fetch all registrations and allocate students (CORRECT COLLECTION)
        const regsSnap = await getDocs(collection(db, 'arena_simonesia_2026_registrations'));
        let allocatedCount = 0;
        let skippedCount = 0;
        let regUpdatedCount = 0;

        for (const regDoc of regsSnap.docs) {
            const regData = regDoc.data();
            const originalAlunos = regData.alunos || [];

            // Create a copy we can modify
            const updatedAlunos = [...originalAlunos];
            let hasChanges = false;

            for (let i = 0; i < updatedAlunos.length; i++) {
                const aluno = updatedAlunos[i];
                const age = calculateAge(aluno.dataNascimento);

                if (age < 0) {
                    // console.warn(`Skipping student ${aluno.nome}: Invalid age (Input: ${aluno.dataNascimento})`);
                    skippedCount++;
                    if (updatedAlunos[i].turmaId) {
                        updatedAlunos[i] = { ...updatedAlunos[i], turmaId: '' }; // Clear bad allocations
                        hasChanges = true;
                    }
                    continue;
                }

                // Match purely by age
                // Note: .find() returns the FIRST match.
                // Since user wants specific classes (e.g. Terca/Quinta), we might match ANY of them.
                // The current request implies they take BOTH days if possible, or we just assign ONE?
                // Usually we just assign a turmaId. If they need multiple days, the system might need multiple registrations or a multi-turma support.
                // Assuming single turma assignment for now, picking the first one that fits age.
                // Ideally we pick one based on some preference, but random first valid is standard if not specified.

                // Let's modify to pick 'Terça' as default preference if available, then others, to stay consistent?
                // Or just the first one defined in NEW_TURMAS.

                let matchedTurma = createdTurmas.find(t => t.data.targetAges && t.data.targetAges.includes(age));

                if (matchedTurma) {
                    updatedAlunos[i] = { ...updatedAlunos[i], turmaId: matchedTurma.id };
                    hasChanges = true;
                    allocatedCount++;
                    // console.log(`Allocated ${aluno.nome} (${age}y) to ${matchedTurma.data.nome}`);
                } else {
                    skippedCount++;
                    console.log(`Skipped ${aluno.nome} (${age}y) [${aluno.dataNascimento}] - No class covers this age`);
                    // Clear existing turmaId if they don't match anymore? Yes, safer.
                    if (updatedAlunos[i].turmaId) {
                        updatedAlunos[i] = { ...updatedAlunos[i], turmaId: '' };
                        hasChanges = true;
                    }
                }
            }

            // Write updates to DB
            if (hasChanges) {
                await updateDoc(doc(db, 'arena_simonesia_2026_registrations', regDoc.id), { alunos: updatedAlunos });
                regUpdatedCount++;
            }
        }

        console.log("Migration finished.");
        return {
            success: true,
            message: `Turmas atualizadas!`,
            stats: {
                deletedTurmas: turmasSnap.docs.length,
                createdTurmas: createdTurmas.length,
                allocatedStudents: allocatedCount,
                skippedStudents: skippedCount,
                registrationsUpdated: regUpdatedCount
            }
        };
    } catch (error: any) {
        console.error('Error updating turmas:', error);
        return {
            success: false,
            message: `Erro: ${error.message}`,
            stats: null
        };
    }
};
