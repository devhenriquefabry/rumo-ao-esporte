import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, Trophy, ListOrdered, User, Medal, FileText } from 'lucide-react';
import type { Evento, JogoEvento, VagaPublica } from '../../types/eventos';
import { buscarEvento, listarJogos, listarVagas, contarOcupadas } from '../../utils/eventos/eventosService';
import {
    formatarData, formatarMoeda, formatarTempoDeJogo, modalidadeLabel, situacaoInscricoes, inscricoesAbertas,
    faixaEtariaTexto, vagasRestantes, formatoLabel, criterioLabel,
} from '../../utils/eventos/eventosRules';
import { EventosShell, RegulamentoCard, Carregando } from '../../components/eventos/EventosUI';
import { TabelaClassificacao, TabelaJogos, ResultadosCorridaPublico } from '../../components/eventos/TabelasPublicas';
import { blocosDeClassificacao } from '../../utils/eventos/eventosRules';

type Aba = 'info' | 'jogos' | 'classificacao' | 'resultados';

export default function EventoPublico() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [evento, setEvento] = useState<Evento | null>(null);
    const [vagas, setVagas] = useState<VagaPublica[]>([]);
    const [jogos, setJogos] = useState<JogoEvento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [aba, setAba] = useState<Aba>('info');
    const [categoriaSel, setCategoriaSel] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const ev = await buscarEvento(id);
                setEvento(ev && ev.status !== 'rascunho' ? ev : null);
                if (ev) {
                    const [v, j] = await Promise.all([listarVagas(id), listarJogos(id)]);
                    setVagas(v);
                    setJogos(j);
                    setCategoriaSel(ev.categorias[0]?.id || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setCarregando(false);
            }
        })();
    }, [id]);

    const blocos = useMemo(() => {
        if (!evento || !categoriaSel) return [];
        const equipes = vagas.filter(v => v.tipo === 'equipe' && v.categoriaId === categoriaSel && v.status !== 'cancelada')
            .map(v => ({ id: v.id!, nome: v.nome, grupo: v.grupo }));
        return blocosDeClassificacao(evento, categoriaSel, equipes, jogos);
    }, [evento, vagas, jogos, categoriaSel]);

    if (carregando) return <EventosShell><Carregando /></EventosShell>;
    if (!evento) {
        return (
            <EventosShell voltar={{ to: '/eventos', label: 'Eventos' }}>
                <div className="ev-card ev-vazio"><Trophy size={40} /><p>Evento não encontrado.</p></div>
            </EventosShell>
        );
    }

    const individual = evento.tipo === 'individual';
    const abertas = inscricoesAbertas(evento);
    const temJogos = jogos.length > 0;
    const nomeCat = (cid: string) => evento.categorias.find(c => c.id === cid)?.nome || '-';

    return (
        <EventosShell voltar={{ to: '/eventos', label: 'Eventos' }} direita={<Link to="/eventos/minha-area"><User size={15} /> Minha área</Link>}>
            <div className="ev-hero">
                {evento.bannerUrl && <img src={evento.bannerUrl} alt={evento.nome} className="ev-hero-banner" />}
                <div className="ev-hero-body">
                    <h1>{evento.nome}</h1>
                    <div className="ev-chips">
                        <span className="ev-chip"><Trophy size={13} /> {modalidadeLabel(evento.modalidade)}</span>
                        <span className="ev-chip"><Calendar size={13} /> {formatarData(evento.dataInicio)}{evento.dataFim && evento.dataFim !== evento.dataInicio ? ` a ${formatarData(evento.dataFim)}` : ''}</span>
                        {evento.local && <span className="ev-chip"><MapPin size={13} /> {evento.local}</span>}
                        <span className="ev-chip" style={{ background: abertas ? '#00a63a' : undefined }}>{situacaoInscricoes(evento)}</span>
                    </div>
                    {abertas && (
                        <button className="ev-btn ouro grande" style={{ marginTop: 16 }} onClick={() => navigate(`/eventos/${evento.id}/inscrever`)}>
                            {individual ? 'Fazer minha inscrição' : 'Inscrever minha equipe'}
                        </button>
                    )}
                </div>
            </div>

            <div className="ev-tabs">
                <button className={`ev-tab ${aba === 'info' ? 'ativa' : ''}`} onClick={() => setAba('info')}><FileText size={14} /> Informações</button>
                {!individual && temJogos && <button className={`ev-tab ${aba === 'jogos' ? 'ativa' : ''}`} onClick={() => setAba('jogos')}><Calendar size={14} /> Jogos</button>}
                {!individual && temJogos && <button className={`ev-tab ${aba === 'classificacao' ? 'ativa' : ''}`} onClick={() => setAba('classificacao')}><ListOrdered size={14} /> Classificação</button>}
                {individual && <button className={`ev-tab ${aba === 'resultados' ? 'ativa' : ''}`} onClick={() => setAba('resultados')}><Medal size={14} /> Resultados</button>}
            </div>

            {aba === 'info' && (
                <>
                    {evento.descricao && (
                        <div className="ev-card">
                            <h3>Sobre o evento</h3>
                            <p style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{evento.descricao}</p>
                        </div>
                    )}

                    <RegulamentoCard regulamento={evento.regulamento} nomeEvento={evento.nome} historico={evento.regulamentoHistorico} />

                    <div className="ev-card">
                        <h3><Users size={18} /> Categorias</h3>
                        <div className="ev-table-wrap">
                            <table className="ev-table">
                                <thead>
                                    <tr>
                                        <th>Categoria</th><th>Faixa etária</th>
                                        {individual ? <th>Distância</th> : <th>Tempo de jogo</th>}
                                        {!individual && <th className="num">Atletas</th>}
                                        <th className="num">Vagas</th><th>Inscrição</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {evento.categorias.map(c => {
                                        const restantes = vagasRestantes(c, contarOcupadas(vagas, c.id));
                                        return (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 800 }}>{c.nome}</td>
                                                <td>{faixaEtariaTexto(c)}</td>
                                                {individual ? <td>{c.distancia || '-'}</td> : <td><Clock size={12} /> {formatarTempoDeJogo(c.tempo).toLowerCase()}</td>}
                                                {!individual && <td className="num">até {c.maxAtletas}</td>}
                                                <td className="num">{restantes === Infinity ? 'Livre' : restantes === 0 ? <span style={{ color: '#c62828', fontWeight: 800 }}>Esgotado</span> : `${restantes} de ${c.maxInscricoes}`}</td>
                                                <td>{c.valor > 0 ? formatarMoeda(c.valor) : <span className="ev-chip verde">Gratuita</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {!individual && (
                        <div className="ev-card">
                            <h3><Trophy size={18} /> Formato e critérios</h3>
                            <p><strong>Formato:</strong> {formatoLabel(evento.formato)}</p>
                            <p><strong>Pontuação:</strong> vitória {evento.pontuacao.vitoria} · empate {evento.pontuacao.empate} · derrota {evento.pontuacao.derrota}</p>
                            <p><strong>Critérios de desempate:</strong> {evento.criteriosDesempate.map((c, i) => `${i + 1}º ${criterioLabel(c)}`).join(' · ')}</p>
                            {evento.regrasEspecificas && <p style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{evento.regrasEspecificas}</p>}
                        </div>
                    )}

                    {individual && evento.orientacoesKit && (
                        <div className="ev-card">
                            <h3>Retirada do kit</h3>
                            <p style={{ whiteSpace: 'pre-line' }}>{evento.orientacoesKit}</p>
                        </div>
                    )}
                </>
            )}

            {(aba === 'jogos' || aba === 'classificacao') && (
                <div className="ev-card">
                    <div className="ev-field" style={{ maxWidth: 320, marginBottom: 14 }}>
                        <label>Categoria</label>
                        <select className="ev-select" value={categoriaSel} onChange={e => setCategoriaSel(e.target.value)}>
                            {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    {aba === 'jogos' && <TabelaJogos jogos={jogos.filter(j => j.categoriaId === categoriaSel)} nomeCategoria={nomeCat} />}
                    {aba === 'classificacao' && blocos.map(b => (
                        <div key={b.titulo} style={{ marginBottom: 16 }}>
                            <h3>{b.titulo}</h3>
                            <TabelaClassificacao linhas={b.linhas} />
                        </div>
                    ))}
                </div>
            )}

            {aba === 'resultados' && <div className="ev-card"><ResultadosCorridaPublico evento={evento} vagas={vagas} /></div>}
        </EventosShell>
    );
}
