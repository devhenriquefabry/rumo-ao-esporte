import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { Send, RefreshCw, History } from 'lucide-react';
import { loadWhatsAppConfig, sendWhatsAppBatch } from './whatsappUtils';
import { useNavigate } from 'react-router-dom';
import type { WhatsAppFullConfig } from './whatsappUtils';

interface Devedor {
    id: string;
    nome: string;          // aluno
    responsavel: string;   // responsavel.nome
    telefone: string;      // responsavel.telefonePrincipal
    valorDevido: string;   // financialPendingAmount
    vencimento: string;    // paymentDay
    modalidade: string;
}



const DEFAULT_TEMPLATE = `Olá, {responsavel}! 👋
Gostaríamos de lembrá-lo(a) de que existe um débito pendente:

Aluno(a): *{nome}*
Valor: *R$ {valor}*
Vencimento: *{vencimento}*

Por favor, regularize o quanto antes para evitar a suspensão das atividades.

Dúvidas? Entre em contato conosco. 🙏`;

export default function AdminMensagensCobrancas() {
    const [devedores, setDevedores] = useState<Devedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
    const [showTemplate, setShowTemplate] = useState(false);
    const [config, setConfig] = useState<WhatsAppFullConfig | null>(null);
    const { showAlert, showConfirm } = useDialog();
    const navigate = useNavigate();

    useEffect(() => {
        loadConfig();
        loadDevedores();
    }, []);

    const loadConfig = async () => {
        const c = await loadWhatsAppConfig();
        if (c) setConfig(c);
    };

    const loadDevedores = async () => {
        setLoading(true);
        try {
            // Busca apenas aprovados
            const q = query(
                collection(db, 'rumo_ao_esporte_2026_registrations'),
                where('contractStatus', '==', 'aprovado')
            );
            const snap = await getDocs(q);
            const lista: Devedor[] = [];
            const seen = new Set<string>();

            snap.docs.forEach(docSnap => {
                const data = docSnap.data();

                // Só inclui quem está de fato inadimplente (status atrasado/overdue com valor pendente)
                const status = (data.status || '').toLowerCase();
                const pendingAmount = data.financialPendingAmount || 0;
                const isInadimplente = (status === 'atrasado' || status === 'overdue') && pendingAmount > 0;

                if (!isInadimplente) return;

                const alunos = Array.isArray(data.alunos) ? data.alunos : [];
                const responsavelNome = data.responsavel?.nome || '';
                const telefone = data.responsavel?.telefonePrincipal || '';
                const valorFmt = pendingAmount > 0
                    ? pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—';
                const vencimento = data.paymentDay ? `Dia ${data.paymentDay}` : '—';
                const modalidade = data.modalidade || '';

                alunos.forEach((aluno: any) => {
                    const nomeAluno = aluno.nome || 'Sem nome';
                    // Deduplicar por nome do aluno + CPF do responsável
                    const key = `${nomeAluno.trim().toUpperCase()}|${data.responsavel?.cpf || ''}`;
                    if (seen.has(key)) return;
                    seen.add(key);

                    lista.push({
                        id: `${docSnap.id}_${nomeAluno}`,
                        nome: nomeAluno,
                        responsavel: responsavelNome,
                        telefone,
                        valorDevido: valorFmt,
                        vencimento,
                        modalidade,
                    });
                });
            });

            setDevedores(lista);
        } catch (e) {
            console.error('Erro ao buscar devedores:', e);
        } finally {
            setLoading(false);
        }
    };

    const buildMessage = (d: Devedor) => template
        .replace(/{responsavel}/g, d.responsavel || 'Responsável')
        .replace(/{nome}/g, d.nome)
        .replace(/{valor}/g, d.valorDevido)
        .replace(/{vencimento}/g, d.vencimento);

    const handleSend = () => {
        if (selectedIds.size === 0) return showAlert('Selecione ao menos um devedor.', 'warning');
        if (!config) return showAlert('Configuração não carregada.', 'error');

        showConfirm(`Enviar cobrança para ${selectedIds.size} contato(s)?`, async () => {
            setSending(true);
            const items = devedores.filter(d => selectedIds.has(d.id));

            // Prepara o lote para o Worker
            const batch = items.map(d => ({
                id: crypto.randomUUID(),
                phone: d.telefone,
                text: buildMessage(d)
            }));

            try {
                const result = await sendWhatsAppBatch(batch);
                if (result.success) {
                    showAlert('Cobranças enviadas para a fila segura!', 'success');
                    setSelectedIds(new Set());
                    setTimeout(() => showConfirm('Deseja ver o progresso no Histórico?', () => {
                        navigate('/admin/mensagens/historico');
                    }), 1000);
                } else {
                    showAlert('Erro ao enviar cobranças.', 'error');
                }
            } finally {
                setSending(false);
            }
        });
    };

    const toggleAll = () => {
        const ids = devedores.map(d => d.id);
        const allSel = ids.every(id => selectedIds.has(id));
        const next = new Set(selectedIds);
        ids.forEach(id => allSel ? next.delete(id) : next.add(id));
        setSelectedIds(next);
    };

    return (
        <PageContainer>
            <PageTitle
                title="COBRAR DÉBITOS"
                subtitle="Envie mensagens de cobrança para alunos com pagamentos atrasados."
            />



            {/* Toolbar */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={loadDevedores} style={btnStyle('#fff', '#555', 'pointer', '1px solid #ddd')}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                    <button onClick={toggleAll} style={btnStyle('#fff', '#555', 'pointer', '1px solid #ddd')}>
                        {devedores.every(d => selectedIds.has(d.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                    <button onClick={() => setShowTemplate(!showTemplate)} style={btnStyle('#eef8ff', '#00a63a', 'pointer', '1px solid #f0c0c0')}>
                        ✏️ {showTemplate ? 'Fechar Template' : 'Editar Mensagem'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => navigate('/admin/mensagens/historico')} style={btnStyle('#f8f9fa', '#666', 'pointer', '1px solid #ddd')}>
                        <History size={15} /> Histórico
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || selectedIds.size === 0}
                        style={btnStyle(sending || selectedIds.size === 0 ? '#e0e0e0' : '#00a63a', '#fff', sending || selectedIds.size === 0 ? 'not-allowed' : 'pointer')}
                    >
                        <Send size={15} />
                        {sending ? 'Registrando...' : `Cobrar Selecionados (${selectedIds.size})`}
                    </button>
                </div>
            </div>

            {/* Template editor */}
            {showTemplate && (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px', borderLeft: '4px solid #00a63a' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#333' }}>📝 Template da Cobrança</h3>
                    <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '12px' }}>
                        Variáveis: <code>{'{responsavel}'}</code>, <code>{'{nome}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>
                    </p>
                    <textarea
                        value={template}
                        onChange={e => setTemplate(e.target.value)}
                        rows={8}
                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.88rem', resize: 'vertical' }}
                    />
                </div>
            )}


            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Buscando inadimplentes...</div>
            ) : devedores.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '12px', padding: '60px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                    <h3 style={{ color: '#27ae60', marginBottom: '8px' }}>Nenhum débito encontrado</h3>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>Todos os alunos aprovados estão em dia.</p>
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#00a63a' }}>{devedores.length} inadimplente(s) encontrado(s)</strong>
                        {selectedIds.size > 0 && <span style={{ fontSize: '0.85rem', color: '#666' }}>{selectedIds.size} selecionado(s)</span>}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa' }}>
                                    {['', 'Aluno', 'Modalidade', 'Responsável', 'Telefone', 'Valor Pendente', 'Vencimento'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: h === '' ? 'center' : 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {devedores.map(d => {
                                    const sel = selectedIds.has(d.id);
                                    return (
                                        <tr
                                            key={d.id}
                                            onClick={() => {
                                                const next = new Set(selectedIds);
                                                sel ? next.delete(d.id) : next.add(d.id);
                                                setSelectedIds(next);
                                            }}
                                            style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: sel ? '#eef8ff' : 'transparent' }}
                                        >
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <input type="checkbox" checked={sel} readOnly style={{ pointerEvents: 'none', accentColor: '#00a63a', transform: 'scale(1.2)' }} />
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{d.nome}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '20px', background: '#f5f5f5', color: '#555', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                                    {d.modalidade || '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#555' }}>{d.responsavel || '—'}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#555' }}>{d.telefone || '—'}</td>
                                            <td style={{ padding: '12px 16px', color: '#00a63a', fontWeight: 600 }}>{d.valorDevido}</td>
                                            <td style={{ padding: '12px 16px', color: '#555' }}>{d.vencimento}</td>
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

function btnStyle(bg: string, color: string, cursor: string, border = 'none'): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '9px 16px', background: bg, color, border,
        borderRadius: '8px', cursor, fontWeight: 600, fontSize: '0.88rem',
        whiteSpace: 'nowrap', transition: 'opacity 0.2s',
    };
}
