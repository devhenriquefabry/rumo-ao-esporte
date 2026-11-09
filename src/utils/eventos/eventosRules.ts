/**
 * Regras de negócio puras do módulo de eventos (sem Firestore, sem React).
 * Mantidas isoladas para poderem ser conferidas/testadas sem banco.
 */
import type {
    CriterioDesempate,
    Evento,
    EventoCategoria,
    EventoFormato,
    InscricaoStatus,
    JogoEvento,
    TempoDeJogo,
    InscricaoIndividual,
} from '../../types/eventos';

/** Mensagem legível de um erro desconhecido. */
export const mensagemErro = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

export const novoId = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        : Math.random().toString(36).slice(2, 14);

export const TEMPO_PADRAO: TempoDeJogo = {
    periodos: 2,
    duracaoMin: 10,
    intervaloMin: 5,
    prorrogacaoPeriodos: 0,
    prorrogacaoMin: 0,
};

export const novaCategoria = (parcial: Partial<EventoCategoria> = {}): EventoCategoria => ({
    id: novoId(),
    nome: '',
    anoNascimentoMin: null,
    anoNascimentoMax: null,
    sexo: 'misto',
    maxInscricoes: 0,
    maxAtletas: 12,
    minAtletas: 5,
    valor: 0,
    tempo: { ...TEMPO_PADRAO },
    faltasPorPeriodo: 5,
    temposPorPeriodo: 1,
    distancia: '',
    observacoes: '',
    ...parcial,
});

export const CRITERIOS_PADRAO: CriterioDesempate[] = [
    'pontos', 'vitorias', 'saldo_gols', 'gols_pro', 'confronto_direto', 'menos_cartoes_vermelhos', 'menos_cartoes_amarelos',
];

export const novoEvento = (tipo: Evento['tipo'] = 'equipes'): Evento => {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
        tipo,
        modalidade: tipo === 'individual' ? 'corrida' : 'futsal',
        nome: '',
        descricao: '',
        bannerUrl: '',
        dataInicio: hoje,
        dataFim: '',
        local: '',
        inscricoesInicio: hoje,
        inscricoesFim: hoje,
        status: 'rascunho',
        formato: tipo === 'individual' ? 'manual' : 'todos_contra_todos',
        pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
        criteriosDesempate: [...CRITERIOS_PADRAO],
        regrasEspecificas: '',
        orientacoesKit: '',
        exigirDocumento: true,
        categorias: [],
        regulamento: null,
        regulamentoHistorico: [],
    };
};

// ---------- Rótulos ----------

export const MODALIDADES = [
    { id: 'futsal', label: 'Futsal' },
    { id: 'futebol', label: 'Futebol de Campo' },
    { id: 'society', label: 'Futebol Society' },
    { id: 'volei', label: 'Vôlei' },
    { id: 'basquete', label: 'Basquete' },
    { id: 'handebol', label: 'Handebol' },
    { id: 'corrida', label: 'Corrida de Rua' },
    { id: 'caminhada', label: 'Caminhada' },
    { id: 'ciclismo', label: 'Ciclismo' },
    { id: 'outro', label: 'Outra modalidade' },
];

export const modalidadeLabel = (id: string) => MODALIDADES.find(m => m.id === id)?.label || id;

export const FORMATOS: { id: EventoFormato; label: string }[] = [
    { id: 'todos_contra_todos', label: 'Todos contra todos' },
    { id: 'mata_mata', label: 'Mata-mata' },
    { id: 'grupos', label: 'Fase de grupos' },
    { id: 'grupos_mata_mata', label: 'Grupos + eliminatórias' },
    { id: 'manual', label: 'Confrontos manuais' },
];

export const formatoLabel = (id: EventoFormato) => FORMATOS.find(f => f.id === id)?.label || id;

export const CRITERIOS: { id: CriterioDesempate; label: string }[] = [
    { id: 'pontos', label: 'Pontos' },
    { id: 'vitorias', label: 'Número de vitórias' },
    { id: 'saldo_gols', label: 'Saldo de gols' },
    { id: 'gols_pro', label: 'Gols marcados' },
    { id: 'menos_gols_contra', label: 'Menos gols sofridos' },
    { id: 'confronto_direto', label: 'Confronto direto' },
    { id: 'menos_cartoes_vermelhos', label: 'Menos cartões vermelhos' },
    { id: 'menos_cartoes_amarelos', label: 'Menos cartões amarelos' },
];

export const criterioLabel = (id: CriterioDesempate) => CRITERIOS.find(c => c.id === id)?.label || id;

