import { useState } from 'react';
import { Send, Terminal, CreditCard, Upload, Server, Smartphone } from 'lucide-react';

export default function AdminTestes() {
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'payment' | 'uploads' | 'status'>('whatsapp');
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Worker Status State
    const [workerStatus, setWorkerStatus] = useState<string | null>(null);

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

    // --- Actions ---

    const runWhatsAppTest = async () => {
        setLoading(true);
        setLogs('Iniciando teste de WhatsApp...\n');

        const testNumber = '33998200546';
        const testMessage = 'Teste de sistema - Admin Panel';

        setLogs(prev => prev + `Target: ${testNumber}\nEndpoint: ${workerUrl}/send-whatsapp\n`);

        try {
            const response = await fetch(`${workerUrl}/send-whatsapp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: testNumber, message: testMessage })
            });

            setLogs(prev => prev + `Status: ${response.status} ${response.statusText}\n`);

            const data = await response.json();
            setLogs(prev => prev + `Response Body:\n${JSON.stringify(data, null, 2)}`);

        } catch (error: any) {
            console.error("Test error:", error);
            setLogs(prev => prev + `ERROR: ${error.message}\n`);
        } finally {
            setLoading(false);
        }
    };

    const checkWorker = async () => {
        try {
            setWorkerStatus('Checking...');
            const start = Date.now();
            const res = await fetch(`${workerUrl}/options`);
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

    // --- Render ---

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => { setActiveTab(id); if (id === 'status') checkWorker(); }}
            style={{
                padding: '12px 20px',
                background: activeTab === id ? '#006d77' : '#fff',
                color: activeTab === id ? '#fff' : '#444',
                border: '1px solid #ddd',
                borderBottom: activeTab === id ? 'none' : '1px solid #ddd',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: activeTab === id ? 'bold' : 'normal',
                marginRight: '5px'
            }}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ color: '#333', fontSize: '1.8rem', fontWeight: '700', marginBottom: '30px' }}>Ferramentas de Teste</h2>

            <div style={{ display: 'flex', borderBottom: '2px solid #006d77', marginBottom: '20px' }}>
                <TabButton id="whatsapp" label="WhatsApp" icon={Smartphone} />
                <TabButton id="payment" label="Pagamentos" icon={CreditCard} />
                <TabButton id="uploads" label="Uploads" icon={Upload} />
                <TabButton id="status" label="Status" icon={Server} />
            </div>

            {/* TAB: WHATSAPP */}
            {activeTab === 'whatsapp' && (
                <div style={{ background: '#fff', padding: '30px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#006d77', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Send size={20} /> Teste de Integração WhatsApp
                    </h3>

                    <p style={{ marginBottom: '20px', color: '#666' }}>
                        Envia uma mensagem de teste para o número <strong>(33) 99820-0546</strong>.
                    </p>

                    <button
                        onClick={runWhatsAppTest}
                        disabled={loading}
                        style={{
                            padding: '12px 24px',
                            background: loading ? '#ccc' : '#006d77',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? 'Testando...' : 'Executar Teste WhatsApp'}
                    </button>

                    <div style={{ marginTop: '30px', background: '#1e1e1e', color: '#0f0', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', minHeight: '150px', overflowX: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                            <Terminal size={16} /> Console Output
                        </div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {logs || 'Aguardando execução...'}
                        </pre>
                    </div>
                </div>
            )}

            {/* TAB: PAYMENT */}
            {activeTab === 'payment' && (
                <div style={{ background: '#fff', padding: '30px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3>Teste de Pagamento (Asaas)</h3>
                    <form onSubmit={handleCreatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', marginTop: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>CPF (Responsável):</label>
                            <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} style={{ padding: '10px', width: '100%', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Valor (R$):</label>
                            <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} style={{ padding: '10px', width: '100%', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Método:</label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} style={{ padding: '10px', width: '100%', border: '1px solid #ddd', borderRadius: '6px' }}>
                                <option value="PIX">PIX</option>
                                <option value="CREDIT_CARD">Cartão de Crédito (Mock)</option>
                            </select>
                        </div>
                        {paymentMethod === 'CREDIT_CARD' && <p style={{ fontSize: '0.8rem', color: 'red' }}>Atenção: Teste de cartão enviará dados INVÁLIDOS propositalmente.</p>}
                        <button type="submit" disabled={loadingPayment} style={{ padding: '12px', background: '#007d2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            {loadingPayment ? 'Processando...' : 'Criar Pagamento Teste'}
                        </button>
                    </form>
                    {paymentResult && (
                        <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
                            <h4>Resultado:</h4>
                            <pre style={{ fontSize: '0.85rem' }}>{JSON.stringify(paymentResult, null, 2)}</pre>
                            {paymentResult.payment?.pixQrCodeUrl && (
                                <img src={paymentResult.payment.pixQrCodeUrl} alt="QR Code" style={{ width: '200px', marginTop: '10px' }} />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: UPLOADS */}
            {activeTab === 'uploads' && (
                <div style={{ background: '#fff', padding: '30px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3>Teste de Uploads</h3>
                    <div style={{ marginBottom: '20px', marginTop: '10px' }}>
                        <label style={{ marginRight: '20px', cursor: 'pointer' }}>
                            <input type="radio" name="uploadType" value="image" checked={uploadType === 'image'} onChange={() => setUploadType('image')} /> Upload de Imagem (Público)
                        </label>
                        <label style={{ cursor: 'pointer' }}>
                            <input type="radio" name="uploadType" value="document" checked={uploadType === 'document'} onChange={() => setUploadType('document')} /> Upload de Documento (Seguro)
                        </label>
                    </div>

                    <div style={{ padding: '40px', border: '2px dashed #ddd', borderRadius: '8px', textAlign: 'center', background: '#fafafa' }}>
                        <input type="file" onChange={handleUploadTest} disabled={uploading} />
                        {uploading && <p style={{ marginTop: '10px', color: '#006d77' }}>Enviando arquivo...</p>}
                    </div>

                    {uploadResult && (
                        <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                            <h4>Resultado:</h4>
                            <pre style={{ fontSize: '0.85rem' }}>{JSON.stringify(uploadResult, null, 2)}</pre>
                            {uploadResult.url && uploadType === 'image' && (
                                <img src={uploadResult.url} alt="Uploaded" style={{ maxWidth: '300px', marginTop: '10px', borderRadius: '4px' }} />
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

            {/* TAB: STATUS */}
            {activeTab === 'status' && (
                <div style={{ background: '#fff', padding: '30px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3>Conectividade com Worker</h3>
                    <p style={{ marginBottom: '15px' }}>URL Configurada: <strong style={{ background: '#eee', padding: '2px 5px', borderRadius: '4px' }}>{workerUrl}</strong></p>
                    <button onClick={checkWorker} style={{ marginTop: '10px', padding: '10px 20px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '6px' }}>Verificar Conexão Agora</button>
                    {workerStatus && <div style={{ marginTop: '20px', padding: '15px', borderRadius: '6px', background: workerStatus.startsWith('Error') || workerStatus.startsWith('Offline') ? '#ffebee' : '#e8f5e9', color: workerStatus.startsWith('Error') || workerStatus.startsWith('Offline') ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
                        {workerStatus}
                    </div>}
                </div>
            )}
        </div>
    );
}
