import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, Printer, RefreshCw, XCircle } from 'lucide-react';
import { CONV_UI, ConvocacaoToggle } from './ConvocacaoToggle';
import TermoPrintModal from './TermoPrintModal';
import { listarAutorizacoesDaConvocacao } from '../../utils/autorizacaoService';
import type {
    AutorizacaoConfig,
    AutorizacaoResposta,
    ConvocacaoJogador,
    ModalidadeEvento,
    TipoEvento,
    TransporteProjeto
} from '../../types/convocacao';
import {
    FORMA_TRANSPORTE_LABEL,
    MODALIDADE_EVENTO_LABEL,
    TIPO_EVENTO_LABEL,
    TRANSPORTE_PROJETO_LABEL
} from '../../types/convocacao';

interface AutorizacaoSectionProps {
    tituloEvento: string;
    config: AutorizacaoConfig;
    /** Recebe o setter de estado: usamos a forma funcional para não perder
     *  alterações quando dois campos mudam no mesmo lote de render do React. */
    onChange: React.Dispatch<React.SetStateAction<AutorizacaoConfig>>;
    jogadores: ConvocacaoJogador[];
    convocacaoId?: string;
    isMobile: boolean;
}

function Chip({
    ativo,
    onClick,
    children
}: {
    ativo: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: `1px solid ${ativo ? CONV_UI.blue : CONV_UI.border}`,
                background: ativo ? CONV_UI.blueSoft : '#fff',
                color: ativo ? CONV_UI.blue : '#63708a',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
            }}
        >
            {children}
        </button>
    );
}

const statusVisual = {
    autorizado: { label: 'AUTORIZADO', cor: CONV_UI.green, fundo: CONV_UI.greenSoft, Icone: CheckCircle2 },
    recusado: { label: 'NÃO AUTORIZADO', cor: CONV_UI.danger, fundo: '#fdeeec', Icone: XCircle },
    pendente: { label: 'AGUARDANDO', cor: '#a06f00', fundo: '#fff8e1', Icone: Clock }
};

