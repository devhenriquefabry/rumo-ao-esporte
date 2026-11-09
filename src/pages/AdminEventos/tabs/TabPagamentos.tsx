import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import type { InscricaoStatus, PagamentoInscricao, RegistroAlteracao } from '../../../types/eventos';
import { atualizarEquipe, atualizarInscricao, consultarPagamentoPix } from '../../../utils/eventos/eventosService';
import { formatarDataHora, formatarMoeda } from '../../../utils/eventos/eventosRules';
import { pdfComprovantePagamento } from '../../../utils/eventos/eventosPdf';
import { Modal } from '../../../components/eventos/EventosUI';
import type { TabProps } from './tipos';

interface Linha {
    id: string;
    nome: string;
    categoriaId: string;
    responsavel: { nome: string; cpf: string; telefone: string };
    pagamento: PagamentoInscricao;
    status: InscricaoStatus;
    alteracoes: RegistroAlteracao[];
}

const ROTULO_PAG: Record<PagamentoInscricao['status'], { label: string; cor: string; fundo: string }> = {
    pendente: { label: 'Pendente', cor: '#b45309', fundo: '#fef3c7' },
    em_analise: { label: 'Comprovante em análise', cor: '#1d4ed8', fundo: '#dbeafe' },
    confirmado: { label: 'Confirmado', cor: '#047857', fundo: '#d1fae5' },
    isento: { label: 'Isento', cor: '#475569', fundo: '#e2e8f0' },
};