export const STATUS_INSCRICAO: Record<InscricaoStatus, { label: string; cor: string; fundo: string }> = {
    aguardando_pagamento: { label: 'Aguardando pagamento', cor: '#b45309', fundo: '#fef3c7' },
    pagamento_em_analise: { label: 'Pagamento em análise', cor: '#1d4ed8', fundo: '#dbeafe' },
    liberada: { label: 'Cadastro de atletas aberto', cor: '#047857', fundo: '#d1fae5' },
    finalizada: { label: 'Inscrição finalizada', cor: '#ffffff', fundo: '#00a63a' },
    cancelada: { label: 'Cancelada', cor: '#991b1b', fundo: '#fee2e2' },
};

// ---------- Datas e valores ----------

export const formatarMoeda = (valor: number) =>
    (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarData = (iso?: string | null) => {
    if (!iso) return '-';
    const [y, m, d] = iso.slice(0, 10).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
};

export const formatarDataHora = (iso?: string | null) => {
    if (!iso) return '-';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const inscricoesAbertas = (evento: Evento, hoje = hojeISO()) =>
    evento.status === 'publicado' && hoje >= evento.inscricoesInicio && hoje <= evento.inscricoesFim;

export const situacaoInscricoes = (evento: Evento, hoje = hojeISO()) => {
    if (evento.status === 'encerrado') return 'Evento encerrado';
    if (evento.status !== 'publicado') return 'Em preparação';
    if (hoje < evento.inscricoesInicio) return `Inscrições a partir de ${formatarData(evento.inscricoesInicio)}`;
    if (hoje > evento.inscricoesFim) return 'Inscrições encerradas';
    return `Inscrições abertas até ${formatarData(evento.inscricoesFim)}`;
};

// ---------- Tempo de jogo ----------

/** Texto do cabeçalho da súmula, ex.: "2 x 8 MINUTOS · INTERVALO 5 MIN · PRORROGAÇÃO 2 x 3 MIN". */
export const formatarTempoDeJogo = (tempo?: TempoDeJogo | null) => {
    if (!tempo || !tempo.periodos || !tempo.duracaoMin) return 'TEMPO A DEFINIR';
    const partes = [`${tempo.periodos} x ${tempo.duracaoMin} MINUTOS`];
    if (tempo.intervaloMin > 0) partes.push(`INTERVALO ${tempo.intervaloMin} MIN`);
    if (tempo.prorrogacaoPeriodos > 0 && tempo.prorrogacaoMin > 0) {
        partes.push(`PRORROGAÇÃO ${tempo.prorrogacaoPeriodos} x ${tempo.prorrogacaoMin} MIN`);
    }
    return partes.join(' · ');
};

/** Nomes dos períodos usados em faltas/pedidos de tempo/placar parcial. */
export const nomesPeriodos = (tempo?: TempoDeJogo | null, incluirProrrogacao = true) => {
    const nomes: string[] = [];
    const periodos = Math.max(1, tempo?.periodos || 1);
    for (let i = 1; i <= periodos; i++) nomes.push(periodos === 2 ? `${i}º TEMPO` : `${i}º PERÍODO`);
    if (incluirProrrogacao && tempo && tempo.prorrogacaoPeriodos > 0 && tempo.prorrogacaoMin > 0) {
        for (let i = 1; i <= tempo.prorrogacaoPeriodos; i++) nomes.push(`PRORR. ${i}`);
    }
    return nomes;
};

// ---------- Idade ----------

export const anoDe = (dataISO: string) => Number((dataISO || '').slice(0, 4)) || 0;

export const faixaEtariaTexto = (cat: EventoCategoria) => {
    const min = cat.anoNascimentoMin, max = cat.anoNascimentoMax;
    if (min && max) return min === max ? `Nascidos em ${min}` : `Nascidos entre ${min} e ${max}`;
    if (min) return `Nascidos a partir de ${min}`;
    if (max) return `Nascidos até ${max}`;
    return 'Livre';
};

/** Retorna a mensagem de erro, ou null se a data de nascimento atende a categoria. */
export const validarIdade = (cat: EventoCategoria, dataNascimento: string): string | null => {
    const ano = anoDe(dataNascimento);
    if (!ano) return 'Data de nascimento inválida.';
    if (cat.anoNascimentoMin && ano < cat.anoNascimentoMin) {
        return `Atleta nascido em ${ano} não pode jogar na categoria ${cat.nome} (${faixaEtariaTexto(cat)}).`;
    }
    if (cat.anoNascimentoMax && ano > cat.anoNascimentoMax) {
        return `Atleta nascido em ${ano} não pode jogar na categoria ${cat.nome} (${faixaEtariaTexto(cat)}).`;
    }
    return null;
};

// ---------- Vagas ----------

export const vagasRestantes = (cat: EventoCategoria, ocupadas: number) =>
    cat.maxInscricoes > 0 ? Math.max(0, cat.maxInscricoes - ocupadas) : Infinity;

// ---------- Confrontos ----------

/**
 * Tabela "todos contra todos" pelo método do círculo.
 * Retorna as rodadas com os pares [mandante, visitante]; equipe sem par folga.
 */
export const gerarTodosContraTodos = <T>(equipes: T[], idaEVolta = false): [T, T][][] => {
    if (equipes.length < 2) return [];
    const lista: (T | null)[] = [...equipes];
    if (lista.length % 2 === 1) lista.push(null);
    const n = lista.length;
    const rodadas: [T, T][][] = [];

    for (let r = 0; r < n - 1; r++) {
        const rodada: [T, T][] = [];
        for (let i = 0; i < n / 2; i++) {
            const a = lista[i];
            const b = lista[n - 1 - i];
            if (a !== null && b !== null) rodada.push(r % 2 === 0 ? [a, b] : [b, a]);
        }
        rodadas.push(rodada);
        // gira mantendo o primeiro fixo
        lista.splice(1, 0, lista.pop() as T | null);
    }

    if (idaEVolta) {
        const volta = rodadas.map(r => r.map(([a, b]) => [b, a] as [T, T]));
        return [...rodadas, ...volta];
    }
    return rodadas;
};

// ---------- Classificação ----------

export interface LinhaClassificacao {
    equipeId: string;
    nome: string;
    grupo?: string;
    pontos: number;
    jogos: number;
    vitorias: number;
    empates: number;
    derrotas: number;
    golsPro: number;
    golsContra: number;
    saldo: number;
    amarelos: number;
    vermelhos: number;
}

const jogoContabilizado = (j: JogoEvento) =>
    (j.status === 'encerrado' || j.status === 'wo') && j.placarA != null && j.placarB != null;

const contarCartoes = (j: JogoEvento, lado: 'A' | 'B', tipo: 'amarelo' | 'vermelho') =>
    (j.lances || []).filter(l => l.equipe === lado && l.tipo === tipo).length;

/**
 * Classificação de um conjunto de equipes a partir dos jogos encerrados,
 * ordenada pelos critérios do evento (na ordem configurada pelo organizador).
 */
export const calcularClassificacao = (
    equipes: { id: string; nome: string; grupo?: string }[],
    jogos: JogoEvento[],
    pontuacao: Evento['pontuacao'],
    criterios: CriterioDesempate[],
): LinhaClassificacao[] => {
    const tabela = new Map<string, LinhaClassificacao>();
    equipes.forEach(e => tabela.set(e.id, {
        equipeId: e.id, nome: e.nome, grupo: e.grupo,
        pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0,
        golsPro: 0, golsContra: 0, saldo: 0, amarelos: 0, vermelhos: 0,
    }));

    const validos = jogos.filter(j => jogoContabilizado(j) && tabela.has(j.equipeAId) && tabela.has(j.equipeBId));

    validos.forEach(j => {
        const a = tabela.get(j.equipeAId)!;
        const b = tabela.get(j.equipeBId)!;
        const ga = Number(j.placarA), gb = Number(j.placarB);
        a.jogos++; b.jogos++;
        a.golsPro += ga; a.golsContra += gb;
        b.golsPro += gb; b.golsContra += ga;
        a.amarelos += contarCartoes(j, 'A', 'amarelo');
        a.vermelhos += contarCartoes(j, 'A', 'vermelho');
        b.amarelos += contarCartoes(j, 'B', 'amarelo');
        b.vermelhos += contarCartoes(j, 'B', 'vermelho');
        if (ga > gb) { a.vitorias++; b.derrotas++; a.pontos += pontuacao.vitoria; b.pontos += pontuacao.derrota; }
        else if (gb > ga) { b.vitorias++; a.derrotas++; b.pontos += pontuacao.vitoria; a.pontos += pontuacao.derrota; }
        else { a.empates++; b.empates++; a.pontos += pontuacao.empate; b.pontos += pontuacao.empate; }
    });
    tabela.forEach(l => { l.saldo = l.golsPro - l.golsContra; });

    // Pontos no confronto direto entre duas equipes empatadas
    const confrontoDireto = (x: string, y: string) => {
        let px = 0, py = 0;
        validos.forEach(j => {
            const ids = [j.equipeAId, j.equipeBId];
            if (!ids.includes(x) || !ids.includes(y)) return;
            const gx = j.equipeAId === x ? Number(j.placarA) : Number(j.placarB);
            const gy = j.equipeAId === x ? Number(j.placarB) : Number(j.placarA);
            if (gx > gy) px += pontuacao.vitoria; else if (gy > gx) py += pontuacao.vitoria;
            else { px += pontuacao.empate; py += pontuacao.empate; }
        });
        return py - px;
    };

    const ordem = criterios.length ? criterios : CRITERIOS_PADRAO;
    const comparar = (x: LinhaClassificacao, y: LinhaClassificacao) => {
        for (const c of ordem) {
            let d = 0;
            switch (c) {
                case 'pontos': d = y.pontos - x.pontos; break;
                case 'vitorias': d = y.vitorias - x.vitorias; break;
                case 'saldo_gols': d = y.saldo - x.saldo; break;
                case 'gols_pro': d = y.golsPro - x.golsPro; break;
                case 'menos_gols_contra': d = x.golsContra - y.golsContra; break;
                case 'confronto_direto': d = confrontoDireto(x.equipeId, y.equipeId); break;
                case 'menos_cartoes_vermelhos': d = x.vermelhos - y.vermelhos; break;
                case 'menos_cartoes_amarelos': d = x.amarelos - y.amarelos; break;
            }
            if (d !== 0) return d;
        }
        return x.nome.localeCompare(y.nome, 'pt-BR');
    };

    return Array.from(tabela.values()).sort(comparar);
};

/** Agrupa as equipes de uma categoria por grupo (ou um bloco único). */
export function blocosDeClassificacao(evento: Evento, categoriaId: string, equipes: { id: string; nome: string; grupo?: string }[], jogos: JogoEvento[]) {
    const daCategoria = equipes;
    // Jogos eliminatórios (mata-mata) não contam pontos na tabela
    const jogosCat = jogos.filter(j => j.categoriaId === categoriaId && !j.eliminatoria);
    const grupos = Array.from(new Set(daCategoria.map(e => (e.grupo || '').trim()).filter(Boolean))).sort();
    if (!grupos.length) {
        return [{ titulo: 'Classificação geral', linhas: calcularClassificacao(daCategoria, jogosCat, evento.pontuacao, evento.criteriosDesempate) }];
    }
    return grupos.map(g => ({
        titulo: `Grupo ${g}`,
        linhas: calcularClassificacao(daCategoria.filter(e => (e.grupo || '').trim() === g), jogosCat, evento.pontuacao, evento.criteriosDesempate),
    }));
}


// ---------- Corrida ----------

/** "1:02:03", "25:40" ou "1:2:3" → segundos. Retorna null se inválido. */
export const tempoParaSegundos = (tempo?: string | null): number | null => {
    if (!tempo) return null;
    const partes = tempo.trim().split(':').map(p => Number(p));
    if (!partes.length || partes.some(p => Number.isNaN(p) || p < 0)) return null;
    return partes.reduce((acc, p) => acc * 60 + p, 0);
};

export const normalizarTempo = (tempo: string): string | null => {
    const s = tempoParaSegundos(tempo);
    if (s === null) return null;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = Math.round(s % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
};

/** Calcula posição geral (por distância) e por categoria a partir dos tempos cadastrados. */
export const calcularResultadosCorrida = (
    inscricoes: InscricaoIndividual[],
    categorias: EventoCategoria[],
): Map<string, { posicaoGeral: number; posicaoCategoria: number }> => {
    const resultado = new Map<string, { posicaoGeral: number; posicaoCategoria: number }>();
    const comTempo = inscricoes
        .filter(i => i.id && i.status !== 'cancelada' && tempoParaSegundos(i.resultado?.tempo) !== null)
        .sort((a, b) => (tempoParaSegundos(a.resultado?.tempo) as number) - (tempoParaSegundos(b.resultado?.tempo) as number));

    const distanciaDe = (catId: string) => categorias.find(c => c.id === catId)?.distancia?.trim().toLowerCase() || catId;
    const contGeral = new Map<string, number>();
    const contCategoria = new Map<string, number>();

    comTempo.forEach(i => {
        const dist = distanciaDe(i.categoriaId);
        const g = (contGeral.get(dist) || 0) + 1;
        const c = (contCategoria.get(i.categoriaId) || 0) + 1;
        contGeral.set(dist, g);
        contCategoria.set(i.categoriaId, c);
        resultado.set(i.id!, { posicaoGeral: g, posicaoCategoria: c });
    });
    return resultado;
};
