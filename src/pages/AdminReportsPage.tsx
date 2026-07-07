import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { planService } from '../utils/planService';
import AdminReports from './AdminFinanceiroComponents/AdminReports';
import PageContainer from '../components/PageContainer';

const isFutebol = (value?: string) => (value || '').trim().toLowerCase() === 'futebol';

export default function AdminReportsPage() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [turmas, setTurmas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [regSnap, fetchedPlans, turmasSnap] = await Promise.all([
                    getDocs(collection(db, "rumo_ao_esporte_2026_registrations")),
                    planService.getPlans(),
                    getDocs(collection(db, "turmas"))
                ]);
                setRegistrations(regSnap.docs
                    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
                    .filter((item: any) => isFutebol(item.modalidade)));
                setPlans(fetchedPlans.filter((plan: any) => isFutebol(plan.modalidade)));
                setTurmas(turmasSnap.docs
                    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
                    .filter((item: any) => isFutebol(item.modalidade)));
            } catch (err) {
                console.error('Error loading report data:', err);
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
            <AdminReports registrations={registrations} plans={plans} turmas={turmas} />
        </PageContainer>
    );
}
