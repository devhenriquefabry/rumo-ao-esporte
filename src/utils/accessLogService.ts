import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export interface AccessLog {
    id?: string;
    studentName: string;
    studentId?: string; // If available (e.g. index in students array)
    registrationId: string;
    timestamp: any; // Firestore Timestamp
    status: 'allowed' | 'denied' | 'scan_only';
    reason?: string;
    modality?: string;
    photoUrl?: string;
}

const COLLECTION_NAME = 'arena_simonesia_2026_access_logs';

/**
 * Logs a new access event to Firestore
 */
export const logAccess = async (log: Omit<AccessLog, 'timestamp'>) => {
    try {
        console.log(`[AccessLog] Logging: ${log.studentName} - ${log.status}`);

        const cleanLog = Object.fromEntries(
            Object.entries(log).filter(([_, v]) => v !== undefined)
        );

        await addDoc(collection(db, COLLECTION_NAME), {
            ...cleanLog,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error("Error logging access:", error);
    }
};

/**
 * Fetches recent logs across all students (for Portaria admin)
 */
export const getRecentLogs = async (maxCount = 50) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('timestamp', 'desc'),
            limit(maxCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert timestamp to Date for easier UI usage
            timestamp: (doc.data().timestamp as Timestamp).toDate()
        } as any));
    } catch (error) {
        console.error("Error fetching logs:", error);
        return [];
    }
};

/**
 * Fetches logs for a specific registration (for Parent app)
 */
export const getStudentLogs = async (registrationId: string) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('registrationId', '==', registrationId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: (doc.data().timestamp as Timestamp).toDate()
        } as any));
    } catch (error) {
        console.error("Error fetching student logs:", error);
        return [];
    }
};

/**
 * Deletes an access log from Firestore
 */
export const deleteAccessLog = async (logId: string) => {
    try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, COLLECTION_NAME, logId));
        return true;
    } catch (error) {
        console.error("Error deleting access log:", error);
        return false;
    }
};
