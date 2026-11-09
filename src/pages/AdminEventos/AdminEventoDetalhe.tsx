import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, ExternalLink, FileText, Users, CreditCard, FileCheck2, Swords, ListOrdered, LayoutDashboard, Medal, Copy } from 'lucide-react';
import PageContainer from '../../components/PageContainer';
import PageTitle from '../../components/PageTitle';
import { useLoading } from '../../components/LoadingService';
import { useDialog } from '../../context/CustomDialogContext';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import type { Evento, EquipeEvento, InscricaoIndividual, JogoEvento } from '../../types/eventos';
import { buscarEvento, listarEquipesDoEvento, listarInscricoesDoEvento, listarJogos } from '../../utils/eventos/eventosService';
import { formatarData, formatarMoeda, formatarTempoDeJogo, faixaEtariaTexto, modalidadeLabel, situacaoInscricoes, formatoLabel } from '../../utils/eventos/eventosRules';
import TabRegulamento from './tabs/TabRegulamento';
import TabEquipes from './tabs/TabEquipes';
import TabPagamentos from './tabs/TabPagamentos';
import TabDocumentos from './tabs/TabDocumentos';
import TabJogos from './tabs/TabJogos';
import TabClassificacao from './tabs/TabClassificacao';
import TabCorrida from './tabs/TabCorrida';
import type { TabProps } from './tabs/tipos';
import '../../styles/eventos.css';

type Aba = 'resumo' | 'regulamento' | 'inscricoes' | 'pagamentos' | 'documentos' | 'jogos' | 'classificacao' | 'resultados';

