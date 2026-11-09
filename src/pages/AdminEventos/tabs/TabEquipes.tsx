import { useMemo, useState } from 'react';
import { Search, Eye, Download, Printer, Unlock, Lock, Ban, Trash2, UserPlus, Pencil, RotateCcw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDialog } from '../../../context/CustomDialogContext';
import type { AtletaEvento, EquipeEvento, RegistroAlteracao } from '../../../types/eventos';
import { atualizarEquipe, excluirEquipe } from '../../../utils/eventos/eventosService';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../utils/eventos/eventosRules';
import { pdfListaOficial } from '../../../utils/eventos/eventosPdf';
import { Modal, StatusBadge, DocumentoBadge, Alerta } from '../../../components/eventos/EventosUI';
import AtletaFormModal from '../../../components/eventos/AtletaFormModal';
import type { TabProps } from './tipos';

export default function TabEquipes({ evento, equipes, recarregar, adminNome, canEdit }: TabProps) {
    const { showAlert, showConfirm } = useDialog();
    const [busca, setBusca] = useState('');
    const [filtroCat, setFiltroCat] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
    const [motivo, setMotivo] = useState('');
    const [modalAtleta, setModalAtleta] = useState<{ aberto: boolean; atleta?: AtletaEvento | null }>({ aberto: false });

    const nomeCat = (id: string) => evento.categorias.find(c => c.id === id)?.nome || '-';

    const filtradas = useMemo(() => equipes.filter(e =>
        (!filtroCat || e.categoriaId === filtroCat) &&
        (!filtroStatus || e.status === filtroStatus) &&
        (!busca || `${e.nome} ${e.responsavel.nome}`.toLowerCase().includes(busca.toLowerCase()))
    ), [equipes, filtroCat, filtroStatus, busca]);

    const selecionada = equipes.find(e => e.id === selecionadaId) || null;
    const categoriaSel = evento.categorias.find(c => c.id === selecionada?.categoriaId);

    const registrar = (equipe: EquipeEvento, acao: string, mot?: string): RegistroAlteracao[] =>
        [...(equipe.alteracoes || []), { em: new Date().toISOString(), por: adminNome, acao, motivo: mot || '' }];

    const exigirMotivo = () => {
        if (motivo.trim().length < 5) { showAlert('Descreva o motivo da correção (mínimo 5 caracteres). Ele fica registrado no histórico.', 'warning'); return false; }
        return true;
    };

    const executar = async (fn: () => Promise<void>, ok: string) => {
        try { await fn(); await recarregar(); showAlert(ok, 'success'); }
        catch (e) { console.error(e); showAlert('Não foi possível salvar a alteração.', 'error'); }
    };

    // ----- Atletas (admin) -----
    const salvarAtletaAdmin = async (atleta: AtletaEvento) => {
        if (!selecionada) return;
        const finalizada = selecionada.status === 'finalizada';
        if (finalizada && !exigirMotivo()) throw new Error('Informe o motivo da correção.');
        const existe = selecionada.atletas.some(a => a.id === atleta.id);
        const atletas = existe ? selecionada.atletas.map(a => a.id === atleta.id ? atleta : a) : [...selecionada.atletas, atleta];
        const dados: Partial<EquipeEvento> = {
            atletas,
            alteracoes: registrar(selecionada, `${existe ? 'Editou' : 'Incluiu'} atleta ${atleta.nome}${finalizada ? ' (correção excepcional na lista oficial)' : ''}`, motivo.trim()),
        };
        if (finalizada && selecionada.listaOficial) dados.listaOficial = { ...selecionada.listaOficial, atletas };
        await atualizarEquipe(selecionada.id!, dados);
        await recarregar();
        setMotivo('');
    };

    const removerAtletaAdmin = (atleta: AtletaEvento) => {
        if (!selecionada) return;
        const finalizada = selecionada.status === 'finalizada';
        if (finalizada && !exigirMotivo()) return;
        showConfirm(`Remover ${atleta.nome}${finalizada ? ' da lista oficial' : ''}?`, () => executar(async () => {
            const atletas = selecionada.atletas.filter(a => a.id !== atleta.id);
            const dados: Partial<EquipeEvento> = { atletas, alteracoes: registrar(selecionada, `Removeu atleta ${atleta.nome}`, motivo.trim()) };
            if (finalizada && selecionada.listaOficial) dados.listaOficial = { ...selecionada.listaOficial, atletas };
            await atualizarEquipe(selecionada.id!, dados);
            setMotivo('');
        }, 'Atleta removido.'), 'warning');
    };

    // ----- Ações da equipe -----
    const reabrir = () => {
        if (!selecionada || !exigirMotivo()) return;
        showConfirm('Reabrir a relação? O responsável poderá editar os atletas e precisará finalizar novamente. A lista oficial atual deixa de valer para as súmulas.', () => executar(async () => {
            await atualizarEquipe(selecionada.id!, {
                status: 'liberada', listaOficial: null, finalizadaEm: null,
                alteracoes: registrar(selecionada, 'Reabriu a relação de atletas', motivo.trim()),
            });
            setMotivo('');
        }, 'Relação reaberta.'), 'warning');
    };

    const finalizarPeloAdmin = () => {
        if (!selecionada) return;
        if (!selecionada.atletas.length) { showAlert('A equipe não tem atletas.', 'warning'); return; }
        showConfirm('Finalizar a relação em nome do responsável e gerar a lista oficial?', () => executar(async () => {
            const agora = new Date().toISOString();
            await atualizarEquipe(selecionada.id!, {
                status: 'finalizada', finalizadaEm: agora,
                listaOficial: { geradaEm: agora, geradaPor: `${adminNome} (organização)`, atletas: [...selecionada.atletas], regulamentoVersao: evento.regulamento?.versao },
                alteracoes: registrar(selecionada, 'Finalizou a relação pela organização', motivo.trim()),
            });
        }, 'Relação finalizada.'), 'info');
    };

    const cancelar = () => {
        if (!selecionada) return;
        const cancelada = selecionada.status === 'cancelada';
        showConfirm(cancelada ? 'Reativar esta inscrição?' : 'Cancelar esta inscrição? A vaga será liberada.', () => executar(async () => {
            const novoStatus = cancelada
                ? (selecionada.listaOficial ? 'finalizada' : (selecionada.pagamento.status === 'confirmado' || selecionada.pagamento.status === 'isento') ? 'liberada' : 'aguardando_pagamento')
                : 'cancelada';
            await atualizarEquipe(selecionada.id!, { status: novoStatus, alteracoes: registrar(selecionada, cancelada ? 'Reativou a inscrição' : 'Cancelou a inscrição', motivo.trim()) });
        }, cancelada ? 'Inscrição reativada.' : 'Inscrição cancelada.'), 'warning');
    };

    const excluir = () => {
        if (!selecionada) return;
        showConfirm(`Excluir definitivamente a equipe ${selecionada.nome}? Esta ação não pode ser desfeita.`, () => executar(async () => {
            await excluirEquipe(selecionada.id!);
            setSelecionadaId(null);
        }, 'Equipe excluída.'), 'error');
    };

    const salvarGrupo = (equipe: EquipeEvento, grupo: string) => executar(async () => {
        await atualizarEquipe(equipe.id!, { grupo: grupo.trim().toUpperCase() });
    }, 'Grupo atualizado.');

    const salvarCampo = (dados: Partial<EquipeEvento>, acao: string) => {
        if (!selecionada) return;
        executar(async () => { await atualizarEquipe(selecionada.id!, { ...dados, alteracoes: registrar(selecionada, acao) }); }, 'Dados atualizados.');
    };

    const exportarPlanilha = () => {
        const linhas = filtradas.flatMap(e => {
            const base = { Equipe: e.nome, Categoria: nomeCat(e.categoriaId), Grupo: e.grupo || '', Responsável: e.responsavel.nome, Telefone: e.responsavel.telefone, 'E-mail': e.responsavel.email, Situação: e.status, Pagamento: e.pagamento.status };
            const atletas = e.listaOficial?.atletas || e.atletas;
            return atletas.length ? atletas.map(a => ({ ...base, Atleta: a.nome, Nascimento: formatarData(a.dataNascimento), Camisa: a.camisa || '', Documento: a.documentoStatus })) : [base];
        });
        const ws = XLSX.utils.json_to_sheet(linhas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Equipes');
        XLSX.writeFile(wb, `equipes-${evento.nome.replace(/[^\w]+/g, '_')}.xlsx`);
    };

    return (
        <>
            <div className="ev-card">
                <div className="ev-grid c4" style={{ alignItems: 'end' }}>
                    <div className="ev-field ev-span2">
                        <label>Buscar</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#63708a' }} />
                            <input className="ev-input" style={{ paddingLeft: 34 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Equipe ou responsável" />
                        </div>
                    </div>
                    <div className="ev-field">
                        <label>Categoria</label>
                        <select className="ev-select" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
                            <option value="">Todas</option>
                            {evento.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div className="ev-field">
                        <label>Situação</label>
                        <select className="ev-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                            <option value="">Todas</option>
                            <option value="aguardando_pagamento">Aguardando pagamento</option>
                            <option value="pagamento_em_analise">Pagamento em análise</option>
                            <option value="liberada">Cadastrando atletas</option>
                            <option value="finalizada">Finalizadas</option>
                            <option value="cancelada">Canceladas</option>
                        </select>
                    </div>
                </div>
                <div className="ev-actions" style={{ marginTop: 12 }}>
                    <button className="ev-btn neutro mini" onClick={exportarPlanilha}><FileSpreadsheet size={13} /> Exportar planilha</button>
                </div>
            </div>

            <div className="ev-card">
                {filtradas.length === 0 ? <p className="ev-muted">Nenhuma equipe encontrada.</p> : (
                    <div className="ev-table-wrap">
                        <table className="ev-table">
                            <thead><tr><th>Equipe</th><th>Categoria</th><th>Grupo</th><th>Responsável</th><th className="num">Atletas</th><th>Situação</th><th></th></tr></thead>
                            <tbody>
                                {filtradas.map(e => {
                                    const max = evento.categorias.find(c => c.id === e.categoriaId)?.maxAtletas || 0;
                                    return (
                                        <tr key={e.id}>
                                            <td style={{ fontWeight: 800, textTransform: 'uppercase' }}>{e.nome}</td>
                                            <td>{nomeCat(e.categoriaId)}</td>
                                            <td style={{ width: 80 }}>
                                                <input className="ev-input" style={{ padding: '6px 8px', width: 60 }} defaultValue={e.grupo || ''} disabled={!canEdit}
                                                    onBlur={ev => { if ((ev.target.value || '').trim().toUpperCase() !== (e.grupo || '')) salvarGrupo(e, ev.target.value); }} placeholder="-" />
                                            </td>
                                            <td>{e.responsavel.nome}<div className="ev-muted ev-small">{e.responsavel.telefone}</div></td>
                                            <td className="num">{(e.listaOficial?.atletas || e.atletas).length}/{max}</td>
                                            <td><StatusBadge status={e.status} /></td>
                                            <td><button className="ev-btn mini azul" onClick={() => { setSelecionadaId(e.id!); setMotivo(''); }}><Eye size={13} /> Abrir</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal aberto={!!selecionada} onFechar={() => setSelecionadaId(null)} largo titulo={selecionada ? selecionada.nome : ''}>
                {selecionada && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                            <div>
                                <p><strong>Categoria:</strong> {categoriaSel?.nome} · <strong>Grupo:</strong> {selecionada.grupo || '-'}</p>
                                <p><strong>Responsável:</strong> {selecionada.responsavel.nome} · {selecionada.responsavel.telefone} · {selecionada.responsavel.email} · CPF {selecionada.responsavel.cpf}</p>
                                <p><strong>Pagamento:</strong> {selecionada.pagamento.status === 'isento' ? 'Isento' : `${formatarMoeda(selecionada.pagamento.valor)} — ${selecionada.pagamento.status}`}</p>
                                <p><strong>Inscrita em:</strong> {formatarDataHora(selecionada.createdAt)}</p>
                            </div>
                            <StatusBadge status={selecionada.status} />
                        </div>

                        {canEdit && (
                            <div className="ev-grid c2" style={{ marginBottom: 12 }}>
                                <div className="ev-field">
                                    <label>Nome da equipe</label>
                                    <input className="ev-input" defaultValue={selecionada.nome} onBlur={e => e.target.value.trim() && e.target.value.trim() !== selecionada.nome && salvarCampo({ nome: e.target.value.trim() }, `Renomeou a equipe para ${e.target.value.trim()}`)} />
                                </div>
                                <div className="ev-field">
                                    <label>Técnico (aparece na súmula)</label>
                                    <input className="ev-input" defaultValue={selecionada.tecnico || ''} onBlur={e => e.target.value.trim() !== (selecionada.tecnico || '') && salvarCampo({ tecnico: e.target.value.trim() }, 'Alterou o técnico')} />
                                </div>
                            </div>
                        )}

                        {canEdit && (
                            <div className="ev-field" style={{ marginBottom: 12 }}>
                                <label>Motivo da correção / ação (obrigatório para alterar relação finalizada ou reabrir)</label>
                                <input className="ev-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: atleta com documento divergente substituído a pedido do responsável" />
                            </div>
                        )}

                        <div className="ev-actions" style={{ marginBottom: 14 }}>
                            {selecionada.listaOficial && <>
                                <button className="ev-btn mini azul" onClick={() => pdfListaOficial(evento, categoriaSel, selecionada, 'visualizar')}><Eye size={13} /> Lista oficial</button>
                                <button className="ev-btn mini secundario" onClick={() => pdfListaOficial(evento, categoriaSel, selecionada, 'baixar')}><Download size={13} /> Baixar</button>
                                <button className="ev-btn mini secundario" onClick={() => pdfListaOficial(evento, categoriaSel, selecionada, 'imprimir')}><Printer size={13} /> Imprimir</button>
                            </>}
                            {canEdit && selecionada.status === 'finalizada' && <button className="ev-btn mini ouro" onClick={reabrir}><Unlock size={13} /> Reabrir relação</button>}
                            {canEdit && selecionada.status === 'liberada' && <button className="ev-btn mini primario" onClick={finalizarPeloAdmin}><Lock size={13} /> Finalizar pela organização</button>}
                            {canEdit && <button className="ev-btn mini perigo" onClick={cancelar}>{selecionada.status === 'cancelada' ? <><RotateCcw size={13} /> Reativar</> : <><Ban size={13} /> Cancelar inscrição</>}</button>}
                            {canEdit && <button className="ev-btn mini perigo-cheio" onClick={excluir}><Trash2 size={13} /> Excluir</button>}
                        </div>

                        {selecionada.status === 'finalizada' && <Alerta tipo="aviso">Relação finalizada. Alterações aqui são <strong>correções excepcionais</strong>: exigem motivo e ficam registradas.</Alerta>}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                            <h3 style={{ margin: 0 }}>Atletas ({selecionada.atletas.length}/{categoriaSel?.maxAtletas})</h3>
                            {canEdit && <button className="ev-btn mini primario" onClick={() => setModalAtleta({ aberto: true, atleta: null })}><UserPlus size={13} /> Incluir</button>}
                        </div>
                        <div className="ev-table-wrap">
                            <table className="ev-table">
                                <thead><tr><th>Nº</th><th>Nome</th><th>Nascimento</th><th>Documento</th><th></th></tr></thead>
                                <tbody>
                                    {selecionada.atletas.map(a => (
                                        <tr key={a.id}>
                                            <td><strong>{a.camisa || '-'}</strong></td>
                                            <td style={{ fontWeight: 700, textTransform: 'uppercase' }}>{a.nome}</td>
                                            <td>{formatarData(a.dataNascimento)}</td>
                                            <td>{a.documentoUrl ? <a href={a.documentoUrl} target="_blank" rel="noreferrer"><DocumentoBadge status={a.documentoStatus} /></a> : <DocumentoBadge status="pendente" temArquivo={false} />}</td>
                                            <td>{canEdit && <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                                <button className="ev-btn mini secundario" onClick={() => setModalAtleta({ aberto: true, atleta: a })}><Pencil size={12} /></button>
                                                <button className="ev-btn mini perigo" onClick={() => removerAtletaAdmin(a)}><Trash2 size={12} /></button>
                                            </div>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 style={{ marginTop: 16 }}>Aceites do regulamento</h3>
                        {(selecionada.aceites || []).length === 0 ? <p className="ev-muted">Nenhum aceite registrado.</p> : (
                            <ul style={{ paddingLeft: 18 }} className="ev-small">
                                {selecionada.aceites.map((a, i) => <li key={i}>Versão {a.versao} · {formatarDataHora(a.aceitoEm)} · {a.nome} · {a.etapa}</li>)}
                            </ul>
                        )}

                        <h3 style={{ marginTop: 16 }}>Histórico de alterações da organização</h3>
                        {(selecionada.alteracoes || []).length === 0 ? <p className="ev-muted">Nenhuma alteração registrada.</p> : (
                            <ul style={{ paddingLeft: 18 }} className="ev-small">
                                {[...(selecionada.alteracoes || [])].reverse().map((a, i) => <li key={i}>{formatarDataHora(a.em)} · <strong>{a.por}</strong> · {a.acao}{a.motivo ? ` — motivo: ${a.motivo}` : ''}</li>)}
                            </ul>
                        )}
                    </>
                )}
            </Modal>

            <AtletaFormModal
                aberto={modalAtleta.aberto}
                onFechar={() => setModalAtleta({ aberto: false })}
                atleta={modalAtleta.atleta}
                categoria={categoriaSel}
                exigirDocumento={false}
                outrosAtletas={selecionada?.atletas || []}
                onSalvar={salvarAtletaAdmin}
                permitirForaDaIdade
            />
        </>
    );
}
