import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Flag, Undo2, Download, Printer, Lock, Timer, Hand } from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import type { Evento, EquipeEvento, JogoEvento, LanceSumula, LanceTipo, AtletaEvento } from '../../types/eventos';
import { atualizarJogo, buscarEquipe, buscarEvento, buscarJogo } from '../../utils/eventos/eventosService';
import { formatarTempoDeJogo, nomesPeriodos, novoId, formatarData } from '../../utils/eventos/eventosRules';
import { pdfSumulas } from '../../utils/eventos/eventosPdf';
import { Alerta } from '../../components/eventos/EventosUI';
import '../../styles/eventos.css';

const ROTULO: Record<LanceTipo, string> = {
    gol: 'Gol', gol_contra: 'Gol contra', amarelo: 'Cartão amarelo', vermelho: 'Cartão vermelho', falta: 'Falta', tempo: 'Pedido de tempo',
};

function placarDosLances(lances: LanceSumula[]) {
    let a = 0, b = 0;
    lances.forEach(l => {
        // Gol contra é registrado na equipe do atleta e conta para a adversária
        const paraA = (l.tipo === 'gol' && l.equipe === 'A') || (l.tipo === 'gol_contra' && l.equipe === 'B');
        const paraB = (l.tipo === 'gol' && l.equipe === 'B') || (l.tipo === 'gol_contra' && l.equipe === 'A');
        if (paraA) a++;
        if (paraB) b++;
    });
    return { a, b };
}

