import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { criterioLabel, blocosDeClassificacao } from '../../../utils/eventos/eventosRules';
import { pdfClassificacao } from '../../../utils/eventos/eventosPdf';
import { TabelaClassificacao, TabelaJogos } from '../../../components/eventos/TabelasPublicas';
import type { TabProps } from './tipos';

export default function TabClassificacao({ evento, equipes, jogos }: TabProps) {
    const [catId, setCatId] = useState(evento.categorias[0]?.id || '');
    const categoria = evento.categorias.find(c => c.id === catId);

    const blocos = useMemo(() => blocosDeClassificacao(
        evento, catId,
        equipes.filter(e => e.categoriaId === catId && e.status !== 'cancelada').map(e => ({ id: e.id!, nome: e.nome, grupo: e.grupo })),
        jogos,
    ), [evento, catId, equipes, jogos]);

    const eliminatorios = jogos.filter(j => j.categoriaId === catId && j.eliminatoria);

    return (
        <>
            <div className="ev-card">
                <div className="ev-grid c2" style={{ alignItems: 'end' }}>
                    <div className="ev-field">
                        <label>Categoria</label>
                        <select className="ev-select" value={catId} onChange={e => setCatId(e.target.value)}>
                            {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div className="ev-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="ev-btn secundario" onClick={() => pdfClassificacao(evento, categoria?.nome || '', blocos, 'baixar')}><Download size={16} /> PDF</button>
                        <button className="ev-btn secundario" onClick={() => pdfClassificacao(evento, categoria?.nome || '', blocos, 'imprimir')}><Printer size={16} /> Imprimir</button>
                    </div>
                </div>
                <p className="ev-muted ev-small" style={{ marginTop: 10 }}>
                    Pontuação: V {evento.pontuacao.vitoria} · E {evento.pontuacao.empate} · D {evento.pontuacao.derrota}.
                    Desempate: {evento.criteriosDesempate.map((c, i) => `${i + 1}º ${criterioLabel(c)}`).join(' · ')}.
                    Só jogos encerrados e não eliminatórios entram na tabela.
                </p>
            </div>

            {blocos.map(b => (
                <div key={b.titulo} className="ev-card">
                    <h3>{b.titulo}</h3>
                    {b.linhas.length ? <TabelaClassificacao linhas={b.linhas} /> : <p className="ev-muted">Sem equipes.</p>}
                </div>
            ))}

            {eliminatorios.length > 0 && (
                <div className="ev-card">
                    <h3>Fase eliminatória</h3>
                    <TabelaJogos jogos={eliminatorios} />
                </div>
            )}
        </>
    );
}
