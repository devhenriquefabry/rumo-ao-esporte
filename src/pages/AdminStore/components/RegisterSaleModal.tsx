import { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, increment } from 'firebase/firestore';
import type { StoreProduct, PaymentMethodType } from '../../../types/store';
import { X, Search, User, CreditCard, ChevronRight, ChevronLeft, Loader, Check, Package, Upload } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import { compressImage } from '../../../utils/imageUtils';

interface StudentOption {
    registrationId: string;
    studentId: string;
    nome: string;
    dataNascimento: string;
    modalidade: string;
    fotoUrl: string;
    responsavelNome: string;
    responsavelCpf: string;
    responsavelEmail: string;
    responsavelPhone: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaleComplete: () => void;
}

const PM_LABELS: Record<PaymentMethodType, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de Crédito',
};

// Taxas Asaas para repasse (Gross-up)
function calculateAdjustedPrice(basePrice: number, installments: number): number {
    const FIXED_FEE = 0.49;
    const PERCENT_FEES: Record<number, number> = {
        1: 0.0399, 2: 0.0599, 3: 0.0699, 4: 0.0799, 5: 0.0899, 6: 0.0999,
        7: 0.1049, 8: 0.1099, 9: 0.1149, 10: 0.1199, 11: 0.1249, 12: 0.1299
    };
    const rate = PERCENT_FEES[installments] || PERCENT_FEES[1];
    return (basePrice + FIXED_FEE) / (1 - rate);
}

