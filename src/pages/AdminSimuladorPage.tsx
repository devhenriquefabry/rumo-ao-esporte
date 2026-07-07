import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { planService } from '../utils/planService';
import AdminRevenueSimulator from './AdminFinanceiroComponents/AdminRevenueSimulator';
import PageContainer from '../components/PageContainer';

export default function AdminSimuladorPage() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [regSnap, fetchedPlans] = await Promise.all([
                    getDocs(collection(db, "rumo_ao_esporte_2026_registrations")),
                    planService.getPlans()
                ]);
                setRegistrations(regSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
                setPlans(fetchedPlans);
            } catch (err) {
                console.error('Error loading simulator data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #eee', borderTop: '4px solid #00a63a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <AdminRevenueSimulator
                currentMRR={0}
                currentStudents={0}
                plans={plans}
                registrations={registrations}
            />
        </PageContainer>
    );
}
