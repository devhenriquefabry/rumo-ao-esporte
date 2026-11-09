import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Shuffle, Printer, Download, Pencil, Trash2, ClipboardEdit, Smartphone, Lock, AlertTriangle } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import { useLoading } from '../../../components/LoadingService';
import type { JogoEvento, EquipeEvento } from '../../../types/eventos';
import { salvarJogo, criarJogosEmLote, excluirJogo, atualizarJogo } from '../../../utils/eventos/eventosService';
import { formatarData, gerarTodosContraTodos, formatarTempoDeJogo } from '../../../utils/eventos/eventosRules';
import { pdfSumulas, type DadosSumula, type ModoPdf } from '../../../utils/eventos/eventosPdf';
import { Modal, Alerta } from '../../../components/eventos/EventosUI';
import type { TabProps } from './tipos';

const jogoVazio = (eventId: string, categoriaId: string, numero: number, local: string): JogoEvento => ({
    eventId, categoriaId, numero, fase: '1ª Rodada', grupo: '', eliminatoria: false,
    equipeAId: '', equipeANome: '', equipeBId: '', equipeBNome: '',
    data: '', horario: '', local, arbitragem: {}, status: 'agendado',
    placarA: null, placarB: null, penaltisA: null, penaltisB: null, lances: [], ocorrencias: '', createdAt: new Date().toISOString(),
});

