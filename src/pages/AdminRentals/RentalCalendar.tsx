import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { type RentalBooking, type RentalLocation } from './types';
import { Plus, Clock, User, ExternalLink, RefreshCw, Calendar } from 'lucide-react';
import NewBookingModal from './NewBookingModal';

const RentalCalendar: React.FC = () => {
    const [bookings, setBookings] = useState<RentalBooking[]>([]);
    const [locations, setLocations] = useState<RentalLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]); // Default today
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Load Locations
    useEffect(() => {
        const fetchLocs = async () => {
            const snap = await getDocs(collection(db, 'rentals_locations'));
            setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as RentalLocation)));
        };
        fetchLocs();
    }, []);

    // Load Bookings for selected Date
    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'rentals_bookings'),
            where('date', '==', dateFilter),
            orderBy('startTime', 'asc') // Requires Index probably, but let's try
        );

        // Use onSnapshot for realtime updates
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RentalBooking));
            setBookings(list);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching bookings:", err);
            // Fallback for missing index error
            if (err.message.includes("requires an index")) {
                console.warn("Index missing, consider creating one. For now, client-side sort if needed.");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [dateFilter]);

    // Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'cancelled': return '#F44336';
            case 'completed': return '#2196F3';
            default: return '#999';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'confirmed': return 'Confirmado';
            case 'pending': return 'Pendente';
            case 'cancelled': return 'Cancelado';
            case 'completed': return 'Concluído';
            default: return status;
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* Header / Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>Data</label>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                    />
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        <RefreshCw size={16} /> Hoje
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#17428f', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                    >
                        <Plus size={20} /> Nova Reserva
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Carregando agenda...</div>
            ) : bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888', background: '#f9f9f9', borderRadius: '12px' }}>
                    <Calendar size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
                    <p>Nenhuma reserva para este dia.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {bookings.map(book => (
                        <div key={book.id} style={{
                            borderLeft: `5px solid ${getStatusColor(book.status)}`,
                            background: '#fff', borderRadius: '8px', padding: '15px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>
                                    {book.startTime} - {book.endTime}
                                </div>
                                <div style={{ color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Clock size={14} /> {book.durationHours}h
                                </div>
                            </div>

                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ fontWeight: 'bold', color: '#17428f' }}>{book.locationName}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555', marginTop: '4px' }}>
                                    <User size={14} /> {book.customerName}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 'bold', color: '#333' }}>R$ {book.totalPrice.toFixed(2)}</div>
                                    <div style={{ fontSize: '0.8rem', color: getStatusColor(book.status), fontWeight: 'bold' }}>
                                        {getStatusLabel(book.status)}
                                    </div>
                                </div>

                                {book.paymentLink && (
                                    <a
                                        href={book.paymentLink} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            background: '#f0f4ff', color: '#17428f', padding: '8px', borderRadius: '8px',
                                            display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold'
                                        }}
                                    >
                                        <ExternalLink size={16} /> Pagar
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <NewBookingModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                locations={locations}
                onSuccess={() => setDateFilter(dateFilter)} // Force refresh (snapshot handles it mostly)
            />
        </div>
    );
};

export default RentalCalendar;
