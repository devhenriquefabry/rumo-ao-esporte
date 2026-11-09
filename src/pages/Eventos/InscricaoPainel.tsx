import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Printer, Upload, Medal, Package, Hash } from 'lucide-react';
import type { Evento, InscricaoIndividual, AceiteRegulamento as Aceite } from '../../types/eventos';
import { atualizarInscricao, buscarEvento, buscarInscricao, enviarArquivo } from '../../utils/eventos/eventosService';
import { formatarData, mensagemErro } from '../../utils/eventos/eventosRules';
import { pdfComprovanteInscricao } from '../../utils/eventos/eventosPdf';
import { useEventoConta } from '../../hooks/useEventoConta';
import { useDialog } from '../../context/CustomDialogContext';
import { EventosShell, Carregando, Passos, RegulamentoCard, AceiteRegulamento, Alerta, StatusBadge, DocumentoBadge } from '../../components/eventos/EventosUI';
import PagamentoBox from '../../components/eventos/PagamentoBox';

export default function InscricaoPainel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { user, conta, loading } = useEventoConta();
    const [insc, setInsc] = useState<InscricaoIndividual | null>(null);
    const [evento, setEvento] = useState<Evento | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [aceiteNovaVersao, setAceiteNovaVersao] = useState(false);
    const [enviandoDoc, setEnviandoDoc] = useState(false);

    const carregar = useCallback(async () => {
        if (!id) return;
        try {
            const i = await buscarInscricao(id);
            setInsc(i);
            if (i) setEvento(await buscarEvento(i.eventId));
        } catch (e) {
            console.error(e);
        } finally {
            setCarregando(false);
        }
    }, [id]);

    useEffect(() => {
        if (loading) return;
        if (!user || !conta) { navigate(`/eventos/entrar?volta=${encodeURIComponent(`/eventos/minha-area/inscricao/${id}`)}`, { replace: true }); return; }
        carregar();
    }, [loading, user, conta, id, navigate, carregar]);

    if (loading || carregando) return <EventosShell><Carregando /></EventosShell>;
    if (!insc || !evento || !user || !conta) {
        return <EventosShell voltar={{ to: '/eventos/minha-area', label: 'Minha área' }}><div className="ev-card ev-vazio"><p>Inscrição não encontrada.</p></div></EventosShell>;
    }

    const categoria = evento.categorias.find(c => c.id === insc.categoriaId);
    const pago = insc.pagamento.status === 'confirmado' || insc.pagamento.status === 'isento';
    const regulamento = evento.regulamento;
    const ultimaVersao = Math.max(0, ...(insc.aceites || []).map(a => a.versao));
    const novaVersao = !!regulamento && regulamento.versao > ultimaVersao;

    const salvar = async (dados: Partial<InscricaoIndividual>) => {
        await atualizarInscricao(insc.id!, dados);
        setInsc(prev => prev ? { ...prev, ...dados } as InscricaoIndividual : prev);
    };

    const reenviarDocumento = async (file?: File | null) => {
        if (!file) return;
        setEnviandoDoc(true);
        try {
            const url = await enviarArquivo(file, 'evento_doc');
            await salvar({ documentoUrl: url, documentoNome: file.name, documentoStatus: 'pendente', motivoRejeicao: '' });
            showAlert('Documento enviado para análise.', 'success');
        } catch (e) {
            showAlert(mensagemErro(e, 'Erro ao enviar o documento.'), 'error');
        } finally {
            setEnviandoDoc(false);
        }
    };

    const registrarCiencia = async () => {
        if (!aceiteNovaVersao) { showAlert('Marque a declaração para continuar.', 'warning'); return; }
        const aceite: Aceite = { versao: regulamento!.versao, aceitoEm: new Date().toISOString(), nome: conta.nome, uid: user.uid, etapa: 'nova_versao' };
        await salvar({ aceites: [...(insc.aceites || []), aceite] });
        setAceiteNovaVersao(false);
        showAlert('Ciência registrada.', 'success');
    };

    return (
        <EventosShell voltar={{ to: '/eventos/minha-area', label: 'Minha área' }}>
            <Passos passos={['Inscrição', 'Pagamento', 'Comprovantes']} atual={pago ? 3 : 1} />

            <div className="ev-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ marginBottom: 4 }}>{insc.participante.nome}</h2>
                        <p className="ev-muted">{evento.nome} · {formatarData(evento.dataInicio)} · {evento.local}</p>
                        <p className="ev-muted">Categoria <strong>{categoria?.nome}</strong>{categoria?.distancia ? ` · ${categoria.distancia}` : ''}</p>
                    </div>
                    <StatusBadge status={insc.status} />
                </div>
                <div className="ev-grid c3" style={{ marginTop: 14 }}>
                    <div className="ev-stat"><div className="valor"><Hash size={20} /> {insc.numeroPeito || '—'}</div><div className="rotulo">Número de peito</div></div>
                    <div className="ev-stat"><div className="valor" style={{ fontSize: '1rem' }}><DocumentoBadge status={insc.documentoStatus} temArquivo={!!insc.documentoUrl} /></div><div className="rotulo">Documento</div></div>
                    <div className="ev-stat verde"><div className="valor"><Medal size={20} /> {insc.resultado?.tempo || '—'}</div><div className="rotulo">{insc.resultado?.posicaoCategoria ? `${insc.resultado.posicaoCategoria}º na categoria · ${insc.resultado.posicaoGeral}º geral` : 'Resultado'}</div></div>
                </div>
            </div>

            {insc.documentoStatus === 'rejeitado' && (
                <div className="ev-card">
                    <Alerta tipo="erro">Seu documento foi rejeitado{insc.motivoRejeicao ? `: ${insc.motivoRejeicao}` : ''}. Envie um novo arquivo.</Alerta>
                    <label className="ev-btn secundario">
                        <Upload size={16} /> {enviandoDoc ? 'Enviando...' : 'Enviar novo documento'}
                        <input type="file" accept="image/*,application/pdf" hidden onChange={e => reenviarDocumento(e.target.files?.[0])} />
                    </label>
                </div>
            )}
            {!insc.documentoUrl && evento.exigirDocumento && (
                <div className="ev-card">
                    <Alerta tipo="aviso">Documento ainda não enviado.</Alerta>
                    <label className="ev-btn secundario">
                        <Upload size={16} /> {enviandoDoc ? 'Enviando...' : 'Enviar documento'}
                        <input type="file" accept="image/*,application/pdf" hidden onChange={e => reenviarDocumento(e.target.files?.[0])} />
                    </label>
                </div>
            )}

            {insc.status !== 'cancelada' && (
                <PagamentoBox
                    evento={evento} categoria={categoria} inscricaoId={insc.id!} inscritoNome={insc.participante.nome}
                    responsavel={{ nome: conta.nome, cpf: insc.participante.cpf, email: insc.participante.email, telefone: insc.participante.telefone }}
                    pagamento={insc.pagamento} status={insc.status} statusAposPagamento="finalizada" onSalvar={salvar}
                />
            )}
            {insc.status === 'cancelada' && <div className="ev-card"><Alerta tipo="erro">Inscrição cancelada pela organização.</Alerta></div>}

            {pago && insc.status !== 'cancelada' && (
                <div className="ev-card">
                    <h3><Package size={18} /> Comprovante de inscrição</h3>
                    <p className="ev-muted" style={{ marginBottom: 10 }}>Contém categoria, distância, número de peito (quando disponível) e orientações para retirada do kit.</p>
                    <div className="ev-actions">
                        <button className="ev-btn azul" onClick={() => pdfComprovanteInscricao(evento, categoria, insc, 'baixar')}><Download size={16} /> Baixar comprovante</button>
                        <button className="ev-btn secundario" onClick={() => pdfComprovanteInscricao(evento, categoria, insc, 'imprimir')}><Printer size={16} /> Imprimir</button>
                    </div>
                    {evento.orientacoesKit && (
                        <div style={{ marginTop: 14 }}>
                            <h3>Retirada do kit</h3>
                            <p style={{ whiteSpace: 'pre-line' }}>{evento.orientacoesKit}</p>
                        </div>
                    )}
                </div>
            )}

            <RegulamentoCard regulamento={regulamento} nomeEvento={evento.nome} historico={evento.regulamentoHistorico}
                aviso={novaVersao ? (
                    <div style={{ marginBottom: 12 }}>
                        <Alerta tipo="aviso"><strong>Regulamento atualizado para a versão {regulamento?.versao}.</strong> {regulamento?.notas}</Alerta>
                        <AceiteRegulamento marcado={aceiteNovaVersao} onChange={setAceiteNovaVersao} versao={regulamento?.versao} />
                        <button className="ev-btn azul" style={{ marginTop: 10 }} onClick={registrarCiencia}>Registrar ciência</button>
                    </div>
                ) : null}
            />
        </EventosShell>
    );
}
