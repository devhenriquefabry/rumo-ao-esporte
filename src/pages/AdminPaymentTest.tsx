import { useState } from 'react';

export default function AdminPaymentTest() {
    const [amount, setAmount] = useState('5.00');
    const [description, setDescription] = useState('Teste Admin Rumo ao Esporte');
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

    // Credit Card State
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiryMonth, setExpiryMonth] = useState('');
    const [expiryYear, setExpiryYear] = useState('');
    const [ccv, setCcv] = useState('');
    const [installments, setInstallments] = useState(1);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [statusResult, setStatusResult] = useState<any>(null);
    const [checkingStatus, setCheckingStatus] = useState(false);

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Fee Calculation Logic
    const calculateGrossAmount = (netAmount: number, installments: number) => {
        const fixedFee = 0.49;
        let rate = 0;

        if (installments === 1) rate = 0.0299;
        else if (installments >= 2 && installments <= 6) rate = 0.0349;
        else if (installments >= 7 && installments <= 12) rate = 0.0399;
        else if (installments >= 13) rate = 0.0429;

        // Formula: Net = Gross - (Gross * Rate + Fixed)
        // Net + Fixed = Gross * (1 - Rate)
        // Gross = (Net + Fixed) / (1 - Rate)
        const gross = (netAmount + fixedFee) / (1 - rate);
        return gross;
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setStatusResult(null);

        try {
            if (!workerUrl) throw new Error('VITE_WORKER_URL not configured');

            const netValueInCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
            let finalValueInCents = netValueInCents;

            // Recalculate if Credit Card to pass fees
            if (paymentMethod === 'CREDIT_CARD') {
                const netValueReal = parseFloat(amount.replace(',', '.'));
                const grossValueReal = calculateGrossAmount(netValueReal, installments);
                finalValueInCents = Math.round(grossValueReal * 100);
            }

            const payload: any = {
                amount: finalValueInCents,
                billingType: paymentMethod,
                responsibleName: 'Admin Tester',
                responsibleCpf: '15133300638',
                responsibleEmail: 'admin_test@uba.com',
                responsiblePhone: '00000000000',
                childName: 'Teste Sistema',
                registrationId: `TEST_${Date.now()}`,
                description: description
            };

            if (paymentMethod === 'CREDIT_CARD') {
                payload.creditCard = {
                    holderName: cardName,
                    number: cardNumber.replace(/\s/g, ''),
                    expiryMonth,
                    expiryYear,
                    ccv
                };
                payload.creditCardHolderInfo = {
                    name: 'Admin Tester',
                    email: 'admin_test@uba.com',
                    cpfCnpj: '15133300638',
                    postalCode: '12345678',
                    addressNumber: '100',
                    phone: '44999999999',
                    mobilePhone: '44999999999'
                };
                if (installments > 1) {
                    payload.installmentCount = installments;
                    payload.installmentValue = finalValueInCents / installments;
                }
            }

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            setResult(data);
        } catch (error: any) {
            console.error(error);
            setResult({ success: false, error: error.message });
        } finally {
            setLoading(false);
        }
    };

    // Helper to format currency
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    // Calculate details for current selection for display
    const currentNet = parseFloat(amount.replace(',', '.')) || 0;
    const currentGross = calculateGrossAmount(currentNet, installments);

    const checkStatus = async () => {
        if (!result?.payment?.id) return;
        setCheckingStatus(true);
        try {
            const response = await fetch(`${workerUrl}/payment-status?paymentId=${result.payment.id}`);
            const data = await response.json();
            setStatusResult(data);
        } catch (error: any) {
            setStatusResult({ error: error.message });
        } finally {
            setCheckingStatus(false);
        }
    };

    return (
        <div className="admin-page">
            <header style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', marginBottom: '10px' }}>Teste de Pagamentos</h1>
                <p style={{ color: '#666' }}>Gere pagamentos reais para validar a integração com o Asaas.</p>
                <div style={{ marginTop: '10px', padding: '10px', background: '#fff3e0', borderLeft: '4px solid #ff9800', color: '#e65100', fontSize: '0.9rem' }}>
                    ⚠️ <strong>Atenção:</strong> Testes de Cartão de Crédito em produção geram cobranças reais. Use com cautela ou estorne imediatamente.
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* Form Section */}
                <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: '#00a63a' }}>Gerar Nova Cobrança</h2>

                    {/* Method Selector */}
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('PIX')}
                            style={{
                                flex: 1, padding: '12px', border: paymentMethod === 'PIX' ? '2px solid #00a63a' : '1px solid #ddd',
                                borderRadius: '8px', background: paymentMethod === 'PIX' ? '#fff0f0' : '#fff',
                                fontWeight: 'bold', color: paymentMethod === 'PIX' ? '#00a63a' : '#666', cursor: 'pointer'
                            }}
                        >
                            💠 PIX
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('CREDIT_CARD')}
                            style={{
                                flex: 1, padding: '12px', border: paymentMethod === 'CREDIT_CARD' ? '2px solid #00a63a' : '1px solid #ddd',
                                borderRadius: '8px', background: paymentMethod === 'CREDIT_CARD' ? '#fff0f0' : '#fff',
                                fontWeight: 'bold', color: paymentMethod === 'CREDIT_CARD' ? '#00a63a' : '#666', cursor: 'pointer'
                            }}
                        >
                            💳 Cartão de Crédito
                        </button>
                    </div>

                    <form onSubmit={handleCreatePayment}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                                    {paymentMethod === 'PIX' ? 'Valor (R$)' : 'Valor Líquido Desejado (R$)'}
                                </label>
                                <input
                                    type="number" step="0.01"
                                    value={amount} onChange={e => setAmount(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                />
                                {paymentMethod === 'CREDIT_CARD' && (
                                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                                        Valor Total a Cobrar: <strong>{formatCurrency(currentGross)}</strong>
                                    </small>
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Descrição</label>
                                <input
                                    type="text"
                                    value={description} onChange={e => setDescription(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>

                        {paymentMethod === 'CREDIT_CARD' && (
                            <div style={{ background: '#fafafa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #eee' }}>
                                <h4 style={{ marginBottom: '15px', color: '#444' }}>Dados do Cartão</h4>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Nome no Cartão</label>
                                    <input
                                        type="text" placeholder="COMO ESTA NO CARTAO"
                                        value={cardName} onChange={e => setCardName(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Número do Cartão</label>
                                    <input
                                        type="text" placeholder="0000 0000 0000 0000"
                                        value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Mês (MM)</label>
                                        <input
                                            type="text" placeholder="MM" maxLength={2}
                                            value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Ano (AAAA)</label>
                                        <input
                                            type="text" placeholder="AAAA" maxLength={4}
                                            value={expiryYear} onChange={e => setExpiryYear(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>CCV</label>
                                        <input
                                            type="text" placeholder="123" maxLength={4}
                                            value={ccv} onChange={e => setCcv(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Parcelamento (com repasse de juros)</label>
                                    <select
                                        value={installments} onChange={e => setInstallments(Number(e.target.value))}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
                                            const gross = calculateGrossAmount(currentNet, num);
                                            const val = gross / num;
                                            return (
                                                <option key={num} value={num}>
                                                    {num}x de {formatCurrency(val)} (Total: {formatCurrency(gross)})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit" disabled={loading}
                            style={{
                                width: '100%', padding: '12px', background: '#00a63a', color: '#fff',
                                border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Processando...' : `Gerar Cobrança ${paymentMethod === 'PIX' ? 'PIX' : 'Cartão'}`}
                        </button>
                    </form>

                    {/* Config Info */}
                    <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <strong>Configuração Atual:</strong>
                        <div style={{ marginTop: '5px', wordBreak: 'break-all' }}>URL Worker: {workerUrl}</div>
                        <div style={{ marginTop: '5px' }}>Ambiente: {import.meta.env.MODE}</div>
                    </div>
                </div>

                {/* Results Section */}
                {result?.success && (
                    <div style={{ background: '#e0f7fa', padding: '30px', borderRadius: '12px', border: '2px solid #006d77', textAlign: 'center' }}>
                        <h2 style={{ color: '#006d77', marginBottom: '20px', fontSize: '1.5rem' }}>✅ Cobrança Gerada com Sucesso!</h2>

                        {result.payment.pixQrCodeUrl ? (
                            <div style={{ marginBottom: '20px', padding: '15px', background: '#fff', display: 'inline-block', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                <img src={`data:image/png;base64,${result.payment.pixQrCodeUrl}`} alt="QR Code PIX" style={{ width: '200px', height: '200px' }} />
                                <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>Scan para Pagar</p>
                            </div>
                        ) : paymentMethod === 'CREDIT_CARD' ? (
                            <div style={{ marginBottom: '20px', fontSize: '1.1rem', color: '#2c7a7b' }}>
                                Pagamento via Cartão processado. Verifique o status abaixo.
                            </div>
                        ) : (
                            <p style={{ color: 'red' }}>QR Code Url não disponível na resposta.</p>
                        )}

                        {result.payment.pixQrCode && (
                            <div style={{ maxWidth: '600px', margin: '0 auto 20px auto', textAlign: 'left' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Copia e Cola:</label>
                                <textarea
                                    readOnly
                                    value={result.payment.pixQrCode || 'Sem código'}
                                    style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                            <div style={{ padding: '10px 20px', background: '#fff', borderRadius: '6px' }}>
                                <strong>ID:</strong> <code>{result.payment.id}</code>
                            </div>

                            <button
                                onClick={checkStatus} disabled={checkingStatus}
                                style={{
                                    padding: '12px 25px', background: '#004d40', color: '#fff',
                                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                {checkingStatus ? 'Verificando...' : '🔄 Verificar Status no Asaas'}
                            </button>
                        </div>

                        {statusResult && (
                            <div style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
                                <h4 style={{ marginBottom: '10px', color: '#333' }}>Resultado da Verificação:</h4>
                                <strong style={{ fontSize: '1.2rem', color: statusResult?.payment?.status === 'RECEIVED' || statusResult?.payment?.status === 'CONFIRMED' ? 'green' : '#e65100' }}>
                                    {statusResult?.payment?.status || 'Desconhecido'}
                                </strong>
                                <p>Data: {statusResult?.payment?.clientPaymentDate || statusResult?.payment?.paymentDate || 'Pendente'}</p>
                                {statusResult?.payment?.invoiceUrl && (
                                    <a href={statusResult.payment.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '10px', color: '#006d77', textDecoration: 'underline' }}>
                                        Ver Fatura / Comprovante
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Debug Log */}
                <div style={{ background: '#2d3748', padding: '20px', borderRadius: '12px', color: '#cbd5e0', fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'auto', maxHeight: '300px' }}>
                    <div style={{ marginBottom: '10px', borderBottom: '1px solid #4a5568', paddingBottom: '5px', fontWeight: 'bold' }}>LOG TÉCNICO (JSON RESPONSES)</div>
                    <pre>{JSON.stringify(result || {}, null, 2)}</pre>
                    {statusResult && (
                        <>
                            <div style={{ margin: '15px 0 10px 0', borderBottom: '1px solid #4a5568', paddingBottom: '5px', fontWeight: 'bold' }}>Status Check Log</div>
                            <pre>{JSON.stringify(statusResult, null, 2)}</pre>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
