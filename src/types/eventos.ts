/**
 * Tipos do módulo de Eventos (campeonatos, torneios e corridas de rua).
 * Tudo que pode variar de um campeonato para outro é configuração do evento /
 * da categoria — nada de regra fixa no código.
 */

export type EventoTipo = 'equipes' | 'individual';
export type EventoStatus = 'rascunho' | 'publicado' | 'encerrado';
export type EventoFormato = 'todos_contra_todos' | 'mata_mata' | 'grupos' | 'grupos_mata_mata' | 'manual';

export type CriterioDesempate =
    | 'pontos'
    | 'vitorias'
    | 'saldo_gols'
    | 'gols_pro'
    | 'menos_gols_contra'
    | 'confronto_direto'
    | 'menos_cartoes_vermelhos'
    | 'menos_cartoes_amarelos';

export interface TempoDeJogo {
    periodos: number;           // quantidade de tempos/períodos
    duracaoMin: number;         // duração de cada período
    intervaloMin: number;       // 0 = sem intervalo
    prorrogacaoPeriodos: number; // 0 = sem prorrogação
    prorrogacaoMin: number;
}

export interface EventoCategoria {
    id: string;
    nome: string;               // Sub-12, Adulto Masculino, 5 km Feminino...
    anoNascimentoMin?: number | null; // nascidos a partir de (mais novo permitido = maior ano)
    anoNascimentoMax?: number | null;
    sexo?: 'masculino' | 'feminino' | 'misto';
    maxInscricoes: number;      // equipes (eventos de equipes) ou participantes (individual); 0 = sem limite
    maxAtletas: number;         // por equipe
    minAtletas: number;
    valor: number;              // R$ — 0 = gratuito
    tempo: TempoDeJogo;
    faltasPorPeriodo: number;   // caixas de faltas acumuladas na súmula (0 = não exibir)
    temposPorPeriodo: number;   // pedidos de tempo por período (0 = não exibir)
    distancia?: string;         // corrida: "5 km"
    observacoes?: string;
}

export interface RegulamentoVersao {
    versao: number;
    url: string;
    nomeArquivo: string;
    publicadoEm: string;        // ISO
    publicadoPor: string;
    notas?: string;
    alteracaoImportante?: boolean;
}

export interface Evento {
    id?: string;
    tipo: EventoTipo;
    modalidade: string;         // futebol, futsal, society, corrida...
    nome: string;
    descricao: string;
    bannerUrl?: string;
    dataInicio: string;         // YYYY-MM-DD
    dataFim?: string;
    local: string;
    inscricoesInicio: string;   // YYYY-MM-DD
    inscricoesFim: string;
    status: EventoStatus;
    formato: EventoFormato;
    pontuacao: { vitoria: number; empate: number; derrota: number };
    criteriosDesempate: CriterioDesempate[];
    regrasEspecificas?: string;
    orientacoesKit?: string;    // corrida
    exigirDocumento: boolean;
    categorias: EventoCategoria[];
    regulamento?: RegulamentoVersao | null;
    regulamentoHistorico?: RegulamentoVersao[];
    createdAt?: string;
    updatedAt?: string;
}

export type InscricaoStatus =
    | 'aguardando_pagamento'
    | 'pagamento_em_analise'
    | 'liberada'      // pagamento confirmado / gratuito — cadastro de atletas aberto
    | 'finalizada'    // relação oficial gerada e bloqueada
    | 'cancelada';

export interface PagamentoInscricao {
    valor: number;
    status: 'pendente' | 'em_analise' | 'confirmado' | 'isento';
    metodo?: 'pix' | 'manual' | 'isento';
    transacaoId?: string;       // id da cobrança no provedor
    pixCopiaECola?: string;
    pixQrCodeUrl?: string;
    confirmadoEm?: string;
    confirmadoPor?: string;     // 'automatico' ou nome do admin
    comprovanteEnviadoUrl?: string; // comprovante anexado pelo responsável (aprovação manual)
    observacao?: string;
}

export interface AceiteRegulamento {
    versao: number;
    aceitoEm: string;
    nome: string;
    uid: string;
    etapa: 'cadastro' | 'finalizacao' | 'nova_versao';
}

