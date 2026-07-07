import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { type RentalLocation } from './types';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';
import LocationModal from './LocationModal';

const LocationManager: React.FC = () => {
    const { showAlert, showConfirm } = useDialog();
    const [locations, setLocations] = useState<RentalLocation[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<RentalLocation | null>(null);

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'rentals_locations'));
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentalLocation));
            setLocations(list);
        } catch (error) {
            console.error(error);
            showAlert("Erro ao carregar locais.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, []);

    const handleSave = async (data: Omit<RentalLocation, 'id' | 'createdAt'>, id?: string) => {
        try {
            if (id) {
                // Edit
                await updateDoc(doc(db, 'rentals_locations', id), data);
                showAlert("Local atualizado com sucesso!", "success");
            } else {
                // Create
                const newId = `loc_${Date.now()}`;
                await setDoc(doc(db, 'rentals_locations', newId), {
                    ...data,
                    createdAt: new Date().toISOString()
                });
                showAlert("Local criado com sucesso!", "success");
            }
            fetchLocations();
        } catch (error) {
            console.error(error);
            throw error; // Modal handles error display if needed, but we acted here
        }
    };

    const handleDelete = (id: string) => {
        showConfirm("Tem certeza que deseja excluir este local?", async () => {
            try {
                await deleteDoc(doc(db, 'rentals_locations', id));
                showAlert("Local excluído.", "success");
                fetchLocations();
            } catch (error) {
                console.error(error);
                showAlert("Erro ao excluir local.", "error");
            }
        });
    };

    const openEdit = (loc: RentalLocation) => {
        setEditingLocation(loc);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingLocation(null);
        setIsModalOpen(true);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#333' }}>Locais Cadastrados</h3>
                <button
                    onClick={openNew}
                    style={{
                        backgroundColor: '#17428f', color: '#fff', border: 'none', padding: '10px 20px',
                        borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        fontWeight: 'bold'
                    }}
                >
                    <Plus size={18} /> Novo Local
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Carregando...</div>
            ) : locations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888', background: '#f9f9f9', borderRadius: '8px' }}>
                    Nenhum local cadastrado. Clique em "Novo Local" para começar.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {locations.map(loc => (
                        <div key={loc.id} style={{
                            border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden',
                            backgroundColor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            display: 'flex', flexDirection: 'column'
                        }}>
                            {/* Image Header */}
                            <div style={{ height: '150px', backgroundColor: '#eee', position: 'relative' }}>
                                {loc.images && loc.images.length > 0 ? (
                                    <img src={loc.images[0]} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
                                        <MapPin size={40} />
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div style={{ padding: '15px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{loc.name}</h4>
                                    <span style={{
                                        background: loc.type === 'quadra' ? '#e8f5e9' : '#fff3e0',
                                        color: loc.type === 'quadra' ? '#2e7d32' : '#ef6c00',
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                        textTransform: 'uppercase', flexShrink: 0
                                    }}>
                                        {loc.type}
                                    </span>
                                </div>
                                <p style={{
                                    margin: '0 0 15px 0', fontSize: '0.9rem', color: '#666',
                                    minHeight: '40px', maxHeight: '80px', overflowY: 'auto',
                                    paddingRight: '5px'
                                }}>
                                    {loc.description || 'Sem descrição.'}
                                </p>

                                <div style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
                                    Preços definidos na agenda.
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div style={{ borderTop: '1px solid #eee', padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fafafa' }}>
                                <button
                                    onClick={() => openEdit(loc)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd',
                                        background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                        color: '#333'
                                    }}
                                >
                                    <Edit2 size={16} /> Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(loc.id)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #ffeba1',
                                        background: '#fff0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                        color: '#d32f2f'
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <LocationModal
                isOpen={isModalOpen}
                initialData={editingLocation}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
};

export default LocationManager;
