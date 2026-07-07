import React, { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

import LocationManager from './LocationManager';
import RentalCalendar from './RentalCalendar';

const AdminRentals: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'calendar' | 'locations'>('calendar');
    const [rentalsEnabled, setRentalsEnabled] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const docRef = doc(db, 'system_settings', 'rentals');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setRentalsEnabled(snap.data().enabled);
                } else {
                    setRentalsEnabled(true); // Default
                }
            } catch (error) {
                console.error("Error fetching rentals status:", error);
            }
        };
        fetchStatus();
    }, []);

    const toggleRentals = async () => {
        setSaving(true);
        const newState = !rentalsEnabled;
        try {
            await setDoc(doc(db, 'system_settings', 'rentals'), {
                enabled: newState,
                updatedAt: new Date()
            }, { merge: true });
            setRentalsEnabled(newState);
        } catch (error) {
            console.error("Error toggling rentals:", error);
            alert("Erro ao alterar status das reservas.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fcfcfc', overflow: 'hidden' }}>
            {/* Header Area */}
            <div style={{ padding: '15px 25px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#17428f' }}>ALUGUEL DE ESPAÇOS</h1>
                    <p style={{ margin: '5px 0 0', color: '#666' }}>Gerencie reservas de quadras e quiosques</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Toggle Button */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 15px',
                        background: rentalsEnabled === false ? '#fff3f3' : '#f0fdf4',
                        borderRadius: '30px',
                        border: rentalsEnabled === false ? '1px solid #ffd1d1' : '1px solid #b7ebc6',
                        transition: 'all 0.3s'
                    }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: rentalsEnabled === false ? '#d32f2f' : '#2e7d32' }}>
                            RESERVAS: {rentalsEnabled === false ? 'INATIVAS' : 'ATIVAS'}
                        </span>
                        <button
                            onClick={toggleRentals}
                            disabled={saving || rentalsEnabled === null}
                            style={{
                                width: '40px',
                                height: '22px',
                                borderRadius: '11px',
                                background: rentalsEnabled ? '#2e7d32' : '#d32f2f',
                                border: 'none',
                                cursor: saving ? 'wait' : 'pointer',
                                position: 'relative',
                                transition: 'background 0.3s'
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: '2px',
                                left: rentalsEnabled ? '20px' : '2px',
                                width: '18px',
                                height: '18px',
                                background: '#fff',
                                borderRadius: '50%',
                                transition: 'left 0.2s'
                            }} />
                            {saving && <Loader2 size={10} className="animate-spin" style={{ position: 'absolute', left: '15px', top: '6px', color: '#fff' }} />}
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '5px', background: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === 'calendar' ? '#fff' : 'transparent',
                                color: activeTab === 'calendar' ? '#17428f' : '#666',
                                boxShadow: activeTab === 'calendar' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <CalendarDays size={18} />
                            Agenda
                        </button>
                        <button
                            onClick={() => setActiveTab('locations')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === 'locations' ? '#fff' : 'transparent',
                                color: activeTab === 'locations' ? '#17428f' : '#666',
                                boxShadow: activeTab === 'locations' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <MapPin size={18} />
                            Locais
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area - Full Width & Scrolled */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                {activeTab === 'calendar' ? <RentalCalendar /> : <LocationManager />}
            </div>
        </div>
    );
};

export default AdminRentals;
