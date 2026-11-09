import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Pencil, Trash2, Lock, FileText, Eye, Download, Printer, ShieldAlert, Users } from 'lucide-react';
import type { AtletaEvento, Evento, EquipeEvento, AceiteRegulamento as Aceite } from '../../types/eventos';
import { atualizarEquipe, buscarEquipe, buscarEvento } from '../../utils/eventos/eventosService';
import { formatarData, formatarDataHora, faixaEtariaTexto, formatarTempoDeJogo } from '../../utils/eventos/eventosRules';
import { pdfListaOficial } from '../../utils/eventos/eventosPdf';
import { useEventoConta } from '../../hooks/useEventoConta';
import { useDialog } from '../../context/CustomDialogContext';
import {
    EventosShell, Carregando, Passos, RegulamentoCard, AceiteRegulamento, Alerta, StatusBadge, DocumentoBadge, Modal,
} from '../../components/eventos/EventosUI';
import PagamentoBox from '../../components/eventos/PagamentoBox';
import AtletaFormModal from '../../components/eventos/AtletaFormModal';

export default function EquipePainel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const { user, conta, loading } = useEventoConta();

    const [equipe, setEquipe] = useState<EquipeEvento | null>(null);
    const [evento, setEvento] = useState<Evento | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [modalAtleta, setModalAtleta] = useState<{ aberto: boolean; atleta?: AtletaEvento | null }>({ aberto: false });
    const [revisao, setRevisao] = useState(false);
    const [aceiteFinal, setAceiteFinal] = useState(false);
    const [aceiteNovaVersao, setAceiteNovaVersao] = useState(false);
    const [finalizando, setFinalizando] = useState(false);

    const carregar = useCallback(async () => {
        if (!id) return;
        try {
            const eq = await buscarEquipe(id);
            setEquipe(eq);
            if (eq) setEvento(await buscarEvento(eq.eventId));
        } catch (e) {
            console.error(e);
            setEquipe(null);
        } finally {
            setCarregando(false);
        }
    }, [id]);

    useEffect(() => {
        if (loading) return;
        if (!user || !conta) { navigate(`/eventos/entrar?volta=${encodeURIComponent(`/eventos/minha-area/equipe/${id}`)}`, { replace: true }); return; }
        carregar();
    }, [loading, user, conta, id, navigate, carregar]);

    if (loading || carregando) return <EventosShell><Carregando /></EventosShell>;
    if (!equipe || !evento || !user || !conta) {
        return <EventosShell voltar={{ to: '/eventos/minha-area', label: 'Minha área' }}><div className="ev-card ev-vazio"><p>Equipe não encontrada ou sem permissão de acesso.</p></div></EventosShell>;
    }

    const categoria = evento.categorias.find(c => c.id === equipe.categoriaId);
    const finalizada = equipe.status === 'finalizada';
    const cadastroAberto = equipe.status === 'liberada';
    const maxAtletas = categoria?.maxAtletas || 0;
    const minAtletas = Math.max(1, categoria?.minAtletas || 1);
    const atletas = equipe.atletas || [];
    const atingiuLimite = maxAtletas > 0 && atletas.length >= maxAtletas;
    const ultimaVersaoAceita = Math.max(0, ...(equipe.aceites || []).map(a => a.versao));
    const regulamento = evento.regulamento;
    const novaVersaoPendente = !!regulamento && regulamento.versao > ultimaVersaoAceita;
    const novaVersaoImportante = novaVersaoPendente && (evento.regulamentoHistorico || [])
        .some(v => v.versao > ultimaVersaoAceita && v.alteracaoImportante);
    const documentosRejeitados = atletas.filter(a => a.documentoStatus === 'rejeitado');
    const semDocumento = evento.exigirDocumento ? atletas.filter(a => !a.documentoUrl) : [];

    const passoAtual = finalizada ? 4 : cadastroAberto ? 2 : 1;

    const salvar = async (dados: Partial<EquipeEvento>) => {
        await atualizarEquipe(equipe.id!, dados);
        setEquipe(prev => prev ? { ...prev, ...dados } as EquipeEvento : prev);
    };

    const novoAceite = (etapa: Aceite['etapa']): Aceite => ({
        versao: regulamento?.versao || 0, aceitoEm: new Date().toISOString(), nome: conta.nome, uid: user.uid, etapa,
    });

    const salvarAtleta = async (atleta: AtletaEvento) => {
        if (!cadastroAberto) throw new Error('A relação de atletas não está aberta para edição.');
        const existe = atletas.some(a => a.id === atleta.id);
        if (!existe && atingiuLimite) throw new Error(`Limite de ${maxAtletas} atletas atingido para esta categoria.`);
        const nova = existe ? atletas.map(a => a.id === atleta.id ? atleta : a) : [...atletas, atleta];
        await salvar({ atletas: nova });
    };

    const removerAtleta = (atleta: AtletaEvento) => {
        showConfirm(`Remover ${atleta.nome} da relação?`, async () => {
            try { await salvar({ atletas: atletas.filter(a => a.id !== atleta.id) }); }
            catch { showAlert('Não foi possível remover o atleta.', 'error'); }
        }, 'warning', 'Remover atleta');
    };

    const registrarCienciaNovaVersao = async () => {
        if (!aceiteNovaVersao) { showAlert('Marque a declaração para registrar a ciência da nova versão.', 'warning'); return; }
        try {
            await salvar({ aceites: [...(equipe.aceites || []), novoAceite('nova_versao')] });
            setAceiteNovaVersao(false);
            showAlert('Ciência da nova versão do regulamento registrada.', 'success');
        } catch {
            showAlert('Não foi possível registrar agora. Tente novamente.', 'error');
        }
    };

    const abrirRevisao = () => {
        if (atletas.length < minAtletas) { showAlert(`Cadastre pelo menos ${minAtletas} atleta(s) antes de finalizar.`, 'warning'); return; }
        if (documentosRejeitados.length) { showAlert('Há documentos rejeitados. Corrija ou substitua esses atletas antes de finalizar.', 'warning'); return; }
        if (semDocumento.length) { showAlert('Todos os atletas precisam ter o documento anexado antes de finalizar.', 'warning'); return; }
        setAceiteFinal(false);
        setRevisao(true);
    };

    const finalizar = async () => {
        if (regulamento && !aceiteFinal) { showAlert('Marque a declaração de ciência do regulamento para finalizar.', 'warning'); return; }
        setFinalizando(true);
        try {
            const agora = new Date().toISOString();
            const dados: Partial<EquipeEvento> = {
                status: 'finalizada',
                finalizadaEm: agora,
                listaOficial: { geradaEm: agora, geradaPor: conta.nome, atletas: [...atletas], regulamentoVersao: regulamento?.versao },
                aceites: regulamento ? [...(equipe.aceites || []), novoAceite('finalizacao')] : equipe.aceites,
            };
            await salvar(dados);
            setRevisao(false);
            showAlert('Inscrição finalizada! A lista oficial foi gerada e enviada para a organização.', 'success');
            await pdfListaOficial(evento, categoria, { ...equipe, ...dados } as EquipeEvento, 'baixar');
        } catch (e) {
            console.error(e);
            showAlert('Não foi possível finalizar agora. Tente novamente.', 'error');
        } finally {
            setFinalizando(false);
        }
    };

    const listaAtletas = (editavel: boolean, base: AtletaEvento[]) => (
        <div className="ev-lista-atletas">
            {base.map(a => (
                <div key={a.id} className="ev-atleta">
                    <span className="camisa">{a.camisa || '–'}</span>
                    <div>
                        <div className="nome">{a.nome}</div>
                        <div className="ev-muted ev-small">Nasc. {formatarData(a.dataNascimento)}</div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <DocumentoBadge status={a.documentoStatus} temArquivo={!!a.documentoUrl} />
                            {a.documentoStatus === 'rejeitado' && a.motivoRejeicao && <span className="ev-small" style={{ color: '#9b1c1c' }}>{a.motivoRejeicao}</span>}
                        </div>
                    </div>
                    {editavel && (
                        <div className="ev-actions">
                            <button className="ev-btn mini secundario" onClick={() => { setRevisao(false); setModalAtleta({ aberto: true, atleta: a }); }}><Pencil size={13} /> Editar</button>
                            <button className="ev-btn mini perigo" onClick={() => removerAtleta(a)}><Trash2 size={13} /> Excluir</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <EventosShell voltar={{ to: '/eventos/minha-area', label: 'Minha área' }}>
            <Passos passos={['Equipe', 'Pagamento', 'Atletas', 'Lista oficial']} atual={passoAtual} />

            <div className="ev-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ marginBottom: 4 }}>{equipe.nome}</h2>
                        <p className="ev-muted">{evento.nome} · <strong>{categoria?.nome}</strong> ({categoria ? faixaEtariaTexto(categoria) : ''})</p>
                        {categoria && <p className="ev-muted ev-small">Tempo de jogo: {formatarTempoDeJogo(categoria.tempo).toLowerCase()} · até {maxAtletas} atletas</p>}
                    </div>
                    <StatusBadge status={equipe.status} />
                </div>
            </div>

            <RegulamentoCard
                regulamento={regulamento}
                nomeEvento={evento.nome}
                historico={evento.regulamentoHistorico}
                aviso={novaVersaoPendente ? (
                    <div style={{ marginBottom: 12 }}>
                        <Alerta tipo={novaVersaoImportante ? 'aviso' : 'info'}>
                            <strong>O regulamento foi atualizado para a versão {regulamento?.versao}.</strong>
                            {regulamento?.notas ? <> Alterações: {regulamento.notas}.</> : null}
                            {' '}Leia a nova versão e registre sua ciência.
                        </Alerta>
                        <AceiteRegulamento marcado={aceiteNovaVersao} onChange={setAceiteNovaVersao} versao={regulamento?.versao} />
                        <button className="ev-btn azul" style={{ marginTop: 10 }} onClick={registrarCienciaNovaVersao}>Registrar ciência da nova versão</button>
                    </div>
                ) : null}
            />

            {!finalizada && (equipe.status === 'aguardando_pagamento' || equipe.status === 'pagamento_em_analise' || equipe.pagamento.status === 'confirmado') && (
                <PagamentoBox
                    evento={evento} categoria={categoria} inscricaoId={equipe.id!} inscritoNome={equipe.nome}
                    responsavel={equipe.responsavel} pagamento={equipe.pagamento} status={equipe.status}
                    statusAposPagamento="liberada" onSalvar={salvar}
                />
            )}
            {finalizada && equipe.pagamento.status === 'confirmado' && (
                <PagamentoBox
                    evento={evento} categoria={categoria} inscricaoId={equipe.id!} inscritoNome={equipe.nome}
                    responsavel={equipe.responsavel} pagamento={equipe.pagamento} status={equipe.status}
                    statusAposPagamento="finalizada" onSalvar={salvar}
                />
            )}

            {equipe.status === 'cancelada' && <div className="ev-card"><Alerta tipo="erro">Esta inscrição foi cancelada pela organização.</Alerta></div>}

            {(cadastroAberto || finalizada) && (
                <div className="ev-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}><Users size={18} /> Atletas · {finalizada ? equipe.listaOficial?.atletas.length : atletas.length} de {maxAtletas}</h3>
                        {cadastroAberto && (
                            <button className="ev-btn primario" disabled={atingiuLimite} onClick={() => setModalAtleta({ aberto: true, atleta: null })}>
                                <UserPlus size={16} /> {atingiuLimite ? 'Limite atingido' : 'Adicionar atleta'}
                            </button>
                        )}
                    </div>

                    {cadastroAberto && (
                        <Alerta tipo="info">
                            Você pode corrigir, excluir ou substituir atletas enquanto a relação estiver aberta.
                            Não é obrigatório preencher todas as {maxAtletas} vagas — quando terminar, clique em <strong>Finalizar inscrição</strong>.
                        </Alerta>
                    )}
                    {documentosRejeitados.length > 0 && cadastroAberto && <Alerta tipo="erro">{documentosRejeitados.length} documento(s) rejeitado(s). Edite o atleta e envie um novo documento.</Alerta>}

                    {finalizada
                        ? listaAtletas(false, equipe.listaOficial?.atletas || atletas)
                        : atletas.length === 0 ? <div className="ev-vazio"><UserPlus size={36} /><p>Nenhum atleta cadastrado ainda.</p></div> : listaAtletas(true, atletas)}

                    {cadastroAberto && atletas.length > 0 && (
                        <button className="ev-btn ouro grande bloco" style={{ marginTop: 18 }} onClick={abrirRevisao}>
                            <Lock size={18} /> Finalizar inscrição e gerar lista oficial
                        </button>
                    )}
                </div>
            )}

            {finalizada && (
                <div className="ev-card">
                    <h3><FileText size={18} /> Lista oficial de atletas</h3>
                    <Alerta tipo="ok">
                        Relação finalizada em {formatarDataHora(equipe.listaOficial?.geradaEm)} por {equipe.listaOficial?.geradaPor}.
                        A lista foi enviada para a organização e será usada nas súmulas dos jogos.
                    </Alerta>
                    <div className="ev-actions">
                        <button className="ev-btn azul" onClick={() => pdfListaOficial(evento, categoria, equipe, 'visualizar')}><Eye size={16} /> Visualizar</button>
                        <button className="ev-btn secundario" onClick={() => pdfListaOficial(evento, categoria, equipe, 'baixar')}><Download size={16} /> Baixar</button>
                        <button className="ev-btn secundario" onClick={() => pdfListaOficial(evento, categoria, equipe, 'imprimir')}><Printer size={16} /> Imprimir</button>
                    </div>
                    <p className="ev-muted ev-small" style={{ marginTop: 10 }}>Precisa de uma correção excepcional? Entre em contato com a organização da REAL.</p>
                </div>
            )}

            <AtletaFormModal
                aberto={modalAtleta.aberto}
                onFechar={() => setModalAtleta({ aberto: false })}
                atleta={modalAtleta.atleta}
                categoria={categoria}
                exigirDocumento={evento.exigirDocumento}
                outrosAtletas={atletas}
                onSalvar={salvarAtleta}
            />

            <Modal aberto={revisao} onFechar={() => setRevisao(false)} largo titulo="Conferência final da relação"
                rodape={<>
                    <button className="ev-btn neutro" onClick={() => setRevisao(false)}>Voltar e corrigir</button>
                    <button className="ev-btn perigo-cheio" onClick={finalizar} disabled={finalizando || (!!regulamento && !aceiteFinal)}>
                        <Lock size={16} /> {finalizando ? 'Finalizando...' : 'Confirmar e bloquear relação'}
                    </button>
                </>}>
                <div className="ev-alert erro" style={{ fontSize: '0.95rem' }}>
                    <ShieldAlert size={22} />
                    <div>
                        <strong>Atenção: após a confirmação NÃO será possível alterar os jogadores.</strong><br />
                        Confira nomes, datas de nascimento e números das camisas. Depois de finalizar, somente a organização poderá fazer correções excepcionais.
                    </div>
                </div>
                <p style={{ margin: '8px 0 12px' }}><strong>{equipe.nome}</strong> · {categoria?.nome} · <strong>{atletas.length}</strong> atleta(s) de {maxAtletas} permitidos</p>
                <div className="ev-table-wrap" style={{ marginBottom: 14 }}>
                    <table className="ev-table">
                        <thead><tr><th>#</th><th>Nº</th><th>Nome</th><th>Nascimento</th><th>Documento</th><th></th></tr></thead>
                        <tbody>
                            {atletas.map((a, i) => (
                                <tr key={a.id}>
                                    <td>{i + 1}</td>
                                    <td><strong>{a.camisa || '-'}</strong></td>
                                    <td style={{ fontWeight: 700, textTransform: 'uppercase' }}>{a.nome}</td>
                                    <td>{formatarData(a.dataNascimento)}</td>
                                    <td><DocumentoBadge status={a.documentoStatus} temArquivo={!!a.documentoUrl} /></td>
                                    <td>
                                        <div className="ev-actions" style={{ flexWrap: 'nowrap' }}>
                                            <button className="ev-btn mini secundario" onClick={() => { setRevisao(false); setModalAtleta({ aberto: true, atleta: a }); }}><Pencil size={12} /></button>
                                            <button className="ev-btn mini perigo" onClick={() => { setRevisao(false); removerAtleta(a); }}><Trash2 size={12} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {regulamento && (
                    <>
                        <RegulamentoCard regulamento={regulamento} nomeEvento={evento.nome} compacto />
                        <AceiteRegulamento marcado={aceiteFinal} onChange={setAceiteFinal} versao={regulamento.versao} />
                    </>
                )}
            </Modal>
        </EventosShell>
    );
}
