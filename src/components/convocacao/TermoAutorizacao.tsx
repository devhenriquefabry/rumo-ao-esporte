import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import type {
    AutorizacaoConfig,
    FormaTransporteAtleta,
    ModalidadeEvento,
    TipoEvento,
    TransporteProjeto
} from '../../types/convocacao';
import { FORMA_TRANSPORTE_LABEL } from '../../types/convocacao';

export interface LinhaTermo {
    nome: string;
    turma?: string;
    formaTransporte?: FormaTransporteAtleta;
    assinaturaData?: string;
    assinanteNome?: string;
    status?: 'autorizado' | 'recusado';
}

interface TermoAutorizacaoProps {
    /** Nome do jogo/evento da convocação, exibido como subtítulo. */
    tituloEvento?: string;
    config: AutorizacaoConfig;
    linhas: LinhaTermo[];
    /** Completa a tabela com linhas em branco (padrão do modelo impresso: 20). */
    minLinhas?: number;
    /** Reduz a folha para caber na tela (1 = tamanho real). */
    escala?: number;
}

const RODAPE =
    'ASSOCIAÇÃO RUMO AO ESPORTE E AO LAZER (REAL)  |  rumoaoesporte@gmail.com  |  Av. Cota Emerick, 87 – Centro – Martins Soares/MG  |  (33) 9978-6088';

