import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import type { Evento, EquipeEvento, InscricaoIndividual, VagaPublica, AceiteRegulamento as Aceite } from '../../types/eventos';
import {
    buscarEvento, listarVagas, contarOcupadas, criarEquipe, criarInscricao, enviarArquivo,
} from '../../utils/eventos/eventosService';
import {
    formatarMoeda, inscricoesAbertas, situacaoInscricoes, faixaEtariaTexto, vagasRestantes, validarIdade, formatarTempoDeJogo, mensagemErro } from '../../utils/eventos/eventosRules';
import { useEventoConta } from '../../hooks/useEventoConta';
import { useDialog } from '../../context/CustomDialogContext';
import { EventosShell, RegulamentoCard, AceiteRegulamento, Carregando, Alerta, Passos } from '../../components/eventos/EventosUI';

export default function EventoInscrever() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { user, conta, loading } = useEventoConta();

    const [evento, setEvento] = useState<Evento | null>(null);
    const [vagas, setVagas] = useState<VagaPublica[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [enviando, setEnviando] = useState(false);

    const [categoriaId, setCategoriaId] = useState('');
    const [aceite, setAceite] = useState(false);
    // equipe
    const [nomeEquipe, setNomeEquipe] = useState('');
    const [tecnico, setTecnico] = useState('');
    // individual
    const [nascimento, setNascimento] = useState('');
    const [sexo, setSexo] = useState<'masculino' | 'feminino' | 'outro'>('masculino');
    const [camiseta, setCamiseta] = useState('');
    const [cidade, setCidade] = useState('');
    const [emergencia, setEmergencia] = useState('');
    const [nomeParticipante, setNomeParticipante] = useState('');
    const [arquivo, setArquivo] = useState<File | null>(null);

    useEffect(() => {
        if (!loading && (!user || !conta)) navigate(`/eventos/entrar?volta=${encodeURIComponent(`/eventos/${id}/inscrever`)}`, { replace: true });
    }, [loading, user, conta, id, navigate]);

    useEffect(() => {
        if (conta) setNomeParticipante(conta.nome);
    }, [conta]);

    useEffect(() => {
        if (!id) return;
        Promise.all([buscarEvento(id), listarVagas(id)])
            .then(([ev, v]) => { setEvento(ev); setVagas(v); })
            .finally(() => setCarregando(false));
    }, [id]);

    const categoria = useMemo(() => evento?.categorias.find(c => c.id === categoriaId), [evento, categoriaId]);

    if (loading || carregando) return <EventosShell><Carregando /></EventosShell>;
    if (!evento || !user || !conta) return <EventosShell><Carregando /></EventosShell>;

    const individual = evento.tipo === 'individual';
    const abertas = inscricoesAbertas(evento);

    const montarAceite = (): Aceite => ({
        versao: evento.regulamento?.versao || 0,
        aceitoEm: new Date().toISOString(),
        nome: conta.nome,
        uid: user.uid,
        etapa: 'cadastro',
    });

    const confirmar = async () => {
        if (!categoria) { showAlert('Escolha a categoria.', 'warning'); return; }
        if (vagasRestantes(categoria, contarOcupadas(vagas, categoria.id)) <= 0) { showAlert('Não há mais vagas nesta categoria.', 'warning'); return; }
        if (evento.regulamento && !aceite) { showAlert('Para continuar, marque a declaração de ciência do regulamento.', 'warning'); return; }

        const agora = new Date().toISOString();
        const gratuito = !categoria.valor || categoria.valor <= 0;
        const pagamento = gratuito
            ? { valor: 0, status: 'isento' as const, metodo: 'isento' as const, confirmadoEm: agora, confirmadoPor: 'automatico' }
            : { valor: categoria.valor, status: 'pendente' as const };

        setEnviando(true);
        try {
            if (!individual) {
                if (nomeEquipe.trim().length < 2) { showAlert('Informe o nome da equipe.', 'warning'); return; }
                const nomeNormal = nomeEquipe.trim().toLowerCase();
                if (vagas.some(v => v.categoriaId === categoria.id && v.status !== 'cancelada' && v.nome.trim().toLowerCase() === nomeNormal)) {
                    showAlert('Já existe uma equipe com este nome nesta categoria.', 'warning'); return;
                }
                const equipe: EquipeEvento = {
                    eventId: evento.id!, categoriaId: categoria.id, nome: nomeEquipe.trim(), tecnico: tecnico.trim(),
                    ownerUid: user.uid,
                    responsavel: { uid: user.uid, nome: conta.nome, email: conta.email, telefone: conta.telefone, cpf: conta.cpf },
                    status: gratuito ? 'liberada' : 'aguardando_pagamento',
                    pagamento, atletas: [], aceites: evento.regulamento ? [montarAceite()] : [],
                    listaOficial: null, finalizadaEm: null, alteracoes: [], createdAt: agora,
                };
                const novoId = await criarEquipe(equipe);
                navigate(`/eventos/minha-area/equipe/${novoId}`, { replace: true });
                return;
            }

            // Individual (corrida)
            if (nomeParticipante.trim().split(' ').length < 2) { showAlert('Informe o nome completo do participante.', 'warning'); return; }
            if (!nascimento) { showAlert('Informe a data de nascimento.', 'warning'); return; }
            const erroIdade = validarIdade(categoria, nascimento);
            if (erroIdade) { showAlert(erroIdade, 'warning'); return; }
            if (categoria.sexo && categoria.sexo !== 'misto' && sexo !== categoria.sexo) {
                showAlert(`A categoria ${categoria.nome} é ${categoria.sexo}.`, 'warning'); return;
            }
            if (evento.exigirDocumento && !arquivo) { showAlert('Anexe um documento com foto (RG, CNH ou certidão).', 'warning'); return; }

            let documentoUrl = '';
            if (arquivo) documentoUrl = await enviarArquivo(arquivo, 'evento_doc');

            const insc: InscricaoIndividual = {
                eventId: evento.id!, categoriaId: categoria.id, ownerUid: user.uid,
                participante: {
                    nome: nomeParticipante.trim(), dataNascimento: nascimento, sexo, cpf: conta.cpf, telefone: conta.telefone,
                    email: conta.email, camiseta, cidade: cidade.trim(), contatoEmergencia: emergencia.trim(),
                },
                documentoUrl, documentoNome: arquivo?.name || '', documentoStatus: 'pendente',
                // Individual não tem etapa de atletas: gratuito já nasce confirmado
                status: gratuito ? 'finalizada' : 'aguardando_pagamento',
                pagamento, aceites: evento.regulamento ? [montarAceite()] : [],
                numeroPeito: null, resultado: null, alteracoes: [], createdAt: agora,
            };
            const novoId = await criarInscricao(insc);
            navigate(`/eventos/minha-area/inscricao/${novoId}`, { replace: true });
        } catch (e) {
            console.error(e);
            showAlert(mensagemErro(e, 'Não foi possível concluir a inscrição.'), 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <EventosShell voltar={{ to: `/eventos/${evento.id}`, label: 'Voltar ao evento' }}>
            <Passos passos={individual ? ['Inscrição', 'Pagamento', 'Comprovantes'] : ['Equipe', 'Pagamento', 'Atletas', 'Lista oficial']} atual={0} />

            <div className="ev-card">
                <h2>{individual ? 'Minha inscrição' : 'Cadastrar equipe'} · {evento.nome}</h2>
                {!abertas && <Alerta tipo="aviso">{situacaoInscricoes(evento)}.</Alerta>}
                <p className="ev-muted">Responsável: <strong>{conta.nome}</strong> · {conta.email} · {conta.telefone}</p>
            </div>

            <RegulamentoCard regulamento={evento.regulamento} nomeEvento={evento.nome} compacto />

            <div className="ev-card">
                <h3>1. Categoria</h3>
                <div className="ev-grid auto">
                    {evento.categorias.map(c => {
                        const restantes = vagasRestantes(c, contarOcupadas(vagas, c.id));
                        const esgotada = restantes <= 0;
                        const ativa = categoriaId === c.id;
                        return (
                            <button key={c.id} type="button" disabled={esgotada}
                                onClick={() => setCategoriaId(c.id)}
                                className="ev-check" style={{ textAlign: 'left', borderColor: ativa ? '#00a63a' : undefined, background: ativa ? '#effaf3' : undefined, opacity: esgotada ? .5 : 1, flexDirection: 'column', gap: 4 }}>
                                <strong style={{ fontSize: '1rem', color: '#17428f' }}>{c.nome}{c.distancia ? ` · ${c.distancia}` : ''}</strong>
                                <span className="ev-muted ev-small">{faixaEtariaTexto(c)}</span>
                                {!individual && <span className="ev-muted ev-small">Até {c.maxAtletas} atletas · {formatarTempoDeJogo(c.tempo).toLowerCase()}</span>}
                                <span className="ev-small" style={{ fontWeight: 800 }}>{c.valor > 0 ? formatarMoeda(c.valor) : 'Gratuita'} · {restantes === Infinity ? 'vagas livres' : esgotada ? 'ESGOTADA' : `${restantes} vaga(s)`}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="ev-card">
                <h3>2. {individual ? 'Dados do participante' : 'Dados da equipe'}</h3>
                {!individual ? (
                    <div className="ev-grid c2">
                        <div className="ev-field">
                            <label>Nome da equipe</label>
                            <input className="ev-input" value={nomeEquipe} onChange={e => setNomeEquipe(e.target.value)} maxLength={60} />
                        </div>
                        <div className="ev-field">
                            <label>Técnico (opcional)</label>
                            <input className="ev-input" value={tecnico} onChange={e => setTecnico(e.target.value)} />
                            <span className="ev-hint">Aparece na súmula oficial.</span>
                        </div>
                    </div>
                ) : (
                    <div className="ev-grid c2">
                        <div className="ev-field">
                            <label>Nome completo do participante</label>
                            <input className="ev-input" value={nomeParticipante} onChange={e => setNomeParticipante(e.target.value)} />
                        </div>
                        <div className="ev-field">
                            <label>Data de nascimento</label>
                            <input className="ev-input" type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
                        </div>
                        <div className="ev-field">
                            <label>Sexo</label>
                            <select className="ev-select" value={sexo} onChange={e => setSexo(e.target.value as 'masculino' | 'feminino' | 'outro')}>
                                <option value="masculino">Masculino</option>
                                <option value="feminino">Feminino</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Tamanho da camiseta</label>
                            <select className="ev-select" value={camiseta} onChange={e => setCamiseta(e.target.value)}>
                                <option value="">Não se aplica</option>
                                {['PP', 'P', 'M', 'G', 'GG', 'XG', 'Infantil'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="ev-field">
                            <label>Cidade</label>
                            <input className="ev-input" value={cidade} onChange={e => setCidade(e.target.value)} />
                        </div>
                        <div className="ev-field">
                            <label>Contato de emergência</label>
                            <input className="ev-input" value={emergencia} onChange={e => setEmergencia(e.target.value)} placeholder="Nome e telefone" />
                        </div>
                        <div className="ev-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Documento com foto {evento.exigirDocumento ? '(obrigatório)' : '(opcional)'}</label>
                            <label className="ev-btn secundario" style={{ alignSelf: 'flex-start' }}>
                                <Upload size={16} /> {arquivo ? arquivo.name : 'Escolher arquivo (foto ou PDF, até 5MB)'}
                                <input type="file" accept="image/*,application/pdf" hidden onChange={e => setArquivo(e.target.files?.[0] || null)} />
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <div className="ev-card">
                <h3>3. Confirmação</h3>
                {categoria && (
                    <Alerta tipo={categoria.valor > 0 ? 'info' : 'ok'}>
                        {categoria.valor > 0
                            ? <>Taxa de inscrição: <strong>{formatarMoeda(categoria.valor)}</strong>. Na próxima tela você paga por PIX. {individual ? '' : 'O cadastro dos atletas é liberado após a confirmação do pagamento.'}</>
                            : <>Categoria gratuita. {individual ? 'Sua inscrição será registrada.' : 'Após confirmar, o cadastro dos atletas é liberado imediatamente.'}</>}
                    </Alerta>
                )}
                {evento.regulamento && <AceiteRegulamento marcado={aceite} onChange={setAceite} versao={evento.regulamento.versao} />}
                <button className="ev-btn primario grande bloco" style={{ marginTop: 14 }} onClick={confirmar} disabled={enviando || !abertas || !categoria}>
                    {enviando ? 'Salvando...' : individual ? 'Confirmar inscrição' : 'Cadastrar equipe'}
                </button>
            </div>
        </EventosShell>
    );
}
