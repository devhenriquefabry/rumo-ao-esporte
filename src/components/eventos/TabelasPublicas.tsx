import { useMemo } from 'react';
import type { Evento, JogoEvento, VagaPublica } from '../../types/eventos';
import { calcularClassificacao, formatarData, tempoParaSegundos } from '../../utils/eventos/eventosRules';

export function TabelaClassificacao({ linhas }: { linhas: ReturnType<typeof calcularClassificacao> }) {
    return (
        <div className="ev-table-wrap">
            <table className="ev-table">
                <thead>
                    <tr><th>#</th><th>Equipe</th><th className="num">P</th><th className="num">J</th><th className="num">V</th><th className="num">E</th><th className="num">D</th><th className="num">GP</th><th className="num">GC</th><th className="num">SG</th></tr>
                </thead>
                <tbody>
                    {linhas.map((l, i) => (
                        <tr key={l.equipeId}>
                            <td><strong>{i + 1}º</strong></td>
                            <td style={{ fontWeight: 700, textTransform: 'uppercase' }}>{l.nome}</td>
                            <td className="num"><strong>{l.pontos}</strong></td>
                            <td className="num">{l.jogos}</td><td className="num">{l.vitorias}</td><td className="num">{l.empates}</td><td className="num">{l.derrotas}</td>
                            <td className="num">{l.golsPro}</td><td className="num">{l.golsContra}</td><td className="num">{l.saldo}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function TabelaJogos({ jogos, mostrarCategoria, nomeCategoria }: { jogos: JogoEvento[]; mostrarCategoria?: boolean; nomeCategoria?: (id: string) => string }) {
    if (!jogos.length) return <p className="ev-muted">Nenhum jogo cadastrado.</p>;
    return (
        <div className="ev-table-wrap">
            <table className="ev-table">
                <thead><tr><th>Jogo</th>{mostrarCategoria && <th>Categoria</th>}<th>Fase</th><th>Data</th><th>Local</th><th style={{ textAlign: 'right' }}>Equipe A</th><th className="num">Placar</th><th>Equipe B</th></tr></thead>
                <tbody>
                    {jogos.map(j => {
                        const temPlacar = j.placarA != null && j.placarB != null && j.status !== 'agendado';
                        return (
                            <tr key={j.id}>
                                <td><strong>{String(j.numero).padStart(2, '0')}</strong></td>
                                {mostrarCategoria && <td>{nomeCategoria?.(j.categoriaId) || '-'}</td>}
                                <td>{j.fase}{j.grupo ? ` · Gr. ${j.grupo}` : ''}</td>
                                <td>{formatarData(j.data)}{j.horario ? ` ${j.horario}` : ''}</td>
                                <td>{j.local || '-'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, textTransform: 'uppercase' }}>{j.equipeANome}</td>
                                <td className="num" style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                                    {temPlacar ? `${j.placarA} x ${j.placarB}` : 'x'}
                                    {j.penaltisA != null && j.penaltisB != null ? <div className="ev-muted ev-small">pên. {j.penaltisA}x{j.penaltisB}</div> : null}
                                    {j.status === 'em_andamento' && <div className="ev-small" style={{ color: '#c62828' }}>AO VIVO</div>}
                                </td>
                                <td style={{ fontWeight: 700, textTransform: 'uppercase' }}>{j.equipeBNome}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function ResultadosCorridaPublico({ evento, vagas }: { evento: Evento; vagas: VagaPublica[] }) {
    const porCategoria = useMemo(() => evento.categorias.map(cat => ({
        cat,
        linhas: vagas
            .filter(v => v.categoriaId === cat.id && tempoParaSegundos(v.resultado?.tempo) !== null)
            .sort((a, b) => (a.resultado?.posicaoCategoria || 9999) - (b.resultado?.posicaoCategoria || 9999)),
    })).filter(b => b.linhas.length), [evento, vagas]);

    if (!porCategoria.length) return <p className="ev-muted">Os resultados serão publicados após a prova.</p>;
    return (
        <>
            {porCategoria.map(({ cat, linhas }) => (
                <div key={cat.id} style={{ marginBottom: 16 }}>
                    <h3>{cat.nome}{cat.distancia ? ` · ${cat.distancia}` : ''}</h3>
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>Cat.</th><th>Geral</th><th>Peito</th><th>Nome</th><th>Tempo</th></tr></thead>
                            <tbody>
                                {linhas.map(v => (
                                    <tr key={v.id}>
                                        <td><strong>{v.resultado?.posicaoCategoria}º</strong></td>
                                        <td>{v.resultado?.posicaoGeral}º</td>
                                        <td>{v.numeroPeito || '-'}</td>
                                        <td style={{ fontWeight: 700, textTransform: 'uppercase' }}>{v.nome}</td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v.resultado?.tempo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </>
    );
}