export default function TabPagamentos({ evento, equipes, inscricoes, recarregar, adminNome, canEdit }: TabProps) {
    const { showAlert, showConfirm } = useDialog();
    const [filtro, setFiltro] = useState<'abertos' | 'confirmados' | 'todos'>('abertos');
    const [rejeitando, setRejeitando] = useState<Linha | null>(null);
    const [motivo, setMotivo] = useState('');
    const [verificando, setVerificando] = useState('');
    const equipesEvento = evento.tipo === 'equipes';

    const linhas: Linha[] = useMemo(() => (equipesEvento
        ? equipes.map(e => ({ id: e.id!, nome: e.nome, categoriaId: e.categoriaId, responsavel: e.responsavel, pagamento: e.pagamento, status: e.status, alteracoes: e.alteracoes || [] }))
        : inscricoes.map(i => ({ id: i.id!, nome: i.participante.nome, categoriaId: i.categoriaId, responsavel: { nome: i.participante.nome, cpf: i.participante.cpf, telefone: i.participante.telefone }, pagamento: i.pagamento, status: i.status, alteracoes: i.alteracoes || [] }))
    ).filter(l => l.status !== 'cancelada'), [equipesEvento, equipes, inscricoes]);

    const filtradas = linhas.filter(l => filtro === 'todos' ? true
        : filtro === 'confirmados' ? (l.pagamento.status === 'confirmado' || l.pagamento.status === 'isento')
            : (l.pagamento.status === 'pendente' || l.pagamento.status === 'em_analise'))
        .sort((a, b) => (a.pagamento.status === 'em_analise' ? -1 : 0) - (b.pagamento.status === 'em_analise' ? -1 : 0));

    const recebido = linhas.filter(l => l.pagamento.status === 'confirmado').reduce((s, l) => s + l.pagamento.valor, 0);
    const aReceber = linhas.filter(l => l.pagamento.status === 'pendente' || l.pagamento.status === 'em_analise').reduce((s, l) => s + l.pagamento.valor, 0);
    const nomeCat = (id: string) => evento.categorias.find(c => c.id === id)?.nome || '-';

    const salvar = async (l: Linha, pagamento: PagamentoInscricao, status: InscricaoStatus, acao: string) => {
        const alteracoes = [...l.alteracoes, { em: new Date().toISOString(), por: adminNome, acao }];
        if (equipesEvento) await atualizarEquipe(l.id, { pagamento, status, alteracoes });
        else await atualizarInscricao(l.id, { pagamento, status, alteracoes });
        await recarregar();
    };

    const statusAposConfirmar = (l: Linha): InscricaoStatus => {
        if (l.status === 'finalizada') return 'finalizada';
        return equipesEvento ? 'liberada' : 'finalizada';
    };

    const aprovar = (l: Linha) => {
        showConfirm(`Confirmar manualmente o pagamento de ${formatarMoeda(l.pagamento.valor)} de "${l.nome}"?${equipesEvento ? ' O cadastro de atletas será liberado.' : ''}`, async () => {
            try {
                await salvar(l, { ...l.pagamento, status: 'confirmado', metodo: l.pagamento.metodo === 'pix' && l.pagamento.transacaoId ? 'pix' : 'manual', confirmadoEm: new Date().toISOString(), confirmadoPor: adminNome },
                    statusAposConfirmar(l), 'Aprovou o pagamento manualmente');
                showAlert('Pagamento confirmado.', 'success');
            } catch { showAlert('Erro ao confirmar pagamento.', 'error'); }
        }, 'info', 'Aprovar pagamento');
    };

    const verificarBanco = async (l: Linha) => {
        if (!l.pagamento.transacaoId) return;
        setVerificando(l.id);
        try {
            const pago = await consultarPagamentoPix(l.pagamento.transacaoId);
            if (!pago) { showAlert('O banco ainda não registra este PIX como pago.', 'info'); return; }
            await salvar(l, { ...l.pagamento, status: 'confirmado', metodo: 'pix', confirmadoEm: new Date().toISOString(), confirmadoPor: 'automatico' }, statusAposConfirmar(l), 'Confirmou PIX consultando o banco');
            showAlert('PIX confirmado pelo banco.', 'success');
        } catch { showAlert('Não foi possível consultar o banco agora.', 'error'); }
        finally { setVerificando(''); }
    };

    const confirmarRejeicao = async () => {
        if (!rejeitando) return;
        if (motivo.trim().length < 3) { showAlert('Informe o motivo.', 'warning'); return; }
        try {
            await salvar(rejeitando, { ...rejeitando.pagamento, status: 'pendente', observacao: motivo.trim() }, 'aguardando_pagamento', `Recusou o comprovante: ${motivo.trim()}`);
            setRejeitando(null);
            setMotivo('');
            showAlert('Comprovante recusado. O responsável verá o pagamento como pendente.', 'success');
        } catch { showAlert('Erro ao salvar.', 'error'); }
    };

    return (
        <>
            <div className="ev-grid c3" style={{ marginBottom: 16 }}>
                <div className="ev-stat verde"><div className="valor">{formatarMoeda(recebido)}</div><div className="rotulo">Recebido</div></div>
                <div className="ev-stat ouro"><div className="valor">{formatarMoeda(aReceber)}</div><div className="rotulo">Pendente</div></div>
                <div className="ev-stat"><div className="valor">{linhas.filter(l => l.pagamento.status === 'em_analise').length}</div><div className="rotulo">Comprovantes para analisar</div></div>
            </div>

            <div className="ev-card">
                <div className="ev-tabs">
                    {(['abertos', 'confirmados', 'todos'] as const).map(f => (
                        <button key={f} className={`ev-tab ${filtro === f ? 'ativa' : ''}`} onClick={() => setFiltro(f)}>{f === 'abertos' ? 'Pendentes' : f === 'confirmados' ? 'Recebidos' : 'Todos'}</button>
                    ))}
                </div>
                {filtradas.length === 0 ? <p className="ev-muted">Nada por aqui.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>{equipesEvento ? 'Equipe' : 'Participante'}</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Transação / comprovante</th><th></th></tr></thead>
                            <tbody>
                                {filtradas.map(l => {
                                    const r = ROTULO_PAG[l.pagamento.status];
                                    return (
                                        <tr key={l.id}>
                                            <td style={{ fontWeight: 800 }}>{l.nome}<div className="ev-muted ev-small">{l.responsavel.nome} · {l.responsavel.telefone}</div></td>
                                            <td>{nomeCat(l.categoriaId)}</td>
                                            <td>{formatarMoeda(l.pagamento.valor)}</td>
                                            <td>
                                                <span className="ev-badge" style={{ color: r.cor, background: r.fundo }}>{r.label}</span>
                                                {l.pagamento.confirmadoEm && <div className="ev-muted ev-small">{formatarDataHora(l.pagamento.confirmadoEm)} · {l.pagamento.confirmadoPor === 'automatico' ? 'automático' : l.pagamento.confirmadoPor}</div>}
                                                {l.pagamento.observacao && l.pagamento.status === 'pendente' && <div className="ev-small" style={{ color: '#9b1c1c' }}>{l.pagamento.observacao}</div>}
                                            </td>
                                            <td className="ev-small">
                                                {l.pagamento.transacaoId ? <code>{l.pagamento.transacaoId}</code> : '-'}
                                                {l.pagamento.comprovanteEnviadoUrl && <div><a href={l.pagamento.comprovanteEnviadoUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Ver comprovante enviado</a></div>}
                                            </td>
                                            <td>
                                                <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                                    {canEdit && (l.pagamento.status === 'pendente' || l.pagamento.status === 'em_analise') && <>
                                                        {l.pagamento.transacaoId && <button className="ev-btn mini neutro" title="Consultar banco" onClick={() => verificarBanco(l)} disabled={verificando === l.id}><RefreshCw size={12} className={verificando === l.id ? 'spin' : ''} /></button>}
                                                        <button className="ev-btn mini primario" onClick={() => aprovar(l)}><CheckCircle2 size={12} /> Aprovar</button>
                                                        {l.pagamento.status === 'em_analise' && <button className="ev-btn mini perigo" onClick={() => { setRejeitando(l); setMotivo(''); }}><XCircle size={12} /> Recusar</button>}
                                                    </>}
                                                    {l.pagamento.status === 'confirmado' && (
                                                        <button className="ev-btn mini secundario" onClick={() => pdfComprovantePagamento({
                                                            evento, categoria: evento.categorias.find(c => c.id === l.categoriaId), inscritoNome: l.nome,
                                                            responsavelNome: l.responsavel.nome, responsavelCpf: l.responsavel.cpf, pagamento: l.pagamento, inscricaoId: l.id,
                                                        })}><Download size={12} /> Comprovante</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal aberto={!!rejeitando} onFechar={() => setRejeitando(null)} titulo="Recusar comprovante"
                rodape={<><button className="ev-btn neutro" onClick={() => setRejeitando(null)}>Cancelar</button><button className="ev-btn perigo-cheio" onClick={confirmarRejeicao}>Recusar</button></>}>
                <div className="ev-field">
                    <label>Motivo (o responsável verá esta mensagem)</label>
                    <textarea className="ev-textarea" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: valor divergente, comprovante ilegível..." />
                </div>
            </Modal>
        </>
    );
}
