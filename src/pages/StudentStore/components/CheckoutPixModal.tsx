import { useState, useEffect } from 'react';
import { X, Copy, Loader, Check, ShoppingBag, ArrowRight, ShieldCheck, CreditCard, FileText, ChevronDown, ChevronUp, User } from 'lucide-react';
import type { StoreProduct, PaymentMethodType } from '../../../types/store';
import { db, auth } from '../../../firebase';
import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';

interface CheckoutPixModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: StoreProduct;
}

const PM_LABELS: Record<PaymentMethodType, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de Crédito',
};
const PM_COLORS: Record<PaymentMethodType, string> = {
    PIX: '#00b894',
    BOLETO: '#0984e3',
    CREDIT_CARD: '#6c5ce7',
};

// Taxas Asaas para repasse (Gross-up)
// Cálculo: (Valor Líquido + Taxa Fixa) / (1 - Porcentagem)
const calculateAdjustedPrice = (basePrice: number, installments: number) => {
    let rate = 0;
    const fixedFee = 0.49;

    if (installments === 1) rate = 0.0299;
    else if (installments <= 6) rate = 0.0349;
    else if (installments <= 12) rate = 0.0399;
    else rate = 0.0429;

    return (basePrice + fixedFee) / (1 - rate);
};

export default function CheckoutPixModal({ isOpen, onClose, product }: CheckoutPixModalProps) {
    const [step, setStep] = useState(1);
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('PIX');
    const [installments, setInstallments] = useState(1);
    const [buyerInfo, setBuyerInfo] = useState({ name: '', cpf: '', phone: '' });
    const [showBillingInfo, setShowBillingInfo] = useState(false);

    // Payment result state
    const [loading, setLoading] = useState(false);
    const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
    const [pixCode, setPixCode] = useState('');
    const [pixQrUrl, setPixQrUrl] = useState('');
    const [boletoUrl, setBoletoUrl] = useState('');
    const [pixTimeLeft, setPixTimeLeft] = useState(0);
    const [copied, setCopied] = useState(false);
    const [cardData, setCardData] = useState({
        number: '',
        name: '',
        expiry: '',
        cvv: '',
        postalCode: '',
        addressNumber: ''
    });

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Formas de pagamento disponíveis para este produto
    const availablePaymentMethods: PaymentMethodType[] = (product.paymentMethods && product.paymentMethods.length > 0)
        ? product.paymentMethods
        : ['PIX'];

    useEffect(() => {
        if (!isOpen) return;
        setStep(1);
        setQuantity(1);
        setSelectedSize(product.hasSizes && product.sizes && product.sizes.length > 0 ? '' : '');
        setSelectedVariations({});
        setSelectedPaymentMethod(availablePaymentMethods[0]);
        setInstallments(1);
        setPendingPaymentId(null);
        setPixCode('');
        setPixQrUrl('');
        setBoletoUrl('');
        setCardData({ number: '', name: '', expiry: '', cvv: '', postalCode: '', addressNumber: '' });

        const fetchUser = async () => {
            const user = auth.currentUser;
            if (user?.email) {
                try {
                    const q = query(collection(db, "arena_simonesia_2026_registrations"), where("responsavel.email", "==", user.email.toLowerCase().trim()));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        setBuyerInfo({
                            name: data.responsavel?.nome || user.displayName || '',
                            cpf: data.responsavel?.cpf || '',
                            phone: data.responsavel?.telefonePrincipal || ''
                        });
                    }
                } catch (err) { console.error(err); }
            }
        };
        fetchUser();
    }, [isOpen, product]);

    // Timer PIX
    useEffect(() => {
        let timer: any;
        if (step === 2 && pixTimeLeft > 0 && selectedPaymentMethod === 'PIX') {
            timer = setInterval(() => setPixTimeLeft(prev => prev - 1), 1000);
        } else if (pixTimeLeft === 0 && step === 2 && selectedPaymentMethod === 'PIX') {
            alert("Tempo para pagamento expirou.");
            onClose();
        }
        return () => clearInterval(timer);
    }, [step, pixTimeLeft, selectedPaymentMethod]);

    if (!isOpen) return null;

    const baseTotal = product.price * quantity;
    const isCreditCard = selectedPaymentMethod === 'CREDIT_CARD';

    // Total ajustado se for cartão
    const totalAmount = isCreditCard
        ? calculateAdjustedPrice(baseTotal, installments)
        : baseTotal;

    const installmentValue = totalAmount / installments;
    const maxInst = (isCreditCard && product.maxInstallments) ? product.maxInstallments : 1;

    // Validações antes de gerar pagamento
    const validate = () => {
        if (product.hasSizes && product.sizes && product.sizes.length > 0 && !selectedSize) {
            alert("Por favor, selecione um tamanho."); return false;
        }
        if (product.variations && product.variations.length > 0) {
            for (const v of product.variations) {
                if (!selectedVariations[v.name]) {
                    alert(`Por favor, selecione uma opção para "${v.name}".`); return false;
                }
            }
        }
        if (!buyerInfo.name || !buyerInfo.cpf || !buyerInfo.phone) {
            alert("Preencha todos os dados do comprador."); return false;
        }
        const cleanCpf = buyerInfo.cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) { alert("CPF inválido."); return false; }

        if (selectedPaymentMethod === 'CREDIT_CARD') {
            if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv || !cardData.postalCode || !cardData.addressNumber) {
                alert('Por favor, preencha todos os dados do cartão e o endereço do titular.');
                return false;
            }
        }
        return true;
    };

    const handleGeneratePayment = async () => {
        if (!validate()) return;
        const cleanCpf = buyerInfo.cpf.replace(/\D/g, '');

        setLoading(true);
        try {
            const pDoc = await getDoc(doc(db, 'uba_store_products', product.id!));
            if (!pDoc.exists() || pDoc.data().stock < quantity) {
                alert("Estoque insuficiente."); setLoading(false); return;
            }

            const sizeLabel = selectedSize ? ` Tam: ${selectedSize}` : '';
            const variationsLabel = Object.entries(selectedVariations).map(([k, v]) => `${k}: ${v}`).join(', ');
            const description = `Compra: ${quantity}x ${product.name}${sizeLabel}${variationsLabel ? ` (${variationsLabel})` : ''}`;

            const [expiryMonth, expiryYear] = cardData.expiry.split('/');

            const payload = {
                amount: Math.round(totalAmount * 100),
                billingType: selectedPaymentMethod,
                installmentCount: selectedPaymentMethod === 'CREDIT_CARD' ? installments : undefined,
                installmentValue: selectedPaymentMethod === 'CREDIT_CARD' ? Math.round(installmentValue * 100) : undefined,
                responsibleName: buyerInfo.name,
                responsibleCpf: cleanCpf,
                responsibleEmail: auth.currentUser?.email || "email@teste.com",
                responsiblePhone: buyerInfo.phone.replace(/\D/g, ''),
                childName: "Loja Clube",
                description,
                registrationId: `STR_${Date.now()}`,
                creditCard: selectedPaymentMethod === 'CREDIT_CARD' ? {
                    holderName: cardData.name,
                    number: cardData.number.replace(/\s/g, ''),
                    expiryMonth: expiryMonth?.trim(),
                    expiryYear: expiryYear?.trim()?.length === 2 ? `20${expiryYear.trim()}` : expiryYear?.trim(),
                    ccv: cardData.cvv
                } : undefined,
                creditCardHolderInfo: selectedPaymentMethod === 'CREDIT_CARD' ? {
                    name: cardData.name,
                    email: auth.currentUser?.email || "email@teste.com",
                    cpfCnpj: cleanCpf,
                    postalCode: cardData.postalCode.replace(/\D/g, ''),
                    addressNumber: cardData.addressNumber,
                    mobilePhone: buyerInfo.phone.replace(/\D/g, '')
                } : undefined
            };

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.success || !data.payment) throw new Error(data.error || "Erro ao gerar cobrança.");

            setPendingPaymentId(data.payment.id);


            if (selectedPaymentMethod === 'PIX') {
                setPixCode(data.payment.pixQrCode);
                setPixQrUrl(`data:image/png;base64,${data.payment.pixQrCodeUrl}`);
                setPixTimeLeft(900);
            } else if (selectedPaymentMethod === 'BOLETO' || selectedPaymentMethod === 'CREDIT_CARD') {
                if (data.payment.status === 'CONFIRMED' || data.payment.status === 'RECEIVED') {
                    setStep(3);
                    return;
                }
                setBoletoUrl(data.payment.invoiceUrl || data.payment.bankSlipUrl || '');
            }

            setStep(2);
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao gerar pagamento: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const verifyPaymentAndCreateOrder = async () => {
        if (!pendingPaymentId) return;
        setLoading(true);
        try {
            const res = await fetch(`${workerUrl}/payment-status?paymentId=${pendingPaymentId}`);
            const data = await res.json();
            const isPaid = data.payment && ['RECEIVED', 'CONFIRMED', 'AVAILABLE'].includes(data.payment.status);

            if (isPaid) {
                await addDoc(collection(db, 'uba_store_orders'), {
                    customerId: auth.currentUser?.uid || 'guest',
                    customerName: buyerInfo.name,
                    customerEmail: auth.currentUser?.email || '',
                    items: [{
                        productId: product.id,
                        name: product.name,
                        quantity,
                        price: product.price,
                        size: selectedSize || undefined,
                        selectedVariations: Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined
                    }],
                    totalAmount,
                    paymentMethod: selectedPaymentMethod,
                    installments: selectedPaymentMethod === 'CREDIT_CARD' ? installments : 1,
                    status: 'paid',
                    invoiceId: pendingPaymentId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                await updateDoc(doc(db, 'uba_store_products', product.id!), { stock: increment(-quantity) });
                setStep(3);
            } else {
                alert("Pagamento não identificado. Aguarde mais alguns instantes.");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao verificar status.");
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-slide-up" style={{ background: '#fff', borderRadius: '24px', width: '90%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', position: 'sticky', top: 0, zIndex: 10 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingBag size={20} color="#00237f" /> Finalizar compra
                    </h2>
                    <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '20px' }}>
                    {/* ── STEP 1: Detalhes ─────────────────────────────────── */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Resumo do produto */}
                            <div style={{ display: 'flex', gap: '15px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                {product.imageUrl ? (
                                    <div style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: '70px', height: '70px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                                        <ShoppingBag size={28} />
                                    </div>
                                )}
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#1e293b' }}>{product.name}</h3>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#00237f' }}>R$ {product.price.toFixed(2)}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>{product.stock} disponíveis</div>
                                </div>
                            </div>

                            {/* Quantidade */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Quantidade</label>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', width: 'fit-content' }}>
                                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#334155', fontWeight: 'bold' }}>-</button>
                                    <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold', color: '#0f172a' }}>{quantity}</span>
                                    <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#334155', fontWeight: 'bold' }}>+</button>
                                </div>
                            </div>

                            {/* Tamanho */}
                            {product.hasSizes && product.sizes && product.sizes.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                                        Tamanho <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {product.sizes.map(s => (
                                            <button
                                                key={s} type="button"
                                                onClick={() => setSelectedSize(s)}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: selectedSize === s ? '#00237f' : '#f1f5f9',
                                                    color: selectedSize === s ? '#fff' : '#475569',
                                                    border: `2px solid ${selectedSize === s ? '#00237f' : '#e2e8f0'}`,
                                                }}
                                            >{s}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Variações */}
                            {product.variations && product.variations.map(v => (
                                <div key={v.name}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                                        {v.name} <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {v.options.map(opt => (
                                            <button
                                                key={opt} type="button"
                                                onClick={() => setSelectedVariations(prev => ({ ...prev, [v.name]: opt }))}
                                                style={{
                                                    padding: '7px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: selectedVariations[v.name] === opt ? '#007d2f' : '#f1f5f9',
                                                    color: selectedVariations[v.name] === opt ? '#fff' : '#475569',
                                                    border: `2px solid ${selectedVariations[v.name] === opt ? '#007d2f' : '#e2e8f0'}`,
                                                }}
                                            >{opt}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Forma de Pagamento */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>
                                    Forma de Pagamento <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {availablePaymentMethods.map(pm => {
                                        const active = selectedPaymentMethod === pm;
                                        return (
                                            <button
                                                key={pm} type="button"
                                                onClick={() => { setSelectedPaymentMethod(pm); setInstallments(1); }}
                                                style={{
                                                    padding: '10px 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: active ? PM_COLORS[pm] : '#f8fafc',
                                                    color: active ? '#fff' : '#475569',
                                                    border: `2px solid ${active ? PM_COLORS[pm] : '#e2e8f0'}`,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}
                                            >
                                                {active && <Check size={14} />} {PM_LABELS[pm]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Parcelas - Cartão */}
                            {selectedPaymentMethod === 'CREDIT_CARD' && (
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    {maxInst > 1 && (
                                        <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '14px', border: '1px solid #e9d5ff' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#5b21b6', marginBottom: '10px' }}>
                                                <CreditCard size={14} style={{ display: 'inline', marginRight: '5px' }} />
                                                Número de Parcelas
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {Array.from({ length: maxInst }, (_, i) => i + 1).map(n => {
                                                    const adjustedTotal = calculateAdjustedPrice(baseTotal, n);
                                                    const val = adjustedTotal / n;
                                                    const active = installments === n;
                                                    return (
                                                        <button
                                                            key={n} type="button"
                                                            onClick={() => setInstallments(n)}
                                                            style={{
                                                                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                                                                background: active ? '#6c5ce7' : '#fff',
                                                                color: active ? '#fff' : '#4c1d95',
                                                                border: `2px solid ${active ? '#6c5ce7' : '#e9d5ff'}`,
                                                                fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: 'bold' }}>{n}x de R$ {val.toFixed(2)}</div>
                                                            {n === 1 && <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>à vista</div>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Integrated Credit Card Form */}
                                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CreditCard size={16} /> Dados do Cartão
                                        </h3>
                                        <input
                                            type="text" placeholder="Número do Cartão"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                            value={cardData.number}
                                            onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                                        />
                                        <input
                                            type="text" placeholder="Nome Impresso no Cartão"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', textTransform: 'uppercase' }}
                                            value={cardData.name}
                                            onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <input
                                                type="text" placeholder="MM/AA"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center' }}
                                                value={cardData.expiry}
                                                onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                                            />
                                            <input
                                                type="text" placeholder="CVV"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center' }}
                                                value={cardData.cvv}
                                                onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                            />
                                        </div>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={16} /> Endereço do Titular
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                            <input
                                                type="text" placeholder="CEP"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                                value={cardData.postalCode}
                                                onChange={(e) => setCardData({ ...cardData, postalCode: e.target.value })}
                                            />
                                            <input
                                                type="text" placeholder="Nº"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                                value={cardData.addressNumber}
                                                onChange={(e) => setCardData({ ...cardData, addressNumber: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Dados do comprador */}
                            <div>
                                <button
                                    onClick={() => setShowBillingInfo(!showBillingInfo)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: showBillingInfo ? '12px 12px 0 0' : '12px', color: '#64748b', cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        <User size={16} /> Dados para Cobrança
                                    </div>
                                    {showBillingInfo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                {showBillingInfo && (
                                    <div style={{ background: '#fff', padding: '14px', borderRadius: '0 0 12px 12px', border: '1px solid #e2e8f0', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>Responsável</div>
                                            <div style={{ color: '#475569', fontWeight: '600' }}>{buyerInfo.name || '---'}</div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>CPF</div>
                                                <div style={{ color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>{buyerInfo.cpf || '---'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>Celular</div>
                                                <div style={{ color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>{buyerInfo.phone || '---'}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Total */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1rem', color: '#4b5563' }}>Total:</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#16a34a' }}>R$ {totalAmount.toFixed(2)}</span>
                                </div>
                                {selectedPaymentMethod === 'CREDIT_CARD' && installments > 1 && (
                                    <div style={{ fontSize: '0.8rem', color: '#6c5ce7', marginTop: '4px', fontWeight: 'bold', textAlign: 'right' }}>
                                        {installments}x de R$ {installmentValue.toFixed(2)}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ShieldCheck size={13} /> Pagamento seguro via {PM_LABELS[selectedPaymentMethod]}
                                </div>
                            </div>

                            <button
                                onClick={handleGeneratePayment}
                                disabled={loading}
                                style={{ width: '100%', padding: '15px', background: PM_COLORS[selectedPaymentMethod], color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1 }}
                            >
                                {loading ? <Loader className="animate-spin" /> : (
                                    <>{selectedPaymentMethod === 'CREDIT_CARD' ? 'CONFIRMAR PEDIDO' : selectedPaymentMethod === 'BOLETO' ? 'GERAR BOLETO' : 'GERAR PIX'} <ArrowRight size={18} /></>
                                )}
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: Pagamento ────────────────────────────────── */}
                    {step === 2 && (
                        <div style={{ textAlign: 'center' }}>
                            {selectedPaymentMethod === 'PIX' && (
                                <>
                                    <div style={{ background: '#fefce8', padding: '10px', borderRadius: '8px', color: '#a16207', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        Pague o QR Code abaixo para finalizar o pedido.
                                    </div>
                                    <div style={{ display: 'inline-block', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                        {pixQrUrl ? <img src={pixQrUrl} alt="Pix" style={{ width: '200px', height: '200px' }} /> : <Loader className="animate-spin" size={32} />}
                                    </div>
                                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>Código Copia e Cola:</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input readOnly value={pixCode} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontSize: '0.85rem', color: '#334155' }} />
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(pixCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                                style={{ padding: '0 16px', background: copied ? '#16a34a' : '#00237f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                                            >
                                                {copied ? <Check size={16} /> : <Copy size={16} />} Copiar
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: pixTimeLeft < 60 ? '#ef4444' : '#0f172a', marginBottom: '20px' }}>
                                        Tempo restante: {formatTime(pixTimeLeft)}
                                    </div>
                                </>
                            )}

                            {selectedPaymentMethod === 'BOLETO' && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', color: '#1d4ed8', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        Boleto gerado! Pague até a data de vencimento.
                                    </div>
                                    {boletoUrl && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <a href={boletoUrl} target="_blank" rel="noreferrer"
                                                style={{ display: 'block', padding: '14px', background: '#0984e3', color: '#fff', textDecoration: 'none', borderRadius: '12px', fontWeight: 'bold' }}>
                                                Abrir Boleto
                                            </a>
                                            <a href={boletoUrl} target="_blank" rel="noreferrer"
                                                style={{ display: 'block', padding: '14px', background: '#f8fafc', color: '#0984e3', textDecoration: 'none', borderRadius: '12px', fontWeight: 'bold', border: '2px solid #0984e3' }}>
                                                Baixar Boleto
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedPaymentMethod === 'CREDIT_CARD' && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '12px', marginBottom: '16px', color: '#5b21b6', fontWeight: 'bold' }}>
                                        Pagamento Processando...
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
                                        Seu pagamento está sendo processado. Você pode acompanhar o status pelo link abaixo ou aguardar a confirmação automática.
                                    </p>
                                    {boletoUrl && (
                                        <a href={boletoUrl} target="_blank" rel="noreferrer"
                                            style={{ display: 'block', padding: '14px', background: '#6c5ce7', color: '#fff', textDecoration: 'none', borderRadius: '12px', fontWeight: 'bold', marginBottom: '16px' }}>
                                            Ver Detalhes do Pagamento
                                        </a>
                                    )}
                                </div>
                            )}

                            {selectedPaymentMethod !== 'CREDIT_CARD' && (
                                <button
                                    onClick={verifyPaymentAndCreateOrder}
                                    disabled={loading}
                                    style={{ width: '100%', padding: '15px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1 }}
                                >
                                    {loading ? <Loader className="animate-spin" /> : 'JÁ FIZ O PAGAMENTO'}
                                </button>
                            )}
                            <button
                                onClick={() => setStep(1)}
                                style={{ width: '100%', padding: '10px', background: 'transparent', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                            >
                                Alterar forma de pagamento
                            </button>
                        </div>
                    )}

                    {/* ── STEP 3: Sucesso ──────────────────────────────────── */}
                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#16a34a' }}>
                                <Check size={40} />
                            </div>
                            <h2 style={{ color: '#16a34a', margin: '0 0 10px 0', fontSize: '1.6rem' }}>Pedido Confirmado!</h2>
                            <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '24px' }}>
                                Seu pedido está sendo processado e logo estará disponível para retirada.
                            </p>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '24px', textAlign: 'left', fontSize: '0.9rem', color: '#64748b' }}>
                                <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>Resumo do Pedido</div>
                                <div>Item: {product.name} {selectedSize && `(${selectedSize})`}</div>
                                {Object.entries(selectedVariations).map(([k, v]) => (
                                    <div key={k}>{k}: {v}</div>
                                ))}
                                <div>Qtd: {quantity}</div>
                                <div>Pagamento: {PM_LABELS[selectedPaymentMethod]}{installments > 1 ? ` • ${installments}x de R$ ${installmentValue.toFixed(2)}` : ''}</div>
                                <div style={{ fontWeight: 'bold', color: '#0f172a', marginTop: '8px' }}>Total: R$ {totalAmount.toFixed(2)}</div>
                            </div>
                            <button onClick={onClose} style={{ width: '100%', padding: '14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
                                FECHAR
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
