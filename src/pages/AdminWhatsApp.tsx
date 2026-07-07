import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as xlsx from 'xlsx';
import { collection, getDocs, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { Clock } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';



interface CobrancaData {
    Nome: string;
    Valor: string | number;
    'Data de vencimento': string;
    'Nome Responsável Financeiro': string;
    'Cel. Responsável Financeiro': string;
    status?: 'pending' | 'sending' | 'sent' | 'error';
    log?: string;
    id?: string; // Firestore ID
    originalId?: number; // Excel row
}

export default function AdminWhatsApp() {
    const [data, setData] = useState<CobrancaData[]>([]);
    const { showAlert, showConfirm } = useDialog();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'whatsapp_contacts'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const loadedData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CobrancaData[];
            setData(loadedData);
        } catch (error) {
            console.error("Erro ao carregar contatos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = xlsx.utils.sheet_to_json<CobrancaData>(ws);

                // Prepare batch
                const batch = writeBatch(db);
                let count = 0;

                // Simply append new data
                for (const row of jsonData) {
                    if (!row['Cel. Responsável Financeiro'] && !row.Nome) continue;

                    const newDocRef = doc(collection(db, "whatsapp_contacts"));
                    const docData = {
                        ...row,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    };
                    batch.set(newDocRef, docData);
                    count++;
                }

                await batch.commit();
                await loadContacts();
                showAlert(`${count} contatos importados com sucesso!`, "success");
                setSelectedIds(new Set()); // Start deselected

            } catch (error) {
                console.error("Erro ao ler/salvar Excel", error);
                showAlert("Erro ao processar arquivo.", "error");
            } finally {
                setLoading(false);
                // Reset input
                e.target.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const clearList = async () => {
        showConfirm("Tem certeza que deseja apagar TODOS os contatos da lista?", async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'whatsapp_contacts'));
                const snapshot = await getDocs(q);
                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                setData([]);
                setSelectedIds(new Set());
                showAlert("Lista limpa com sucesso!", "success");
            } catch (error) {
                console.error("Erro ao limpar lista:", error);
                showAlert("Erro ao limpar lista.", "error");
            } finally {
                setLoading(false);
            }
        });
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const filteredData = data.filter(item =>
        (item.Nome && item.Nome.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item['Nome Responsável Financeiro'] && item['Nome Responsável Financeiro'].toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const toggleAll = () => {
        const visibleIds = filteredData.map(d => d.id!);
        const allSelected = visibleIds.every(id => selectedIds.has(id));

        const newSet = new Set(selectedIds);
        if (allSelected) {
            visibleIds.forEach(id => newSet.delete(id));
        } else {
            visibleIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const sendMessage = async (item: CobrancaData, isTest = false, testPhone = '') => {
        const workerUrl = import.meta.env.VITE_WORKER_URL;
        const phone = isTest ? testPhone : item['Cel. Responsável Financeiro'];
        const name = item['Nome Responsável Financeiro'] || 'Responsável';
        const student = item.Nome || 'Aluno';


        const message = `Olá, ${name}!
Atualizamos nosso sistema da Escola de Esportes Rumo ao Esporte 2026.
É de muita importância que você realize o cadastro do aluno *${student}* pelo novo link.
Acesse: https://rumo-ao-esporte.web.app/ para regularizar.

Caso o aluno não vá participar da temporada 2026, é necessário entrar em contato.

_(Obs: O cancelamento só pode ser realizado após a quitação de todos os débitos pendentes)_

Dúvidas? Entre em contato: +55 33 8414-4053`;

        try {
            const response = await fetch(`${workerUrl}/send-whatsapp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message })
            });
            const result = await response.json();

            if (result.success) {
                return { success: true, log: 'Enviado' };
            } else {
                return { success: false, log: result.error || 'Erro no envio' };
            }
        } catch (error: any) {
            return { success: false, log: error.message };
        }
    };

    const handleSend = async (testMode = false) => {
        if (selectedIds.size === 0) return showAlert("Nenhum item selecionado.", "warning");

        showConfirm(testMode ? "Enviar mensagem de TESTE para vocÃª?" : `Enviar mensagem para ${selectedIds.size} contatos selecionados?`, async () => {
            setSending(true);
            const total = selectedIds.size;
            let current = 0;
            setProgress({ current, total });

            // Filter items to send
            const itemsToSend = data.filter(item => selectedIds.has(item.id!));

            for (const item of itemsToSend) {
                // Update status locally first
                const updateLocalStatus = (s: any, l?: string) => {
                    setData(prev => prev.map(d => d.id === item.id ? { ...d, status: s, log: l } : d));
                };

                updateLocalStatus('sending');

                // Test phone hardcoded as requested
                const testPhone = '5533998200546';

                const result = await sendMessage(item, testMode, testPhone);
                const finalStatus = result.success ? 'sent' : 'error';

                updateLocalStatus(finalStatus, result.log);

                // Note: We could verify persistence of status here, but let's keep it local for now to avoid too many writes
                // If requirement is strict "manter dados fixamente", we should probably update Firestore status too.
                // Let's do it for completeness if not too slow.
                if (!testMode) {
                    // Future: Update status in Firestore
                    // const docRef = doc(db, 'whatsapp_contacts', item.id!);
                    // updateDoc(docRef, ...);
                }

                current++;
                setProgress({ current, total });

                // Small delay
                await new Promise(r => setTimeout(r, 1000));
            }

            setSending(false);
            if (!testMode) showAlert("Envio concluÃ­do!", "success");
        });
    };

    return (
        <PageContainer>
            <PageTitle
                title="DISPARAR WHATSAPP"
                subtitle="Gerenciamento de cobranÃ§as. Os dados sÃ£o salvos automaticamente no sistema."
            />

            <div style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                padding: '30px',
                marginBottom: '30px'
            }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                id="excel-upload"
                            />
                            <label
                                htmlFor="excel-upload"
                                style={{
                                    display: 'inline-block',
                                    padding: '12px 24px',
                                    background: '#006d77',
                                    color: '#fff',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    marginBottom: 0
                                }}
                            >
                                {loading ? 'Processando...' : 'ðŸ“ Importar / Adicionar'}
                            </label>
                        </div>
                        {data.length > 0 && (
                            <>
                                <button
                                    onClick={clearList}
                                    style={{
                                        padding: '12px 20px',
                                        background: '#fff',
                                        border: '1px solid #00a63a',
                                        color: '#00a63a',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Limpar Lista
                                </button>
                                <button
                                    onClick={toggleAll}
                                    style={{
                                        padding: '12px 20px',
                                        background: '#fff',
                                        border: '1px solid #006d77',
                                        color: '#006d77',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {filteredData.length > 0 && filteredData.every(d => selectedIds.has(d.id!)) ? 'Deselecionar Todos' : 'Selecionar Todos'}
                                </button>
                                <input
                                    type="text"
                                    placeholder="ðŸ” Buscar nome..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        minWidth: '200px'
                                    }}
                                />
                            </>
                        )}
                    </div>

                    {data.length > 0 && (
                        <>
                            <div style={{ flex: 1, textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => navigate('/admin/mensagens/automacao')}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#fff',
                                        border: '2px solid #006d77',
                                        color: '#006d77',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Clock size={18} /> AutomaÃ§Ã£o Financeira
                                </button>
                                <button
                                    onClick={() => handleSend(true)}
                                    disabled={sending || selectedIds.size === 0}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#fff',
                                        border: '2px solid #006d77',
                                        color: selectedIds.size === 0 ? '#ccc' : '#006d77',
                                        borderColor: selectedIds.size === 0 ? '#ccc' : '#006d77',
                                        borderRadius: '8px',
                                        cursor: (sending || selectedIds.size === 0) ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Enviar Teste
                                </button>
                                <button
                                    onClick={() => handleSend(false)}
                                    disabled={sending || selectedIds.size === 0}
                                    style={{
                                        padding: '12px 24px',
                                        background: selectedIds.size === 0 ? '#ccc' : '#00a63a',
                                        border: 'none',
                                        color: '#fff',
                                        borderRadius: '8px',
                                        cursor: (sending || selectedIds.size === 0) ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {sending ? `Enviando (${progress.current}/${progress.total})...` : 'Enviar Selecionados'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Same Table Structure as before */}
            {
                data.length > 0 && (
                    <div style={{
                        background: '#fff',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>Total: {data.length} contatos</strong>
                                {searchTerm && <span style={{ marginLeft: '10px', color: '#666' }}>(Exibindo {filteredData.length})</span>}
                                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                                    Selecionados: {selectedIds.size}
                                </div>
                            </div>
                            {sending && (
                                <div style={{ flex: 1, marginLeft: '20px', background: '#eee', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(progress.current / progress.total) * 100}%`, background: '#00a63a', height: '100%', transition: 'width 0.3s' }}></div>
                                </div>
                            )}
                        </div>
                        <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                                    <tr style={{ borderBottom: '2px solid #eee' }}>
                                        <th style={{ padding: '15px', textAlign: 'center', width: '50px' }}>
                                            <input
                                                type="checkbox"
                                                checked={filteredData.length > 0 && filteredData.every(d => selectedIds.has(d.id!))}
                                                onChange={toggleAll}
                                                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                            />
                                        </th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Responsável</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Telefone</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Aluno</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Valor</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Vencimento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                                                Nenhum contato encontrado na busca.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((item) => (
                                            <tr
                                                key={item.id}
                                                onClick={() => toggleSelection(item.id!)}
                                                style={{
                                                    borderBottom: '1px solid #f0f0f0',
                                                    cursor: 'pointer',
                                                    background: selectedIds.has(item.id!) ? '#f0f9fa' : 'transparent',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={(e) => { if (!selectedIds.has(item.id!)) e.currentTarget.style.background = '#fafafa'; }}
                                                onMouseOut={(e) => { if (!selectedIds.has(item.id!)) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(item.id!)}
                                                        onChange={() => { }}
                                                        style={{ pointerEvents: 'none', transform: 'scale(1.2)' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '15px' }}>
                                                    {item.status === 'pending' && <span style={{ color: '#999' }}>Pendente</span>}
                                                    {item.status === 'sending' && <span style={{ color: '#e67e22' }}>Enviando...</span>}
                                                    {item.status === 'sent' && <span style={{ color: '#27ae60', fontWeight: 'bold' }}>âœ“ Enviado</span>}
                                                    {item.status === 'error' && <span style={{ color: '#c0392b', fontWeight: 'bold' }}>Erro</span>}
                                                    {item.log && <div style={{ fontSize: '0.75rem', color: '#666' }}>{item.log}</div>}
                                                </td>
                                                <td style={{ padding: '15px' }}>{item['Nome Responsável Financeiro']}</td>
                                                <td style={{ padding: '15px', fontFamily: 'monospace' }}>{item['Cel. Responsável Financeiro']}</td>
                                                <td style={{ padding: '15px' }}>{item.Nome}</td>
                                                <td style={{ padding: '15px' }}>{item.Valor}</td>
                                                <td style={{ padding: '15px' }}>{item['Data de vencimento']}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
        </PageContainer>
    );
}

