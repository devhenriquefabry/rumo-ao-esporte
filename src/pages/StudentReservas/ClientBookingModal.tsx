import { useState, useEffect } from 'react';
import { X, CreditCard, ChevronRight, CheckCircle, AlertCircle, Copy, Loader, Check } from 'lucide-react';
import type { RentalLocation } from '../AdminRentals/types';
import { db, auth } from '../../firebase';
import { collection, addDoc, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

import CustomCalendar from '../../components/CustomCalendar';

interface ClientBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    location: RentalLocation;
}

export default function ClientBookingModal({ isOpen, onClose, location }: ClientBookingModalProps) {
    // Steps: 1=Schedule, 2=Payment Method, 3=Processing/Pix, 4=Success
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<{ start: string, end: string, price: number } | null>(null);
    const [availableSlots, setAvailableSlots] = useState<{ start: string, end: string, price: number, available: boolean }[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | null>(null);
    const [loading, setLoading] = useState(false);
    const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
    const [rentalsEnabled, setRentalsEnabled] = useState(true);

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Fetch user info on mount
    useEffect(() => {
        const fetchUserInfo = async () => {
            const user = auth.currentUser;
            if (user && user.email) {
                try {
                    // Check Global Rentals Status
                    const rSnap = await getDoc(doc(db, 'system_settings', 'rentals'));
                    if (rSnap.exists()) {
                        setRentalsEnabled(rSnap.data().enabled);
                    }

                    const normalizedEmail = user.email.toLowerCase().trim();
                    const q = query(collection(db, "arena_simonesia_2026_registrations"), where("responsavel.email", "==", normalizedEmail));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        const info = {
                            name: data.responsavel?.nome || user.displayName || '',
                            cpf: data.responsavel?.cpf || '',
                            phone: data.responsavel?.telefonePrincipal || '',
                            email: data.responsavel?.email || user.email || ''
                        };
                        // setPayerInfo(info); // Removed
                        // Pre-fill card data
                        setCardData(prev => ({
                            ...prev,
                            name: info.name,
                            cpf: info.cpf,
                            phone: info.phone
                        }));
                    } else {
                        // Fallback for Teachers or direct login without registration doc
                        // Try teachers collection
                        const teacherQ = query(collection(db, "teachers"), where("email", "==", normalizedEmail));
                        const teacherSnap = await getDocs(teacherQ);
                        if (!teacherSnap.empty) {
                            const tData = teacherSnap.docs[0].data();
                            const info = {
                                name: tData.nome || '',
                                cpf: tData.cpf || '',
                                phone: tData.telefone || '',
                                email: tData.email || ''
                            };
                            // setPayerInfo(info); // Removed
                            setCardData(prev => ({ ...prev, name: info.name, cpf: info.cpf, phone: info.phone }));
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user info:", err);
                }
            }
        };
        fetchUserInfo();
    }, [isOpen]); // Re-fetch when modal opens

    // Pix State
    const [pixCode, setPixCode] = useState('');
    const [pixQrUrl, setPixQrUrl] = useState('');
    const [pixTimeLeft, setPixTimeLeft] = useState(300); // 5 minutes
    const [copied, setCopied] = useState(false);

    // Card State
    const [cardData, setCardData] = useState({
        number: '',
        name: '',
        expiry: '',
        cvc: '',
        cpf: '',
        phone: '' // Needed for contact
    });

    if (!isOpen) return null;

    const handleDateSelect = async (date: string) => {
        setSelectedDate(date);
        setSelectedSlot(null);

        // Calculate slots from location.schedule
        if (!location.schedule) {
            setAvailableSlots([]);
            return;
        }

        const dateObj = new Date(date + 'T12:00:00');
        const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toLowerCase();

        let slots = location.schedule[dayOfWeek] || [];

        // Fetch existing bookings for this date/location
        setLoading(true);
        try {
            const bookingsQuery = query(
                collection(db, 'rentals_bookings'),
                where('locationId', '==', location.id),
                where('date', '==', date),
                where('status', 'in', ['confirmed', 'paid', 'approved', 'pending_payment']) // Block potential conflicts
            );

            const bookingsSnap = await getDocs(bookingsQuery);
            const bookedTimes: string[] = [];

            bookingsSnap.forEach(doc => {
                const booking = doc.data();
                // Simple blocking: block the start time. 
                // Enhanced: block all slots covered by duration.
                const startHour = parseInt(booking.startTime.split(':')[0]);
                const duration = booking.durationHours || 1;

                for (let i = 0; i < duration; i++) {
                    const blockedHour = startHour + i;
                    const blockedTime = `${blockedHour.toString().padStart(2, '0')}:00`; // Assuming hourly slots on the hour
                    bookedTimes.push(blockedTime);
                }
            });

            // Filter slots
            // Map slots to mark as available or not
            const mappedSlots = slots.map(slot => {
                // Convert slot start/end to minutes for comparison
                const slotStart = timeToMinutes(slot.start);
                const slotEnd = timeToMinutes(slot.end);

                // Check if this slot overlaps with ANY booking
                const isBlocked = bookingsSnap.docs.some(doc => {
                    const b = doc.data();
                    const bStart = timeToMinutes(b.startTime);
                    const bEnd = timeToMinutes(b.endTime || calculateEndTime(b.startTime, b.durationHours));

                    // Intersection formula: (StartA < EndB) && (EndA > StartB)
                    return (slotStart < bEnd) && (slotEnd > bStart);
                });

                return { ...slot, available: !isBlocked };
            });

            setAvailableSlots(mappedSlots);

        } catch (error) {
            console.error("Error fetching bookings:", error);
            alert("Erro ao verificar disponibilidade.");
        } finally {
            setLoading(false);
        }
    };

    const createBooking = async (method: string, existingPaymentId?: string) => {
        if (!selectedSlot || !selectedDate) return;

        const user = auth.currentUser;

        await addDoc(collection(db, 'rentals_bookings'), {
            locationId: location.id,
            locationName: location.name,
            locationType: location.type,
            customerName: user?.displayName || cardData.name || 'Cliente App', // Fallback
            customerEmail: user?.email,
            date: selectedDate,
            startTime: selectedSlot.start,
            endTime: selectedSlot.end,
            durationHours: 1, // Assuming fixed slots for now, need logic if slots are variable
            totalPrice: selectedSlot.price,
            status: method === 'CREDIT_CARD' ? 'confirmed' : 'pending_payment', // Pix initially pending until confirmed? Actually if we are here, it's confirmed.
            paymentStatus: 'RECEIVED',
            billingType: method,
            paymentId: existingPaymentId || pendingPaymentId,
            createdAt: new Date().toISOString()
        });
    };

    const timeToMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const calculateEndTime = (start: string, duration: number) => {
        const [h, m] = start.split(':').map(Number);
        const endH = h + duration;
        return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const handlePixPayment = async () => {
        if (!workerUrl) {
            alert("Erro de configuração: VITE_WORKER_URL não definido.");
            return;
        }

        if (!rentalsEnabled) {
            alert("O sistema de reservas está temporariamente desativado pela administração.");
            return;
        }

        // Validate basic payer info
        if (!cardData.name || !cardData.cpf || !cardData.phone) {
            alert("Por favor, preencha os dados do pagador (Nome, CPF e Telefone) antes de continuar.");
            return;
        }

        const cleanCpf = cardData.cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            alert("CPF inválido. Verifique os dados.");
            return;
        }

        const user = auth.currentUser;
        setLoading(true);
        try {
            // Real API Call
            const payload = {
                amount: Math.round(selectedSlot!.price * 100), // Cents
                billingType: 'PIX',
                responsibleName: cardData.name,
                responsibleCpf: cleanCpf,
                responsibleEmail: user?.email || "email@teste.com",
                responsiblePhone: cardData.phone.replace(/\D/g, ''),
                childName: "Reserva Quadra",
                description: `Reserva ${location.name} - ${selectedDate} ${selectedSlot?.start}`,
                registrationId: `RENTAL_${Date.now()}` // Internal ID
            };

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!data.success || !data.payment) {
                if (JSON.stringify(data).includes("CPF/CNPJ informado é inválido")) {
                    throw new Error("CPF informa é inválido na Receita/Asaas.");
                }
                throw new Error(data.error || "Erro ao criar cobrança Pix.");
            }

            setPendingPaymentId(data.payment.id);
            setPixCode(data.payment.pixQrCode);
            setPixQrUrl(`data:image/png;base64,${data.payment.pixQrCodeUrl}`);

            setStep(3); // Go to Pix display
            setPixTimeLeft(600); // 10 minutes for real pix often
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao gerar Pix: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCardPayment = async () => {
        // Validate form
        if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvc || !cardData.cpf) {
            alert("Preencha todos os dados do cartão.");
            return;
        }

        if (!rentalsEnabled) {
            alert("O sistema de reservas está temporariamente desativado pela administração.");
            return;
        }

        if (!window.confirm(`Confirma o pagamento de R$ ${selectedSlot?.price?.toFixed(2)} no cartão final ${cardData.number.slice(-4)}?`)) {
            return;
        }

        const user = auth.currentUser;
        setLoading(true);

        try {
            // Split Expiry MM/AA or MM/AAAA
            const [expMonth, expYear] = cardData.expiry.split('/');

            const payload = {
                amount: Math.round(selectedSlot!.price * 100),
                billingType: 'CREDIT_CARD',
                responsibleName: user?.displayName || cardData.name,
                responsibleCpf: cardData.cpf.replace(/\D/g, ''),
                responsibleEmail: user?.email || "email@teste.com",
                responsiblePhone: cardData.phone.replace(/\D/g, '') || "00000000000",
                childName: "Reserva Quadra",
                description: `Reserva ${location.name} - ${selectedDate} ${selectedSlot?.start}`,
                registrationId: `RENTAL_${Date.now()}`,
                creditCard: {
                    holderName: cardData.name,
                    number: cardData.number.replace(/\s/g, ''),
                    expiryMonth: expMonth,
                    expiryYear: expYear.length === 2 ? `20${expYear}` : expYear,
                    ccv: cardData.cvc
                },
                creditCardHolderInfo: {
                    name: cardData.name,
                    email: user?.email || "email@teste.com",
                    cpfCnpj: cardData.cpf.replace(/\D/g, ''),
                    postalCode: "00000000",
                    addressNumber: "0",
                    phone: cardData.phone.replace(/\D/g, '') || "00000000000",
                    mobilePhone: cardData.phone.replace(/\D/g, '') || "00000000000"
                }
            };

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!data.success || !data.payment) {
                throw new Error(data.error || "Erro ao processar cartão.");
            }

            if (data.payment.status === 'CONFIRMED' || data.payment.status === 'RECEIVED') {
                // Success
                await createBooking('CREDIT_CARD', data.payment.id);
                setStep(4);
            } else {
                alert(`Pagamento processado mas status é ${data.payment.status}. Verifique se foi aprovado.`);
            }

        } catch (error: any) {
            console.error(error);
            alert(`Erro ao processar pagamento: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const verifyPixPayment = async () => {
        if (!pendingPaymentId) return;
        setLoading(true);
        try {
            const res = await fetch(`${workerUrl}/payment-status?paymentId=${pendingPaymentId}`);
            const data = await res.json();

            if (data.payment && (data.payment.status === 'RECEIVED' || data.payment.status === 'CONFIRMED')) {
                await createBooking('PIX', pendingPaymentId);
                setStep(4);
            } else {
                alert("Pagamento ainda não identificado. Aguarde alguns segundos e tente novamente.");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao verificar status.");
        } finally {
            setLoading(false);
        }
    };



    // Pix Timer Effect
    useEffect(() => {
        let timer: any;
        if (step === 3 && paymentMethod === 'PIX' && pixTimeLeft > 0) {
            timer = setInterval(() => {
                setPixTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (pixTimeLeft === 0 && step === 3) {
            // Expired
            alert("Tempo para pagamento expirou.");
            onClose();
        }
        return () => clearInterval(timer);
    }, [step, paymentMethod, pixTimeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
            <div className="animate-slide-up" style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '25px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: '#f5f5f5', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}>
                    <X size={20} color="#666" />
                </button>

                <h2 style={{ marginTop: 0, color: '#00237f', fontSize: '1.5rem' }}>{location.name}</h2>
                <p style={{ color: '#666', marginBottom: '20px' }}>Nova Reserva</p>

                {/* STEPS PROGRESS */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '10px' }}>
                    {[1, 2, 3].map(s => (
                        <div key={s} style={{ flex: 1, height: '4px', background: s <= step ? '#007d2f' : '#eee', borderRadius: '2px' }} />
                    ))}
                </div>

                {/* STEP 1: SCHEDULE */}
                {step === 1 && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '15px' }}>
                            <span style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '5px' }}>Data da Reserva</span>
                            <CustomCalendar
                                selectedDate={selectedDate}
                                onDateSelect={(date) => {
                                    // Adapt to match the expected event structure or refactor handleDateChange
                                    // Refactoring handleDateChange to accept string directly would be cleaner, 
                                    // but for minimal diff, we'll wrap it or just call the logic directly.
                                    // Let's refactor handleDateChange to be cleaner in a moment, 
                                    // for now, let's call a simplified version.
                                    handleDateSelect(date);
                                }}
                                minDate={new Date().toISOString().split('T')[0]}
                            />
                        </label>

                        {availableSlots.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
                                {availableSlots.map((slot, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedSlot(slot)}
                                        disabled={!slot.available}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: selectedSlot === slot ? '2px solid #007d2f' : '1px solid #eee',
                                            background: !slot.available ? '#f5f5f5' : (selectedSlot === slot ? '#fff5f5' : '#fff'),
                                            color: selectedSlot === slot ? '#007d2f' : (slot.available ? '#333' : '#999'),
                                            cursor: slot.available ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px',
                                            opacity: slot.available ? 1 : 0.7
                                        }}
                                    >
                                        <span style={{ fontWeight: 'bold' }}>{slot.start}</span>
                                        <span style={{ fontSize: '0.8rem', color: slot.available ? '#666' : '#999' }}>R$ {slot.price}</span>
                                        {!slot.available && (
                                            <span style={{ fontSize: '0.7rem', color: '#007d2f', fontWeight: 'bold', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <X size={10} /> Reservado
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            selectedDate && <p style={{ color: '#888', fontStyle: 'italic' }}>Nenhum horário disponível nesta data.</p>
                        )}

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                disabled={!selectedSlot}
                                onClick={() => setStep(2)}
                                style={{
                                    background: selectedSlot ? '#007d2f' : '#ccc',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: selectedSlot ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                CONTINUAR <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: PAYMENT METHOD */}
                {step === 2 && selectedSlot && (
                    <div>
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#666' }}>Data:</span>
                                <span style={{ fontWeight: 'bold' }}>{new Date(selectedDate).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#666' }}>Horário:</span>
                                <span style={{ fontWeight: 'bold' }}>{selectedSlot.start} - {selectedSlot.end}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: '#007d2f', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ddd' }}>
                                <span style={{ fontWeight: 'bold' }}>Total:</span>
                                <span style={{ fontWeight: 'bold' }}>R$ {selectedSlot.price.toFixed(2)}</span>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#333', marginBottom: '15px' }}>Dados do Pagador</h3>

                        <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Nome Completo</label>
                                <input
                                    value={cardData.name}
                                    onChange={e => setCardData({ ...cardData, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    placeholder="Nome do responsável"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>CPF</label>
                                    <input
                                        value={cardData.cpf}
                                        onChange={e => setCardData({ ...cardData, cpf: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Telefone</label>
                                    <input
                                        value={cardData.phone}
                                        onChange={e => setCardData({ ...cardData, phone: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#333', marginBottom: '15px' }}>Escolha a forma de pagamento:</h3>

                        <button
                            onClick={() => {
                                setPaymentMethod('PIX');
                                // Only trigger if we have data or handle it inside
                                setTimeout(() => handlePixPayment(), 100);
                            }}
                            className="payment-option-btn"
                            style={{
                                width: '100%',
                                padding: '15px',
                                marginBottom: '10px',
                                border: paymentMethod === 'PIX' ? '2px solid #32BCAD' : '1px solid #ddd', // Highlight if selected
                                background: paymentMethod === 'PIX' ? '#f0fdfa' : '#fff',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ color: '#32BCAD' }}><Copy size={24} /></div>
                            <div>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>PIX (Pagamento Instantâneo)</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>QR Code ou Copia e Cola. Liberação imediata.</div>
                            </div>
                        </button>

                        <button
                            onClick={() => { setPaymentMethod('CREDIT_CARD'); setStep(3); }}
                            style={{
                                width: '100%',
                                padding: '15px',
                                border: '1px solid #ddd',
                                background: '#fff',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ color: '#555' }}><CreditCard size={24} /></div>
                            <div>
                                <div style={{ fontWeight: 'bold', color: '#333' }}>Cartão de Crédito</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Visa, Master, Elo e outros.</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setStep(1)}
                            style={{ marginTop: '20px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Voltar
                        </button>
                    </div>
                )}

                {/* STEP 3: PROCESSING / CONFIRMATION */}
                {step === 3 && paymentMethod === 'PIX' && (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#333', marginBottom: '10px' }}>Escaneie o QR Code</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>Pague via Pix para confirmar sua reserva imediatamente.</p>

                        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                            {pixQrUrl ? <img src={pixQrUrl} alt="Pix QR" style={{ width: '200px' }} /> : <Loader className="animate-spin" />}
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>Código Pix Copia e Cola:</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input readOnly value={pixCode} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '0.8rem' }} />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(pixCode);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    style={{
                                        background: copied ? '#2e7d32' : '#333',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0 15px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied && <span style={{ fontSize: '0.7rem' }}>Copiado!</span>}
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: pixTimeLeft < 60 ? '#007d2f' : '#333', marginBottom: '20px' }}>
                            Tempo restante: {formatTime(pixTimeLeft)}
                        </div>

                        {/* Verify Payment Button */}
                        <button
                            onClick={verifyPixPayment}
                            disabled={loading}
                            style={{ width: '100%', padding: '12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Verificando...' : 'JÁ FIZ O PAGAMENTO'}
                        </button>
                    </div>
                )}

                {step === 3 && paymentMethod === 'CREDIT_CARD' && (
                    <div>
                        <h3 style={{ marginBottom: '20px' }}>Dados do Cartão</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input
                                placeholder="Número do Cartão"
                                value={cardData.number}
                                onChange={e => setCardData({ ...cardData, number: e.target.value })}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%' }}
                            />
                            <input
                                placeholder="Nome como no cartão"
                                value={cardData.name}
                                onChange={e => setCardData({ ...cardData, name: e.target.value })}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <input
                                    placeholder="MM/AA"
                                    value={cardData.expiry}
                                    onChange={e => setCardData({ ...cardData, expiry: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', flex: 1 }}
                                />
                                <input
                                    placeholder="CVC"
                                    value={cardData.cvc}
                                    onChange={e => setCardData({ ...cardData, cvc: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '80px' }}
                                />
                            </div>

                            <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #eee' }} />

                            <input
                                placeholder="CPF do Titular"
                                value={cardData.cpf}
                                onChange={e => setCardData({ ...cardData, cpf: e.target.value })}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%' }}
                            />

                            <input
                                placeholder="Telefone do Titular"
                                value={cardData.phone}
                                onChange={e => setCardData({ ...cardData, phone: e.target.value })}
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%' }}
                            />

                            <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginTop: '10px', fontSize: '0.85rem', color: '#856404', display: 'flex', gap: '10px' }}>
                                <AlertCircle size={20} />
                                <div>
                                    Ao confirmar, será cobrado <strong>R$ {selectedSlot?.price.toFixed(2)}</strong> no seu cartão de crédito.
                                </div>
                            </div>

                            <button
                                onClick={handleCardPayment}
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#007d2f',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    marginTop: '10px',
                                    cursor: 'pointer',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? 'PROCESSANDO...' : 'CONFIRMAR PAGAMENTO'}
                            </button>

                            <button
                                onClick={() => setStep(2)}
                                style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline', width: '100%' }}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: SUCCESS */}
                {step === 4 && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: '#e8f5e9',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            color: '#2e7d32'
                        }}>
                            <CheckCircle size={40} />
                        </div>
                        <h2 style={{ color: '#2e7d32', margin: 0 }}>Reserva Confirmada!</h2>
                        <p style={{ color: '#666', marginTop: '10px' }}>Seu horário foi agendado com sucesso.</p>

                        <div style={{ marginTop: '30px' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '12px 30px',
                                    background: '#00237f',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
