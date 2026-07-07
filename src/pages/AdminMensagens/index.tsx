import { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { collection, getDocs, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { Upload, Trash2, CheckSquare, Square, Send, Search, History, Clock } from 'lucide-react';
import { loadWhatsAppConfig, sendWhatsAppBatch } from './whatsappUtils';
import { useNavigate } from 'react-router-dom';
import type { WhatsAppFullConfig } from './whatsappUtils';

interface ContatoData {
    Nome: string;
    Valor?: string | number;
    'Data de vencimento'?: string;
    'Nome Responsável Financeiro'?: string;
    'Cel. Responsável Financeiro'?: string;
    status?: 'pending' | 'sending' | 'sent' | 'error';
    log?: string;
    id?: string;
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#999',
    sending: '#e67e22',
    sent: '#27ae60',
    error: '#00a63a',
};
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    sending: 'Enviando...',
    sent: '✓ Enviado',
    error: 'Erro',
};

const DEFAULT_MESSAGE = `Olá, {responsavel}! 👋
Esse é um recado importante do nosso sistema.
Aluno(a): *{nome}*

Dúvidas? Entre em contato conosco.`;

export default function AdminMensagens() {
    const [data, setData] = useState<ContatoData[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE);
    const [showTemplate, setShowTemplate] = useState(false);
    const [config, setConfig] = useState<WhatsAppFullConfig | null>(null);
    const { showAlert, showConfirm } = useDialog();
    const navigate = useNavigate();

    useEffect(() => {
        loadContacts();
        loadConfig();
    }, []);

    const loadConfig = async () => {
        const c = await loadWhatsAppConfig();
        if (c) setConfig(c);
    };

    const loadContacts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'whatsapp_disparos'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setData(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ContatoData[]);
        } catch (e) {
            console.error(e);
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
                const wb = xlsx.read(evt.target?.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = xlsx.utils.sheet_to_json<ContatoData>(ws);
                const batch = writeBatch(db);
                let count = 0;
                for (const row of rows) {
                    if (!row['Cel. Responsável Financeiro'] && !row.Nome) continue;
                    const ref = doc(collection(db, 'whatsapp_disparos'));
                    batch.set(ref, { ...row, status: 'pending', createdAt: new Date().toISOString() });
                    count++;
                }
                await batch.commit();
                await loadContacts();
                showAlert(`${count} contatos importados!`, 'success');
                setSelectedIds(new Set());
            } catch {
                showAlert('Erro ao processar o arquivo.', 'error');
            } finally {
                setLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const clearList = () => {
        showConfirm('Apagar TODOS os contatos da lista?', async () => {
            setLoading(true);
            try {
                const snap = await getDocs(collection(db, 'whatsapp_disparos'));
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                setData([]);
                setSelectedIds(new Set());
                showAlert('Lista limpa!', 'success');
            } finally {
                setLoading(false);
            }
        });
    };

    const filtered = data.filter(item =>
        (item.Nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item['Nome Responsável Financeiro'] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleAll = () => {
        const ids = filtered.map(d => d.id!);
        const allSelected = ids.every(id => selectedIds.has(id));
        const next = new Set(selectedIds);
        ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
        setSelectedIds(next);
    };

    const buildMessage = (item: ContatoData) => {
        return messageTemplate
            .replace(/{responsavel}/g, item['Nome Responsável Financeiro'] || 'Responsável')
            .replace(/{nome}/g, item.Nome || 'Aluno')
            .replace(/{valor}/g, String(item.Valor || ''))
            .replace(/{vencimento}/g, item['Data de vencimento'] || '');
    };

    const handleSend = (testMode = false) => {
        if (selectedIds.size === 0) return showAlert('Nenhum item selecionado.', 'warning');
        if (!config) return showAlert('Configuração não carregada.', 'error');

        showConfirm(
            testMode ? 'Enviar mensagem de TESTE para o número configurado?' : `Enviar para ${selectedIds.size} contato(s)?`,
            async () => {
                setSending(true);
                const items = data.filter(d => selectedIds.has(d.id!));

                // Prepara o lote para o Worker
                const batch = items.map(item => ({
                    id: item.id || crypto.randomUUID(),
                    phone: item['Cel. Responsável Financeiro'] || '',
                    text: buildMessage(item)
                }));

                try {
                    const result = await sendWhatsAppBatch(batch);
                    if (result.success) {
                        showAlert('Lote enviado para a fila segura! Você pode fechar esta página.', 'success');
                        setSelectedIds(new Set());
                        // Opcional: Redirecionar para o histórico
                        setTimeout(() => showConfirm('Deseja ver o progresso no Histórico?', () => {
                            navigate('/admin/mensagens/historico');
                        }), 1000);
                    } else {
                        showAlert('Erro ao enviar lote.', 'error');
                    }
                } finally {
                    setSending(false);
                }
            }
        );
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id!));

    return (
        <PageContainer>
            <PageTitle
                title="DISPAROS EM MASSA"
                subtitle="Importe contatos via Excel e dispare mensagens pelo WhatsApp."
            />

            {/* Toolbar */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Import */}
                    <input type="file" accept=".xlsx,.xls" id="excel-upload-disparos" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <label htmlFor="excel-upload-disparos" style={toolbarBtnStyle('#00a63a', '#fff', loading ? 'wait' : 'pointer')}>
                        <Upload size={15} />
                        {loading ? 'Processando...' : 'Importar Excel'}
                    </label>

                    {data.length > 0 && (
                        <>
                            <button onClick={clearList} style={toolbarBtnStyle('#fff', '#00a63a', 'pointer', '1px solid #00a63a')}>
                                <Trash2 size={15} /> Limpar Lista
                            </button>
                            <button onClick={toggleAll} style={toolbarBtnStyle('#fff', '#555', 'pointer', '1px solid #ddd')}>
                                {allFilteredSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                                {allFilteredSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                        </>
                    )}
                </div>

                {data.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                            <input
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '32px', padding: '9px 12px 9px 32px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.9rem', width: '200px' }}
                            />
                        </div>
                        <button onClick={() => setShowTemplate(!showTemplate)} style={toolbarBtnStyle('#eef8ff', '#00a63a', 'pointer', '1px solid #f0c0c0')}>
                            ✏️ {showTemplate ? 'Fechar Template' : 'Editar Mensagem'}
                        </button>
                        <button
                            onClick={() => handleSend(false)}
                            disabled={sending || selectedIds.size === 0}
                            style={toolbarBtnStyle(selectedIds.size === 0 || sending ? '#e0e0e0' : '#00a63a', '#fff', selectedIds.size === 0 || sending ? 'not-allowed' : 'pointer')}
                        >
                            <Send size={15} />
                            {sending ? `Registrando na fila...` : `Enviar (${selectedIds.size})`}
                        </button>
                        <button onClick={() => navigate('/admin/mensagens/historico')} style={toolbarBtnStyle('#f8f9fa', '#666', 'pointer', '1px solid #ddd')}>
                            <History size={15} /> Histórico
                        </button>
                        <button onClick={() => navigate('/admin/mensagens/automacao')} style={toolbarBtnStyle('#e6fffa', '#006d77', 'pointer', '1px solid #b2f2bb')}>
                            <Clock size={15} /> Automação
                        </button>
                    </div>
                )}
            </div>

            {/* Template editor */}
            {showTemplate && (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px', borderLeft: '4px solid #00a63a' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#333' }}>📝 Template da Mensagem</h3>
                    <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '12px' }}>
                        Variáveis disponíveis: <code>{'{responsavel}'}</code>, <code>{'{nome}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>
                    </p>
                    <textarea
                        value={messageTemplate}
                        onChange={e => setMessageTemplate(e.target.value)}
                        rows={7}
                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical' }}
                    />
                </div>
            )}


            {/* Table */}
            {data.length === 0 && !loading ? (
                <div style={{ background: '#fff', borderRadius: '12px', padding: '60px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📤</div>
                    <h3 style={{ color: '#333', marginBottom: '8px' }}>Nenhum contato importado</h3>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>Importe uma planilha Excel para começar os disparos.</p>
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <strong style={{ color: '#333' }}>{data.length} contato(s)</strong>
                        {searchTerm && <span style={{ color: '#888', fontSize: '0.85rem' }}>— exibindo {filtered.length}</span>}
                        {selectedIds.size > 0 && <span style={{ marginLeft: 'auto', color: '#00a63a', fontSize: '0.85rem', fontWeight: 600 }}>{selectedIds.size} selecionado(s)</span>}
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 1 }}>
                                    {['', 'Status', 'Responsável', 'Telefone', 'Aluno', 'Valor', 'Vencimento'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: h === '' ? 'center' : 'left', fontWeight: 600, color: '#555', fontSize: '0.82rem', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(item => {
                                    const selected = selectedIds.has(item.id!);
                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => {
                                                const next = new Set(selectedIds);
                                                selected ? next.delete(item.id!) : next.add(item.id!);
                                                setSelectedIds(next);
                                            }}
                                            style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected ? '#eef8ff' : 'transparent', transition: 'background 0.15s' }}
                                        >
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <input type="checkbox" checked={selected} readOnly style={{ pointerEvents: 'none', accentColor: '#00a63a', transform: 'scale(1.2)' }} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ color: STATUS_COLORS[item.status || 'pending'], fontWeight: item.status === 'sent' ? 600 : 400 }}>
                                                    {STATUS_LABELS[item.status || 'pending']}
                                                </span>
                                                {item.log && <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>{item.log}</div>}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>{item['Nome Responsável Financeiro'] || '—'}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{item['Cel. Responsável Financeiro'] || '—'}</td>
                                            <td style={{ padding: '12px 16px' }}>{item.Nome || '—'}</td>
                                            <td style={{ padding: '12px 16px' }}>{item.Valor || '—'}</td>
                                            <td style={{ padding: '12px 16px' }}>{item['Data de vencimento'] || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

function toolbarBtnStyle(bg: string, color: string, cursor: string, border = 'none'): React.CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '9px 16px',
        background: bg,
        color,
        border,
        borderRadius: '8px',
        cursor,
        fontWeight: 600,
        fontSize: '0.88rem',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.2s',
    };
}
