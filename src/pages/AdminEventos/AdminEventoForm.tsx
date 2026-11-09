import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, Copy, ArrowUp, ArrowDown, Upload, Clock, Users } from 'lucide-react';
import PageContainer from '../../components/PageContainer';
import PageTitle from '../../components/PageTitle';
import { useLoading } from '../../components/LoadingService';
import { useDialog } from '../../context/CustomDialogContext';
import type { Evento, EventoCategoria, CriterioDesempate } from '../../types/eventos';
import { buscarEvento, salvarEvento, enviarArquivo } from '../../utils/eventos/eventosService';
import {
    novoEvento, novaCategoria, novoId, MODALIDADES, FORMATOS, CRITERIOS, criterioLabel, formatarTempoDeJogo, mensagemErro } from '../../utils/eventos/eventosRules';
import '../../styles/eventos.css';

const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);

export default function AdminEventoForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setLoading } = useLoading();
    const { showAlert, showConfirm } = useDialog();
    const [evento, setEvento] = useState<Evento>(novoEvento());
    const [enviandoBanner, setEnviandoBanner] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true, 'Carregando evento...');
        buscarEvento(id).then(ev => { if (ev) setEvento(ev); }).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const set = <K extends keyof Evento>(campo: K, valor: Evento[K]) => setEvento(prev => ({ ...prev, [campo]: valor }));

    const setCategoria = (catId: string, dados: Partial<EventoCategoria>) =>
        setEvento(prev => ({ ...prev, categorias: prev.categorias.map(c => c.id === catId ? { ...c, ...dados } : c) }));

    const setTempo = (catId: string, campo: keyof EventoCategoria['tempo'], valor: number) =>
        setEvento(prev => ({ ...prev, categorias: prev.categorias.map(c => c.id === catId ? { ...c, tempo: { ...c.tempo, [campo]: valor } } : c) }));

    const adicionarCategoria = () => set('categorias', [...evento.categorias, novaCategoria(evento.tipo === 'individual'
        ? { maxAtletas: 1, minAtletas: 1, faltasPorPeriodo: 0, temposPorPeriodo: 0 } : {})]);

    const duplicarCategoria = (c: EventoCategoria) => set('categorias', [...evento.categorias, { ...c, id: novoId(), nome: `${c.nome} (cópia)`, tempo: { ...c.tempo } }]);

    const removerCategoria = (c: EventoCategoria) => showConfirm(
        `Remover a categoria "${c.nome || 'sem nome'}"? Se já houver inscrições nela, elas ficarão sem categoria — prefira ajustar a categoria em vez de removê-la.`,
        () => setEvento(prev => ({ ...prev, categorias: prev.categorias.filter(x => x.id !== c.id) })),
        'warning', 'Remover categoria',
    );

    const moverCriterio = (i: number, dir: -1 | 1) => {
        const lista = [...evento.criteriosDesempate];
        const j = i + dir;
        if (j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        set('criteriosDesempate', lista);
    };

    const alternarCriterio = (c: CriterioDesempate) => set('criteriosDesempate',
        evento.criteriosDesempate.includes(c) ? evento.criteriosDesempate.filter(x => x !== c) : [...evento.criteriosDesempate, c]);

    const enviarBanner = async (file?: File | null) => {
        if (!file) return;
        setEnviandoBanner(true);
        try { set('bannerUrl', await enviarArquivo(file, 'evento_banner')); }
        catch (e) { showAlert(mensagemErro(e, 'Erro ao enviar o banner.'), 'error'); }
        finally { setEnviandoBanner(false); }
    };

    const salvar = async () => {
        if (!evento.nome.trim()) { showAlert('Informe o nome do evento.', 'warning'); return; }
        if (!evento.categorias.length) { showAlert('Cadastre pelo menos uma categoria.', 'warning'); return; }
        if (evento.categorias.some(c => !c.nome.trim())) { showAlert('Todas as categorias precisam de nome.', 'warning'); return; }
        if (evento.inscricoesFim < evento.inscricoesInicio) { showAlert('O fim das inscrições não pode ser antes do início.', 'warning'); return; }
        if (evento.tipo === 'equipes' && evento.categorias.some(c => c.maxAtletas < 1 || c.minAtletas > c.maxAtletas)) {
            showAlert('Revise o limite de atletas: o mínimo não pode ser maior que o máximo.', 'warning'); return;
        }
        if (evento.tipo === 'equipes' && evento.categorias.some(c => c.tempo.periodos < 1 || c.tempo.duracaoMin < 1)) {
            showAlert('Revise o tempo de jogo das categorias (períodos e duração).', 'warning'); return;
        }
        setLoading(true, 'Salvando evento...');
        try {
            const novoIdEvento = await salvarEvento({ ...evento, nome: evento.nome.trim() });
            showAlert('Evento salvo!', 'success');
            navigate(`/admin/eventos/${novoIdEvento}`);
        } catch (e) {
            console.error(e);
            showAlert('Erro ao salvar o evento.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const equipes = evento.tipo === 'equipes';

    return (
        <PageContainer>
            <PageTitle title={id ? 'Editar evento' : 'Novo evento'} subtitle="Tudo aqui é configurável por evento e por categoria — sem depender de programador.">
                <button className="ev-btn neutro" onClick={() => navigate(id ? `/admin/eventos/${id}` : '/admin/eventos')}>Cancelar</button>
                <button className="ev-btn primario" onClick={salvar}><Save size={16} /> Salvar</button>
            </PageTitle>

            <div className="ev-card">
                <h2>Dados do evento</h2>
                <div className="ev-grid c3">
                    <div className="ev-field">
                        <label>Tipo de inscrição</label>
                        <select className="ev-select" value={evento.tipo} disabled={!!id}
                            onChange={e => setEvento(prev => ({ ...prev, tipo: e.target.value as Evento['tipo'], modalidade: e.target.value === 'individual' ? 'corrida' : 'futsal', formato: e.target.value === 'individual' ? 'manual' : prev.formato }))}>
                            <option value="equipes">Por equipes (futebol, futsal, torneios)</option>
                            <option value="individual">Individual (corrida de rua, caminhada)</option>
                        </select>
                        {id && <span className="ev-hint">O tipo não pode ser alterado depois de criado.</span>}
                    </div>
                    <div className="ev-field">
                        <label>Modalidade</label>
                        <select className="ev-select" value={evento.modalidade} onChange={e => set('modalidade', e.target.value)}>
                            {MODALIDADES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                    <div className="ev-field">
                        <label>Situação</label>
                        <select className="ev-select" value={evento.status} onChange={e => set('status', e.target.value as Evento['status'])}>
                            <option value="rascunho">Rascunho (não aparece no site)</option>
                            <option value="publicado">Publicado</option>
                            <option value="encerrado">Encerrado (só resultados)</option>
                        </select>
                    </div>
                    <div className="ev-field ev-span2">
                        <label>Nome do evento</label>
                        <input className="ev-input" value={evento.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Copa REAL de Futsal 2026" />
                    </div>
                    <div className="ev-field">
                        <label>Local</label>
                        <input className="ev-input" value={evento.local} onChange={e => set('local', e.target.value)} placeholder="Ginásio Poliesportivo" />
                    </div>
                    <div className="ev-field">
                        <label>Data de início</label>
                        <input className="ev-input" type="date" value={evento.dataInicio} onChange={e => set('dataInicio', e.target.value)} />
                    </div>
                    <div className="ev-field">
                        <label>Data de término</label>
                        <input className="ev-input" type="date" value={evento.dataFim || ''} onChange={e => set('dataFim', e.target.value)} />
                    </div>
                    <div className="ev-field">
                        <label>Banner</label>
                        <label className="ev-btn secundario" style={{ cursor: 'pointer' }}>
                            <Upload size={16} /> {enviandoBanner ? 'Enviando...' : evento.bannerUrl ? 'Trocar banner' : 'Enviar imagem'}
                            <input type="file" accept="image/*" hidden onChange={e => enviarBanner(e.target.files?.[0])} />
                        </label>
                    </div>
                    <div className="ev-field">
                        <label>Inscrições — início</label>
                        <input className="ev-input" type="date" value={evento.inscricoesInicio} onChange={e => set('inscricoesInicio', e.target.value)} />
                    </div>
                    <div className="ev-field">
                        <label>Inscrições — fim</label>
                        <input className="ev-input" type="date" value={evento.inscricoesFim} onChange={e => set('inscricoesFim', e.target.value)} />
                    </div>
                    <div className="ev-field">
                        <label>Documento obrigatório</label>
                        <select className="ev-select" value={evento.exigirDocumento ? 'sim' : 'nao'} onChange={e => set('exigirDocumento', e.target.value === 'sim')}>
                            <option value="sim">Sim — exigir documento de cada {equipes ? 'atleta' : 'participante'}</option>
                            <option value="nao">Não exigir</option>
                        </select>
                    </div>
                    <div className="ev-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Descrição</label>
                        <textarea className="ev-textarea" value={evento.descricao} onChange={e => set('descricao', e.target.value)} />
                    </div>
                    {evento.bannerUrl && <img src={evento.bannerUrl} alt="Banner" style={{ gridColumn: '1 / -1', maxHeight: 180, objectFit: 'cover', borderRadius: 12, width: '100%' }} />}
                </div>
            </div>

            {equipes && (
                <div className="ev-card">
                    <h2>Formato da competição</h2>
                    <div className="ev-grid c4">
                        <div className="ev-field">
                            <label>Formato</label>
                            <select className="ev-select" value={evento.formato} onChange={e => set('formato', e.target.value as Evento['formato'])}>
                                {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Pontos por vitória</label>
                            <input className="ev-input" type="number" min={0} value={evento.pontuacao.vitoria} onChange={e => set('pontuacao', { ...evento.pontuacao, vitoria: num(e.target.value) })} />
                        </div>
                        <div className="ev-field">
                            <label>Pontos por empate</label>
                            <input className="ev-input" type="number" min={0} value={evento.pontuacao.empate} onChange={e => set('pontuacao', { ...evento.pontuacao, empate: num(e.target.value) })} />
                        </div>
                        <div className="ev-field">
                            <label>Pontos por derrota</label>
                            <input className="ev-input" type="number" min={0} value={evento.pontuacao.derrota} onChange={e => set('pontuacao', { ...evento.pontuacao, derrota: num(e.target.value) })} />
                        </div>
                    </div>
                    <div className="ev-secao-titulo">Critérios de desempate (na ordem de aplicação)</div>
                    <div className="ev-grid c2">
                        <div>
                            {evento.criteriosDesempate.map((c, i) => (
                                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #dce7f3', borderRadius: 10, marginBottom: 6, background: '#fff' }}>
                                    <strong style={{ color: '#00a63a', width: 24 }}>{i + 1}º</strong>
                                    <span style={{ flex: 1, fontWeight: 700 }}>{criterioLabel(c)}</span>
                                    <button className="ev-btn mini neutro" onClick={() => moverCriterio(i, -1)} disabled={i === 0}><ArrowUp size={12} /></button>
                                    <button className="ev-btn mini neutro" onClick={() => moverCriterio(i, 1)} disabled={i === evento.criteriosDesempate.length - 1}><ArrowDown size={12} /></button>
                                    <button className="ev-btn mini perigo" onClick={() => alternarCriterio(c)}><Trash2 size={12} /></button>
                                </div>
                            ))}
                        </div>
                        <div>
                            <span className="ev-hint">Adicionar critério:</span>
                            <div className="ev-actions" style={{ marginTop: 6 }}>
                                {CRITERIOS.filter(c => !evento.criteriosDesempate.includes(c.id)).map(c => (
                                    <button key={c.id} className="ev-btn mini secundario" onClick={() => alternarCriterio(c.id)}><Plus size={12} /> {c.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="ev-field" style={{ marginTop: 12 }}>
                        <label>Regras específicas</label>
                        <textarea className="ev-textarea" value={evento.regrasEspecificas || ''} onChange={e => set('regrasEspecificas', e.target.value)} placeholder="Ex.: W.O. vale 3x0; atleta com 2 amarelos cumpre suspensão automática..." />
                    </div>
                </div>
            )}

            {!equipes && (
                <div className="ev-card">
                    <h2>Kit do participante</h2>
                    <div className="ev-field">
                        <label>Orientações para retirada do kit</label>
                        <textarea className="ev-textarea" value={evento.orientacoesKit || ''} onChange={e => set('orientacoesKit', e.target.value)} placeholder="Local, datas, horários e documentos necessários para retirar o kit." />
                        <span className="ev-hint">Aparece no comprovante de inscrição do corredor.</span>
                    </div>
                </div>
            )}

            <div className="ev-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <h2 style={{ margin: 0 }}>Categorias</h2>
                    <button className="ev-btn azul" onClick={adicionarCategoria}><Plus size={16} /> Adicionar categoria</button>
                </div>
                {evento.categorias.length === 0 && <p className="ev-muted">Nenhuma categoria. Ex.: {equipes ? 'Sub-9, Sub-11, Sub-13, Adulto' : '5 km Masculino, 5 km Feminino, 10 km Geral'}.</p>}

                {evento.categorias.map(c => (
                    <div key={c.id} className="ev-categoria-editor">
                        <div className="ev-grid c4">
                            <div className="ev-field ev-span2">
                                <label>Nome da categoria</label>
                                <input className="ev-input" value={c.nome} onChange={e => setCategoria(c.id, { nome: e.target.value })} placeholder={equipes ? 'Sub-12' : '5 km Feminino'} />
                            </div>
                            <div className="ev-field">
                                <label>Nascidos a partir de (ano)</label>
                                <input className="ev-input" type="number" value={c.anoNascimentoMin || ''} onChange={e => setCategoria(c.id, { anoNascimentoMin: Number(e.target.value) || null })} placeholder="Ex.: 2014" />
                            </div>
                            <div className="ev-field">
                                <label>Nascidos até (ano)</label>
                                <input className="ev-input" type="number" value={c.anoNascimentoMax || ''} onChange={e => setCategoria(c.id, { anoNascimentoMax: Number(e.target.value) || null })} placeholder="Ex.: 2016" />
                            </div>
                            <div className="ev-field">
                                <label>Sexo</label>
                                <select className="ev-select" value={c.sexo || 'misto'} onChange={e => setCategoria(c.id, { sexo: e.target.value as EventoCategoria['sexo'] })}>
                                    <option value="misto">Misto / livre</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="feminino">Feminino</option>
                                </select>
                            </div>
                            <div className="ev-field">
                                <label>Máx. de {equipes ? 'equipes' : 'participantes'}</label>
                                <input className="ev-input" type="number" min={0} value={c.maxInscricoes} onChange={e => setCategoria(c.id, { maxInscricoes: num(e.target.value) })} />
                                <span className="ev-hint">0 = sem limite</span>
                            </div>
                            <div className="ev-field">
                                <label>Valor da inscrição (R$)</label>
                                <input className="ev-input" type="number" min={0} step="0.01" value={c.valor} onChange={e => setCategoria(c.id, { valor: Math.max(0, Number(e.target.value) || 0) })} />
                                <span className="ev-hint">0 = gratuita</span>
                            </div>
                            {!equipes && (
                                <div className="ev-field">
                                    <label>Distância</label>
                                    <input className="ev-input" value={c.distancia || ''} onChange={e => setCategoria(c.id, { distancia: e.target.value })} placeholder="5 km" />
                                </div>
                            )}
                            {equipes && (
                                <>
                                    <div className="ev-field">
                                        <label>Mín. de atletas</label>
                                        <input className="ev-input" type="number" min={1} value={c.minAtletas} onChange={e => setCategoria(c.id, { minAtletas: num(e.target.value, 1) })} />
                                    </div>
                                    <div className="ev-field">
                                        <label>Máx. de atletas por equipe</label>
                                        <input className="ev-input" type="number" min={1} value={c.maxAtletas} onChange={e => setCategoria(c.id, { maxAtletas: num(e.target.value, 1) })} />
                                        <span className="ev-hint">Também define as linhas da súmula.</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {equipes && (
                            <>
                                <div className="ev-secao-titulo"><Clock size={12} /> Tempo de jogo — {formatarTempoDeJogo(c.tempo)}</div>
                                <div className="ev-grid c4">
                                    <div className="ev-field">
                                        <label>Nº de tempos / períodos</label>
                                        <input className="ev-input" type="number" min={1} max={6} value={c.tempo.periodos} onChange={e => setTempo(c.id, 'periodos', num(e.target.value, 1))} />
                                    </div>
                                    <div className="ev-field">
                                        <label>Duração de cada (min)</label>
                                        <input className="ev-input" type="number" min={1} value={c.tempo.duracaoMin} onChange={e => setTempo(c.id, 'duracaoMin', num(e.target.value, 1))} />
                                    </div>
                                    <div className="ev-field">
                                        <label>Intervalo (min)</label>
                                        <input className="ev-input" type="number" min={0} value={c.tempo.intervaloMin} onChange={e => setTempo(c.id, 'intervaloMin', num(e.target.value))} />
                                    </div>
                                    <div className="ev-field">
                                        <label>Prorrogação</label>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <input className="ev-input" type="number" min={0} max={4} value={c.tempo.prorrogacaoPeriodos} onChange={e => setTempo(c.id, 'prorrogacaoPeriodos', num(e.target.value))} title="Quantidade" />
                                            <span>x</span>
                                            <input className="ev-input" type="number" min={0} value={c.tempo.prorrogacaoMin} onChange={e => setTempo(c.id, 'prorrogacaoMin', num(e.target.value))} title="Minutos" />
                                        </div>
                                        <span className="ev-hint">0 x 0 = sem prorrogação</span>
                                    </div>
                                </div>
                                <div className="ev-secao-titulo"><Users size={12} /> Controles da súmula</div>
                                <div className="ev-grid c4">
                                    <div className="ev-field">
                                        <label>Faltas acumuladas por período</label>
                                        <input className="ev-input" type="number" min={0} max={10} value={c.faltasPorPeriodo} onChange={e => setCategoria(c.id, { faltasPorPeriodo: num(e.target.value) })} />
                                        <span className="ev-hint">0 = não exibir</span>
                                    </div>
                                    <div className="ev-field">
                                        <label>Pedidos de tempo por período</label>
                                        <input className="ev-input" type="number" min={0} max={3} value={c.temposPorPeriodo} onChange={e => setCategoria(c.id, { temposPorPeriodo: num(e.target.value) })} />
                                        <span className="ev-hint">0 = não exibir</span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="ev-field" style={{ marginTop: 10 }}>
                            <label>Observações da categoria</label>
                            <input className="ev-input" value={c.observacoes || ''} onChange={e => setCategoria(c.id, { observacoes: e.target.value })} />
                        </div>
                        <div className="ev-actions" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                            <button className="ev-btn mini neutro" onClick={() => duplicarCategoria(c)}><Copy size={12} /> Duplicar</button>
                            <button className="ev-btn mini perigo" onClick={() => removerCategoria(c)}><Trash2 size={12} /> Remover</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ev-actions" style={{ justifyContent: 'flex-end' }}>
                <button className="ev-btn primario grande" onClick={salvar}><Save size={18} /> Salvar evento</button>
            </div>
        </PageContainer>
    );
}
