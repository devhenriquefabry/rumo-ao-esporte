import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Clock } from 'lucide-react';
import { type RentalLocation } from './types';
import { useDialog } from '../../context/CustomDialogContext';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<RentalLocation, 'id' | 'createdAt'>, id?: string) => Promise<void>;
    initialData?: RentalLocation | null;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const { showAlert } = useDialog();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'quadra' | 'quiosque'>('quadra');
    const [description, setDescription] = useState('');

    // Schedule State: { [day: string]: Array<{ start: string, end: string, price: number }> }
    const [scheduleConfig, setScheduleConfig] = useState<Record<string, { start: string, end: string, price: number }[]>>({
        seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: []
    });

    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setDescription(initialData.description);
            setImages(initialData.images || []);

            // INIT SCHEDULE
            if (initialData.schedule) {
                // Check if new format (array of objects) or intermediate/legacy
                // We trust the new type definition from types.ts
                setScheduleConfig(initialData.schedule as any);
            } else if ((initialData as any).availableHours) {
                // Legacy: Apply to all days with default price (e.g. 0 or ask user)
                // Since we removed priceWeekday, we might not have a price reference if we don't pass it.
                // Assuming we can't easily migrate without price info. 
                // Let's set a placeholder price.
                const start = (initialData as any).availableHours[0];
                const end = incrementHour((initialData as any).availableHours[(initialData as any).availableHours.length - 1]);
                const allDaysConfig: Record<string, any[]> = {};
                ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].forEach(d => {
                    allDaysConfig[d] = [{ start, end, price: 0 }];
                });
                setScheduleConfig(allDaysConfig);
            } else {
                // Default empty
                setScheduleConfig({ seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [] });
            }
        } else if (isOpen) {
            // Reset for new entry
            setName('');
            setType('quadra');
            setDescription('');
            setImages([]);
            setScheduleConfig({ seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [] });
        }
    }, [isOpen, initialData]);

    const incrementHour = (time: string) => {
        if (!time) return '00:00';
        const [h, m] = time.split(':').map(Number);
        return `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };



    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const workerUrl = import.meta.env.VITE_WORKER_URL;

        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch(`${workerUrl}/images/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success && data.data?.url) {
                    return data.data.url;
                } else {
                    throw new Error(data.error || "Erro no upload");
                }
            });

            const uploadedUrls = await Promise.all(uploadPromises);
            setImages(prev => [...prev, ...uploadedUrls]);

        } catch (error) {
            console.error(error);
            showAlert("Erro ao enviar imagens. Tente novamente.", "error");
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const addSlot = (day: string) => {
        setScheduleConfig(prev => ({
            ...prev,
            [day]: [...prev[day], { start: '08:00', end: '12:00', price: 50 }]
        }));
    };

    const removeSlot = (day: string, index: number) => {
        setScheduleConfig(prev => ({
            ...prev,
            [day]: prev[day].filter((_, i) => i !== index)
        }));
    };

    const updateSlot = (day: string, index: number, field: string, value: any) => {
        setScheduleConfig(prev => {
            const newSlots = [...prev[day]];
            newSlots[index] = { ...newSlots[index], [field]: value };
            return { ...prev, [day]: newSlots };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // We save scheduleConfig directly as it matches the new types.ts structure
            await onSave({
                name,
                type,
                description,
                schedule: scheduleConfig,
                images,
                active: true
            }, initialData?.id);

            onClose();
        } catch (error) {
            console.error(error);
            showAlert("Erro ao salvar local.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const dayLabels: Record<string, string> = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '700px',
                maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                    <X size={24} color="#666" />
                </button>

                <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#17428f', fontSize: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                    {initialData ? 'Editar Local' : 'Novo Local'}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>


                    {/* Images */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#333' }}>Fotos do Local</label>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {images.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                    <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        style={{
                                            position: 'absolute', top: 5, right: 5,
                                            background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none',
                                            borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}

                            <label style={{
                                width: '100px', height: '100px', border: '2px dashed #ccc', borderRadius: '8px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#666', fontSize: '13px', background: '#fafafa',
                                transition: 'all 0.2s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#17428f'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#ccc'}
                            >
                                {uploading ? <div className="loader">...</div> : <><Upload size={24} style={{ marginBottom: '5px' }} /> Adicionar</>}
                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
                            </label>
                        </div>
                    </div>

                    {/* Nome e Tipo */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Nome do Local</label>
                            <input
                                value={name} onChange={e => setName(e.target.value)}
                                required placeholder="Ex: Quadra de Areia 1"
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', transition: 'border 0.2s' }}
                                onFocus={(e) => e.target.style.borderColor = '#17428f'}
                                onBlur={(e) => e.target.style.borderColor = '#ddd'}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Tipo</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={type} onChange={e => setType(e.target.value as any)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', appearance: 'none', background: '#fff' }}
                                >
                                    <option value="quadra">Quadra</option>
                                    <option value="quiosque">Quiosque</option>
                                </select>
                                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>▼</div>
                            </div>
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Descrição</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Descreva o local (ex: Coberta, Iluminação LED...)"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', resize: 'vertical' }}
                        />
                    </div>

                    {/* Horários e Preços */}
                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontWeight: '600', color: '#333', fontSize: '1.1rem' }}>
                            <Clock size={20} /> Agenda e Preços
                        </label>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].map((day) => {
                                const slots = scheduleConfig[day] || [];

                                return (
                                    <div key={day} style={{
                                        background: '#fff', borderRadius: '8px', padding: '12px',
                                        border: slots.length > 0 ? '1px solid #17428f' : '1px solid #e0e0e0',
                                        opacity: slots.length > 0 ? 1 : 0.8
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{dayLabels[day]}</span>
                                            <button
                                                type="button"
                                                onClick={() => addSlot(day)}
                                                style={{
                                                    background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9',
                                                    borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <Plus size={14} /> Adicionar Turno
                                            </button>
                                        </div>

                                        {slots.length === 0 ? (
                                            <div style={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>Fechado neste dia.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {slots.map((slot, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#fafafa', padding: '8px', borderRadius: '6px' }}>
                                                        <input
                                                            type="time"
                                                            value={slot.start}
                                                            onChange={e => updateSlot(day, idx, 'start', e.target.value)}
                                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', width: '85px' }}
                                                        />
                                                        <span style={{ color: '#666' }}>até</span>
                                                        <input
                                                            type="time"
                                                            value={slot.end}
                                                            onChange={e => updateSlot(day, idx, 'end', e.target.value)}
                                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', width: '85px' }}
                                                        />

                                                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: '5px' }}>
                                                            <span style={{ fontWeight: '600', color: '#333' }}>R$</span>
                                                            <input
                                                                type="number"
                                                                value={slot.price}
                                                                onChange={e => updateSlot(day, idx, 'price', parseFloat(e.target.value))}
                                                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', width: '70px' }}
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => removeSlot(day, idx)}
                                                            style={{
                                                                background: '#ffebee', color: '#c62828', border: 'none',
                                                                borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>



                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <button
                            type="button" onClick={onClose}
                            style={{
                                padding: '12px 24px', borderRadius: '8px', border: '1px solid #ddd',
                                background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#555'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit" disabled={loading}
                            style={{
                                padding: '12px 24px', borderRadius: '8px', border: 'none',
                                background: 'linear-gradient(135deg, #17428f 0%, #0033cc 100%)',
                                color: '#fff', cursor: 'pointer', fontWeight: 'bold',
                                boxShadow: '0 4px 10px rgba(0,35,127,0.2)',
                                opacity: loading ? 0.7 : 1,
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            {loading ? 'Salvando...' : <><Plus size={18} /> Salvar Local</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default LocationModal;
