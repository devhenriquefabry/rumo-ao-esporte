import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Clock, ChevronRight } from 'lucide-react';
import type { RentalLocation } from './AdminRentals/types';
import ClientBookingModal from './StudentReservas/ClientBookingModal'; // We will create this next

export default function StudentReservas() {
    const [locations, setLocations] = useState<RentalLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<RentalLocation | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    useEffect(() => {
        console.log("StudentReservas component mounted");
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const q = query(collection(db, 'rentals_locations'), where('active', '==', true));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentalLocation));
            setLocations(data);
        } catch (error) {
            console.error("Error fetching locations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLocationClick = (location: RentalLocation) => {
        setSelectedLocation(location);
        setIsBookingModalOpen(true);
    };

    return (
        <PageContainer>
            <PageTitle title="Reservas de Quadras e Quiosques" subtitle="Selecione um local para agendar seu horário." />

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Carregando locais...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {locations.map(location => (
                        <div
                            key={location.id}
                            onClick={() => handleLocationClick(location)}
                            className="touch-feedback"
                            style={{
                                background: '#fff',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                border: '1px solid #f0f0f0',
                                transition: 'transform 0.2s',
                            }}
                        >
                            <div style={{
                                height: '160px',
                                background: '#eee',
                                backgroundImage: `url(${location.images?.[0] || '/placeholder-location.jpg'})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    left: '10px',
                                    background: 'rgba(0,0,0,0.6)',
                                    color: '#fff',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}>
                                    {location.type}
                                </div>
                            </div>

                            <div style={{ padding: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#17428f', fontSize: '1.1rem' }}>{location.name}</h3>
                                <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '0.9rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {location.description}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#555', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Clock size={16} color="#00a63a" />
                                        <span>Ver Horários</span>
                                    </div>
                                </div>

                                <button style={{
                                    width: '100%',
                                    marginTop: '15px',
                                    padding: '10px',
                                    background: '#f8f9fa',
                                    border: '1px solid #e9ecef',
                                    borderRadius: '8px',
                                    color: '#17428f',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}>
                                    RESERVAR AGORA <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isBookingModalOpen && selectedLocation && (
                <ClientBookingModal
                    isOpen={isBookingModalOpen}
                    onClose={() => setIsBookingModalOpen(false)}
                    location={selectedLocation}
                />
            )}
        </PageContainer>
    );
}
