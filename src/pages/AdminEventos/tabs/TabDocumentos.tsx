import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import type { DocumentoStatus } from '../../../types/eventos';
import { atualizarEquipe, atualizarInscricao } from '../../../utils/eventos/eventosService';
import { formatarData, validarIdade } from '../../../utils/eventos/eventosRules';
import { Modal, DocumentoBadge } from '../../../components/eventos/EventosUI';
import type { TabProps } from './tipos';

interface LinhaDoc {
    chave: string;
    donoId: string;       // equipe ou inscrição
    atletaId?: string;    // só em equipes
    nome: string;
    grupo: string;        // equipe ou categoria
    categoriaId: string;
    nascimento: string;
    url?: string;
    status: DocumentoStatus;
    motivo?: string;
}

export default function TabDocumentos({ evento, equipes, inscricoes, recarregar, adminNome, canEdit }: TabProps) {
    const { showAlert } = useDialog();
    const [filtro, setFiltro] = useState<'pendente' | 'rejeitado' | 'aprovado' | 'todos'>('pendente');
    const [rejeitando, setRejeitando] = useState<LinhaDoc | null>(null);
    const [motivo, setMotivo] = useState('');
    const porEquipe = evento.tipo === 'equipes';

    const linhas: LinhaDoc[] = useMemo(() => porEquipe
        ? equipes.filter(e => e.status !== 'cancelada').flatMap(e => e.atletas.map(a => ({
            chave: `${e.id}_${a.id}`, donoId: e.id!, atletaId: a.id, nome: a.nome, grupo: e.nome, categoriaId: e.categoriaId,
            nascimento: a.dataNascimento, url: a.documentoUrl, status: a.documentoStatus, motivo: a.motivoRejeicao,
        })))
        : inscricoes.filter(i => i.status !== 'cancelada').map(i => ({
            chave: i.id!, donoId: i.id!, nome: i.participante.nome, grupo: evento.categorias.find(c => c.id === i.categoriaId)?.nome || '-',
            categoriaId: i.categoriaId, nascimento: i.participante.dataNascimento, url: i.documentoUrl, status: i.documentoStatus, motivo: i.motivoRejeicao,
        })), [porEquipe, equipes, inscricoes, evento.categorias]);

    const filtradas = linhas.filter(l => filtro === 'todos' || (l.url && l.status === filtro) || (filtro === 'pendente' && !l.url));

    const definir = async (l: LinhaDoc, status: DocumentoStatus, mot = '') => {
        try {
            const registro = { em: new Date().toISOString(), por: adminNome, acao: `${status === 'aprovado' ? 'Aprovou' : 'Rejeitou'} documento de ${l.nome}`, motivo: mot };
            if (porEquipe) {
                const eq = equipes.find(e => e.id === l.donoId)!;
                const atualizar = (lista: typeof eq.atletas) => lista.map(a => a.id === l.atletaId ? { ...a, documentoStatus: status, motivoRejeicao: mot } : a);
                await atualizarEquipe(eq.id!, {
                    atletas: atualizar(eq.atletas),
                    ...(eq.listaOficial ? { listaOficial: { ...eq.listaOficial, atletas: atualizar(eq.listaOficial.atletas) } } : {}),
                    alteracoes: [...(eq.alteracoes || []), registro],
                });
            } else {
                const ins = inscricoes.find(i => i.id === l.donoId)!;
                await atualizarInscricao(ins.id!, { documentoStatus: status, motivoRejeicao: mot, alteracoes: [...(ins.alteracoes || []), registro] });
            }
            await recarregar();
        } catch (e) {
            console.error(e);
            showAlert('Não foi possível salvar.', 'error');
        }
    };

    const confirmarRejeicao = async () => {
        if (!rejeitando) return;
        if (motivo.trim().length < 3) { showAlert('Informe o motivo da rejeição.', 'warning'); return; }
        await definir(rejeitando, 'rejeitado', motivo.trim());
        setRejeitando(null);
        setMotivo('');
    };

    return (
        <>
            <div className="ev-card">
                <div className="ev-tabs">
                    {(['pendente', 'rejeitado', 'aprovado', 'todos'] as const).map(f => (
                        <button key={f} className={`ev-tab ${filtro === f ? 'ativa' : ''}`} onClick={() => setFiltro(f)}>
                            {f === 'pendente' ? 'A analisar' : f === 'rejeitado' ? 'Rejeitados' : f === 'aprovado' ? 'Aprovados' : 'Todos'}
                            <span className="cont">{linhas.filter(l => f === 'todos' || (l.url && l.status === f) || (f === 'pendente' && !l.url)).length}</span>
                        </button>
                    ))}
                </div>
                {filtradas.length === 0 ? <p className="ev-muted">Nenhum documento nesta situação.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>{porEquipe ? 'Atleta' : 'Participante'}</th><th>{porEquipe ? 'Equipe' : 'Categoria'}</th><th>Nascimento</th><th>Documento</th><th></th></tr></thead>
                            <tbody>
                                {filtradas.map(l => {
                                    const cat = evento.categorias.find(c => c.id === l.categoriaId);
                                    const erroIdade = cat ? validarIdade(cat, l.nascimento) : null;
                                    return (
                                        <tr key={l.chave}>
                                            <td style={{ fontWeight: 800, textTransform: 'uppercase' }}>{l.nome}</td>
                                            <td>{l.grupo}</td>
                                            <td>{formatarData(l.nascimento)}{erroIdade && <div className="ev-small" style={{ color: '#c62828', fontWeight: 700 }}>Fora da faixa etária</div>}</td>
                                            <td>
                                                <DocumentoBadge status={l.status} temArquivo={!!l.url} />
                                                {l.url && <div><a className="ev-small" href={l.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Abrir documento</a></div>}
                                                {l.status === 'rejeitado' && l.motivo && <div className="ev-small" style={{ color: '#9b1c1c' }}>{l.motivo}</div>}
                                            </td>
                                            <td>
                                                {canEdit && l.url && (
                                                    <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                                        {l.status !== 'aprovado' && <button className="ev-btn mini primario" onClick={() => definir(l, 'aprovado')}><CheckCircle2 size={12} /> Aprovar</button>}
                                                        {l.status !== 'rejeitado' && <button className="ev-btn mini perigo" onClick={() => { setRejeitando(l); setMotivo(''); }}><XCircle size={12} /> Rejeitar</button>}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal aberto={!!rejeitando} onFechar={() => setRejeitando(null)} titulo={`Rejeitar documento — ${rejeitando?.nome || ''}`}
                rodape={<><button className="ev-btn neutro" onClick={() => setRejeitando(null)}>Cancelar</button><button className="ev-btn perigo-cheio" onClick={confirmarRejeicao}>Rejeitar</button></>}>
                <div className="ev-field">
                    <label>Motivo (o responsável verá esta mensagem)</label>
                    <textarea className="ev-textarea" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: documento ilegível, data de nascimento não confere..." />
                </div>
            </Modal>
        </>
    );
}