export default function AdminSumulaDigital() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const { user, canEdit } = useAdminPermissions();
    const [jogo, setJogo] = useState<JogoEvento | null>(null);
    const [evento, setEvento] = useState<Evento | null>(null);
    const [equipeA, setEquipeA] = useState<EquipeEvento | null>(null);
    const [equipeB, setEquipeB] = useState<EquipeEvento | null>(null);
    const [lado, setLado] = useState<'A' | 'B'>('A');
    const [periodo, setPeriodo] = useState(1);
    const [minuto, setMinuto] = useState('');
    const [ocorrencias, setOcorrencias] = useState('');
    const [salvando, setSalvando] = useState(false);

    const carregar = useCallback(async () => {
        if (!id) return;
        const j = await buscarJogo(id);
        if (!j) return;
        setJogo(j);
        setOcorrencias(j.ocorrencias || '');
        const [ev, a, b] = await Promise.all([buscarEvento(j.eventId), buscarEquipe(j.equipeAId), buscarEquipe(j.equipeBId)]);
        setEvento(ev);
        setEquipeA(a);
        setEquipeB(b);
        const ultimo = (j.lances || []).reduce((m, l) => Math.max(m, l.periodo), 1);
        setPeriodo(ultimo);
    }, [id]);

    useEffect(() => {
        carregar().catch(e => { console.error(e); showAlert('Erro ao carregar a partida.', 'error'); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carregar]);

    const categoria = evento?.categorias.find(c => c.id === jogo?.categoriaId);
    const periodos = nomesPeriodos(categoria?.tempo, true);
    const lances = useMemo(() => jogo?.lances || [], [jogo]);
    const placar = placarDosLances(lances);
    const encerrado = jogo?.status === 'encerrado' || jogo?.status === 'wo';
    const podeEditar = canEdit && !encerrado;

    if (!jogo || !evento) return <div className="ev-page" style={{ background: '#f4f8fc' }}><div className="ev-vazio">Carregando partida...</div></div>;

    const atletasDe = (l: 'A' | 'B'): AtletaEvento[] => {
        const eq = l === 'A' ? equipeA : equipeB;
        return [...(eq?.listaOficial?.atletas || [])].sort((x, y) => (parseInt(x.camisa || '999') - parseInt(y.camisa || '999')) || x.nome.localeCompare(y.nome));
    };

    const salvarLances = async (novos: LanceSumula[], extra: Partial<JogoEvento> = {}) => {
        setSalvando(true);
        try {
            const p = placarDosLances(novos);
            const dados: Partial<JogoEvento> = { lances: novos, placarA: p.a, placarB: p.b, ...extra };
            await atualizarJogo(jogo.id!, dados);
            setJogo({ ...jogo, ...dados });
        } catch (e) {
            console.error(e);
            showAlert('Não foi possível salvar o lance. Verifique a conexão.', 'error');
        } finally {
            setSalvando(false);
        }
    };

    const registrar = (tipo: LanceTipo, atleta?: AtletaEvento) => {
        if (!podeEditar) return;
        const contagem = (t: LanceTipo) => lances.filter(l => l.tipo === t && l.equipe === lado && l.periodo === periodo).length;
        if (tipo === 'tempo' && categoria && categoria.temposPorPeriodo > 0 && contagem('tempo') >= categoria.temposPorPeriodo) {
            showAlert(`Limite de ${categoria.temposPorPeriodo} pedido(s) de tempo por período já atingido.`, 'warning'); return;
        }
        if (atleta && tipo === 'amarelo' && lances.some(l => l.tipo === 'amarelo' && l.atletaId === atleta.id)) {
            showConfirm(`${atleta.nome} já tem cartão amarelo. Registrar o segundo amarelo e o vermelho?`, () => {
                const base = { equipe: lado, periodo, minuto: minuto.trim(), atletaId: atleta.id, atletaNome: atleta.nome, camisa: atleta.camisa, registradoEm: new Date().toISOString(), registradoPor: user?.nome || 'Mesário' };
                salvarLances([...lances, { ...base, id: novoId(), tipo: 'amarelo' }, { ...base, id: novoId(), tipo: 'vermelho' }]);
            }, 'warning');
            return;
        }
        const lance: LanceSumula = {
            id: novoId(), tipo, equipe: lado, periodo, minuto: minuto.trim(),
            atletaId: atleta?.id, atletaNome: atleta?.nome, camisa: atleta?.camisa,
            registradoEm: new Date().toISOString(), registradoPor: user?.nome || 'Mesário',
        };
        const extra: Partial<JogoEvento> = jogo.status === 'agendado' ? { status: 'em_andamento' } : {};
        salvarLances([...lances, lance], extra);
        setMinuto('');
        if (tipo === 'falta' && categoria && categoria.faltasPorPeriodo > 0 && contagem('falta') + 1 === categoria.faltasPorPeriodo) {
            showAlert(`Equipe ${lado} atingiu ${categoria.faltasPorPeriodo} faltas acumuladas neste período.`, 'warning');
        }
    };

    const desfazer = (l: LanceSumula) => showConfirm(`Remover o lance "${ROTULO[l.tipo]}${l.atletaNome ? ` — ${l.atletaNome}` : ''}"?`, () => salvarLances(lances.filter(x => x.id !== l.id)), 'warning');

    const iniciar = () => atualizarJogo(jogo.id!, { status: 'em_andamento' }).then(() => setJogo({ ...jogo, status: 'em_andamento' }));

    const salvarOcorrencias = () => atualizarJogo(jogo.id!, { ocorrencias }).then(() => setJogo({ ...jogo, ocorrencias })).catch(() => showAlert('Erro ao salvar ocorrências.', 'error'));

    const finalizar = () => showConfirm(
        <>Encerrar a partida com placar <strong>{jogo.equipeANome} {placar.a} x {placar.b} {jogo.equipeBNome}</strong>?<br />Depois de encerrada, a súmula não poderá mais ser alterada.</>,
        async () => {
            await salvarLances(lances, { status: 'encerrado', ocorrencias, encerradoEm: new Date().toISOString(), encerradoPor: user?.nome || 'Mesário' });
            showAlert('Partida encerrada. A súmula está disponível em PDF.', 'success');
        }, 'warning', 'Encerrar partida');

    const pdf = (modo: 'baixar' | 'imprimir') => pdfSumulas([{ evento, jogo: { ...jogo, ocorrencias }, categoria, equipeA, equipeB }], `sumula-jogo-${jogo.numero}`, modo);

    const contar = (tipo: LanceTipo, l: 'A' | 'B', p = periodo) => lances.filter(x => x.tipo === tipo && x.equipe === l && x.periodo === p).length;
    const cartoes = (atletaId: string) => ({
        amarelo: lances.filter(l => l.atletaId === atletaId && l.tipo === 'amarelo').length,
        vermelho: lances.some(l => l.atletaId === atletaId && l.tipo === 'vermelho'),
        gols: lances.filter(l => l.atletaId === atletaId && l.tipo === 'gol').length,
    });

    return (
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '12px 12px 60px' }}>
            <div className="ev-actions" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <button className="ev-btn neutro mini" onClick={() => navigate(`/admin/eventos/${evento.id}`)}>← Voltar</button>
                <div className="ev-actions">
                    <button className="ev-btn mini secundario" onClick={() => pdf('baixar')}><Download size={13} /> PDF</button>
                    <button className="ev-btn mini secundario" onClick={() => pdf('imprimir')}><Printer size={13} /> Imprimir</button>
                </div>
            </div>

            <div className="ev-placar">
                <div className="time">{jogo.equipeANome}</div>
                <div>
                    <div className="gols">{placar.a} x {placar.b}</div>
                    <div className="ev-small" style={{ opacity: .8 }}>Jogo {jogo.numero} · {categoria?.nome} · {formatarTempoDeJogo(categoria?.tempo)}</div>
                </div>
                <div className="time">{jogo.equipeBNome}</div>
            </div>

            <div className="ev-card" style={{ marginTop: 12 }}>
                <p className="ev-muted ev-small">{evento.nome} · {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · {formatarData(jogo.data)} {jogo.horario} · {jogo.local}</p>
                {encerrado && <Alerta tipo="ok"><Lock size={14} /> Partida encerrada{jogo.encerradoPor ? ` por ${jogo.encerradoPor}` : ''}. A súmula está bloqueada para alterações.</Alerta>}
                {!canEdit && !encerrado && <Alerta tipo="aviso">Seu perfil tem acesso somente para visualização.</Alerta>}
                {(!equipeA?.listaOficial || !equipeB?.listaOficial) && <Alerta tipo="aviso">Uma das equipes ainda não finalizou a relação oficial — os atletas dela não aparecem aqui.</Alerta>}
                {podeEditar && jogo.status === 'agendado' && <button className="ev-btn primario grande bloco" onClick={iniciar}><Play size={18} /> Iniciar partida</button>}

                {podeEditar && (
                    <>
                        <div className="ev-secao-titulo">Período</div>
                        <div className="ev-tabs">
                            {periodos.map((p, i) => <button key={p} className={`ev-tab ${periodo === i + 1 ? 'ativa' : ''}`} onClick={() => setPeriodo(i + 1)}>{p}</button>)}
                        </div>
                        <div className="ev-grid c2">
                            <div className="ev-field">
                                <label>Minuto (opcional)</label>
                                <input className="ev-input" inputMode="numeric" value={minuto} onChange={e => setMinuto(e.target.value.slice(0, 5))} placeholder="Ex.: 7" />
                            </div>
                            <div className="ev-field">
                                <label>Equipe</label>
                                <div className="ev-tabs" style={{ marginBottom: 0 }}>
                                    <button className={`ev-tab ${lado === 'A' ? 'ativa' : ''}`} onClick={() => setLado('A')}>A · {jogo.equipeANome}</button>
                                    <button className={`ev-tab ${lado === 'B' ? 'ativa' : ''}`} onClick={() => setLado('B')}>B · {jogo.equipeBNome}</button>
                                </div>
                            </div>
                        </div>
                        <div className="ev-grid c2" style={{ marginTop: 12 }}>
                            <button className="ev-lance-btn" onClick={() => registrar('falta')} disabled={salvando}>
                                <Hand size={20} /> Falta da equipe {lado}
                                <span className="ev-muted">{contar('falta', lado)}{categoria?.faltasPorPeriodo ? ` / ${categoria.faltasPorPeriodo}` : ''} no período</span>
                            </button>
                            <button className="ev-lance-btn" onClick={() => registrar('tempo')} disabled={salvando}>
                                <Timer size={20} /> Pedido de tempo
                                <span className="ev-muted">{contar('tempo', lado)}{categoria?.temposPorPeriodo ? ` / ${categoria.temposPorPeriodo}` : ''} no período</span>
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="ev-card">
                <h3>Atletas — Equipe {lado}</h3>
                {atletasDe(lado).length === 0 ? <p className="ev-muted">Sem relação oficial.</p> : (
                    <div className="ev-lista-atletas">
                        {atletasDe(lado).map(a => {
                            const c = cartoes(a.id);
                            return (
                                <div key={a.id} className="ev-atleta" style={{ opacity: c.vermelho ? .55 : 1 }}>
                                    <span className="camisa">{a.camisa || '–'}</span>
                                    <div>
                                        <div className="nome">{a.nome}</div>
                                        <div className="ev-small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {c.gols > 0 && <span>⚽ {c.gols}</span>}
                                            {Array.from({ length: c.amarelo }).map((_, k) => <span key={k} className="ev-cartao" style={{ background: '#f4c20d' }} />)}
                                            {c.vermelho && <span className="ev-cartao" style={{ background: '#c62828' }} />}
                                        </div>
                                    </div>
                                    {podeEditar && (
                                        <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                            <button className="ev-btn mini primario" onClick={() => registrar('gol', a)} disabled={salvando}>⚽ Gol</button>
                                            <button className="ev-btn mini" style={{ background: '#f4c20d' }} onClick={() => registrar('amarelo', a)} disabled={salvando || c.vermelho}>CA</button>
                                            <button className="ev-btn mini" style={{ background: '#c62828', color: '#fff' }} onClick={() => registrar('vermelho', a)} disabled={salvando || c.vermelho}>CV</button>
                                            <button className="ev-btn mini neutro" title="Gol contra" onClick={() => registrar('gol_contra', a)} disabled={salvando}>GC</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="ev-card">
                <h3>Lances registrados ({lances.length})</h3>
                {lances.length === 0 ? <p className="ev-muted">Nenhum lance ainda.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>Período</th><th>Min.</th><th>Equipe</th><th>Lance</th><th>Atleta</th><th></th></tr></thead>
                            <tbody>
                                {[...lances].reverse().map(l => (
                                    <tr key={l.id}>
                                        <td>{periodos[l.periodo - 1] || l.periodo}</td>
                                        <td>{l.minuto || '-'}</td>
                                        <td>{l.equipe}</td>
                                        <td style={{ fontWeight: 700 }}>{ROTULO[l.tipo]}</td>
                                        <td>{l.camisa ? `${l.camisa} · ` : ''}{l.atletaNome || '-'}</td>
                                        <td>{podeEditar && <button className="ev-btn mini perigo" onClick={() => desfazer(l)}><Undo2 size={12} /></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="ev-card">
                <h3>Anotações e ocorrências</h3>
                <textarea className="ev-textarea" value={ocorrencias} disabled={!podeEditar} onChange={e => setOcorrencias(e.target.value)} onBlur={() => podeEditar && ocorrencias !== (jogo.ocorrencias || '') && salvarOcorrencias()} placeholder="Expulsões, protestos, atrasos, lesões..." />
                {podeEditar && jogo.status !== 'agendado' && (
                    <button className="ev-btn perigo-cheio grande bloco" style={{ marginTop: 14 }} onClick={finalizar} disabled={salvando}>
                        <Flag size={18} /> Encerrar partida
                    </button>
                )}
            </div>
        </div>
    );
}