/** Renderiza "(X)" quando marcado e "( )" quando não. */
function Caixa({ marcado, children, compacta }: { marcado: boolean; children: React.ReactNode; compacta?: boolean }) {
    return (
        <span style={{ whiteSpace: 'nowrap', marginRight: compacta ? '5px' : '14px' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>({marcado ? 'X' : ' '})</span> {children}
        </span>
    );
}

function Campo({ label, valor, flex = 1 }: { label: string; valor?: string; flex?: number }) {
    return (
        <div style={{ flex, minWidth: 0 }}>
            <span style={{ fontWeight: 700 }}>{label}:</span>{' '}
            <span
                style={{
                    borderBottom: '1px solid #000',
                    display: 'inline-block',
                    minWidth: '60px',
                    paddingLeft: '4px',
                    paddingRight: '4px'
                }}
            >
                {valor?.trim() ? valor : ' '}
            </span>
        </div>
    );
}

function formatarData(data?: string) {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    if (!ano || !mes || !dia) return data;
    return `${dia}/${mes}/${ano}`;
}

const celulaBase: CSSProperties = {
    border: '1px solid #000',
    padding: '1px 5px',
    verticalAlign: 'middle'
};

/**
 * Termo de Autorização para Participação e Deslocamento no papel timbrado
 * da REAL. Serve tanto para o responsável ler/assinar (uma linha) quanto
 * para o documento único arquivado pelo projeto (todos os atletas).
 */
const TermoAutorizacao = forwardRef<HTMLDivElement, TermoAutorizacaoProps>(function TermoAutorizacao(
    { tituloEvento, config, linhas, minLinhas = 0, escala = 1 },
    ref
) {
    const totalLinhas = Math.max(linhas.length, minLinhas);
    const linhasCompletas: (LinhaTermo | null)[] = Array.from({ length: totalLinhas }, (_, i) => linhas[i] || null);

    const tipos: TipoEvento[] = ['campeonato', 'torneio', 'amistoso'];
    const modalidades: ModalidadeEvento[] = ['futsal', 'campo'];
    const transportes: TransporteProjeto[] = ['van', 'carro_particular', 'carona_responsaveis', 'nao_havera'];
    const transportesMarcados = config.transporteProjeto || [];

    return (
        <div
            ref={ref}
            className="termo-folha"
            style={{
                background: '#fff',
                width: '210mm',
                minHeight: '297mm',
                padding: '9mm 14mm 11mm',
                boxSizing: 'border-box',
                color: '#000',
                fontFamily: '"Times New Roman", serif',
                fontSize: '10pt',
                lineHeight: 1.3,
                position: 'relative',
                transform: escala < 1 ? `scale(${escala})` : undefined,
                transformOrigin: 'top left'
            }}
        >
            {/* Cabeçalho timbrado */}
            <div style={{ textAlign: 'center' }}>
                <img
                    src="/timbrado-real.jpg"
                    alt="Associação Rumo ao Esporte e ao Lazer - REAL"
                    style={{ height: '16mm', width: 'auto', maxWidth: '100%', display: 'block', margin: '0 auto' }}
                />
                <div style={{ borderBottom: '1px solid #000', margin: '1mm 0 2.5mm' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '2mm', lineHeight: 1.15 }}>
                <div style={{ fontWeight: 700, fontSize: '10.5pt', textTransform: 'uppercase' }}>
                    Associação Rumo ao Esporte e ao Lazer – REAL
                </div>
                <div style={{ fontWeight: 700, fontSize: '10.5pt', textTransform: 'uppercase' }}>
                    Autorização para Participação e Deslocamento
                </div>
                {tituloEvento && (
                    <div style={{ fontSize: '9.5pt', marginTop: '0.5mm' }}>{tituloEvento}</div>
                )}
            </div>

            {/* Dados do evento */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm 0', marginBottom: '2mm' }}>
                <div style={{ flex: '1 1 60%' }}>
                    <span style={{ fontWeight: 700 }}>Evento:</span>{' '}
                    {tipos.map(t => (
                        <Caixa key={t} marcado={config.tipoEvento === t}>
                            {t === 'campeonato' ? 'Campeonato' : t === 'torneio' ? 'Torneio' : 'Amistoso'}
                        </Caixa>
                    ))}
                </div>
                <div style={{ flex: '1 1 40%' }}>
                    <span style={{ fontWeight: 700 }}>Modalidade:</span>{' '}
                    {modalidades.map(m => (
                        <Caixa key={m} marcado={config.modalidade === m}>
                            {m === 'futsal' ? 'Futsal' : 'Campo'}
                        </Caixa>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '6mm', marginBottom: '2mm' }}>
                <Campo label="Data" valor={formatarData(config.data)} />
                <Campo label="Local/Cidade" valor={config.localCidade} flex={2} />
            </div>

            <div style={{ display: 'flex', gap: '6mm', marginBottom: '2mm' }}>
                <Campo label="Saída" valor={config.saidaLocal} flex={2} />
                <Campo label="Horário" valor={config.horarioSaida} />
                <Campo label="Retorno previsto" valor={config.retornoPrevisto} />
            </div>

            <div style={{ marginBottom: '2mm' }}>
                <span style={{ fontWeight: 700 }}>Transporte disponibilizado pelo projeto:</span>{' '}
                {transportes.map(t => (
                    <Caixa key={t} marcado={transportesMarcados.includes(t)}>
                        {t === 'van'
                            ? 'Van'
                            : t === 'carro_particular'
                                ? 'Carro particular'
                                : t === 'carona_responsaveis'
                                    ? 'Carona entre responsáveis'
                                    : 'Não haverá'}
                    </Caixa>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '6mm', marginBottom: '2mm' }}>
                <Campo label="Motorista" valor={config.motorista} flex={2} />
                <Campo label="Veículo/Placa" valor={config.veiculoPlaca} />
            </div>

            {/* Declaração */}
            <p style={{ textAlign: 'justify', margin: '0 0 1.5mm', fontSize: '9.5pt' }}>
                Declaro estar ciente das informações acima e autorizo o atleta sob minha responsabilidade a participar
                do evento e, quando indicado, deslocar-se no transporte informado. Estou ciente de que poderão ocorrer
                caronas voluntárias entre pais ou responsáveis.
            </p>
            <p style={{ textAlign: 'justify', margin: '0 0 2mm', fontSize: '9.5pt' }}>
                Reconheço os riscos normais relacionados à prática esportiva e ao deslocamento, permanecendo asseguradas
                as responsabilidades previstas em lei.
            </p>

            {config.observacoes?.trim() && (
                <p style={{ textAlign: 'justify', margin: '0 0 2mm', fontSize: '9.5pt' }}>
                    <strong>Observações:</strong> {config.observacoes}
                </p>
            )}

            {/* Tabela de atletas */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={{ ...celulaBase, width: '8mm', textAlign: 'right' }}>Nº</th>
                        <th style={{ ...celulaBase, textAlign: 'left' }}>Atleta</th>
                        <th style={{ ...celulaBase, width: '22mm', textAlign: 'left' }}>Categoria</th>
                        <th style={{ ...celulaBase, width: '49mm', textAlign: 'left' }}>Forma de transporte</th>
                        <th style={{ ...celulaBase, width: '43mm', textAlign: 'center' }}>Assinatura do responsável</th>
                    </tr>
                </thead>
                <tbody>
                    {linhasCompletas.map((linha, index) => (
                        <tr key={index} style={{ pageBreakInside: 'avoid' }}>
                            <td style={{ ...celulaBase, textAlign: 'right' }}>{String(index + 1).padStart(2, '0')}</td>
                            <td style={{ ...celulaBase, textTransform: 'uppercase' }}>{linha?.nome || ' '}</td>
                            <td style={{ ...celulaBase }}>{linha?.turma || ' '}</td>
                            <td style={{ ...celulaBase, fontSize: '7pt', whiteSpace: 'nowrap' }}>
                                {(['projeto', 'carona', 'pais'] as FormaTransporteAtleta[]).map(f => (
                                    <Caixa key={f} marcado={linha?.formaTransporte === f} compacta>
                                        {FORMA_TRANSPORTE_LABEL[f]}
                                    </Caixa>
                                ))}
                            </td>
                            <td style={{ ...celulaBase, height: '7mm', textAlign: 'center' }}>
                                {linha?.status === 'recusado' ? (
                                    <span style={{ fontSize: '7pt', fontWeight: 700 }}>NÃO AUTORIZADO</span>
                                ) : linha?.assinaturaData ? (
                                    <img
                                        src={linha.assinaturaData}
                                        alt={`Assinatura de ${linha.assinanteNome || 'responsável'}`}
                                        style={{ maxHeight: '6.5mm', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                                    />
                                ) : (
                                    ' '
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ display: 'flex', gap: '6mm', marginTop: '4mm' }}>
                <Campo label="Responsável pela delegação" valor={config.responsavelDelegacao} flex={2} />
                <Campo label="Telefone" valor={config.telefoneDelegacao} />
            </div>

            {/* Rodapé timbrado */}
            <div
                style={{
                    position: 'absolute',
                    left: '16mm',
                    right: '16mm',
                    bottom: '6mm',
                    borderTop: '1px solid #000',
                    paddingTop: '1.5mm',
                    fontSize: '7pt',
                    textAlign: 'center'
                }}
            >
                {RODAPE}
            </div>
        </div>
    );
});

export default TermoAutorizacao;

/** CSS de impressão: isola a folha do termo do restante da interface. */
export const TERMO_PRINT_STYLE = `
    @media print {
        @page { margin: 0; size: A4 portrait; }
        body * { visibility: hidden !important; }
        .termo-folha, .termo-folha * { visibility: visible !important; }
        .termo-folha {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            transform: none !important;
        }
        .termo-nao-imprimir { display: none !important; }
        /* A caixa de preview recorta a folha na tela; na impressão ela some. */
        .termo-caixa-preview {
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
        }
        thead { display: table-header-group; }
    }
`;
