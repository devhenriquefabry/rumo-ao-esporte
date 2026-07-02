import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import MaintenancePage from '../pages/MaintenancePage';

interface MaintenanceGuardProps {
    children: React.ReactNode;
}

export default function MaintenanceGuard({ children }: MaintenanceGuardProps) {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const maintRef = doc(db, 'system_settings', 'maintenance');
        const unsubscribe = onSnapshot(maintRef, (doc) => {
            if (doc.exists()) {
                setIsMaintenance(doc.data().enabled === true);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to maintenance settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) return null;

    if (isMaintenance) {
        return <MaintenancePage />;
    }

    return <>{children}</>;
}
