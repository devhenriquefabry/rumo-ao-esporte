import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { type RentalLocation, type RentalBooking } from './types';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';

interface NewBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    locations: RentalLocation[];
    onSuccess: () => void;
}

const NewBookingModal: React.FC<NewBookingModalProps> = ({ isOpen, onClose, locations, onSuccess }) => {
    const { showAlert } = useDialog();
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Step 1: Location & Date
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState(1); // Hours

    // Step 2: Customer
    const [customerName, setCustomerName] = useState('');
    const [customerCpf, setCustomerCpf] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Status
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // Computed
    const selectedLocation = locations.find(l => l.id === selectedLocationId);

    // Helper: Parse HH:MM to minutes
    const timeToMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const getScheduleForDay = (loc: RentalLocation, dateStr: string) => {
        const paramDate = new Date(dateStr + 'T12:00:00');
        const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const dayOfWeek = dayMap[paramDate.getDay()];

        if (loc.schedule && loc.schedule[dayOfWeek]) {
            return loc.schedule[dayOfWeek];
        }

        // Legacy Fallback (Try to construct pseudo-schedule from legacy props if they exist in runtime)
        const legacy = loc as any;
        if (legacy.availableHours && legacy.availableHours.length > 0) {
            // Assume contiguous hours for simplicity or simple blocks
            // This is a rough fallback. Ideally we migrate data.
            // Using priceWeekday/Weekend if available in runtime data
            const isWeekend = dayOfWeek === 'sab' || dayOfWeek === 'dom';
            const price = isWeekend ? (legacy.priceWeekend || 0) : (legacy.priceWeekday || 0);

            // Convert ["08:00", "09:00"] to [{ start: "08:00", end: "09:00", price }, ...]
            return legacy.availableHours.map((h: string) => {
                const [hr, mn] = h.split(':').map(Number);
                const endH = hr + 1;
                const end = `${endH.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`;
                return { start: h, end, price };
            });
        }

        return [];
    };

    const calculateBookingDetails = () => {
        if (!selectedLocation || !date || !startTime || duration <= 0) {
            return { valid: false, price: 0, error: "Dados incompletos" };
        }

        const slots = getScheduleForDay(selectedLocation, date);
        if (slots.length === 0) {
            return { valid: false, price: 0, error: "Local fechado neste dia." };
        }

        let currentPrice = 0;
        const startMins = timeToMinutes(startTime);

        // Check availability and price for each hour segment (assuming hourly bookings for now)
        // Improvements: Handle minute-perfect bookings by integrating over time
        for (let i = 0; i < duration; i++) {
            const segmentStart = startMins + (i * 60);
            // const segmentEnd = segmentStart + 60; // Not strictly needed for point check

            // Find slot containing this segment start
            // A slot covers [start, end)
            const slot = slots.find((s: any) => {
                const sStart = timeToMinutes(s.start);
                const sEnd = timeToMinutes(s.end);
                return segmentStart >= sStart && segmentStart < sEnd;
            });

            if (!slot) {
                const h = Math.floor(segmentStart / 60);
                const m = segmentStart % 60;
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                return { valid: false, price: 0, error: `Horário ${timeStr} indisponível/fechado.` };
            }

            currentPrice += slot.price;
        }

        return { valid: true, price: currentPrice, error: null };
    };

    const bookingDetails = calculateBookingDetails();
    const totalPrice = bookingDetails.price;

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setSelectedLocationId('');
            setDate('');
            setStartTime('');
            setDuration(1);
            setCustomerName('');
            setCustomerCpf('');
            setCustomerPhone('');
            setIsAvailable(null);
        }
    }, [isOpen]);

    const checkAvailability = async () => {
        if (!selectedLocationId || !date || !startTime) {
            showAlert("Preencha os dados do agendamento primeiro.", "warning");
            return;
        }

        setCheckingAvailability(true);
        setIsAvailable(null);

        try {
            // 1. Validate Schedule Logic
            if (!bookingDetails.valid) {
                showAlert(bookingDetails.error || "Horário inválido.", "error");
                setIsAvailable(false);
                return;
            }

            // 2. Check Overlaps in Firestore
            const endDate = new Date(`2000-01-01T${startTime}:00`);
            endDate.setHours(endDate.getHours() + duration);
            const endTime = endDate.toTimeString().substring(0, 5);

            // Query existing bookings for this location & date
            const q = query(
                collection(db, 'rentals_bookings'),
                where('locationId', '==', selectedLocationId),
                where('date', '==', date),
                where('status', 'in', ['confirmed', 'pending'])
            );

            const snap = await getDocs(q);
            const bookings = snap.docs.map(d => d.data() as RentalBooking);

            // Check overlap
            // A overlaps B if (StartA < EndB) and (EndA > StartB)
            const hasOverlap = bookings.some(b => {
                return (startTime < b.endTime) && (endTime > b.startTime);
            });

            if (hasOverlap) {
                showAlert("Horário indisponível! Já existe uma reserva.", "error");
                setIsAvailable(false);
            } else {
                setIsAvailable(true);
            }

        } catch (error) {
            console.error(error);
            showAlert("Erro ao verificar disponibilidade.", "error");
        } finally {
            setCheckingAvailability(false);
        }
    };

    const handleCreateBooking = async () => {
        if (!isAvailable) {
            showAlert("Verifique a disponibilidade primeiro.", "warning");
            return;
        }
        if (!customerName || !customerCpf || !customerPhone) {
            showAlert("Preencha os dados do cliente.", "warning");
            return;
        }

        setLoading(true);

        try {
            // 1. Calculate End Time again
            const endDate = new Date(`2000-01-01T${startTime}:00`);
            endDate.setHours(endDate.getHours() + duration);
            const endTime = endDate.toTimeString().substring(0, 5);

            const pendingBookingId = `book_${Date.now()}`;

            // 2. Create Payment in Asaas
            const paymentPayload = {
                responsibleName: customerName,
                responsibleCpf: customerCpf,
                responsiblePhone: customerPhone,
                billingType: 'PIX', // Default to PIX for rentals
                amount: Math.round(totalPrice * 100), // in cents
                dueDate: new Date().toISOString().split('T')[0], // Today
                description: `Aluguel: ${selectedLocation?.name} - ${date} ${startTime} às ${endTime}`,
                externalReference: `RENTAL_${pendingBookingId}`,
                childName: `Reserva ${selectedLocation?.name}` // Fallback for worker logic
            };

            const res = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentPayload)
            });

            const paymentData = await res.json();

            if (!paymentData.success) {
                throw new Error(paymentData.error || "Erro ao gerar cobrança");
            }

            // 3. Save to Firestore
            const newBooking: RentalBooking = {
                id: pendingBookingId,
                locationId: selectedLocationId,
                locationName: selectedLocation?.name || '',
                locationType: selectedLocation?.type || 'quadra',
                customerName,
                customerCpf,
                customerPhone,
                date,
                startTime,
                endTime,
                durationHours: duration,
                totalPrice,
                status: 'pending',
                paymentId: paymentData.payment.id,
                paymentStatus: 'PENDING',
                paymentLink: paymentData.payment.invoiceUrl,
                externalReference: `RENTAL_${pendingBookingId}`,
                createdAt: new Date().toISOString(),
                createdBy: 'admin'
            };

            await addDoc(collection(db, 'rentals_bookings'), newBooking);

            // 4. Send WhatsApp (Optional but good)
            if (customerPhone) {
                try {
                    const msg = `Olá ${customerName}! Sua pré-reserva do(a) *${selectedLocation?.name}* para o dia ${date.split('-').reverse().join('/')} às ${startTime} foi criada.\n\nValor: R$ ${totalPrice.toFixed(2)}\nPagamento (Pix/Boleto): ${paymentData.payment.invoiceUrl}`;
                    await fetch(`${workerUrl}/send-whatsapp`, {
                        method: 'POST',
                        body: JSON.stringify({ phone: customerPhone, message: msg }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (ignore) { console.error("Whats err", ignore); }
            }

            showAlert("Reserva criada com sucesso! Link enviado ao cliente.", "success");
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            showAlert(error.message || "Erro ao criar reserva.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px',
                padding: '24px', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                    <X size={24} color="#666" />
                </button>

                <h2 style={{ marginTop: 0, color: '#00237f', fontSize: '1.4rem' }}>Nova Reserva</h2>

                {/* Step 1: Selection */}
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Local</label>
                            <select
                                value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            >
                                <option value="">Selecione...</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Data</label>
                                <input
                                    type="date" value={date} onChange={e => setDate(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Início</label>
                                <input
                                    type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Duração (Horas)</label>
                            <input
                                type="number" min="1" max="10" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>

                        {selectedLocation && (
                            <div style={{ background: '#f0f4ff', padding: '10px', borderRadius: '8px', marginTop: '5px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#00237f' }}>
                                    <span>Total Estimado:</span>
                                    <span>R$ {totalPrice.toFixed(2)}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                                    {bookingDetails.valid ? 'Preço calculado base na agenda do dia.' : bookingDetails.error || 'Verifique o horário.'}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={checkAvailability}
                            disabled={checkingAvailability || !selectedLocationId || !date || !startTime}
                            style={{
                                padding: '12px', background: checkingAvailability ? '#ccc' : '#4CAF50', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px'
                            }}
                        >
                            {checkingAvailability ? 'Verificando...' : 'Verificar Disponibilidade'}
                        </button>

                        {isAvailable === true && (
                            <div style={{
                                background: '#e8f5e9', color: '#2e7d32', padding: '10px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold'
                            }}>
                                <Check size={20} /> Horário Disponível!
                                <button
                                    onClick={() => setStep(2)}
                                    style={{ marginLeft: 'auto', background: '#2e7d32', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Continuar
                                </button>
                            </div>
                        )}
                        {isAvailable === false && (
                            <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                                <AlertTriangle size={20} /> Indisponível neste horário.
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Customer */}
                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nome do Cliente</label>
                            <input
                                value={customerName} onChange={e => setCustomerName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                placeholder="Nome completo"
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>CPF</label>
                            <input
                                value={customerCpf} onChange={e => setCustomerCpf(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                placeholder="000.000.000-00"
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>WhatsApp</label>
                            <input
                                value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={() => setStep(1)}
                                style={{ flex: 1, padding: '12px', background: '#eee', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleCreateBooking}
                                disabled={loading}
                                style={{ flex: 2, padding: '12px', background: '#00237f', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {loading ? 'Gerando Cobrança...' : 'Confirmar Reserva'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default NewBookingModal;
