import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateClass, normalizeModality } from './turmasConstants';

/**
 * Calculates student age from DD/MM/YYYY string or other formats
 */
const getAge = (birthDateStr: string): number => {
    if (!birthDateStr) return -1;
    try {
        let date: Date;
        if (birthDateStr.includes('/')) {
            const parts = birthDateStr.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                let y = parseInt(parts[2]);
                if (y < 100) y += 2000;
                date = new Date(y, m, d);
            } else {
                return -1;
            }
        } else {
            date = new Date(birthDateStr);
        }

        if (isNaN(date.getTime())) return -1;

        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const m = today.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age;
    } catch {
        return -1;
    }
};

/**
 * Finds an existing active turma for a given modality and birth date.
 * PRIORITIZES 'targetAges' array matching if available (New logic).
 * Falls back to old logic for other modalities.
 */
export async function findOrCreateTurma(
    modalidade: string,
    birthDate: string,
    forcedDays?: string[],
    forcedTime?: string
): Promise<string> {
    if (!modalidade || !birthDate) return '';

    const normalizedModality = normalizeModality(modalidade);

    // New: Check for manual auto-allocation mapping
    try {
        const settingsRef = doc(db, 'system_settings', 'auto_allocation');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            const mappings = settingsSnap.data().mappings || {};
            // Key format used in AdminAutoAllocation: modalitySuffix_daysJoined_time
            // We need to determine the modality suffix (natacao or hidro)
            const suffix = normalizedModality === 'Natação' ? 'natacao' : (normalizedModality === 'Hidroginástica' ? 'hidro' : '');
            if (suffix && forcedDays && forcedTime) {
                const mappingKey = `${suffix}_${forcedDays.join('_')}_${forcedTime}`;
                const mappedTurmaId = mappings[mappingKey];
                if (mappedTurmaId) {
                    console.log(`[findOrCreateTurma] Using manual mapping: ${mappingKey} -> ${mappedTurmaId}`);
                    return mappedTurmaId;
                }
            }

            // Soccer age-based mapping
            if (normalizedModality === 'Futebol') {
                const age = getAge(birthDate);
                if (age !== -1) {
                    const ageMappingKey = `futebol_age_${age}`;
                    const mappedTurmaId = mappings[ageMappingKey];
                    if (mappedTurmaId) {
                        console.log(`[findOrCreateTurma] Using explicit soccer age mapping: ${ageMappingKey} -> ${mappedTurmaId}`);
                        return mappedTurmaId;
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error checking manual auto-allocation mapping:", e);
    }

    // 0. Forced Schedule Logic (Schedule Selection)
    if (forcedDays && forcedDays.length > 0 && forcedTime) {
        console.log(`Searching for forced schedule: ${normalizedModality} - ${forcedDays.join('/')} at ${forcedTime}`);

        // Try to find exact match
        // We can't query 'dias' array equality easily in Firestore, so we query by modality and time, then filter in memory
        // Or create a composite key. simpler: query by modality + active
        const q = query(
            collection(db, 'turmas'),
            where('modalidade', '==', normalizedModality),
            where('horario', '==', forcedTime)
        );

        const snap = await getDocs(q);

        // Filter by days
        const matchedTurma = snap.docs.find(doc => {
            const data = doc.data();
            const dias = data.dias || [];
            // Check if arrays have same elements
            if (dias.length !== forcedDays.length) return false;
            return forcedDays.every(d => dias.includes(d));
        });

        if (matchedTurma) {
            console.log(`Found existing forced class: ${matchedTurma.id} (${matchedTurma.data().nome})`);
            return matchedTurma.id;
        }

        // Create new if not found
        console.log("[findOrCreateTurma] Class NOT found. Creating new forced class...");
        const classInfo = calculateClass(normalizedModality, birthDate);
        // Name format: Modality - Days - Time (e.g., Natação - Ter/Qui - 09:00)
        // Or keep Age Group name? "Natação Infantil - Ter/Qui 09:00"
        const newName = `${classInfo.label} (${forcedDays.join('/')} ${forcedTime})`;

        const newTurmaRef = await addDoc(collection(db, 'turmas'), {
            nome: newName,
            faixaEtariaId: classInfo.id, // Still meaningful for age tracking
            modalidade: normalizedModality,
            horario: forcedTime,
            dias: forcedDays,
            responsavel: 'A definir',
            ativo: true,
            createdAt: serverTimestamp()
        });

        return newTurmaRef.id;
    }

    const age = getAge(birthDate);

    // 1. Try to find a class with explicit targetAges match (The "New System")
    const isSoccerOrVolley = normalizedModality.toLowerCase() === 'futebol' || normalizedModality.toLowerCase() === 'voleibol';
    if (age > -1 && isSoccerOrVolley) {
        try {
            // Get all active classes for this modality
            const q = query(
                collection(db, 'turmas'),
                where('modalidade', '==', normalizedModality.toLowerCase())
            );
            const snap = await getDocs(q);

            // Find one that covers the age
            const matchedTurma = snap.docs.find(doc => {
                const data = doc.data();
                if (data.targetAges && Array.isArray(data.targetAges)) {
                    return data.targetAges.includes(age);
                }
                return false;
            });

            if (matchedTurma) {
                console.log(`Auto-assigned student (${age}y) to ${matchedTurma.data().nome}`);
                return matchedTurma.id;
            }
        } catch (e) {
            console.error("Error finding targetAges turma:", e);
        }
    }

    // 2. Fallback to Old Logic (Create if not exists) - Mostly for non-futebol or if no fixed class found
    const classInfo = calculateClass(normalizedModality, birthDate);

    // Query for existing turma by new system ID
    const q1 = query(
        collection(db, 'turmas'),
        where('modalidade', '==', normalizedModality),
        where('faixaEtariaId', '==', classInfo.id)
    );

    // Query for existing turma by old system Name
    const q2 = query(
        collection(db, 'turmas'),
        where('modalidade', '==', normalizedModality),
        where('nome', '==', classInfo.label)
    );

    // Only run these queries if we haven't found a forced one (which we haven't if we reached here)
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const existingTurma = snap1.docs.find(doc => doc.data().ativo !== false) ||
        snap2.docs.find(doc => doc.data().ativo !== false);

    if (existingTurma) {
        console.log(`[findOrCreateTurma] Found existing class: ${existingTurma.id} (${existingTurma.data().nome})`);
        return existingTurma.id;
    }

    // Create new turma if not found (Legacy behavior, maybe disable for Futebol?)
    // User said "sempre que ... tem que ir para a turma sub a qual mais condiz".
    // Does he want us to CREATE one if it doesn't exist?
    // Probably not for Futebol anymore, but safe to keep for Volei/Hidro

    const newTurmaRef = await addDoc(collection(db, 'turmas'), {
        nome: classInfo.label,
        faixaEtariaId: classInfo.id,
        modalidade: normalizedModality,
        horario: '12:00',
        dias: [],
        responsavel: 'A definir',
        ativo: true,
        createdAt: serverTimestamp()
    });

    return newTurmaRef.id;
}