export default function RegisterSaleModal({ isOpen, onClose, onSaleComplete }: Props) {
    const { showAlert } = useDialog();
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Steps: 1=aluno, 2=produto, 3=detalhes, 4=pagamento, 5=sucesso
    const [saleType, setSaleType] = useState<'paid' | 'charge' | null>(null);
    const [step, setStep] = useState(0); // 0: Sale Type, 1: Student, 2: Product, 3: Details, 4: Date (if paid), 5: Payment, 6: Success
    const [loading, setLoading] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // Step 1: Student
    const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Step 2: Product
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Step 3: Details
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});

    // Step 5: Payment
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('PIX');
    const [installments, setInstallments] = useState(1);
    const [withInterest, setWithInterest] = useState(true);

    // After success
    const [paymentInfo, setPaymentInfo] = useState<{ invoiceUrl: string; pixCopyPaste: string | null } | null>(null);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStep(0);
            setSaleType(null);
            setSelectedStudent(null);
            setSelectedProduct(null);
            setQuantity(1);
            setSelectedSize('');
            setSelectedVariations({});
            setSelectedPaymentMethod('PIX');
            setInstallments(1);
            setWithInterest(true);
            setPaymentInfo(null);
            setStudentSearch('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            fetchStudents();
            fetchProducts();
        }
    }, [isOpen]);

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const list: StudentOption[] = [];
            snap.docs.forEach(docSnap => {
                const d = docSnap.data();
                const alunos = Array.isArray(d.alunos) ? d.alunos : [];
                alunos.forEach((a: any, idx: number) => {
                    list.push({
                        registrationId: docSnap.id,
                        studentId: `${docSnap.id}_${idx}`,
                        nome: a.nome || 'Sem nome',
                        dataNascimento: a.dataNascimento || '',
                        modalidade: d.modalidade || '',
                        fotoUrl: a.fotoUrl || '',
                        responsavelNome: d.responsavel?.nome || '',
                        responsavelCpf: d.responsavel?.cpf || '',
                        responsavelEmail: d.responsavel?.email || '',
                        responsavelPhone: d.responsavel?.telefonePrincipal || d.responsavel?.telefoneSecundario || '',
                    });
                });
            });
            setAllStudents(list);
        } catch (e) {
            console.error(e);
        }
        setLoadingStudents(false);
    };

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const q = query(collection(db, 'rae_store_products'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProduct)).filter(p => p.active && p.stock > 0);
            setProducts(list);
        } catch (e) {
            console.error(e);
        }
        setLoadingProducts(false);
    };

    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return allStudents.slice(0, 30);
        const term = normalize(studentSearch);
        return allStudents.filter(s => normalize(s.nome).includes(term) || normalize(s.responsavelNome).includes(term)).slice(0, 30);
    }, [allStudents, studentSearch]);

    // Price calculations
    const baseTotal = selectedProduct ? selectedProduct.price * quantity : 0;
    const isCreditCard = selectedPaymentMethod === 'CREDIT_CARD';
    const isBoleto = selectedPaymentMethod === 'BOLETO';
    const showInstallments = (isCreditCard || isBoleto) && (selectedProduct?.maxInstallments || 1) > 1;
    const totalAmount = (isCreditCard && withInterest && installments > 1)
        ? calculateAdjustedPrice(baseTotal, installments)
        : baseTotal;
    const installmentValue = totalAmount / installments;
    const maxInst = selectedProduct?.maxInstallments || 1;
    const availablePM: PaymentMethodType[] = (selectedProduct?.paymentMethods && selectedProduct.paymentMethods.length > 0)
        ? selectedProduct.paymentMethods : ['PIX'];

    const handleSelectProduct = (p: StoreProduct) => {
        setSelectedProduct(p);
        setSelectedSize('');
        setSelectedVariations({});
        setQuantity(1);
        const pm = (p.paymentMethods && p.paymentMethods.length > 0) ? p.paymentMethods : ['PIX'];
        setSelectedPaymentMethod(pm[0] as PaymentMethodType);
        setInstallments(1);
    };

    const canProceedStep3 = () => {
        if (!selectedProduct) return false;
        if (selectedProduct.hasSizes && selectedProduct.sizes && selectedProduct.sizes.length > 0 && !selectedSize) return false;
        if (selectedProduct.variations) {
            for (const v of selectedProduct.variations) {
                if (!selectedVariations[v.name]) return false;
            }
        }
        return true;
    };

    const handleConfirmSale = async () => {
        if (!selectedStudent || !selectedProduct) return;
        setLoading(true);

        try {
            const sizeLabel = selectedSize ? ` Tam: ${selectedSize}` : '';
            const variationsLabel = Object.entries(selectedVariations).map(([k, v]) => `${k}: ${v}`).join(', ');
            const description = `Loja: ${quantity}x ${selectedProduct.name}${sizeLabel}${variationsLabel ? ` (${variationsLabel})` : ''}`;

            const payload: any = {
                amount: Math.round(totalAmount * 100),
                billingType: selectedPaymentMethod,
                responsibleName: selectedStudent.responsavelNome,
                responsibleCpf: selectedStudent.responsavelCpf,
                responsibleEmail: selectedStudent.responsavelEmail || `rae_${Date.now()}@temp.com`,
                responsiblePhone: selectedStudent.responsavelPhone,
                childName: selectedStudent.nome,
                description,
                externalReference: `MANUAL_STORE_${selectedStudent.registrationId}_${Date.now()}`,
                registrationId: `MANUAL_STORE_${Date.now()}`,
            };

            if ((isCreditCard || isBoleto) && installments > 1) {
                payload.installmentCount = installments;
                payload.installmentValue = Math.round(installmentValue * 100);
            }

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!data.success || !data.payment) throw new Error(data.error || 'Erro ao gerar cobrança.');

            // 2) If "paid" => mark as received in Asaas
            let finalStatus = 'pending_payment';

            // Wait, Boleto/Credit Card can't be "receive in cash" in the same way, but Asaas allows receiveInCash for any billingType, but usually we do it for PIX/Cash
            // We just call the worker to receive it
            if (saleType === 'paid') {
                try {
                    await fetch(`${workerUrl}/payments/${data.payment.id}/receive-in-cash`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            value: totalAmount,
                            paymentDate: paymentDate, // Usa a data selecionada no step 4
                            notify: false
                        })
                    });
                    finalStatus = 'paid';
                } catch (e) {
                    console.error("Erro ao dar baixa manual:", e);
                    // Continues anyway
                }
            }

            let uploadedReceiptUrl = '';
            if (saleType === 'paid' && receiptFile) {
                try {
                    const compressedBlob = await compressImage(receiptFile);
                    const formData = new FormData();
                    formData.append('file', compressedBlob, receiptFile.name);
                    formData.append('folder', 'rae_store_receipts');

                    const response = await fetch(`${workerUrl}/images/upload`, {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Upload failed');
                    uploadedReceiptUrl = result.data?.url || result.url;
                } catch (e) {
                    console.error("Erro ao fazer upload do comprovante pro R2:", e);
                }
            }

            // Save order to Firestore with complete data
            const orderPayload: any = {
                // Student info
                customerId: selectedStudent.studentId,
                customerName: selectedStudent.nome,
                customerEmail: selectedStudent.responsavelEmail || '',
                customerPhotoUrl: selectedStudent.fotoUrl || '',
                customerModalidade: selectedStudent.modalidade || '',
                customerDateOfBirth: selectedStudent.dataNascimento || '',
                // Responsible info
                responsibleName: selectedStudent.responsavelNome,
                responsibleCpf: selectedStudent.responsavelCpf,
                responsiblePhone: selectedStudent.responsavelPhone,
                responsibleEmail: selectedStudent.responsavelEmail,
                // Registration reference
                registrationId: selectedStudent.registrationId,
                // Product/order details
                items: [{
                    productId: selectedProduct.id,
                    name: selectedProduct.name,
                    description: selectedProduct.description || '',
                    imageUrl: selectedProduct.imageUrl || '',
                    unitPrice: selectedProduct.price,
                    quantity,
                    price: selectedProduct.price,
                    ...(selectedSize ? { size: selectedSize } : {}),
                    ...(Object.keys(selectedVariations).length > 0 ? { selectedVariations } : {}),
                }],
                // Financial info
                baseAmount: baseTotal,
                totalAmount,
                paymentMethod: selectedPaymentMethod,
                paymentMethodLabel: PM_LABELS[selectedPaymentMethod],
                installments: installments,
                ...(installments > 1 ? { installmentValue: Number(installmentValue.toFixed(2)) } : {}),
                ...(installments > 1 ? { withInterest } : {}),
                saleObjective: saleType, // 'paid' or 'charge'
                // Asaas/charge info
                invoiceId: data.payment.id,
                asaasCustomerId: data.payment.customerId || '',
                externalReference: payload.externalReference,
                chargeDescription: description,
                invoiceUrl: data.payment.invoiceUrl || '',
                ...(uploadedReceiptUrl ? { receiptUrl: uploadedReceiptUrl } : {}),
                // Status & metadata
                status: finalStatus,
                ...(saleType === 'paid' ? { paymentDate } : {}),
                source: 'admin_sale',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, 'rae_store_orders'), orderPayload);

            // Decrement stock
            await updateDoc(doc(db, 'rae_store_products', selectedProduct.id!), {
                stock: increment(-quantity),
            });

            setPaymentInfo({
                invoiceUrl: data.payment.invoiceUrl,
                pixCopyPaste: data.pixInfo ? data.pixInfo.payload : null
            });

            setStep(6);
            showAlert(saleType === 'paid' ? 'Venda registrada e marcada como paga!' : 'Cobrança gerada com sucesso!', 'success');
        } catch (error: any) {
            console.error(error);
            showAlert(`Erro ao registrar venda: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const modalOverlay: React.CSSProperties = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    };
    const modalBox: React.CSSProperties = {
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '700px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
    };

    const stepLabels = saleType === 'paid'
        ? ['Objetivo', 'Aluno', 'Produto', 'Detalhes', 'Data Rec.', 'Pagamento']
        : ['Objetivo', 'Aluno', 'Produto', 'Detalhes', 'Pagamento'];

    // Calcula o índice real a ser comparado de acordo com saleType
    const maxSteps = stepLabels.length;

    return (
        <div style={modalOverlay} onClick={onClose}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#17428f', fontWeight: 800 }}>
                            {step === 6 ? 'Venda Registrada!' : 'Registrar Venda'}
                        </h2>
                        {step < 6 && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                {stepLabels.map((label, i) => {
                                    // Se charge, i=4 significa Pagamento, que na Engine é step=5
                                    const engineStep = saleType !== 'paid' && i === 4 ? 5 : i;
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                            color: step > engineStep ? '#2e7d32' : step === engineStep ? '#17428f' : '#bbb',
                                        }}>
                                            <div style={{
                                                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: step > engineStep ? '#2e7d32' : step === engineStep ? '#17428f' : '#eee',
                                                color: step > engineStep || step === engineStep ? '#fff' : '#bbb', fontSize: '0.7rem',
                                            }}>
                                                {step > engineStep ? <Check size={12} /> : i + 1}
                                            </div>
                                            {label}
                                            {i < maxSteps - 1 && <ChevronRight size={12} color="#ccc" />}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                        <X size={22} color="#999" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                    {/* STEP 0: Tipo de Venda */}
                    {step === 0 && (
                        <div>
                            <p style={{ margin: '0 0 20px', color: '#555' }}>Como você deseja registrar esta venda?</p>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    onClick={() => { setSaleType('paid'); setStep(1); }}
                                    style={{
                                        flex: 1, padding: '24px', borderRadius: '16px', background: saleType === 'paid' ? '#e8f5e9' : '#f9f9f9',
                                        border: saleType === 'paid' ? '2px solid #2e7d32' : '1px solid #ddd',
                                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                                    }}
                                >
                                    <div style={{ background: '#2e7d32', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                        <Check size={24} color="#fff" />
                                    </div>
                                    <h3 style={{ margin: '0 0 5px', color: '#333' }}>Já foi pago</h3>
                                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>O pagamento já foi recebido. Será registrado e baixado automaticamente no financeiro.</p>
                                </button>

                                <button
                                    onClick={() => { setSaleType('charge'); setStep(1); }}
                                    style={{
                                        flex: 1, padding: '24px', borderRadius: '16px', background: saleType === 'charge' ? '#e8eaf6' : '#f9f9f9',
                                        border: saleType === 'charge' ? '2px solid #17428f' : '1px solid #ddd',
                                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                                    }}
                                >
                                    <div style={{ background: '#17428f', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                        <CreditCard size={24} color="#fff" />
                                    </div>
                                    <h3 style={{ margin: '0 0 5px', color: '#333' }}>Gerar cobrança</h3>
                                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Vou gerar um link/pix para enviar ao responsável. O estoque será reservado.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Selecionar Aluno */}
                    {step === 1 && (
                        <div>
                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                <Search size={18} color="#999" style={{ position: 'absolute', left: 12, top: 12 }} />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno por nome..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    autoFocus
                                />
                            </div>

                            {loadingStudents ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                                    <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                                    <p>Carregando alunos...</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflow: 'auto' }}>
                                    {filteredStudents.map(s => (
                                        <button
                                            key={s.studentId}
                                            onClick={() => { setSelectedStudent(s); setStep(2); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                                                border: selectedStudent?.studentId === s.studentId ? '2px solid #17428f' : '1px solid #eee',
                                                borderRadius: '12px', background: selectedStudent?.studentId === s.studentId ? '#f0f4ff' : '#fafafa',
                                                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {s.fotoUrl ? (
                                                    <img src={s.fotoUrl} alt={s.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <User size={20} color="#17428f" />
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{s.nome}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                                    {s.modalidade} • Resp: {s.responsavelNome}
                                                </div>
                                            </div>
                                            <ChevronRight size={18} color="#ccc" />
                                        </button>
                                    ))}
                                    {filteredStudents.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Nenhum aluno encontrado.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Selecionar Produto */}
                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: '15px', padding: '12px 16px', background: '#f0f4ff', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <User size={16} color="#17428f" />
                                <span style={{ fontWeight: 'bold', color: '#17428f', fontSize: '0.9rem' }}>{selectedStudent?.nome}</span>
                            </div>

                            {loadingProducts ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Carregando produtos...</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                                    {products.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { handleSelectProduct(p); setStep(3); }}
                                            style={{
                                                display: 'flex', flexDirection: 'column', border: '1px solid #eee',
                                                borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', background: '#fff',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'all 0.15s', textAlign: 'left',
                                            }}
                                        >
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '120px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Package size={32} color="#ccc" />
                                                </div>
                                            )}
                                            <div style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', marginBottom: '4px' }}>{p.name}</div>
                                                <div style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '1rem' }}>R$ {p.price.toFixed(2)}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>Estoque: {p.stock}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {products.length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: '#888' }}>Nenhum produto ativo disponível.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Detalhes (Tamanho, Variação, Quantidade) */}
                    {step === 3 && selectedProduct && (
                        <div>
                            {/* Resumo do produto */}
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', padding: '16px', background: '#f8f9fa', borderRadius: '12px' }}>
                                {selectedProduct.imageUrl ? (
                                    <img src={selectedProduct.imageUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '10px' }} />
                                ) : (
                                    <div style={{ width: 80, height: 80, background: '#eee', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Package size={28} color="#ccc" />
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{selectedProduct.name}</div>
                                    <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '1rem' }}>R$ {selectedProduct.price.toFixed(2)}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Estoque: {selectedProduct.stock}</div>
                                </div>
                            </div>

                            {/* Quantidade */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Quantidade</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 36, height: 36, borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>−</button>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', minWidth: '30px', textAlign: 'center' }}>{quantity}</span>
                                    <button onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))} style={{ width: 36, height: 36, borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
                                </div>
                            </div>

                            {/* Tamanhos */}
                            {selectedProduct.hasSizes && selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Tamanho *</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {selectedProduct.sizes.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSelectedSize(s)}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer',
                                                    border: selectedSize === s ? '2px solid #17428f' : '1px solid #ddd',
                                                    background: selectedSize === s ? '#e8eaf6' : '#fff',
                                                    color: selectedSize === s ? '#17428f' : '#555',
                                                }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Variações */}
                            {selectedProduct.variations && selectedProduct.variations.map(v => (
                                <div key={v.name} style={{ marginBottom: '20px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>{v.name} *</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {v.options.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => setSelectedVariations(prev => ({ ...prev, [v.name]: opt }))}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer',
                                                    border: selectedVariations[v.name] === opt ? '2px solid #17428f' : '1px solid #ddd',
                                                    background: selectedVariations[v.name] === opt ? '#e8eaf6' : '#fff',
                                                    color: selectedVariations[v.name] === opt ? '#17428f' : '#555',
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STEP 4: Data do Recebimento (Somente Paid) */}
                    {step === 4 && saleType === 'paid' && selectedProduct && (
                        <div>
                            {/* Resumo */}
                            <div style={{ marginBottom: '25px', padding: '16px', background: '#f8f9fa', borderRadius: '12px' }}>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>Aluno: <strong style={{ color: '#333' }}>{selectedStudent?.nome}</strong></div>
                                <div style={{ fontSize: '0.85rem', color: '#888' }}>
                                    Produto: <strong style={{ color: '#333' }}>{quantity}x {selectedProduct.name}</strong>
                                    {selectedSize && <span> • Tam: {selectedSize}</span>}
                                    {Object.entries(selectedVariations).map(([k, v]) => <span key={k}> • {k}: {v}</span>)}
                                </div>
                            </div>

                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>
                                    Data de Recebimento do Pagamento *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', background: '#fff' }}
                                />
                                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                                    Esta é a data em que o pagamento foi ou será recebido em sua conta bancária/caixa. Necessário para os relatórios.
                                </p>
                            </div>

                            {/* Receipt Upload (optional) */}
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Upload size={16} /> Comprovante de Pagamento (Opcional)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                                    style={{ fontSize: '0.9rem', width: '100%', padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                                {receiptFile && <p style={{ fontSize: '0.8rem', color: '#10b981', margin: '8px 0 0 0', fontWeight: 'bold' }}>Arquivo: {receiptFile.name}</p>}
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Forma de Pagamento */}
                    {step === 5 && selectedProduct && (
                        <div>
                            {/* Resumo */}
                            <div style={{ marginBottom: '25px', padding: '16px', background: '#f8f9fa', borderRadius: '12px' }}>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>Aluno: <strong style={{ color: '#333' }}>{selectedStudent?.nome}</strong></div>
                                <div style={{ fontSize: '0.85rem', color: '#888' }}>
                                    Produto: <strong style={{ color: '#333' }}>{quantity}x {selectedProduct.name}</strong>
                                    {selectedSize && <span> • Tam: {selectedSize}</span>}
                                    {Object.entries(selectedVariations).map(([k, v]) => <span key={k}> • {k}: {v}</span>)}
                                </div>
                            </div>

                            {/* Forma de Pagamento */}
                            <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '12px' }}>Forma de Pagamento</label>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                {availablePM.map(pm => (
                                    <button
                                        key={pm}
                                        onClick={() => { setSelectedPaymentMethod(pm); setInstallments(1); }}
                                        style={{
                                            flex: '1 1 auto', padding: '14px 20px', borderRadius: '12px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s',
                                            border: selectedPaymentMethod === pm ? '2px solid #17428f' : '1px solid #ddd',
                                            background: selectedPaymentMethod === pm ? '#e8eaf6' : '#fff',
                                            color: selectedPaymentMethod === pm ? '#17428f' : '#555',
                                        }}
                                    >
                                        {PM_LABELS[pm]}
                                    </button>
                                ))}
                            </div>

                            {/* Parcelas */}
                            {showInstallments && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>
                                        Parcelas
                                    </label>
                                    <select
                                        value={installments}
                                        onChange={e => setInstallments(Number(e.target.value))}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', background: '#fff' }}
                                    >
                                        {Array.from({ length: maxInst }, (_, i) => i + 1).map(n => {
                                            const adj = (isCreditCard && withInterest && n > 1) ? calculateAdjustedPrice(baseTotal, n) : baseTotal;
                                            const instVal = adj / n;
                                            return (
                                                <option key={n} value={n}>
                                                    {n}x de R$ {instVal.toFixed(2)} {n > 1 && isCreditCard && withInterest ? `(Total: R$ ${adj.toFixed(2)})` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Toggle com/sem juros */}
                                    {installments > 1 && (
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                                onClick={() => setWithInterest(true)}
                                                style={{
                                                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    border: withInterest ? '2px solid #c0392b' : '1px solid #ddd',
                                                    background: withInterest ? '#fdecea' : '#fff',
                                                    color: withInterest ? '#c0392b' : '#888',
                                                }}
                                            >
                                                Com Juros
                                            </button>
                                            <button
                                                onClick={() => setWithInterest(false)}
                                                style={{
                                                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    border: !withInterest ? '2px solid #2e7d32' : '1px solid #ddd',
                                                    background: !withInterest ? '#e8f5e9' : '#fff',
                                                    color: !withInterest ? '#2e7d32' : '#888',
                                                }}
                                            >
                                                Sem Juros
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Total */}
                            <div style={{ padding: '20px', background: '#f0fff4', borderRadius: '12px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>Total da Venda</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2e7d32' }}>R$ {totalAmount.toFixed(2)}</div>
                                {installments > 1 && (
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                                        {installments}x de R$ {installmentValue.toFixed(2)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 6: Sucesso */}
                    {step === 6 && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <Check size={40} color="#2e7d32" />
                            </div>
                            <h3 style={{ color: '#333', margin: '0 0 10px' }}>Venda registrada!</h3>
                            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '25px' }}>
                                {saleType === 'paid'
                                    ? 'A cobrança foi criada no Asaas e marcada como recebida (PAGA).'
                                    : 'A cobrança foi criada no Asaas e está pendente de pagamento.'}
                            </p>

                            {saleType === 'charge' && paymentInfo && (
                                <div style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '12px', padding: '20px', textAlign: 'left', margin: '0 auto', maxWidth: '400px' }}>
                                    <h4 style={{ margin: '0 0 15px', color: '#333', fontSize: '1rem', textAlign: 'center' }}>Compartilhar Fatura</h4>

                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>Link de Pagamento (Cartão/Boleto/Pix)</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input type="text" readOnly value={paymentInfo.invoiceUrl} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.85rem' }} />
                                            <a href={paymentInfo.invoiceUrl} target="_blank" rel="noreferrer" style={{ background: '#17428f', color: '#fff', borderRadius: '8px', padding: '0 15px', display: 'flex', alignItems: 'center', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                Abrir
                                            </a>
                                        </div>
                                    </div>

                                    {paymentInfo.pixCopyPaste && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>Pix Cópia e Cola</label>
                                            <textarea readOnly value={paymentInfo.pixCopyPaste} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.8rem', resize: 'none', background: '#fff', boxSizing: 'border-box' }} />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(paymentInfo.pixCopyPaste!);
                                                    showAlert('Chave copiada para a área de transferência!', 'success');
                                                }}
                                                style={{ width: '100%', marginTop: '8px', background: '#e8eaf6', border: '1px solid #17428f', color: '#17428f', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Copiar Chave
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {step > 0 && step < 6 ? (
                        <button
                            onClick={() => {
                                if (step === 5 && saleType === 'charge') setStep(3); // pula step 4 no 'charge'
                                else setStep(step - 1);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', color: '#555', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            <ChevronLeft size={18} /> Voltar
                        </button>
                    ) : <div />}

                    {step === 3 && (
                        <button
                            onClick={() => canProceedStep3() ? setStep(saleType === 'paid' ? 4 : 5) : showAlert('Preencha todos os campos obrigatórios.', 'error')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '10px',
                                border: 'none', background: '#17428f', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem',
                                opacity: canProceedStep3() ? 1 : 0.5,
                            }}
                        >
                            {saleType === 'paid' ? 'Data Recebimento' : 'Pagamento'} <ChevronRight size={18} />
                        </button>
                    )}

                    {step === 4 && saleType === 'paid' && (
                        <button
                            onClick={() => paymentDate ? setStep(5) : showAlert('Insira a data do pagamento', 'error')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '10px',
                                border: 'none', background: '#17428f', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem',
                            }}
                        >
                            Pagamento <ChevronRight size={18} />
                        </button>
                    )}

                    {step === 5 && (
                        <button
                            onClick={handleConfirmSale}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px',
                                border: 'none', background: loading ? '#aaa' : '#2e7d32', color: '#fff', fontWeight: 'bold',
                                cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem',
                            }}
                        >
                            {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <CreditCard size={18} />}
                            {loading ? 'Processando...' : 'Confirmar Venda'}
                        </button>
                    )}

                    {step === 6 && (
                        <button
                            onClick={() => { onSaleComplete(); onClose(); }}
                            style={{
                                padding: '12px 28px', borderRadius: '10px', border: 'none', background: '#17428f',
                                color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', marginLeft: 'auto',
                            }}
                        >
                            Fechar
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