export default function AdminEventoDetalhe() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setLoading } = useLoading();
    const { showAlert } = useDialog();
    const { user, canEdit } = useAdminPermissions();
    const [evento, setEvento] = useState<Evento | null>(null);
    const [equipes, setEquipes] = useState<EquipeEvento[]>([]);
    const [inscricoes, setInscricoes] = useState<InscricaoIndividual[]>([]);
    const [jogos, setJogos] = useState<JogoEvento[]>([]);
    const [aba, setAba] = useState<Aba>(() => (sessionStorage.getItem('rae_evento_aba') as Aba) || 'resumo');

    const recarregar = useCallback(async () => {
        if (!id) return;
        try {
            const ev = await buscarEvento(id);
            setEvento(ev);
            if (!ev) return;
            if (ev.tipo === 'equipes') {
                const [eq, jg] = await Promise.all([listarEquipesDoEvento(id), listarJogos(id)]);
                setEquipes(eq);
                setJogos(jg);
            } else {
                setInscricoes(await listarInscricoesDoEvento(id));
            }
        } catch (e) {
            console.error(e);
            showAlert('Erro ao carregar o evento.', 'error');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        setLoading(true, 'Carregando evento...');
        recarregar().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recarregar]);

    useEffect(() => { try { sessionStorage.setItem('rae_evento_aba', aba); } catch { /* sem storage */ } }, [aba]);

    const contadores = useMemo(() => {
        const lista = evento?.tipo === 'equipes' ? equipes : inscricoes;
        const ativos = lista.filter(i => i.status !== 'cancelada');
        const pag = ativos.filter(i => i.pagamento?.status === 'pendente' || i.pagamento?.status === 'em_analise').length;
        const docs = evento?.tipo === 'equipes'
            ? equipes.flatMap(e => e.atletas || []).filter(a => a.documentoUrl && a.documentoStatus === 'pendente').length
            : inscricoes.filter(i => i.documentoUrl && i.documentoStatus === 'pendente').length;
        const finalizadas = ativos.filter(i => i.status === 'finalizada').length;
        const recebido = ativos.filter(i => i.pagamento?.status === 'confirmado').reduce((s, i) => s + (i.pagamento.valor || 0), 0);
        return { total: ativos.length, pag, docs, finalizadas, recebido };
    }, [evento, equipes, inscricoes]);

    if (!evento) return <PageContainer><div className="ev-card ev-vazio">Carregando evento...</div></PageContainer>;

    const individual = evento.tipo === 'individual';
    const props: TabProps = {
        evento, setEvento, equipes, inscricoes, jogos, recarregar,
        adminNome: user?.nome || 'Administrador', canEdit,
    };

    const abas: { id: Aba; label: string; icone: typeof FileText; cont?: number }[] = [
        { id: 'resumo', label: 'Resumo', icone: LayoutDashboard },
        { id: 'regulamento', label: 'Regulamento', icone: FileText },
        { id: 'inscricoes', label: individual ? 'Inscritos' : 'Equipes', icone: Users, cont: contadores.total },
        { id: 'pagamentos', label: 'Pagamentos', icone: CreditCard, cont: contadores.pag || undefined },
        { id: 'documentos', label: 'Documentos', icone: FileCheck2, cont: contadores.docs || undefined },
        ...(individual
            ? [{ id: 'resultados' as Aba, label: 'Resultados', icone: Medal }]
            : [{ id: 'jogos' as Aba, label: 'Jogos e súmulas', icone: Swords, cont: jogos.length }, { id: 'classificacao' as Aba, label: 'Classificação', icone: ListOrdered }]),
    ];

    const linkPublico = `${window.location.origin}/eventos/${evento.id}`;

    return (
        <PageContainer>
            <PageTitle title={evento.nome} subtitle={`${modalidadeLabel(evento.modalidade)} · ${formatarData(evento.dataInicio)} · ${evento.local || 'local a definir'}`}>
                <button className="ev-btn neutro" onClick={() => navigate('/admin/eventos')}>← Eventos</button>
                <a className="ev-btn secundario" href={`/eventos/${evento.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver página</a>
                {canEdit && <button className="ev-btn azul" onClick={() => navigate(`/admin/eventos/${evento.id}/editar`)}><Pencil size={16} /> Configurar</button>}
            </PageTitle>

            <div className="ev-tabs">
                {abas.map(a => (
                    <button key={a.id} className={`ev-tab ${aba === a.id ? 'ativa' : ''}`} onClick={() => setAba(a.id)}>
                        <a.icone size={14} /> {a.label} {a.cont ? <span className="cont">{a.cont}</span> : null}
                    </button>
                ))}
            </div>

            {aba === 'resumo' && (
                <>
                    <div className="ev-grid c4" style={{ marginBottom: 16 }}>
                        <div className="ev-stat"><div className="valor">{contadores.total}</div><div className="rotulo">{individual ? 'Inscritos' : 'Equipes inscritas'}</div></div>
                        <div className="ev-stat verde"><div className="valor">{formatarMoeda(contadores.recebido)}</div><div className="rotulo">Pagamentos recebidos</div></div>
                        <div className="ev-stat ouro"><div className="valor">{contadores.pag}</div><div className="rotulo">Pagamentos pendentes</div></div>
                        <div className="ev-stat vermelho"><div className="valor">{contadores.docs}</div><div className="rotulo">Documentos a analisar</div></div>
                    </div>
                    <div className="ev-card">
                        <h3>Situação</h3>
                        <p><strong>Status:</strong> {evento.status} · {situacaoInscricoes(evento)}</p>
                        <p><strong>Regulamento:</strong> {evento.regulamento ? `versão ${evento.regulamento.versao} publicada em ${formatarData(evento.regulamento.publicadoEm)}` : <span style={{ color: '#c62828', fontWeight: 700 }}>não anexado</span>}</p>
                        {!individual && <p><strong>Formato:</strong> {formatoLabel(evento.formato)} · <strong>Relações finalizadas:</strong> {contadores.finalizadas} de {contadores.total}</p>}
                        <div className="ev-actions" style={{ marginTop: 10 }}>
                            <button className="ev-btn neutro mini" onClick={() => { navigator.clipboard?.writeText(linkPublico); showAlert('Link da página de inscrição copiado!', 'success'); }}><Copy size={13} /> Copiar link de inscrição</button>
                            <span className="ev-muted ev-small">{linkPublico}</span>
                        </div>
                    </div>
                    <div className="ev-card">
                        <h3>Categorias</h3>
                        <div className="ev-table-wrap">
                            <table className="ev-table">
                                <thead><tr><th>Categoria</th><th>Faixa etária</th>{individual ? <th>Distância</th> : <><th>Tempo</th><th className="num">Atletas</th></>}<th className="num">Inscritos</th><th>Valor</th></tr></thead>
                                <tbody>
                                    {evento.categorias.map(c => {
                                        const qtd = (individual ? inscricoes : equipes).filter(i => i.categoriaId === c.id && i.status !== 'cancelada').length;
                                        return (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 800 }}>{c.nome}</td>
                                                <td>{faixaEtariaTexto(c)}</td>
                                                {individual ? <td>{c.distancia || '-'}</td> : <><td>{formatarTempoDeJogo(c.tempo)}</td><td className="num">{c.minAtletas}–{c.maxAtletas}</td></>}
                                                <td className="num">{qtd}{c.maxInscricoes ? ` / ${c.maxInscricoes}` : ''}</td>
                                                <td>{c.valor > 0 ? formatarMoeda(c.valor) : 'Gratuita'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {aba === 'regulamento' && <TabRegulamento {...props} />}
            {aba === 'inscricoes' && (individual ? <TabCorrida {...props} modo="inscritos" /> : <TabEquipes {...props} />)}
            {aba === 'pagamentos' && <TabPagamentos {...props} />}
            {aba === 'documentos' && <TabDocumentos {...props} />}
            {aba === 'jogos' && <TabJogos {...props} />}
            {aba === 'classificacao' && <TabClassificacao {...props} />}
            {aba === 'resultados' && <TabCorrida {...props} modo="resultados" />}
        </PageContainer>
    );
}
