import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
    Bus,
    Calendar,
    CheckCircle2,
    Clock,
    FileSignature,
    MapPin,
    X,
    XCircle
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import SignatureCanvas from '../components/SignatureCanvas';
import TermoAutorizacao, { TERMO_PRINT_STYLE } from '../components/convocacao/TermoAutorizacao';
import { listarAutorizacoesDeConvocacoes, listarConvocacoesComAutorizacao, salvarAutorizacao } from '../utils/autorizacaoService';
import { useDialog } from '../context/CustomDialogContext';
import type {
    AutorizacaoResposta,
    Convocacao,
    ConvocacaoJogador,
    FormaTransporteAtleta
} from '../types/convocacao';
import {
    FORMA_TRANSPORTE_LABEL,
    MODALIDADE_EVENTO_LABEL,
    TIPO_EVENTO_LABEL
} from '../types/convocacao';

interface ItemAutorizacao {
    convocacao: Convocacao;
    jogador: ConvocacaoJogador;
    resposta?: AutorizacaoResposta;
}

const CORES = {
    navy: '#09245c',
    blue: '#17428f',
    blueSoft: '#eef8ff',
    green: '#00a63a',
    greenSoft: '#e8f9ee',
    danger: '#e74c3c',
    border: '#dce7f3',
    surfaceSoft: '#f8fbff'
};

function formatarData(data?: string) {
    if (!data) return 'A confirmar';
    const [ano, mes, dia] = data.split('-');
    if (!ano || !mes || !dia) return data;
    return `${dia}/${mes}/${ano}`;
}