export default function TabJogos({ evento, equipes, jogos, recarregar, adminNome, canEdit }: TabProps) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const { setLoading } = useLoading();
    const [filtroCat, setFiltroCat] = useState(evento.categorias[0]?.id || '');
    const [filtroFase, setFiltroFase] = useState('');
    const [editando, setEditando] = useState<JogoEvento | null>(null);
    const [resultado, setResultado] = useState<JogoEvento | null>(null);
    const [gerador, setGerador] = useState(false);
    const [gerPorGrupo, setGerPorGrupo] = useState(true);
    const [gerIdaVolta, setGerIdaVolta] = useState(false);
    const [gerData, setGerData] = useState('');

    const equipesAtivas = (catId: string) => equipes.filter(e => e.categoriaId === catId && e.status !== 'cancelada');
    const proximoNumero = () => Math.max(0, ...jogos.map(j => j.numero)) + 1;
    const fases = useMemo(() => Array.from(new Set(jogos.filter(j => j.categoriaId === filtroCat).map(j => j.fase))), [jogos, filtroCat]);
    const filtrados = jogos.filter(j => (!filtroCat || j.categoriaId === filtroCat) && (!filtroFase || j.fase === filtroFase));
    const equipePorId = (id: string) => equipes.find(e => e.id === id) || null;

    // ---------- Súmulas ----------
    const dadosSumula = (j: JogoEvento): DadosSumula => ({
        evento, jogo: j, categoria: evento.categorias.find(c => c.id === j.categoriaId),
        equipeA: equipePorId(j.equipeAId), equipeB: equipePorId(j.equipeBId),
    });

    const gerarSumulas = (lista: JogoEvento[], nome: string, modo: ModoPdf) => {
        if (!lista.length) { showAlert('Nenhum jogo para gerar súmula.', 'info'); return; }
        const pendentes = new Set<string>();
        lista.forEach(j => {
            if (!equipePorId(j.equipeAId)?.listaOficial) pendentes.add(j.equipeANome);
            if (!equipePorId(j.equipeBId)?.listaOficial) pendentes.add(j.equipeBNome);
        });
        const executar = async () => {
            setLoading(true, 'Gerando súmulas...');
            try { await pdfSumulas(lista.map(dadosSumula), nome, modo); }
            catch (e) { console.error(e); showAlert('Erro ao gerar as súmulas.', 'error'); }
            finally { setLoading(false); }
        };
        if (pendentes.size) {
            showConfirm(`Estas equipes ainda não finalizaram a relação e sairão sem atletas na súmula: ${Array.from(pendentes).join(', ')}. Gerar mesmo assim?`, executar, 'warning', 'Relações pendentes');
        } else executar();
    };

    // ---------- Cadastro manual ----------
    const novoJogo = () => setEditando(jogoVazio(evento.id!, filtroCat || evento.categorias[0]?.id || '', proximoNumero(), evento.local));

    const salvarEdicao = async () => {
        if (!editando) return;
        if (!editando.equipeAId || !editando.equipeBId) { showAlert('Escolha as duas equipes.', 'warning'); return; }
        if (editando.equipeAId === editando.equipeBId) { showAlert('Uma equipe não pode jogar contra ela mesma.', 'warning'); return; }
        if (jogos.some(j => j.id !== editando.id && j.numero === editando.numero)) { showAlert(`Já existe o jogo nº ${editando.numero}.`, 'warning'); return; }
        const a = equipePorId(editando.equipeAId)!, b = equipePorId(editando.equipeBId)!;
        try {
            await salvarJogo({ ...editando, equipeANome: a.nome, equipeBNome: b.nome });
            setEditando(null);
            await recarregar();
            showAlert('Jogo salvo.', 'success');
        } catch { showAlert('Erro ao salvar o jogo.', 'error'); }
    };

    const remover = (j: JogoEvento) => showConfirm(`Excluir o jogo ${j.numero} (${j.equipeANome} x ${j.equipeBNome})?`, async () => {
        try { await excluirJogo(j.id!); await recarregar(); } catch { showAlert('Erro ao excluir.', 'error'); }
    }, 'error');

    // ---------- Gerador todos contra todos ----------
    const gerarTabela = async () => {
        const lista = equipesAtivas(filtroCat);
        if (lista.length < 2) { showAlert('São necessárias pelo menos 2 equipes na categoria.', 'warning'); return; }
        const grupos = gerPorGrupo ? Array.from(new Set(lista.map(e => (e.grupo || '').trim()).filter(Boolean))).sort() : [];
        const blocos: { grupo: string; equipes: EquipeEvento[] }[] = grupos.length
            ? grupos.map(g => ({ grupo: g, equipes: lista.filter(e => (e.grupo || '').trim() === g) }))
            : [{ grupo: '', equipes: lista }];

        let numero = proximoNumero();
        const novos: JogoEvento[] = [];
        blocos.forEach(b => {
            gerarTodosContraTodos(b.equipes, gerIdaVolta).forEach((rodada, r) => {
                rodada.forEach(([a, bb]) => {
                    novos.push({
                        ...jogoVazio(evento.id!, filtroCat, numero++, evento.local),
                        fase: `${r + 1}ª Rodada`, grupo: b.grupo, data: gerData,
                        equipeAId: a.id!, equipeANome: a.nome, equipeBId: bb.id!, equipeBNome: bb.nome,
                    });
                });
            });
        });
        showConfirm(`Criar ${novos.length} jogo(s) na categoria ${evento.categorias.find(c => c.id === filtroCat)?.nome}? Depois você pode ajustar datas, horários e locais de cada um.`, async () => {
            setLoading(true, 'Criando jogos...');
            try { await criarJogosEmLote(novos); setGerador(false); await recarregar(); showAlert(`${novos.length} jogos criados.`, 'success'); }
            catch { showAlert('Erro ao criar os jogos.', 'error'); }
            finally { setLoading(false); }
        }, 'info');
    };

    // ---------- Resultado rápido ----------
    const salvarResultado = async () => {
        if (!resultado) return;
        if (resultado.placarA == null || resultado.placarB == null) { showAlert('Informe o placar das duas equipes.', 'warning'); return; }
        try {
            await atualizarJogo(resultado.id!, {
                placarA: resultado.placarA, placarB: resultado.placarB,
                penaltisA: resultado.penaltisA ?? null, penaltisB: resultado.penaltisB ?? null,
                ocorrencias: resultado.ocorrencias || '', status: resultado.status === 'wo' ? 'wo' : 'encerrado',
                encerradoEm: new Date().toISOString(), encerradoPor: adminNome,
            });
            setResultado(null);
            await recarregar();
            showAlert('Resultado registrado.', 'success');
        } catch { showAlert('Não foi possível salvar. Jogos encerrados só podem ser alterados pelo administrador principal.', 'error'); }
    };

    const catAtual = evento.categorias.find(c => c.id === filtroCat);
    const numOuNull = (v: string) => v === '' ? null : Math.max(0, Number(v) || 0);

    return (
        <>
            <div className="ev-card">
                <div className="ev-grid c3" style={{ alignItems: 'end' }}>
                    <div className="ev-field">
                        <label>Categoria</label>
                        <select className="ev-select" value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setFiltroFase(''); }}>
                            {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div className="ev-field">
                        <label>Fase / rodada</label>
                        <select className="ev-select" value={filtroFase} onChange={e => setFiltroFase(e.target.value)}>
                            <option value="">Todas</option>
                            {fases.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="ev-muted ev-small">
                        {catAtual && <>Tempo: <strong>{formatarTempoDeJogo(catAtual.tempo)}</strong><br />Súmula com até {catAtual.maxAtletas} atletas por equipe</>}
                    </div>
                </div>
                <div className="ev-actions" style={{ marginTop: 14 }}>
                    {canEdit && <button className="ev-btn primario" onClick={novoJogo}><Plus size={16} /> Novo jogo</button>}
                    {canEdit && <button className="ev-btn azul" onClick={() => setGerador(true)}><Shuffle size={16} /> Gerar todos contra todos</button>}
                    <button className="ev-btn secundario" onClick={() => gerarSumulas(filtrados, `sumulas-${catAtual?.nome || 'categoria'}${filtroFase ? `-${filtroFase}` : ''}`, 'baixar')}><Download size={16} /> Baixar súmulas {filtroFase ? 'da rodada' : 'da categoria'}</button>
                    <button className="ev-btn secundario" onClick={() => gerarSumulas(filtrados, 'sumulas', 'imprimir')}><Printer size={16} /> Imprimir {filtroFase ? 'rodada' : 'categoria'}</button>
                </div>
            </div>

            <div className="ev-card">
                {filtrados.length === 0 ? <p className="ev-muted">Nenhum jogo cadastrado nesta categoria.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>Nº</th><th>Fase</th><th>Data / local</th><th style={{ textAlign: 'right' }}>Equipe A</th><th className="num">Placar</th><th>Equipe B</th><th>Súmula</th><th></th></tr></thead>
                            <tbody>
                                {filtrados.map(j => {
                                    const encerrado = j.status === 'encerrado' || j.status === 'wo';
                                    const faltaLista = !equipePorId(j.equipeAId)?.listaOficial || !equipePorId(j.equipeBId)?.listaOficial;
                                    return (
                                        <tr key={j.id}>
                                            <td><strong>{String(j.numero).padStart(2, '0')}</strong></td>
                                            <td>{j.fase}{j.grupo ? <div className="ev-muted ev-small">Grupo {j.grupo}</div> : null}{j.eliminatoria ? <div className="ev-muted ev-small">Eliminatória</div> : null}</td>
                                            <td className="ev-small">{formatarData(j.data)} {j.horario}<div className="ev-muted">{j.local}</div></td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, textTransform: 'uppercase' }}>{j.equipeANome}</td>
                                            <td className="num" style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                                                {j.placarA != null && j.placarB != null && j.status !== 'agendado' ? `${j.placarA} x ${j.placarB}` : 'x'}
                                                {encerrado && <div className="ev-small" style={{ color: '#047857' }}><Lock size={10} /> {j.status === 'wo' ? 'W.O.' : 'encerrado'}</div>}
                                                {j.status === 'em_andamento' && <div className="ev-small" style={{ color: '#c62828' }}>em andamento</div>}
                                            </td>
                                            <td style={{ fontWeight: 800, textTransform: 'uppercase' }}>{j.equipeBNome}</td>
                                            <td>
                                                <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                                    <button className="ev-btn mini secundario" title="Baixar súmula" onClick={() => gerarSumulas([j], `sumula-jogo-${j.numero}`, 'baixar')}><Download size={12} /></button>
                                                    <button className="ev-btn mini secundario" title="Imprimir súmula" onClick={() => gerarSumulas([j], `sumula-jogo-${j.numero}`, 'imprimir')}><Printer size={12} /></button>
                                                    <button className="ev-btn mini azul" title="Súmula digital" onClick={() => navigate(`/admin/eventos/jogo/${j.id}/sumula`)}><Smartphone size={12} /></button>
                                                </div>
                                                {faltaLista && <div className="ev-small" style={{ color: '#b45309' }}><AlertTriangle size={10} /> relação pendente</div>}
                                            </td>
                                            <td>
                                                {canEdit && (
                                                    <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                                        <button className="ev-btn mini primario" title="Lançar resultado" onClick={() => setResultado({ ...j })}><ClipboardEdit size={12} /></button>
                                                        <button className="ev-btn mini neutro" title="Editar" onClick={() => setEditando({ ...j, arbitragem: { ...(j.arbitragem || {}) } })}><Pencil size={12} /></button>
                                                        <button className="ev-btn mini perigo" title="Excluir" onClick={() => remover(j)}><Trash2 size={12} /></button>
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

            {/* Novo / editar jogo */}
            <Modal aberto={!!editando} onFechar={() => setEditando(null)} titulo={editando?.id ? `Editar jogo ${editando.numero}` : 'Novo jogo'}
                rodape={<><button className="ev-btn neutro" onClick={() => setEditando(null)}>Cancelar</button><button className="ev-btn primario" onClick={salvarEdicao}>Salvar jogo</button></>}>
                {editando && (
                    <div className="ev-grid c3">
                        <div className="ev-field">
                            <label>Categoria</label>
                            <select className="ev-select" value={editando.categoriaId} onChange={e => setEditando({ ...editando, categoriaId: e.target.value, equipeAId: '', equipeBId: '' })}>
                                {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Nº do jogo</label>
                            <input className="ev-input" type="number" min={1} value={editando.numero} onChange={e => setEditando({ ...editando, numero: Math.max(1, Number(e.target.value) || 1) })} />
                        </div>
                        <div className="ev-field">
                            <label>Fase / rodada</label>
                            <input className="ev-input" list="ev-fases" value={editando.fase} onChange={e => setEditando({ ...editando, fase: e.target.value })} />
                            <datalist id="ev-fases">
                                {['1ª Rodada', '2ª Rodada', '3ª Rodada', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Disputa de 3º lugar', 'Final'].map(f => <option key={f} value={f} />)}
                            </datalist>
                        </div>
                        <div className="ev-field">
                            <label>Equipe A</label>
                            <select className="ev-select" value={editando.equipeAId} onChange={e => setEditando({ ...editando, equipeAId: e.target.value })}>
                                <option value="">Selecione</option>
                                {equipesAtivas(editando.categoriaId).map(e => <option key={e.id} value={e.id}>{e.nome}{e.grupo ? ` (Gr. ${e.grupo})` : ''}</option>)}
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Equipe B</label>
                            <select className="ev-select" value={editando.equipeBId} onChange={e => setEditando({ ...editando, equipeBId: e.target.value })}>
                                <option value="">Selecione</option>
                                {equipesAtivas(editando.categoriaId).map(e => <option key={e.id} value={e.id}>{e.nome}{e.grupo ? ` (Gr. ${e.grupo})` : ''}</option>)}
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Grupo / chave</label>
                            <input className="ev-input" value={editando.grupo || ''} onChange={e => setEditando({ ...editando, grupo: e.target.value.toUpperCase() })} placeholder="A" />
                        </div>
                        <div className="ev-field">
                            <label>Data</label>
                            <input className="ev-input" type="date" value={editando.data || ''} onChange={e => setEditando({ ...editando, data: e.target.value })} />
                        </div>
                        <div className="ev-field">
                            <label>Horário</label>
                            <input className="ev-input" type="time" value={editando.horario || ''} onChange={e => setEditando({ ...editando, horario: e.target.value })} />
                        </div>
                        <div className="ev-field">
                            <label>Local</label>
                            <input className="ev-input" value={editando.local || ''} onChange={e => setEditando({ ...editando, local: e.target.value })} />
                        </div>
                        {(['principal', 'auxiliar', 'anotador', 'cronometrista'] as const).map(campo => (
                            <div key={campo} className="ev-field">
                                <label>{campo === 'principal' ? 'Árbitro principal' : campo === 'auxiliar' ? 'Árbitro auxiliar' : campo === 'anotador' ? 'Anotador / mesário' : 'Cronometrista'}</label>
                                <input className="ev-input" value={editando.arbitragem?.[campo] || ''} onChange={e => setEditando({ ...editando, arbitragem: { ...(editando.arbitragem || {}), [campo]: e.target.value } })} />
                            </div>
                        ))}
                        <label className={`ev-check ${editando.eliminatoria ? 'marcado' : ''}`} style={{ gridColumn: '1 / -1' }}>
                            <input type="checkbox" checked={!!editando.eliminatoria} onChange={e => setEditando({ ...editando, eliminatoria: e.target.checked })} />
                            <span><strong>Jogo eliminatório (mata-mata)</strong> — não soma pontos na classificação e permite registrar pênaltis.</span>
                        </label>
                    </div>
                )}
            </Modal>

            {/* Gerador */}
            <Modal aberto={gerador} onFechar={() => setGerador(false)} titulo="Gerar jogos — todos contra todos"
                rodape={<><button className="ev-btn neutro" onClick={() => setGerador(false)}>Cancelar</button><button className="ev-btn primario" onClick={gerarTabela}><Shuffle size={16} /> Gerar jogos</button></>}>
                <Alerta tipo="info">
                    Categoria <strong>{catAtual?.nome}</strong> · {equipesAtivas(filtroCat).length} equipe(s) ativa(s).
                    Os jogos são criados por rodada; datas, horários, locais e árbitros podem ser ajustados depois.
                </Alerta>
                <label className={`ev-check ${gerPorGrupo ? 'marcado' : ''}`} style={{ marginBottom: 10 }}>
                    <input type="checkbox" checked={gerPorGrupo} onChange={e => setGerPorGrupo(e.target.checked)} />
                    <span><strong>Respeitar os grupos</strong> definidos na aba Equipes (cada grupo joga entre si).</span>
                </label>
                <label className={`ev-check ${gerIdaVolta ? 'marcado' : ''}`} style={{ marginBottom: 10 }}>
                    <input type="checkbox" checked={gerIdaVolta} onChange={e => setGerIdaVolta(e.target.checked)} />
                    <span><strong>Turno e returno</strong> (ida e volta).</span>
                </label>
                <div className="ev-field" style={{ maxWidth: 240 }}>
                    <label>Data (opcional)</label>
                    <input className="ev-input" type="date" value={gerData} onChange={e => setGerData(e.target.value)} />
                </div>
            </Modal>

            {/* Resultado */}
            <Modal aberto={!!resultado} onFechar={() => setResultado(null)} titulo={resultado ? `Resultado · Jogo ${resultado.numero}` : ''}
                rodape={<><button className="ev-btn neutro" onClick={() => setResultado(null)}>Cancelar</button><button className="ev-btn primario" onClick={salvarResultado}><Lock size={14} /> Salvar e encerrar</button></>}>
                {resultado && (
                    <>
                        <div className="ev-grid c2">
                            <div className="ev-field">
                                <label>{resultado.equipeANome}</label>
                                <input className="ev-input" type="number" min={0} style={{ fontSize: '1.6rem', textAlign: 'center', fontWeight: 900 }} value={resultado.placarA ?? ''} onChange={e => setResultado({ ...resultado, placarA: numOuNull(e.target.value) })} />
                            </div>
                            <div className="ev-field">
                                <label>{resultado.equipeBNome}</label>
                                <input className="ev-input" type="number" min={0} style={{ fontSize: '1.6rem', textAlign: 'center', fontWeight: 900 }} value={resultado.placarB ?? ''} onChange={e => setResultado({ ...resultado, placarB: numOuNull(e.target.value) })} />
                            </div>
                            {resultado.eliminatoria && <>
                                <div className="ev-field"><label>Pênaltis — {resultado.equipeANome}</label><input className="ev-input" type="number" min={0} value={resultado.penaltisA ?? ''} onChange={e => setResultado({ ...resultado, penaltisA: numOuNull(e.target.value) })} /></div>
                                <div className="ev-field"><label>Pênaltis — {resultado.equipeBNome}</label><input className="ev-input" type="number" min={0} value={resultado.penaltisB ?? ''} onChange={e => setResultado({ ...resultado, penaltisB: numOuNull(e.target.value) })} /></div>
                            </>}
                        </div>
                        <label className={`ev-check ${resultado.status === 'wo' ? 'marcado' : ''}`} style={{ margin: '12px 0' }}>
                            <input type="checkbox" checked={resultado.status === 'wo'} onChange={e => setResultado({ ...resultado, status: e.target.checked ? 'wo' : 'encerrado' })} />
                            <span><strong>W.O.</strong> — informe acima o placar definido no regulamento.</span>
                        </label>
                        <div className="ev-field">
                            <label>Ocorrências</label>
                            <textarea className="ev-textarea" value={resultado.ocorrencias || ''} onChange={e => setResultado({ ...resultado, ocorrencias: e.target.value })} />
                        </div>
                        {(resultado.lances?.length || 0) > 0 && <Alerta tipo="aviso">Este jogo tem lances registrados na súmula digital. O placar informado aqui prevalece na classificação.</Alerta>}
                    </>
                )}
            </Modal>
        </>
    );
}
