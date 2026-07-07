
import React, { useState } from 'react';

export const AdminSystemTest: React.FC = () => {
    // ... rest of component

    const [activeTab, setActiveTab] = useState<'payment' | 'uploads' | 'status'>('payment');
    const [workerStatus, setWorkerStatus] = useState<string | null>(null);
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Payment State
    const [cpf, setCpf] = useState('15133300638');
    const [value, setValue] = useState(100);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

    // Upload State
    const [uploadType, setUploadType] = useState<'image' | 'document'>('image');
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    const checkWorker = async () => {
        try {
            setWorkerStatus('Checking...');
            const start = Date.now();
            const res = await fetch(`${workerUrl}/options`); // Just hitting valid cors
            const end = Date.now();
            if (res.ok || res.status === 404) {
                setWorkerStatus(`Online (${end - start}ms) - ${workerUrl}`);
            } else {
                setWorkerStatus(`Error: ${res.status}`);
            }
        } catch (e: any) {
            setWorkerStatus(`Offline/Error: ${e.message}`);
        }
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingPayment(true);
        setPaymentResult(null);
        try {
            const payload = {
                amount: value * 100, // Cents
                billingType: paymentMethod,
                responsibleName: "Admin Tester",
                responsibleCpf: cpf,
                responsibleEmail: "admin@test.com",
                responsiblePhone: "11999999999",
                childName: "Test Child",
                description: "Teste Admin System",
                // Credit Card Data (Mock for test if selected)
                ...(paymentMethod === 'CREDIT_CARD' ? {
                    creditCard: {
                        holderName: "TEST HOLDER",
                        number: "0000000000000000",
                        expiryMonth: "12",
                        expiryYear: "2030",
                        ccv: "123"
                    },
                    creditCardHolderInfo: {
                        name: "TEST HOLDER",
                        email: "test@test.com",
                        cpfCnpj: cpf,
                        postalCode: "00000000",
                        addressNumber: "100",
                        phone: "11999999999"
                    }
                } : {})
            };

            const response = await fetch(`${workerUrl}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            setPaymentResult(data);
        } catch (error: any) {
            setPaymentResult({ error: error.message });
        } finally {
            setLoadingPayment(false);
        }
    };

    const handleUploadTest = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (uploadType === 'image') {
                formData.append('folder', 'admin_tests');
            }

            const endpoint = uploadType === 'image' ? '/images/upload' : '/upload-document';

            const response = await fetch(`${workerUrl}${endpoint}`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            setUploadResult(data);
        } catch (error: any) {
            setUploadResult({ error: error.message });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: '30px' }}>
            <h1 style={{ marginBottom: '20px', color: '#006d77' }}>Testes do Sistema Backend</h1>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <button onClick={() => setActiveTab('payment')} style={{ padding: '10px 20px', background: activeTab === 'payment' ? '#006d77' : '#eee', color: activeTab === 'payment' ? '#fff' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Pagamentos</button>
                <button onClick={() => setActiveTab('uploads')} style={{ padding: '10px 20px', background: activeTab === 'uploads' ? '#006d77' : '#eee', color: activeTab === 'uploads' ? '#fff' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Uploads</button>
                <button onClick={() => { setActiveTab('status'); checkWorker(); }} style={{ padding: '10px 20px', background: activeTab === 'status' ? '#006d77' : '#eee', color: activeTab === 'status' ? '#fff' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Status do Worker</button>
            </div>

            {activeTab === 'status' && (
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <h3>Conectividade com Worker</h3>
                    <p>URL Configurada: <strong>{workerUrl}</strong></p>
                    <button onClick={checkWorker} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}>Verificar Agora</button>
                    {workerStatus && <p style={{ marginTop: '15px', fontWeight: 'bold', color: workerStatus.startsWith('Error') ? 'red' : 'green' }}>{workerStatus}</p>}
                </div>
            )}

            {activeTab === 'payment' && (
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <h3>Teste de Pagamento (Asaas)</h3>
                    <form onSubmit={handleCreatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
                        <div>
                            <label>CPF (Responsável):</label>
                            <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} style={{ padding: '8px', width: '100%', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>
                        <div>
                            <label>Valor (R$):</label>
                            <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} style={{ padding: '8px', width: '100%', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>
                        <div>
                            <label>Método:</label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} style={{ padding: '8px', width: '100%', border: '1px solid #ddd', borderRadius: '4px' }}>
                                <option value="PIX">PIX</option>
                                <option value="CREDIT_CARD">Cartão de Crédito (Mock)</option>
                            </select>
                        </div>
                        {paymentMethod === 'CREDIT_CARD' && <p style={{ fontSize: '0.8rem', color: 'red' }}>Atenção: Teste de cartão enviará dados INVÁLIDOS propositalmente apenas para testar a rota.</p>}
                        <button type="submit" disabled={loadingPayment} style={{ padding: '10px', background: '#00a63a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            {loadingPayment ? 'Processando...' : 'Criar Pagamento Teste'}
                        </button>
                    </form>
                    {paymentResult && (
                        <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
                            <h4>Resultado:</h4>
                            <pre>{JSON.stringify(paymentResult, null, 2)}</pre>
                            {paymentResult.payment?.pixQrCodeUrl && (
                                <img src={paymentResult.payment.pixQrCodeUrl} alt="QR Code" style={{ width: '200px', marginTop: '10px' }} />
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'uploads' && (
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <h3>Teste de Uploads</h3>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ marginRight: '15px' }}>
                            <input type="radio" name="uploadType" value="image" checked={uploadType === 'image'} onChange={() => setUploadType('image')} /> Upload de Imagem (Público - Cloudinary/etc)
                        </label>
                        <label>
                            <input type="radio" name="uploadType" value="document" checked={uploadType === 'document'} onChange={() => setUploadType('document')} /> Upload de Documento (Seguro - R2)
                        </label>
                    </div>

                    <div style={{ padding: '30px', border: '2px dashed #ddd', borderRadius: '8px', textAlign: 'center' }}>
                        <input type="file" onChange={handleUploadTest} disabled={uploading} />
                        {uploading && <p>Enviando...</p>}
                    </div>

                    {uploadResult && (
                        <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                            <h4>Resultado:</h4>
                            <pre>{JSON.stringify(uploadResult, null, 2)}</pre>
                            {uploadResult.url && uploadType === 'image' && (
                                <img src={uploadResult.url} alt="Uploaded" style={{ maxWidth: '300px', marginTop: '10px' }} />
                            )}
                            {uploadResult.url && uploadType === 'document' && (
                                <div style={{ marginTop: '10px' }}>
                                    <a href={uploadResult.url} target="_blank" rel="noreferrer" style={{ color: '#006d77', fontWeight: 'bold' }}>Abrir Documento Seguro</a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