export type DocumentoStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface AtletaEvento {
    id: string;
    nome: string;
    dataNascimento: string;     // YYYY-MM-DD
    camisa?: string;
    documentoUrl?: string;
    documentoNome?: string;
    documentoStatus: DocumentoStatus;
    motivoRejeicao?: string;
}

export interface Responsavel {
    uid: string;
    nome: string;
    email: string;
    telefone: string;
    cpf: string;
}

export interface RegistroAlteracao {
    em: string;
    por: string;
    acao: string;
    motivo?: string;
}

export interface ListaOficial {
    geradaEm: string;
    geradaPor: string;
    atletas: AtletaEvento[];
    regulamentoVersao?: number;
}

export interface EquipeEvento {
    id?: string;
    eventId: string;
    categoriaId: string;
    nome: string;
    grupo?: string;
    ownerUid: string;
    responsavel: Responsavel;
    tecnico?: string;
    status: InscricaoStatus;
    pagamento: PagamentoInscricao;
    atletas: AtletaEvento[];
    aceites: AceiteRegulamento[];
    listaOficial?: ListaOficial | null;
    finalizadaEm?: string | null;
    alteracoes?: RegistroAlteracao[];
    createdAt: string;
    updatedAt?: string;
}

export interface ResultadoCorrida {
    tempo: string;              // hh:mm:ss
    posicaoGeral?: number;
    posicaoCategoria?: number;
}

export interface InscricaoIndividual {
    id?: string;
    eventId: string;
    categoriaId: string;
    ownerUid: string;
    participante: {
        nome: string;
        dataNascimento: string;
        sexo: 'masculino' | 'feminino' | 'outro';
        cpf: string;
        telefone: string;
        email: string;
        camiseta?: string;
        cidade?: string;
        contatoEmergencia?: string;
    };
    documentoUrl?: string;
    documentoNome?: string;
    documentoStatus: DocumentoStatus;
    motivoRejeicao?: string;
    status: InscricaoStatus;
    pagamento: PagamentoInscricao;
    aceites: AceiteRegulamento[];
    numeroPeito?: number | null;
    resultado?: ResultadoCorrida | null;
    alteracoes?: RegistroAlteracao[];
    createdAt: string;
    updatedAt?: string;
}

/** Resumo público (mesmo id da equipe/inscrição) — sem dados pessoais. */
export interface VagaPublica {
    id?: string;
    eventId: string;
    categoriaId: string;
    tipo: 'equipe' | 'atleta';
    nome: string;
    status: InscricaoStatus;
    ownerUid: string;
    grupo?: string;
    numeroPeito?: number | null;
    resultado?: ResultadoCorrida | null;
    createdAt: string;
}

export type LanceTipo = 'gol' | 'gol_contra' | 'amarelo' | 'vermelho' | 'falta' | 'tempo';

export interface LanceSumula {
    id: string;
    tipo: LanceTipo;
    equipe: 'A' | 'B';
    periodo: number;            // 1..n (prorrogação continua a numeração)
    minuto?: string;
    atletaId?: string;
    atletaNome?: string;
    camisa?: string;
    registradoEm: string;
    registradoPor: string;
}

export interface Arbitragem {
    principal?: string;
    auxiliar?: string;
    anotador?: string;
    cronometrista?: string;
}

export type JogoStatus = 'agendado' | 'em_andamento' | 'encerrado' | 'wo';

export interface JogoEvento {
    id?: string;
    eventId: string;
    categoriaId: string;
    numero: number;
    fase: string;               // "1ª Rodada", "Quartas de final"...
    grupo?: string;
    eliminatoria?: boolean;     // mata-mata: não soma na classificação
    equipeAId: string;
    equipeANome: string;
    equipeBId: string;
    equipeBNome: string;
    data?: string;              // YYYY-MM-DD
    horario?: string;           // HH:mm
    local?: string;
    arbitragem?: Arbitragem;
    status: JogoStatus;
    placarA?: number | null;
    placarB?: number | null;
    penaltisA?: number | null;
    penaltisB?: number | null;
    lances?: LanceSumula[];
    ocorrencias?: string;
    encerradoEm?: string | null;
    encerradoPor?: string | null;
    createdAt: string;
    updatedAt?: string;
}