export default function AutorizacaoSection({
    tituloEvento,
    config,
    onChange,
    jogadores,
    convocacaoId,
    isMobile
}: AutorizacaoSectionProps) {
    const [respostas, setRespostas] = useState<AutorizacaoResposta[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);

    const carregarRespostas = useCallback(async () => {
        if (!convocacaoId) return;
        setCarregando(true);
        try {
            setRespostas(await listarAutorizacoesDaConvocacao(convocacaoId));
        } catch (error) {
            console.error('Erro ao carregar autorizações:', error);
        } finally {
            setCarregando(false);
        }
    }, [convocacaoId]);

    useEffect(() => {
        carregarRespostas();
    }, [carregarRespostas]);

    const atualizar = (patch: Partial<AutorizacaoConfig>) => onChange(prev => ({ ...prev, ...patch }));

    const alternarTransporte = (valor: TransporteProjeto) => {
        onChange(prev => {
            const atuais = prev.transporteProjeto || [];
            return {
                ...prev,
                transporteProjeto: atuais.includes(valor)
                    ? atuais.filter(t => t !== valor)
                    : [...atuais, valor]
            };
        });
    };

    const respostaPorJogador = useMemo(() => {
        const mapa = new Map<string, AutorizacaoResposta>();
        respostas.forEach(r => mapa.set(r.jogadorId, r));
        return mapa;
    }, [respostas]);

    const totais = useMemo(() => {
        let autorizados = 0;
        let recusados = 0;
        jogadores.forEach(j => {
            const r = respostaPorJogador.get(j.id);
            if (r?.status === 'autorizado') autorizados += 1;
            else if (r?.status === 'recusado') recusados += 1;
        });
        return { autorizados, recusados, pendentes: jogadores.length - autorizados - recusados };
    }, [jogadores, respostaPorJogador]);

    return (
        <div style={{ marginBottom: '25px' }}>
            <ConvocacaoToggle
                label="AUTORIZAÇÃO PARA PARTICIPAÇÃO E DESLOCAMENTO"
                hint={
                    config.ativa
                        ? 'Os responsáveis dos atletas convocados verão o termo no portal do aluno para ler e assinar'
                        : 'Ligue para preencher os dados do evento e enviar o termo aos responsáveis'
                }
                checked={!!config.ativa}
                onChange={ativa => atualizar({ ativa })}
            >
                <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                        <label style={CONV_UI.label}>TIPO DE EVENTO</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(Object.keys(TIPO_EVENTO_LABEL) as TipoEvento[]).map(t => (
                                <Chip key={t} ativo={config.tipoEvento === t} onClick={() => atualizar({ tipoEvento: t })}>
                                    {TIPO_EVENTO_LABEL[t]}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={CONV_UI.label}>MODALIDADE</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(Object.keys(MODALIDADE_EVENTO_LABEL) as ModalidadeEvento[]).map(m => (
                                <Chip key={m} ativo={config.modalidade === m} onClick={() => atualizar({ modalidade: m })}>
                                    {MODALIDADE_EVENTO_LABEL[m]}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px' }}>
                        <div>
                            <label style={CONV_UI.label}>DATA DO EVENTO</label>
                            <input
                                type="date"
                                value={config.data || ''}
                                onChange={e => atualizar({ data: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>LOCAL / CIDADE</label>
                            <input
                                type="text"
                                value={config.localCidade || ''}
                                onChange={e => atualizar({ localCidade: e.target.value })}
                                placeholder="Ex: Ginásio Poliesportivo — Manhuaçu/MG"
                                style={CONV_UI.input}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={CONV_UI.label}>LOCAL DE SAÍDA</label>
                            <input
                                type="text"
                                value={config.saidaLocal || ''}
                                onChange={e => atualizar({ saidaLocal: e.target.value })}
                                placeholder="Ex: Sede da Associação"
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>HORÁRIO DE SAÍDA</label>
                            <input
                                type="time"
                                value={config.horarioSaida || ''}
                                onChange={e => atualizar({ horarioSaida: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>RETORNO PREVISTO</label>
                            <input
                                type="time"
                                value={config.retornoPrevisto || ''}
                                onChange={e => atualizar({ retornoPrevisto: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={CONV_UI.label}>TRANSPORTE DISPONIBILIZADO PELO PROJETO</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(Object.keys(TRANSPORTE_PROJETO_LABEL) as TransporteProjeto[]).map(t => (
                                <Chip
                                    key={t}
                                    ativo={(config.transporteProjeto || []).includes(t)}
                                    onClick={() => alternarTransporte(t)}
                                >
                                    {TRANSPORTE_PROJETO_LABEL[t]}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={CONV_UI.label}>MOTORISTA</label>
                            <input
                                type="text"
                                value={config.motorista || ''}
                                onChange={e => atualizar({ motorista: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>VEÍCULO / PLACA</label>
                            <input
                                type="text"
                                value={config.veiculoPlaca || ''}
                                onChange={e => atualizar({ veiculoPlaca: e.target.value })}
                                placeholder="Ex: Van Sprinter — ABC1D23"
                                style={CONV_UI.input}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={CONV_UI.label}>RESPONSÁVEL PELA DELEGAÇÃO</label>
                            <input
                                type="text"
                                value={config.responsavelDelegacao || ''}
                                onChange={e => atualizar({ responsavelDelegacao: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>TELEFONE</label>
                            <input
                                type="text"
                                value={config.telefoneDelegacao || ''}
                                onChange={e => atualizar({ telefoneDelegacao: e.target.value })}
                                style={CONV_UI.input}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={CONV_UI.label}>OBSERVAÇÕES (Opcional)</label>
                        <textarea
                            value={config.observacoes || ''}
                            onChange={e => atualizar({ observacoes: e.target.value })}
                            placeholder="Ex: levar uniforme completo, garrafa de água e documento com foto."
                            rows={3}
                            style={{ ...CONV_UI.input, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div
                        style={{
                            background: '#fff8e1',
                            border: '1px solid #ffe6a1',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            color: '#8a6100',
                            fontSize: '0.82rem'
                        }}
                    >
                        As alterações acima só chegam aos responsáveis depois de clicar em <strong>SALVAR</strong> no topo da página.
                    </div>
                </div>
            </ConvocacaoToggle>

            {/* Acompanhamento das respostas */}
            {config.ativa && convocacaoId && (
                <div
                    style={{
                        background: '#fff',
                        border: `1px solid ${CONV_UI.border}`,
                        borderRadius: '12px',
                        padding: '20px',
                        marginTop: '16px',
                        boxShadow: CONV_UI.shadow
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'stretch' : 'center',
                            gap: '12px',
                            marginBottom: '16px'
                        }}
                    >
                        <h3 style={{ margin: 0, color: CONV_UI.navy, fontSize: '1rem', fontWeight: 800 }}>
                            RESPOSTAS DOS RESPONSÁVEIS
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                onClick={carregarRespostas}
                                style={{
                                    background: CONV_UI.surfaceSoft,
                                    border: `1px solid ${CONV_UI.border}`,
                                    color: '#63708a',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.82rem'
                                }}
                            >
                                <RefreshCw size={16} /> {carregando ? 'ATUALIZANDO...' : 'ATUALIZAR'}
                            </button>
                            <button
                                onClick={() => setPrintOpen(true)}
                                style={{
                                    background: CONV_UI.blue,
                                    border: 'none',
                                    color: '#fff',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.82rem'
                                }}
                            >
                                <Printer size={16} /> DOCUMENTO ÚNICO
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {[
                            { label: 'Autorizados', valor: totais.autorizados, cor: CONV_UI.green, fundo: CONV_UI.greenSoft },
                            { label: 'Aguardando', valor: totais.pendentes, cor: '#a06f00', fundo: '#fff8e1' },
                            { label: 'Não autorizados', valor: totais.recusados, cor: CONV_UI.danger, fundo: '#fdeeec' }
                        ].map(item => (
                            <div
                                key={item.label}
                                style={{
                                    flex: '1 1 130px',
                                    background: item.fundo,
                                    borderRadius: '10px',
                                    padding: '12px 14px'
                                }}
                            >
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: item.cor }}>{item.valor}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: item.cor }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {jogadores.length === 0 && (
                            <div style={{ color: '#8ea3c0', fontStyle: 'italic' }}>
                                Adicione atletas à convocação para acompanhar as autorizações.
                            </div>
                        )}
                        {jogadores.map(j => {
                            const resposta = respostaPorJogador.get(j.id);
                            const visual = statusVisual[resposta?.status || 'pendente'];
                            const Icone = visual.Icone;

                            return (
                                <div
                                    key={j.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        flexWrap: 'wrap',
                                        border: `1px solid ${CONV_UI.border}`,
                                        borderRadius: '10px',
                                        padding: '10px 14px',
                                        background: CONV_UI.surfaceSoft
                                    }}
                                >
                                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontWeight: 800,
                                                color: CONV_UI.navy,
                                                textTransform: 'uppercase',
                                                fontSize: '0.88rem'
                                            }}
                                        >
                                            {j.nome}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#63708a' }}>
                                            {j.turma || 'Sem turma'}
                                            {resposta?.assinanteNome ? ` · ${resposta.assinanteNome}` : ''}
                                        </div>
                                    </div>

                                    {resposta?.formaTransporte && (
                                        <span
                                            style={{
                                                background: CONV_UI.blueSoft,
                                                color: CONV_UI.blue,
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.72rem',
                                                fontWeight: 800
                                            }}
                                        >
                                            {FORMA_TRANSPORTE_LABEL[resposta.formaTransporte]}
                                        </span>
                                    )}

                                    {resposta?.assinaturaData && (
                                        <img
                                            src={resposta.assinaturaData}
                                            alt={`Assinatura de ${resposta.assinanteNome || 'responsável'}`}
                                            style={{ height: '34px', maxWidth: '120px', objectFit: 'contain' }}
                                        />
                                    )}

                                    <span
                                        style={{
                                            background: visual.fundo,
                                            color: visual.cor,
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <Icone size={14} /> {visual.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {totais.pendentes > 0 && (
                        <div
                            style={{
                                marginTop: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.8rem',
                                color: '#63708a'
                            }}
                        >
                            <FileText size={16} />
                            O documento único pode ser impresso a qualquer momento — quem ainda não assinou aparece com a
                            linha em branco para assinatura manual.
                        </div>
                    )}
                </div>
            )}

            <TermoPrintModal
                isOpen={printOpen}
                onClose={() => setPrintOpen(false)}
                tituloEvento={tituloEvento}
                config={config}
                jogadores={jogadores}
                respostas={respostas}
            />
        </div>
    );
}
