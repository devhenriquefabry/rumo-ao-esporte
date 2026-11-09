import { useMemo, useState } from 'react';
import { Search, Hash, Save, Calculator, Download, Printer, Ban, RotateCcw, Trash2, FileSpreadsheet, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDialog } from '../../../context/CustomDialogContext';
import { useLoading } from '../../../components/LoadingService';
import type { InscricaoIndividual } from '../../../types/eventos';
import { atualizarInscricao, excluirInscricao } from '../../../utils/eventos/eventosService';
import { calcularResultadosCorrida, formatarData, formatarDataHora, normalizarTempo } from '../../../utils/eventos/eventosRules';
import { pdfComprovanteInscricao, pdfListaInscritosCorrida, pdfResultadosCorrida } from '../../../utils/eventos/eventosPdf';
import { StatusBadge, DocumentoBadge, Modal } from '../../../components/eventos/EventosUI';
import type { TabProps } from './tipos';

export default function TabCorrida({ evento, inscricoes, recarregar, adminNome, canEdit, modo }: TabProps & { modo: 'inscritos' | 'resultados' }) {
    const { showAlert, showConfirm } = useDialog();
    const { setLoading } = useLoading();
    const [busca, setBusca] = useState('');
    const [filtroCat, setFiltroCat] = useState('');
    const [peitos, setPeitos] = useState<Record<string, string>>({});
    const [tempos, setTempos] = useState<Record<string, string>>({});
    const [numeroInicial, setNumeroInicial] = useState(1);
    const [detalhe, setDetalhe] = useState<InscricaoIndividual | null>(null);

    const nomeCat = (id: string) => evento.categorias.find(c => c.id === id)?.nome || '-';
    const filtradas = useMemo(() => inscricoes.filter(i =>
        (!filtroCat || i.categoriaId === filtroCat) &&
        (!busca || `${i.participante.nome} ${i.numeroPeito || ''}`.toLowerCase().includes(busca.toLowerCase()))
    ), [inscricoes, filtroCat, busca]);

    const confirmadas = inscricoes.filter(i => i.status !== 'cancelada' && (i.pagamento.status === 'confirmado' || i.pagamento.status === 'isento'));
    const log = (i: InscricaoIndividual, acao: string) => [...(i.alteracoes || []), { em: new Date().toISOString(), por: adminNome, acao }];

    // ---------- Números de peito ----------
    const atribuirAutomatico = () => {
        const usados = new Set(inscricoes.map(i => i.numeroPeito).filter(Boolean) as number[]);
        const semNumero = confirmadas.filter(i => !i.numeroPeito)
            .sort((a, b) => evento.categorias.findIndex(c => c.id === a.categoriaId) - evento.categorias.findIndex(c => c.id === b.categoriaId) || a.participante.nome.localeCompare(b.participante.nome, 'pt-BR'));
        if (!semNumero.length) { showAlert('Todos os inscritos confirmados já têm número de peito.', 'info'); return; }
        showConfirm(`Atribuir números a ${semNumero.length} inscrito(s) confirmado(s), a partir do ${numeroInicial}, em ordem de categoria e nome?`, async () => {
            setLoading(true, 'Atribuindo números...');
            try {
                let n = numeroInicial;
                for (const i of semNumero) {
                    while (usados.has(n)) n++;
                    usados.add(n);
                    await atualizarInscricao(i.id!, { numeroPeito: n, alteracoes: log(i, `Atribuiu número de peito ${n}`) });
                }
                await recarregar();
                showAlert('Números atribuídos.', 'success');
            } catch { showAlert('Erro ao atribuir números.', 'error'); }
            finally { setLoading(false); }
        }, 'info');
    };

    const salvarPeitos = async () => {
        const alterados = Object.entries(peitos).filter(([id, v]) => String(inscricoes.find(i => i.id === id)?.numeroPeito || '') !== v.trim());
        const valores = alterados.map(([, v]) => v.trim()).filter(Boolean);
        if (new Set(valores).size !== valores.length) { showAlert('Há números de peito repetidos.', 'warning'); return; }
        const conflito = alterados.find(([id, v]) => v.trim() && inscricoes.some(i => i.id !== id && String(i.numeroPeito || '') === v.trim() && !(i.id! in peitos)));
        if (conflito) { showAlert(`O número ${conflito[1]} já pertence a outro inscrito.`, 'warning'); return; }
        setLoading(true, 'Salvando...');
        try {
            for (const [id, v] of alterados) {
                const i = inscricoes.find(x => x.id === id)!;
                await atualizarInscricao(id, { numeroPeito: v.trim() ? Number(v) : null, alteracoes: log(i, `Alterou número de peito para ${v || '(vazio)'}`) });
            }
            setPeitos({});
            await recarregar();
            showAlert('Números salvos.', 'success');
        } catch { showAlert('Erro ao salvar.', 'error'); }
        finally { setLoading(false); }
    };

    // ---------- Tempos e classificação ----------
    const salvarTempos = async (recalcular = true) => {
        const invalidos = Object.entries(tempos).filter(([, v]) => v.trim() && !normalizarTempo(v));
        if (invalidos.length) { showAlert('Use o formato hh:mm:ss (ex.: 00:25:41).', 'warning'); return; }
        setLoading(true, 'Salvando tempos e calculando classificação...');
        try {
            // Aplica os tempos digitados sobre a lista atual
            const atualizadas = inscricoes.map(i => {
                if (!(i.id! in tempos)) return i;
                const t = tempos[i.id!].trim();
                return { ...i, resultado: t ? { tempo: normalizarTempo(t)! } : null };
            });
            const posicoes = recalcular ? calcularResultadosCorrida(atualizadas, evento.categorias) : new Map();
            for (const i of atualizadas) {
                const pos = posicoes.get(i.id!);
                const novo = i.resultado ? { tempo: i.resultado.tempo, posicaoGeral: pos?.posicaoGeral, posicaoCategoria: pos?.posicaoCategoria } : null;
                const antigo = inscricoes.find(x => x.id === i.id)!.resultado || null;
                if (JSON.stringify(novo) !== JSON.stringify(antigo)) {
                    await atualizarInscricao(i.id!, { resultado: novo });
                }
            }
            setTempos({});
            await recarregar();
            showAlert('Resultados atualizados.', 'success');
        } catch (e) { console.error(e); showAlert('Erro ao salvar os resultados.', 'error'); }
        finally { setLoading(false); }
    };

    const alternarCancelamento = (i: InscricaoIndividual) => {
        const cancelada = i.status === 'cancelada';
        showConfirm(cancelada ? 'Reativar inscrição?' : 'Cancelar esta inscrição?', async () => {
            const status = cancelada ? ((i.pagamento.status === 'confirmado' || i.pagamento.status === 'isento') ? 'finalizada' : 'aguardando_pagamento') : 'cancelada';
            await atualizarInscricao(i.id!, { status, alteracoes: log(i, cancelada ? 'Reativou a inscrição' : 'Cancelou a inscrição') });
            await recarregar();
        }, 'warning');
    };

    const excluir = (i: InscricaoIndividual) => showConfirm(`Excluir definitivamente a inscrição de ${i.participante.nome}?`, async () => {
        await excluirInscricao(i.id!);
        setDetalhe(null);
        await recarregar();
    }, 'error');

    const exportar = () => {
        const ws = XLSX.utils.json_to_sheet(filtradas.map(i => ({
            Peito: i.numeroPeito || '', Nome: i.participante.nome, Categoria: nomeCat(i.categoriaId), Nascimento: formatarData(i.participante.dataNascimento),
            Sexo: i.participante.sexo, CPF: i.participante.cpf, Telefone: i.participante.telefone, 'E-mail': i.participante.email,
            Camiseta: i.participante.camiseta || '', Cidade: i.participante.cidade || '', Pagamento: i.pagamento.status, Situação: i.status,
            Tempo: i.resultado?.tempo || '', 'Pos. categoria': i.resultado?.posicaoCategoria || '', 'Pos. geral': i.resultado?.posicaoGeral || '',
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inscritos');
        XLSX.writeFile(wb, `inscritos-${evento.nome.replace(/[^\w]+/g, '_')}.xlsx`);
    };

    const ordenadas = modo === 'resultados'
        ? [...filtradas].sort((a, b) => (a.resultado?.posicaoGeral || 9999) - (b.resultado?.posicaoGeral || 9999) || (a.numeroPeito || 9999) - (b.numeroPeito || 9999))
        : filtradas;

    return (
        <>
            <div className="ev-card">
                <div className="ev-grid c3" style={{ alignItems: 'end' }}>
                    <div className="ev-field">
                        <label>Buscar</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#63708a' }} />
                            <input className="ev-input" style={{ paddingLeft: 34 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou nº de peito" />
                        </div>
                    </div>
                    <div className="ev-field">
                        <label>Categoria</label>
                        <select className="ev-select" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
                            <option value="">Todas</option>
                            {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}{c.distancia ? ` · ${c.distancia}` : ''}</option>)}
                        </select>
                    </div>
                    {modo === 'inscritos' && canEdit && (
                        <div className="ev-field">
                            <label>Numeração a partir de</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input className="ev-input" type="number" min={1} value={numeroInicial} onChange={e => setNumeroInicial(Math.max(1, Number(e.target.value) || 1))} />
                                <button className="ev-btn azul" onClick={atribuirAutomatico}><Hash size={14} /> Atribuir</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="ev-actions" style={{ marginTop: 12 }}>
                    {modo === 'inscritos' ? <>
                        {canEdit && Object.keys(peitos).length > 0 && <button className="ev-btn primario" onClick={salvarPeitos}><Save size={16} /> Salvar números</button>}
                        <button className="ev-btn secundario" onClick={() => pdfListaInscritosCorrida(evento, inscricoes, 'baixar')}><Download size={16} /> Lista de inscritos (PDF)</button>
                        <button className="ev-btn secundario" onClick={() => pdfListaInscritosCorrida(evento, inscricoes, 'imprimir')}><Printer size={16} /> Imprimir lista</button>
                    </> : <>
                        {canEdit && <button className="ev-btn primario" onClick={() => salvarTempos(true)}><Calculator size={16} /> Salvar tempos e calcular classificação</button>}
                        <button className="ev-btn secundario" onClick={() => pdfResultadosCorrida(evento, inscricoes, 'baixar')}><Download size={16} /> Resultados (PDF)</button>
                        <button className="ev-btn secundario" onClick={() => pdfResultadosCorrida(evento, inscricoes, 'imprimir')}><Printer size={16} /> Imprimir resultados</button>
                    </>}
                    <button className="ev-btn neutro" onClick={exportar}><FileSpreadsheet size={16} /> Planilha</button>
                </div>
            </div>

            <div className="ev-card">
                {ordenadas.length === 0 ? <p className="ev-muted">Nenhuma inscrição.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead>
                                <tr>
                                    <th>Peito</th><th>Nome</th><th>Categoria</th>
                                    {modo === 'inscritos' ? <><th>Documento</th><th>Situação</th></> : <><th>Tempo (hh:mm:ss)</th><th className="num">Cat.</th><th className="num">Geral</th></>}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordenadas.map(i => (
                                    <tr key={i.id} style={{ opacity: i.status === 'cancelada' ? .5 : 1 }}>
                                        <td style={{ width: 90 }}>
                                            {modo === 'inscritos' && canEdit
                                                ? <input className="ev-input" style={{ padding: '6px 8px', width: 70 }} inputMode="numeric" value={peitos[i.id!] ?? String(i.numeroPeito || '')} onChange={e => setPeitos({ ...peitos, [i.id!]: e.target.value.replace(/\D/g, '') })} />
                                                : <strong>{i.numeroPeito || '-'}</strong>}
                                        </td>
                                        <td style={{ fontWeight: 800, textTransform: 'uppercase' }}>{i.participante.nome}<div className="ev-muted ev-small">{formatarData(i.participante.dataNascimento)} · {i.participante.sexo}</div></td>
                                        <td>{nomeCat(i.categoriaId)}</td>
                                        {modo === 'inscritos' ? <>
                                            <td><DocumentoBadge status={i.documentoStatus} temArquivo={!!i.documentoUrl} /></td>
                                            <td><StatusBadge status={i.status} /></td>
                                        </> : <>
                                            <td style={{ width: 140 }}>
                                                <input className="ev-input" style={{ padding: '6px 8px', fontFamily: 'monospace' }} disabled={!canEdit || i.status === 'cancelada'} placeholder="00:00:00"
                                                    value={tempos[i.id!] ?? (i.resultado?.tempo || '')} onChange={e => setTempos({ ...tempos, [i.id!]: e.target.value })} />
                                            </td>
                                            <td className="num">{i.resultado?.posicaoCategoria ? `${i.resultado.posicaoCategoria}º` : '-'}</td>
                                            <td className="num">{i.resultado?.posicaoGeral ? `${i.resultado.posicaoGeral}º` : '-'}</td>
                                        </>}
                                        <td><button className="ev-btn mini azul" onClick={() => setDetalhe(i)}><Eye size={12} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal aberto={!!detalhe} onFechar={() => setDetalhe(null)} titulo={detalhe?.participante.nome || ''}>
                {detalhe && (
                    <>
                        <p><strong>Categoria:</strong> {nomeCat(detalhe.categoriaId)} · <strong>Peito:</strong> {detalhe.numeroPeito || '-'}</p>
                        <p><strong>Nascimento:</strong> {formatarData(detalhe.participante.dataNascimento)} · <strong>Sexo:</strong> {detalhe.participante.sexo} · <strong>CPF:</strong> {detalhe.participante.cpf}</p>
                        <p><strong>Contato:</strong> {detalhe.participante.telefone} · {detalhe.participante.email}</p>
                        <p><strong>Camiseta:</strong> {detalhe.participante.camiseta || '-'} · <strong>Cidade:</strong> {detalhe.participante.cidade || '-'}</p>
                        <p><strong>Emergência:</strong> {detalhe.participante.contatoEmergencia || '-'}</p>
                        <p><strong>Inscrito em:</strong> {formatarDataHora(detalhe.createdAt)}</p>
                        {detalhe.documentoUrl && <p><a href={detalhe.documentoUrl} target="_blank" rel="noreferrer">Abrir documento</a></p>}
                        <div className="ev-actions" style={{ marginTop: 12 }}>
                            <button className="ev-btn mini secundario" onClick={() => pdfComprovanteInscricao(evento, evento.categorias.find(c => c.id === detalhe.categoriaId), detalhe, 'baixar')}><Download size={12} /> Comprovante</button>
                            {canEdit && <button className="ev-btn mini perigo" onClick={() => alternarCancelamento(detalhe)}>{detalhe.status === 'cancelada' ? <><RotateCcw size={12} /> Reativar</> : <><Ban size={12} /> Cancelar</>}</button>}
                            {canEdit && <button className="ev-btn mini perigo-cheio" onClick={() => excluir(detalhe)}><Trash2 size={12} /> Excluir</button>}
                        </div>
                        {(detalhe.alteracoes || []).length > 0 && (
                            <>
                                <h3 style={{ marginTop: 14 }}>Histórico</h3>
                                <ul className="ev-small" style={{ paddingLeft: 18 }}>
                                    {[...(detalhe.alteracoes || [])].reverse().map((a, k) => <li key={k}>{formatarDataHora(a.em)} · {a.por} · {a.acao}</li>)}
                                </ul>
                            </>
                        )}
                    </>
                )}
            </Modal>
        </>
    );
}
