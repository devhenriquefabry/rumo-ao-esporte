import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';
import { Send, RefreshCw, Smartphone, LogOut } from 'lucide-react';

interface Devedor {
    id: string;
    nome: string;
    responsavel: string;
    telefone: string;
    valorDevido: string;
    vencimento: string;
    modalidade: string;
    linkFatura: string;
    descricao: string;
}

const DEFAULT_TEMPLATE = `Olá, {responsavel}! 👋
Gostaríamos de lembrá-lo(a) de que existe um débito pendente referente à Rumo ao Esporte:

Aluno(a): *{nome}*
Cobrança: *{descricao}*
Valor: *{valor}*
Vencimento original: *{vencimento}*

Pague aqui: {link}

Por favor, regularize o quanto antes para evitar a suspensão das atividades.

Dúvidas? Entre em contato conosco. 🙏`;

export default function AdminFinanceiroCobrancas() {
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const [devedores, setDevedores] = useState<Devedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
    const [showTemplate, setShowTemplate] = useState(false);

    // Evolution API States
    const [connState, setConnState] = useState<'open' | 'close' | 'connecting'>('close');
    const [qrCodeData, setQrCodeData] = useState<{ qrcode?: string; pairingCode?: string } | null>(null);
    const [loadingConn, setLoadingConn] = useState(true);

    // Filters
    const [filterPendente, setFilterPendente] = useState(false);
    const [filterInadimplente, setFilterInadimplente] = useState(true);
    const [filterManual, setFilterManual] = useState(false);

    const { showAlert, showConfirm } = useDialog();

    useEffect(() => {
        checkConnection();
        loadDevedores();
    }, [filterPendente, filterInadimplente, filterManual]);

    const checkConnection = async () => {
        setLoadingConn(true);
        try {
            const res = await fetch(`${workerUrl}/api/whatsapp/status`);
            const data = await res.json();
            setConnState(data.state || 'close');
        } catch (e) {
            console.error('Erro ao checar conexao Evolution:', e);
            setConnState('close');
        } finally {
            setLoadingConn(false);
        }
    };

    const handleConnect = async () => {
        setLoadingConn(true);
        setQrCodeData(null);
        try {
            const res = await fetch(`${workerUrl}/api/whatsapp/qr`);
            const data = await res.json();

            if (data.status === 'open') {
                setConnState('open');
                showAlert('Conectado com sucesso!', 'success');
            } else if (data.qrcode) {
                setQrCodeData(data);
                showAlert('Escaneie o QR Code para conectar.', 'info');
                // Poll for connection
                let attempts = 0;
                const interval = setInterval(async () => {
                    attempts++;
                    const stRes = await fetch(`${workerUrl}/api/whatsapp/status`);
                    const stData = await stRes.json();
                    if (stData.state === 'open') {
                        setConnState('open');
                        setQrCodeData(null);
                        clearInterval(interval);
                        showAlert('WhatsApp Conectado!', 'success');
                    } else if (attempts > 30) {
                        clearInterval(interval);
                    }
                }, 3000);
            } else if (data.error) {
                showAlert(data.error, 'error');
            }
        } catch (e: any) {
            showAlert(e.message, 'error');
        } finally {
            setLoadingConn(false);
        }
    };

    const handleLogout = async () => {
        showConfirm('Deseja desconectar este WhatsApp?', async () => {
            setLoadingConn(true);
            try {
                await fetch(`${workerUrl}/api/whatsapp/logout`, { method: 'POST' });
                setConnState('close');
                showAlert('Desconectado com sucesso.', 'success');
            } catch (e: any) {
                showAlert(e.message, 'error');
            } finally {
                setLoadingConn(false);
            }
        });
    };

    const loadDevedores = async () => {
        setLoading(true);
        try {
            // 1. Fetch manual payments map IF filterManual is on
            const paymentsMap = new Map<string, any[]>();
            if (filterManual || filterPendente || filterInadimplente) {
                const paymentsSnap = await getDocs(query(collection(db, 'financial_payments'), where('status', 'in', ['PENDING', 'OVERDUE'])));
                paymentsSnap.docs.forEach(d => {
                    const pay = d.data();
                    const descLower = (pay.description || '').toLowerCase();
                    const isManual = pay.externalReference?.startsWith('MANUAL_') || descLower.includes('uniforme') || descLower.includes('kit');
                    
                    if (!paymentsMap.has(pay.studentId)) paymentsMap.set(pay.studentId, []);
                    paymentsMap.get(pay.studentId)!.push({ ...pay, isManual });
                });
            }

            // 2. Fetch approved registrations
            const q = query(
                collection(db, 'rumo_ao_esporte_2026_registrations'),
                where('contractStatus', '==', 'aprovado')
            );
            const snap = await getDocs(q);
            const lista: Devedor[] = [];
            const seen = new Set<string>();

            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const status = (data.status || '').toLowerCase();
                const pendingAmount = data.financialPendingAmount || 0;

                const matchPendente = filterPendente && (status === 'pendente') && pendingAmount > 0;
                const matchInadimplente = filterInadimplente && (status === 'atrasado' || status === 'overdue') && pendingAmount > 0;

                let manualAmount = 0;
                let manualDates: string[] = [];

                if (filterManual) {
                    const studentPayments = paymentsMap.get(docSnap.id) || [];
                    const manualPays = studentPayments.filter(p => p.isManual);
                    if (manualPays.length > 0) {
                        manualAmount = manualPays.reduce((sum, p) => sum + Number(p.value || 0), 0);
                        manualDates = manualPays.map(p => p.dueDate ? new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '');
                    }
                }

                const matchManual = filterManual && manualAmount > 0;

                // Stop if doesn't match any filter
                if (!matchPendente && !matchInadimplente && !matchManual) return;

                // Find a relevant invoice link and description
                let linkFatura = '';
                let descricaoCobranca = '';
                const studentPayments = paymentsMap.get(docSnap.id) || [];
                if (studentPayments.length > 0) {
                    // Find first pending/overdue with a link
                    const validPay = studentPayments.find(p => p.invoiceUrl && (p.status === 'PENDING' || p.status === 'OVERDUE'));
                    if (validPay) {
                        linkFatura = validPay.invoiceUrl;
                        descricaoCobranca = validPay.description || '';
                    } else {
                        // Fallback to description of first pending/overdue even without link
                        const anyPending = studentPayments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
                        if (anyPending) descricaoCobranca = anyPending.description || '';
                    }
                }

                // If no description from payments, use modalidade as fallback
                if (!descricaoCobranca) {
                    descricaoCobranca = `Mensalidade ${data.modalidade || 'Esporte'}`;
                }

                const totalAmount = (matchPendente || matchInadimplente ? pendingAmount : 0) + (matchManual ? manualAmount : 0);
                const valorFmt = totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                let vcts = [];
                if (matchPendente || matchInadimplente) {
                    if (data.paymentDay) vcts.push(`Dia ${data.paymentDay} (Mensalidade)`);
                }
                if (matchManual) {
                    manualDates.forEach(d => { if (d) vcts.push(`${d} (Manual)`) });
                }
                const vencimentoStr = vcts.join(' | ');

                const alunos = Array.isArray(data.alunos) ? data.alunos : [];
                const responsavelNome = data.responsavel?.nome || '';
                const telefone = data.responsavel?.telefonePrincipal || '';
                const modalidade = data.modalidade || '';

                alunos.forEach((aluno: any) => {
                    const nomeAluno = aluno.nome || 'Sem nome';
                    const key = `${nomeAluno.trim().toUpperCase()}|${data.responsavel?.cpf || ''}`;
                    if (seen.has(key)) return;
                    seen.add(key);

                    lista.push({
                        id: `${docSnap.id}_${nomeAluno}`,
                        nome: nomeAluno,
                        responsavel: responsavelNome,
                        telefone,
                        valorDevido: valorFmt,
                        vencimento: vencimentoStr,
                        modalidade,
                        linkFatura: linkFatura || 'Link não disponível',
                        descricao: descricaoCobranca
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
        .replace(/{vencimento}/g, d.vencimento)
        .replace(/{link}/g, d.linkFatura)
        .replace(/{descricao}/g, d.descricao);

    const handleSend = () => {
        if (selectedIds.size === 0) return showAlert('Selecione ao menos um devedor.', 'warning');
        if (connState !== 'open') return showAlert('Conecte o WhatsApp primeiro na caixa de Status.', 'error');

        showConfirm(`Enviar cobrança via WhatsApp para ${selectedIds.size} contato(s)?`, async () => {
            setSending(true);
            const items = devedores.filter(d => selectedIds.has(d.id));

            let successCount = 0;
            let errorCount = 0;

            for (const item of items) {
                try {
                    const text = buildMessage(item);
                    const res = await fetch(`${workerUrl}/api/whatsapp/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: item.telefone, message: text })
                    });
                    const data = await res.json();
                    if (data.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                    // Small delay to prevent rate limit
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) {
                    errorCount++;
                }
            }

            setSending(false);
            if (errorCount === 0) {
                showAlert(`${successCount} mensagens enviadas!`, 'success');
                setSelectedIds(new Set());
            } else {
                showAlert(`${successCount} sucesso(s), ${errorCount} erro(s).`, 'warning');
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
                title="COBRANÇAS INTEGRADAS"
                subtitle="Painel de disparo de notificações via WhatsApp (Evolution API)."
            />

            {/* Status Connection Widget */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%', background: connState === 'open' ? '#dcfce7' : '#f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: connState === 'open' ? '#16a34a' : '#94a3b8'
                        }}>
                            <Smartphone size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>Status da Conexão</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginTop: '4px' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: connState === 'open' ? '#16a34a' : connState === 'connecting' ? '#eab308' : '#ef4444' }} />
                                <span style={{ color: '#64748b', fontWeight: 500 }}>
                                    {loadingConn ? 'Verificando...' : connState === 'open' ? 'Conectado e Pronto' : connState === 'connecting' ? 'Conectando...' : 'Desconectado'}
                                </span>
                            </div>
                        </div>
                    </div>
                    {connState !== 'open' && !qrCodeData && (
                        <button onClick={handleConnect} disabled={loadingConn} style={btnStyle('#16a34a', '#fff', loadingConn ? 'not-allowed' : 'pointer')}>
                            {loadingConn ? 'Aguarde...' : 'Gerar QR Code'}
                        </button>
                    )}
                    {connState === 'open' && (
                        <button onClick={handleLogout} disabled={loadingConn} style={btnStyle('#fef2f2', '#ef4444', loadingConn ? 'not-allowed' : 'pointer', '1px solid #fecaca')}>
                            <LogOut size={16} /> Desconectar
                        </button>
                    )}
                </div>

                {qrCodeData && (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <p style={{ margin: 0, color: '#475569', fontWeight: 500, textAlign: 'center' }}>Abra o WhatsApp e escaneie o código abaixo para conectar a instância.</p>
                        {qrCodeData.qrcode ? (
                            <img src={qrCodeData.qrcode} alt="QR Code" style={{ width: 250, height: 250, background: '#fff', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                        ) : (
                            <div style={{ fontSize: '1.8rem', letterSpacing: '8px', fontWeight: 'bold', color: '#1e293b', background: '#fff', padding: '15px 30px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                {qrCodeData.pairingCode}
                            </div>
                        )}
                        <button onClick={() => setQrCodeData(null)} style={btnStyle('transparent', '#64748b', 'pointer')}>Cancelar</button>
                    </div>
                )}
            </div>

            {/* Filters & Actions */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Visual Filtros Section */}
                <div>
                    <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem', display: 'block', marginBottom: '10px' }}>Filtrar exibição:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <label style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                            padding: '8px 16px', borderRadius: '20px', 
                            background: filterInadimplente ? '#fee2e2' : '#f8fafc', 
                            border: `1px solid ${filterInadimplente ? '#fca5a5' : '#e2e8f0'}`,
                            transition: 'all 0.2s',
                            userSelect: 'none'
                        }}>
                            <input 
                                type="checkbox" 
                                checked={filterInadimplente} 
                                onChange={e => setFilterInadimplente(e.target.checked)} 
                                style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer', appearance: 'checkbox', display: 'block' }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: filterInadimplente ? 600 : 500, color: filterInadimplente ? '#991b1b' : '#64748b' }}>Inadimplentes</span>
                                <span style={{ fontSize: '0.7rem', color: filterInadimplente ? '#dc2626' : '#94a3b8' }}>Faturas atrasadas</span>
                            </div>
                        </label>

                        <label style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                            padding: '8px 16px', borderRadius: '20px', 
                            background: filterPendente ? '#fef3c7' : '#f8fafc', 
                            border: `1px solid ${filterPendente ? '#fcd34d' : '#e2e8f0'}`,
                            transition: 'all 0.2s',
                            userSelect: 'none'
                        }}>
                            <input 
                                type="checkbox" 
                                checked={filterPendente} 
                                onChange={e => setFilterPendente(e.target.checked)} 
                                style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer', appearance: 'checkbox', display: 'block' }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: filterPendente ? 600 : 500, color: filterPendente ? '#92400e' : '#64748b' }}>Pendentes</span>
                                <span style={{ fontSize: '0.7rem', color: filterPendente ? '#d97706' : '#94a3b8' }}>A vencer neste mês</span>
                            </div>
                        </label>

                        <label style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                            padding: '8px 16px', borderRadius: '20px', 
                            background: filterManual ? '#dbeafe' : '#f8fafc', 
                            border: `1px solid ${filterManual ? '#93c5fd' : '#e2e8f0'}`,
                            transition: 'all 0.2s',
                            userSelect: 'none'
                        }}>
                            <input 
                                type="checkbox" 
                                checked={filterManual} 
                                onChange={e => setFilterManual(e.target.checked)} 
                                style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer', appearance: 'checkbox', display: 'block' }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: filterManual ? 600 : 500, color: filterManual ? '#1e40af' : '#64748b' }}>Manuais</span>
                                <span style={{ fontSize: '0.7rem', color: filterManual ? '#2563eb' : '#94a3b8' }}>Uniformes e Kits</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button onClick={loadDevedores} style={btnStyle('#fff', '#555', 'pointer', '1px solid #ddd')}>
                            <RefreshCw size={14} /> Atualizar Lista
                        </button>
                        <button onClick={toggleAll} style={btnStyle('#fff', '#555', 'pointer', '1px solid #ddd')}>
                            {devedores.length > 0 && devedores.every(d => selectedIds.has(d.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                        <button onClick={() => setShowTemplate(!showTemplate)} style={btnStyle('#eef8ff', '#00a63a', 'pointer', '1px solid #f0c0c0')}>
                            ✏️ {showTemplate ? 'Fechar Template' : 'Editar Mensagem'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleSend}
                            disabled={sending || selectedIds.size === 0 || connState !== 'open'}
                            style={btnStyle(sending || selectedIds.size === 0 || connState !== 'open' ? '#e0e0e0' : '#00a63a', '#fff', sending || selectedIds.size === 0 || connState !== 'open' ? 'not-allowed' : 'pointer')}
                        >
                            <Send size={15} />
                            {sending ? 'Enviando...' : `Disparar Cobranças (${selectedIds.size})`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Template editor */}
            {showTemplate && (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px', borderLeft: '4px solid #00a63a' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#333' }}>📝 Template da Cobrança</h3>
                    <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '12px' }}>
                        Variáveis: <code>{'{responsavel}'}</code>, <code>{'{nome}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>, <code>{'{link}'}</code>, <code>{'{descricao}'}</code>
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
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>Todos os alunos aprovados parecem estar em dia.</p>
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
                                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '40px', borderBottom: '2px solid #eee' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={devedores.length > 0 && selectedIds.size === devedores.length}
                                            onChange={toggleAll}
                                            style={{ cursor: 'pointer', accentColor: '#00a63a', transform: 'scale(1.2)', appearance: 'checkbox', display: 'block', margin: '0 auto' }} 
                                        />
                                    </th>
                                    {['Aluno', 'Modalidade', 'Responsável', 'Telefone', 'Valor Pendente', 'Vencimento'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{h}</th>
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
                                                <input type="checkbox" checked={sel} readOnly style={{ pointerEvents: 'none', accentColor: '#00a63a', transform: 'scale(1.2)', appearance: 'checkbox', display: 'block' }} />
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
