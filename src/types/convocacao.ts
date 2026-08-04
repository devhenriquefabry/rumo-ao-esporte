export interface ConvocacaoJogador {
    id: string; // unique identifier (uniqueId)
    regId?: string; // registration document identifier
    nome: string;
    photo?: string;
    turma?: string;
    categoria: 'titular' | 'reserva';
    numero?: string;
    responsavel?: string;
}

export type TipoEvento = 'campeonato' | 'torneio' | 'amistoso';
export type ModalidadeEvento = 'futsal' | 'campo';

/** Transporte que o projeto disponibiliza (pode marcar mais de um). */
export type TransporteProjeto = 'van' | 'carro_particular' | 'carona_responsaveis' | 'nao_havera';

/** Como o atleta vai — escolhido pelo responsável ao assinar. */
export type FormaTransporteAtleta = 'projeto' | 'carona' | 'pais';

/**
 * Dados do evento preenchidos pelo projeto antes de enviar a autorização
 * aos responsáveis (Autorização para Participação e Deslocamento).
 */
export interface AutorizacaoConfig {
    ativa: boolean;
    tipoEvento?: TipoEvento;
    modalidade?: ModalidadeEvento;
    data?: string; // yyyy-mm-dd
    localCidade?: string;
    saidaLocal?: string;
    horarioSaida?: string;
    retornoPrevisto?: string;
    transporteProjeto?: TransporteProjeto[];
    motorista?: string;
    veiculoPlaca?: string;
    responsavelDelegacao?: string;
    telefoneDelegacao?: string;
    observacoes?: string;
    atualizadoEm?: number;
}

/**
 * Resposta de um responsável. Fica em coleção própria (um documento por
 * atleta) para que assinaturas simultâneas não sobrescrevam umas às outras
 * — o array `jogadores` da convocação nunca é reescrito pelo portal do aluno.
 */
export interface AutorizacaoResposta {
    id?: string; // `${convocacaoId}__${jogadorId}`
    convocacaoId: string;
    jogadorId: string;
    regId?: string;
    atletaNome: string;
    atletaTurma?: string;
    status: 'autorizado' | 'recusado';
    formaTransporte?: FormaTransporteAtleta;
    assinaturaData?: string; // dataURL PNG da assinatura
    assinanteNome?: string;
    assinanteEmail?: string;
    motivoRecusa?: string;
    respondidoEm: number;
}

export interface Convocacao {
    id?: string;
    jogo: string;
    categoria?: string; // Ex.: "SUB-9", "FEMININO" — aparece no selo da arte
    dataUnix: number; // For sorting
    tecnico?: string;
    auxiliar?: string;
    rivalNome?: string;
    rivalLogo?: string;
    casaNome?: string;
    casaLogo?: string;
    showPhotos?: boolean;
    showNumbers?: boolean;
    showDataJogo?: boolean;
    jogadores: ConvocacaoJogador[];
    autorizacao?: AutorizacaoConfig;
}

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
    campeonato: 'Campeonato',
    torneio: 'Torneio',
    amistoso: 'Amistoso'
};

export const MODALIDADE_EVENTO_LABEL: Record<ModalidadeEvento, string> = {
    futsal: 'Futsal',
    campo: 'Campo'
};

export const TRANSPORTE_PROJETO_LABEL: Record<TransporteProjeto, string> = {
    van: 'Van',
    carro_particular: 'Carro particular',
    carona_responsaveis: 'Carona entre responsáveis',
    nao_havera: 'Não haverá'
};

export const FORMA_TRANSPORTE_LABEL: Record<FormaTransporteAtleta, string> = {
    projeto: 'Projeto',
    carona: 'Carona',
    pais: 'Com os pais'
};