export default function StudentAutorizacoes() {
    const { showAlert, showConfirm } = useDialog();
    const [itens, setItens] = useState<ItemAutorizacao[]>([]);
    const [responsavelNome, setResponsavelNome] = useState('');
    const [responsavelEmail, setResponsavelEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);

    // Estado do fluxo de assinatura
    const [itemAtivo, setItemAtivo] = useState<ItemAutorizacao | null>(null);
    const [formaTransporte, setFormaTransporte] = useState<FormaTransporteAtleta | null>(null);
    const [assinatura, setAssinatura] = useState<string | null>(null);
    const [termoAberto, setTermoAberto] = useState<ItemAutorizacao | null>(null);
    const [escalaTermo, setEscalaTermo] = useState(1);
    const areaTermoRef = useRef<HTMLDivElement>(null);
    const folhaRef = useRef<HTMLDivElement>(null);
    const [alturaFolha, setAlturaFolha] = useState(0);

    const carregar = useCallback(async (email: string) => {
        setLoading(true);
        try {
            const normalizedEmail = email.toLowerCase().trim();
            setResponsavelEmail(normalizedEmail);

            // 1. Matrículas do responsável -> ids únicos dos atletas
            const regSnap = await getDocs(
                query(collection(db, 'rumo_ao_esporte_2026_registrations'), where('responsavel.email', '==', normalizedEmail))
            );

            const meusIds = new Set<string>();
            let nomeResp = '';
            regSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (!nomeResp && data.responsavel?.nome) nomeResp = data.responsavel.nome;
                meusIds.add(docSnap.id); // matrícula sem índice (registros legados)
                (data.alunos || []).forEach((_: unknown, index: number) => meusIds.add(`${docSnap.id}_${index}`));
            });
            setResponsavelNome(nomeResp);

            if (meusIds.size === 0) {
                setItens([]);
                return;
            }

            // 2. Convocações com autorização liberada
            const convocacoes = await listarConvocacoesComAutorizacao();
            const pares: ItemAutorizacao[] = [];
            convocacoes.forEach(conv => {
                (conv.jogadores || []).forEach(jogador => {
                    if (meusIds.has(jogador.id)) pares.push({ convocacao: conv, jogador });
                });
            });

            // 3. Respostas já registradas
            const idsConvocacoes = Array.from(new Set(pares.map(p => p.convocacao.id!).filter(Boolean)));
            const respostas = await listarAutorizacoesDeConvocacoes(idsConvocacoes);
            const mapa = new Map(respostas.map(r => [`${r.convocacaoId}__${r.jogadorId}`, r]));

            setItens(
                pares.map(par => ({
                    ...par,
                    resposta: mapa.get(`${par.convocacao.id}__${par.jogador.id}`)
                }))
            );
        } catch (error) {
            console.error('Erro ao carregar autorizações:', error);
            showAlert('Não foi possível carregar as autorizações. Tente novamente.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            const impersonatedEmail = localStorage.getItem('rae_impersonated_student_email');
            const email = impersonatedEmail || user?.email;
            if (email) carregar(email);
            else setLoading(false);
        });
        return () => unsubscribe();
    }, [carregar]);

    // Escala da folha no visualizador do termo
    useEffect(() => {
        if (!termoAberto) return;
        const calcular = () => {
            const disponivel = (areaTermoRef.current?.clientWidth || window.innerWidth) - 24;
            setEscalaTermo(Math.min(disponivel / 794, 1));
        };
        const timer = setTimeout(() => {
            calcular();
            setAlturaFolha(folhaRef.current?.offsetHeight || 0);
        }, 100);
        window.addEventListener('resize', calcular);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calcular);
        };
    }, [termoAberto, escalaTermo]);

    const pendentes = useMemo(() => itens.filter(i => !i.resposta), [itens]);
    const respondidos = useMemo(() => itens.filter(i => i.resposta), [itens]);

    const abrirAssinatura = (item: ItemAutorizacao) => {
        setItemAtivo(item);
        setFormaTransporte(null);
        setAssinatura(null);
    };

    const registrarResposta = async (
        item: ItemAutorizacao,
        status: 'autorizado' | 'recusado',
        extras: Partial<AutorizacaoResposta> = {}
    ) => {
        setSalvando(true);
        try {
            const resposta: AutorizacaoResposta = {
                convocacaoId: item.convocacao.id!,
                jogadorId: item.jogador.id,
                regId: item.jogador.regId,
                atletaNome: item.jogador.nome,
                atletaTurma: item.jogador.turma,
                status,
                assinanteNome: responsavelNome,
                assinanteEmail: responsavelEmail,
                respondidoEm: Date.now(),
                ...extras
            };

            await salvarAutorizacao(resposta);

            setItens(prev =>
                prev.map(i =>
                    i.convocacao.id === item.convocacao.id && i.jogador.id === item.jogador.id
                        ? { ...i, resposta }
                        : i
                )
            );
            setItemAtivo(null);
            showAlert(
                status === 'autorizado'
                    ? 'Autorização assinada e enviada ao projeto!'
                    : 'Registramos que o atleta não participará deste evento.',
                'success'
            );
        } catch (error) {
            console.error('Erro ao salvar autorização:', error);
            showAlert('Erro ao enviar a autorização. Tente novamente.', 'error');
        } finally {
            setSalvando(false);
        }
    };

    const confirmarAssinatura = () => {
        if (!itemAtivo) return;
        if (!formaTransporte) {
            showAlert('Escolha como o atleta vai se deslocar.', 'warning');
            return;
        }
        if (!assinatura) {
            showAlert('Assine no quadro para concluir.', 'warning');
            return;
        }
        registrarResposta(itemAtivo, 'autorizado', { formaTransporte, assinaturaData: assinatura });
    };

    const recusar = (item: ItemAutorizacao) => {
        showConfirm(
            `Confirmar que ${item.jogador.nome} NÃO participará de "${item.convocacao.jogo}"?`,
            () => registrarResposta(item, 'recusado'),
            'warning',
            'Não autorizar'
        );
    };

    if (loading) {
        return (
            <PageContainer>
                <div style={{ padding: '40px', textAlign: 'center', color: '#63708a' }}>Carregando autorizações...</div>
            </PageContainer>
        );
    }

    const renderResumoEvento = (item: ItemAutorizacao) => {
        const cfg = item.convocacao.autorizacao || { ativa: true };
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                <span style={badgeStyle}>
                    <Calendar size={13} /> {formatarData(cfg.data)}
                    {cfg.horarioSaida ? ` · saída ${cfg.horarioSaida}` : ''}
                </span>
                {cfg.localCidade && (
                    <span style={badgeStyle}>
                        <MapPin size={13} /> {cfg.localCidade}
                    </span>
                )}
                {cfg.tipoEvento && (
                    <span style={badgeStyle}>
                        {TIPO_EVENTO_LABEL[cfg.tipoEvento]}
                        {cfg.modalidade ? ` · ${MODALIDADE_EVENTO_LABEL[cfg.modalidade]}` : ''}
                    </span>
                )}
                {cfg.motorista && (
                    <span style={badgeStyle}>
                        <Bus size={13} /> {cfg.motorista}
                        {cfg.veiculoPlaca ? ` · ${cfg.veiculoPlaca}` : ''}
                    </span>
                )}
            </div>
        );
    };

    return (
        <PageContainer>
            <PageTitle
                title="AUTORIZAÇÕES"
                subtitle="Autorize a participação e o deslocamento do seu atleta"
                count={pendentes.length}
            />

            {itens.length === 0 && (
                <div
                    style={{
                        background: '#fff',
                        border: `1px dashed ${CORES.border}`,
                        borderRadius: '12px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#8ea3c0'
                    }}
                >
                    <FileSignature size={38} color="#c3d3e8" style={{ marginBottom: '10px' }} />
                    <div style={{ fontWeight: 700, color: '#63708a' }}>Nenhuma autorização no momento.</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                        Quando seu atleta for convocado para um evento, o termo aparecerá aqui.
                    </div>
                </div>
            )}

            {/* Pendentes */}
            {pendentes.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <h2 style={secaoTituloStyle}>Aguardando sua assinatura</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {pendentes.map(item => (
                            <div key={`${item.convocacao.id}_${item.jogador.id}`} style={cardStyle('#f4c20d')}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.72rem', color: '#a06f00', fontWeight: 800, letterSpacing: '0.5px' }}>
                                            <Clock size={12} style={{ verticalAlign: '-2px' }} /> PENDENTE
                                        </div>
                                        <h3 style={{ margin: '4px 0 0', color: CORES.navy, fontSize: '1.05rem', fontWeight: 800 }}>
                                            {item.convocacao.jogo}
                                        </h3>
                                        <div style={{ fontSize: '0.85rem', color: '#63708a', textTransform: 'uppercase', fontWeight: 700 }}>
                                            {item.jogador.nome}
                                        </div>
                                    </div>
                                </div>

                                {renderResumoEvento(item)}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                                    <button onClick={() => setTermoAberto(item)} style={botaoSecundario}>
                                        LER O TERMO
                                    </button>
                                    <button onClick={() => abrirAssinatura(item)} style={botaoPrimario}>
                                        <FileSignature size={16} /> AUTORIZAR E ASSINAR
                                    </button>
                                    <button onClick={() => recusar(item)} style={botaoRecusar}>
                                        NÃO VOU AUTORIZAR
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Já respondidos */}
            {respondidos.length > 0 && (
                <div>
                    <h2 style={secaoTituloStyle}>Histórico</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {respondidos.map(item => {
                            const autorizado = item.resposta?.status === 'autorizado';
                            return (
                                <div key={`${item.convocacao.id}_${item.jogador.id}`} style={cardStyle(autorizado ? CORES.green : CORES.danger)}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '10px',
                                            flexWrap: 'wrap',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    letterSpacing: '0.5px',
                                                    color: autorizado ? CORES.green : CORES.danger,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {autorizado ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                                {autorizado ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}
                                            </div>
                                            <h3 style={{ margin: '4px 0 0', color: CORES.navy, fontSize: '1rem', fontWeight: 800 }}>
                                                {item.convocacao.jogo}
                                            </h3>
                                            <div style={{ fontSize: '0.82rem', color: '#63708a', textTransform: 'uppercase', fontWeight: 700 }}>
                                                {item.jogador.nome}
                                                {item.resposta?.formaTransporte
                                                    ? ` · ${FORMA_TRANSPORTE_LABEL[item.resposta.formaTransporte]}`
                                                    : ''}
                                            </div>
                                        </div>
                                        {item.resposta?.assinaturaData && (
                                            <img
                                                src={item.resposta.assinaturaData}
                                                alt="Sua assinatura"
                                                style={{ height: '40px', maxWidth: '150px', objectFit: 'contain' }}
                                            />
                                        )}
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <button onClick={() => setTermoAberto(item)} style={botaoSecundario}>
                                            VER O TERMO
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal de assinatura */}
            {itemAtivo && (
                <div style={overlayStyle}>
                    <div style={modalStyle}>
                        <div style={modalHeaderStyle}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 800 }}>
                                Autorizar {itemAtivo.jogador.nome}
                            </h2>
                            <button onClick={() => setItemAtivo(null)} style={fecharStyle}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', background: CORES.surfaceSoft }}>
                            <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#63708a', lineHeight: 1.5 }}>
                                Ao assinar, você declara estar ciente das informações do evento e autoriza a participação e o
                                deslocamento do atleta, reconhecendo os riscos normais da prática esportiva.
                            </p>

                            <button
                                onClick={() => setTermoAberto(itemAtivo)}
                                style={{ ...botaoSecundario, width: '100%', justifyContent: 'center', marginBottom: '18px' }}
                            >
                                LER O TERMO COMPLETO
                            </button>

                            <label style={rotuloStyle}>COMO O ATLETA VAI SE DESLOCAR?</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                {(['projeto', 'carona', 'pais'] as FormaTransporteAtleta[]).map(forma => (
                                    <button
                                        key={forma}
                                        onClick={() => setFormaTransporte(forma)}
                                        style={{
                                            flex: '1 1 100px',
                                            padding: '12px 10px',
                                            borderRadius: '10px',
                                            border: `2px solid ${formaTransporte === forma ? CORES.blue : CORES.border}`,
                                            background: formaTransporte === forma ? CORES.blueSoft : '#fff',
                                            color: formaTransporte === forma ? CORES.blue : '#63708a',
                                            fontWeight: 800,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {FORMA_TRANSPORTE_LABEL[forma]}
                                    </button>
                                ))}
                            </div>

                            <label style={rotuloStyle}>ASSINATURA DO RESPONSÁVEL</label>
                            <SignatureCanvas onConfirm={setAssinatura} onClear={() => setAssinatura(null)} />

                            {assinatura && (
                                <div
                                    style={{
                                        marginTop: '12px',
                                        fontSize: '0.82rem',
                                        color: CORES.green,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px',
                                        fontWeight: 700
                                    }}
                                >
                                    <CheckCircle2 size={15} /> Assinatura capturada
                                </div>
                            )}

                            <button
                                onClick={confirmarAssinatura}
                                disabled={salvando}
                                style={{
                                    ...botaoPrimario,
                                    width: '100%',
                                    justifyContent: 'center',
                                    marginTop: '18px',
                                    padding: '14px',
                                    fontSize: '0.95rem',
                                    opacity: salvando ? 0.7 : 1
                                }}
                            >
                                {salvando ? 'ENVIANDO...' : 'CONFIRMAR AUTORIZAÇÃO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visualizador do termo timbrado */}
            {termoAberto && (
                <div style={overlayStyle}>
                    <style>{TERMO_PRINT_STYLE}</style>
                    <div style={{ ...modalStyle, maxWidth: '900px', height: '92vh' }}>
                        <div className="termo-nao-imprimir" style={modalHeaderStyle}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 800 }}>
                                Termo de autorização
                            </h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => window.print()} style={{ ...botaoSecundario, padding: '6px 12px' }}>
                                    IMPRIMIR
                                </button>
                                <button onClick={() => setTermoAberto(null)} style={fecharStyle}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div ref={areaTermoRef} style={{ flex: 1, overflow: 'auto', padding: '12px', background: '#525659' }}>
                            <div
                                className="termo-caixa-preview"
                                style={{
                                    width: `${794 * escalaTermo}px`,
                                    height: alturaFolha ? `${alturaFolha * escalaTermo}px` : undefined,
                                    overflow: 'hidden',
                                    margin: '0 auto',
                                    background: '#fff'
                                }}
                            >
                                <TermoAutorizacao
                                    ref={folhaRef}
                                    tituloEvento={termoAberto.convocacao.jogo}
                                    config={termoAberto.convocacao.autorizacao || { ativa: true }}
                                    escala={escalaTermo}
                                    linhas={[
                                        {
                                            nome: termoAberto.jogador.nome,
                                            turma: termoAberto.jogador.turma,
                                            formaTransporte: termoAberto.resposta?.formaTransporte,
                                            assinaturaData: termoAberto.resposta?.assinaturaData,
                                            assinanteNome: termoAberto.resposta?.assinanteNome,
                                            status: termoAberto.resposta?.status
                                        }
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

const badgeStyle: React.CSSProperties = {
    background: CORES.blueSoft,
    color: CORES.blue,
    padding: '5px 10px',
    borderRadius: '20px',
    fontSize: '0.74rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px'
};

const secaoTituloStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: '#63708a',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px',
    fontWeight: 800
};

const cardStyle = (cor: string): React.CSSProperties => ({
    background: '#fff',
    borderRadius: '12px',
    border: `1px solid ${CORES.border}`,
    borderLeft: `5px solid ${cor}`,
    padding: '18px',
    boxShadow: '0 4px 15px rgba(9,36,92,0.06)'
});

const botaoPrimario: React.CSSProperties = {
    background: CORES.green,
    color: '#fff',
    border: 'none',
    padding: '11px 18px',
    borderRadius: '8px',
    fontWeight: 800,
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '7px'
};

const botaoSecundario: React.CSSProperties = {
    background: '#fff',
    color: CORES.blue,
    border: `1px solid ${CORES.border}`,
    padding: '11px 18px',
    borderRadius: '8px',
    fontWeight: 800,
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '7px'
};

const botaoRecusar: React.CSSProperties = {
    background: '#fff',
    color: CORES.danger,
    border: '1px solid #f8cfc9',
    padding: '11px 18px',
    borderRadius: '8px',
    fontWeight: 800,
    fontSize: '0.82rem',
    cursor: 'pointer'
};

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,26,64,0.55)',
    zIndex: 1200,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px',
    backdropFilter: 'blur(3px)'
};

const modalStyle: React.CSSProperties = {
    background: '#fff',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '92vh',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 18px 50px rgba(9,36,92,0.28)'
};

const modalHeaderStyle: React.CSSProperties = {
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px'
};

const fecharStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.14)',
    border: 'none',
    color: '#fff',
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex'
};

const rotuloStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.76rem',
    fontWeight: 800,
    color: '#63708a',
    marginBottom: '8px',
    letterSpacing: '0.5px'
};
