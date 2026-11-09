/**
 * PDFs do módulo de eventos: comprovantes, lista oficial, listas de inscritos,
 * resultados e a SÚMULA OFICIAL.
 *
 * A súmula segue a estrutura visual do modelo da REAL, mas nada nela é fixo:
 * tempo de jogo, quantidade de períodos, caixas de faltas, pedidos de tempo e
 * quantidade de linhas de atletas vêm da configuração da categoria e da lista
 * oficial de cada equipe.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
    AtletaEvento, Evento, EventoCategoria, EquipeEvento, InscricaoIndividual, JogoEvento, PagamentoInscricao, LanceSumula,
} from '../../types/eventos';
import {
    formatarData, formatarDataHora, formatarMoeda, formatarTempoDeJogo, nomesPeriodos, faixaEtariaTexto, modalidadeLabel,
    tempoParaSegundos,
} from './eventosRules';

const ASSOCIACAO = {
    nome: 'ASSOCIAÇÃO RUMO AO ESPORTE E AO LAZER – REAL',
    cnpj: '60.642.277/0001-40',
    cidade: 'Martins Soares/MG',
    logo: '/rumo-ao-esporte-logo.png',
};

const AZUL: [number, number, number] = [23, 66, 143];
const VERDE: [number, number, number] = [0, 166, 58];
const CINZA: [number, number, number] = [99, 112, 138];

let logoCache: string | null | undefined;

async function carregarLogo(): Promise<string | null> {
    if (logoCache !== undefined) return logoCache;
    logoCache = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = 300;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);
                ctx.drawImage(img, 0, 0, 300, 300);
                resolve(canvas.toDataURL('image/png'));
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = ASSOCIACAO.logo;
    });
    return logoCache;
}

export type ModoPdf = 'baixar' | 'imprimir' | 'visualizar';

/** Entrega o PDF: download, impressão direta ou nova aba. */
export function entregarPdf(doc: jsPDF, nomeArquivo: string, modo: ModoPdf = 'baixar') {
    if (modo === 'baixar') {
        doc.save(nomeArquivo);
        return;
    }
    if (modo === 'imprimir') doc.autoPrint();
    const url = doc.output('bloburl');
    const aba = window.open(url as unknown as string, '_blank');
    if (!aba) doc.save(nomeArquivo); // bloqueador de pop-up: cai para download
}

/** Posição Y onde terminou a última tabela do jspdf-autotable. */
const fimTabela = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const nomeSeguro = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60);

/** Ajusta a fonte para o texto caber; se ainda assim não couber, corta com reticências. */
function textoAjustado(doc: jsPDF, texto: string, x: number, y: number, larguraMax: number, tamanho: number, opcoes: { align?: 'left' | 'center' | 'right'; min?: number } = {}) {
    const min = opcoes.min ?? 5.5;
    let t = tamanho;
    doc.setFontSize(t);
    while (doc.getTextWidth(texto) > larguraMax && t > min) {
        t -= 0.25;
        doc.setFontSize(t);
    }
    let final = texto;
    if (doc.getTextWidth(final) > larguraMax) {
        while (final.length > 1 && doc.getTextWidth(final + '…') > larguraMax) final = final.slice(0, -1);
        final += '…';
    }
    doc.text(final, x, y, { align: opcoes.align || 'left' });
    doc.setFontSize(tamanho);
}

async function cabecalhoDocumento(doc: jsPDF, titulo: string, subtitulo?: string) {
    const largura = doc.internal.pageSize.getWidth();
    const logo = await carregarLogo();
    if (logo) doc.addImage(logo, 'PNG', 12, 8, 22, 22);
    doc.setTextColor(...AZUL);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(ASSOCIACAO.nome, largura / 2, 14, { align: 'center' });
    doc.setFontSize(15);
    doc.setTextColor(...VERDE);
    doc.text(titulo, largura / 2, 22, { align: 'center' });
    if (subtitulo) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...CINZA);
        doc.text(subtitulo, largura / 2, 28, { align: 'center' });
    }
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.8);
    doc.line(12, 33, largura - 12, 33);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
}

function rodape(doc: jsPDF, texto: string) {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...CINZA);
        doc.text(`${texto} · Página ${i} de ${total}`, w / 2, h - 6, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
}

function linhasChaveValor(doc: jsPDF, linhas: [string, string][], yInicial: number) {
    autoTable(doc, {
        startY: yInicial,
        body: linhas,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [240, 246, 252] } },
        margin: { left: 14, right: 14 },
    });
    return fimTabela(doc);
}

const ordenarAtletas = (lista: AtletaEvento[]) => [...lista].sort((a, b) => {
    const na = parseInt(a.camisa || '', 10), nb = parseInt(b.camisa || '', 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    if (!Number.isNaN(na) && Number.isNaN(nb)) return -1;
    if (Number.isNaN(na) && !Number.isNaN(nb)) return 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
});

// =====================================================================
// Comprovantes
// =====================================================================

export async function pdfComprovantePagamento(params: {
    evento: Evento;
    categoria?: EventoCategoria;
    inscritoNome: string;       // equipe ou corredor
    responsavelNome: string;
    responsavelCpf?: string;
    pagamento: PagamentoInscricao;
    inscricaoId: string;
}, modo: ModoPdf = 'baixar') {
    const { evento, categoria, pagamento } = params;
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'COMPROVANTE DE PAGAMENTO', 'Taxa de inscrição em evento');
    const y = linhasChaveValor(doc, [
        ['Evento', evento.nome],
        ['Categoria', categoria?.nome || '-'],
        [evento.tipo === 'equipes' ? 'Equipe' : 'Participante', params.inscritoNome],
        ['Responsável', params.responsavelNome + (params.responsavelCpf ? ` (CPF ${params.responsavelCpf})` : '')],
        ['Valor', pagamento.status === 'isento' ? 'Isento (evento gratuito)' : formatarMoeda(pagamento.valor)],
        ['Forma de pagamento', pagamento.metodo === 'manual' ? 'Aprovação manual' : pagamento.metodo === 'isento' ? '-' : 'PIX'],
        ['Data da confirmação', formatarDataHora(pagamento.confirmadoEm)],
        ['Confirmado por', pagamento.confirmadoPor === 'automatico' ? 'Confirmação automática do banco' : (pagamento.confirmadoPor || '-')],
        ['Identificação da transação', pagamento.transacaoId || '-'],
        ['Nº da inscrição', params.inscricaoId],
    ], 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text(
        doc.splitTextToSize(`Declaramos, para os devidos fins, que recebemos o valor acima referente à inscrição no evento "${evento.nome}". ${ASSOCIACAO.nome} · CNPJ ${ASSOCIACAO.cnpj} · ${ASSOCIACAO.cidade}.`, 180),
        14, y + 10,
    );
    rodape(doc, `Emitido em ${formatarDataHora(new Date().toISOString())}`);
    entregarPdf(doc, `comprovante-pagamento-${nomeSeguro(params.inscritoNome)}.pdf`, modo);
}

export async function pdfComprovanteInscricao(evento: Evento, categoria: EventoCategoria | undefined, insc: InscricaoIndividual, modo: ModoPdf = 'baixar') {
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'COMPROVANTE DE INSCRIÇÃO', evento.nome);
    let y = linhasChaveValor(doc, [
        ['Participante', insc.participante.nome],
        ['Data de nascimento', formatarData(insc.participante.dataNascimento)],
        ['CPF', insc.participante.cpf],
        ['Categoria', categoria?.nome || '-'],
        ['Distância / modalidade', categoria?.distancia || modalidadeLabel(evento.modalidade)],
        ['Número de peito', insc.numeroPeito ? String(insc.numeroPeito) : 'Será divulgado pela organização'],
        ['Data do evento', formatarData(evento.dataInicio)],
        ['Local', evento.local || '-'],
        ['Pagamento', insc.pagamento.status === 'isento' ? 'Isento' : insc.pagamento.status === 'confirmado' ? `Confirmado — ${formatarMoeda(insc.pagamento.valor)}` : 'Pendente'],
        ['Regulamento aceito', insc.aceites.length ? `Versão ${insc.aceites[insc.aceites.length - 1].versao} em ${formatarDataHora(insc.aceites[insc.aceites.length - 1].aceitoEm)}` : '-'],
        ['Nº da inscrição', insc.id || '-'],
    ], 42);

    if (evento.orientacoesKit) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...AZUL);
        doc.text('ORIENTAÇÕES PARA RETIRADA DO KIT', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(doc.splitTextToSize(evento.orientacoesKit, 182), 14, y + 6);
    }
    rodape(doc, `Emitido em ${formatarDataHora(new Date().toISOString())}`);
    entregarPdf(doc, `comprovante-inscricao-${nomeSeguro(insc.participante.nome)}.pdf`, modo);
}

// =====================================================================
// Lista oficial de atletas
// =====================================================================

export async function pdfListaOficial(evento: Evento, categoria: EventoCategoria | undefined, equipe: EquipeEvento, modo: ModoPdf = 'baixar') {
    const lista = equipe.listaOficial;
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'LISTA OFICIAL DE ATLETAS', `${evento.nome} · ${categoria?.nome || ''}`);

    const y = linhasChaveValor(doc, [
        ['Equipe', equipe.nome],
        ['Categoria', `${categoria?.nome || '-'} (${categoria ? faixaEtariaTexto(categoria) : ''})`],
        ['Responsável', `${equipe.responsavel.nome} · ${equipe.responsavel.telefone}`],
        ['Técnico', equipe.tecnico || '-'],
        ['Atletas inscritos', `${lista?.atletas.length || 0} de ${categoria?.maxAtletas || '-'} permitidos`],
        ['Finalizada em', `${formatarDataHora(lista?.geradaEm)} por ${lista?.geradaPor || '-'}`],
        ['Regulamento aceito', lista?.regulamentoVersao ? `Versão ${lista.regulamentoVersao}` : '-'],
    ], 40);

    autoTable(doc, {
        startY: y + 6,
        head: [['#', 'Nº', 'Nome completo', 'Nascimento', 'Documento']],
        body: ordenarAtletas(lista?.atletas || []).map((a, i) => [
            String(i + 1), a.camisa || '-', a.nome, formatarData(a.dataNascimento),
            a.documentoStatus === 'aprovado' ? 'Aprovado' : a.documentoStatus === 'rejeitado' ? 'Rejeitado' : (a.documentoUrl ? 'Em análise' : 'Não enviado'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: AZUL, fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 28 }, 4: { cellWidth: 28 } },
        margin: { left: 14, right: 14 },
    });

    let yAss = fimTabela(doc) + 25;
    if (yAss > 270) { doc.addPage(); yAss = 40; }
    doc.line(20, yAss, 95, yAss);
    doc.line(115, yAss, 190, yAss);
    doc.setFontSize(8);
    doc.text('Responsável pela equipe', 57.5, yAss + 4, { align: 'center' });
    doc.text('Organização – REAL', 152.5, yAss + 4, { align: 'center' });

    rodape(doc, `Lista oficial · ${equipe.nome} · Documento gerado pelo sistema REAL`);
    entregarPdf(doc, `lista-oficial-${nomeSeguro(equipe.nome)}.pdf`, modo);
}

// =====================================================================
// Listas administrativas
// =====================================================================

export async function pdfListaInscritosCorrida(evento: Evento, inscricoes: InscricaoIndividual[], modo: ModoPdf = 'baixar') {
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'LISTA DE INSCRITOS', evento.nome);
    let y = 40;
    evento.categorias.forEach((cat) => {
        const daCat = inscricoes.filter(i => i.categoriaId === cat.id && i.status !== 'cancelada')
            .sort((a, b) => (a.numeroPeito || 99999) - (b.numeroPeito || 99999) || a.participante.nome.localeCompare(b.participante.nome, 'pt-BR'));
        if (!daCat.length) return;
        autoTable(doc, {
            startY: y,
            head: [[{ content: `${cat.nome}${cat.distancia ? ` · ${cat.distancia}` : ''} (${daCat.length})`, colSpan: 5 }], ['Peito', 'Nome', 'Nascimento', 'Pagamento', 'Documento']],
            body: daCat.map(i => [
                i.numeroPeito ? String(i.numeroPeito) : '-', i.participante.nome, formatarData(i.participante.dataNascimento),
                i.pagamento.status === 'confirmado' || i.pagamento.status === 'isento' ? 'OK' : 'Pendente',
                i.documentoStatus === 'aprovado' ? 'Aprovado' : i.documentoStatus === 'rejeitado' ? 'Rejeitado' : 'Pendente',
            ]),
            headStyles: { fillColor: AZUL, fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 1.8 },
            margin: { left: 14, right: 14 },
        });
        y = fimTabela(doc) + 8;
    });
    rodape(doc, `Gerado em ${formatarDataHora(new Date().toISOString())}`);
    entregarPdf(doc, `inscritos-${nomeSeguro(evento.nome)}.pdf`, modo);
}

export async function pdfResultadosCorrida(evento: Evento, inscricoes: InscricaoIndividual[], modo: ModoPdf = 'baixar') {
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'RESULTADOS', evento.nome);
    let y = 40;
    evento.categorias.forEach((cat) => {
        const daCat = inscricoes
            .filter(i => i.categoriaId === cat.id && tempoParaSegundos(i.resultado?.tempo) !== null)
            .sort((a, b) => (a.resultado?.posicaoCategoria || 9999) - (b.resultado?.posicaoCategoria || 9999));
        if (!daCat.length) return;
        autoTable(doc, {
            startY: y,
            head: [[{ content: `${cat.nome}${cat.distancia ? ` · ${cat.distancia}` : ''}`, colSpan: 5 }], ['Cat.', 'Geral', 'Peito', 'Nome', 'Tempo']],
            body: daCat.map(i => [
                `${i.resultado?.posicaoCategoria || '-'}º`, `${i.resultado?.posicaoGeral || '-'}º`,
                i.numeroPeito ? String(i.numeroPeito) : '-', i.participante.nome, i.resultado?.tempo || '-',
            ]),
            headStyles: { fillColor: VERDE, fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 1.8 },
            margin: { left: 14, right: 14 },
        });
        y = fimTabela(doc) + 8;
    });
    rodape(doc, `Gerado em ${formatarDataHora(new Date().toISOString())}`);
    entregarPdf(doc, `resultados-${nomeSeguro(evento.nome)}.pdf`, modo);
}

export async function pdfClassificacao(evento: Evento, titulo: string, blocos: { titulo: string; linhas: { nome: string; pontos: number; jogos: number; vitorias: number; empates: number; derrotas: number; golsPro: number; golsContra: number; saldo: number }[] }[], modo: ModoPdf = 'baixar') {
    const doc = new jsPDF();
    await cabecalhoDocumento(doc, 'CLASSIFICAÇÃO', `${evento.nome} · ${titulo}`);
    let y = 40;
    blocos.forEach(b => {
        autoTable(doc, {
            startY: y,
            head: [[{ content: b.titulo, colSpan: 10 }], ['#', 'Equipe', 'P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG']],
            body: b.linhas.map((l, i) => [`${i + 1}º`, l.nome, l.pontos, l.jogos, l.vitorias, l.empates, l.derrotas, l.golsPro, l.golsContra, l.saldo]),
            headStyles: { fillColor: AZUL, fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 1.8, halign: 'center' },
            columnStyles: { 1: { halign: 'left' } },
            margin: { left: 14, right: 14 },
        });
        y = fimTabela(doc) + 8;
    });
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text('P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols pró · GC: gols contra · SG: saldo', 14, Math.min(y + 2, 285));
    rodape(doc, `Gerado em ${formatarDataHora(new Date().toISOString())}`);
    entregarPdf(doc, `classificacao-${nomeSeguro(evento.nome)}.pdf`, modo);
}

// =====================================================================
// SÚMULA OFICIAL
// =====================================================================

export interface DadosSumula {
    evento: Evento;
    jogo: JogoEvento;
    categoria?: EventoCategoria;
    equipeA?: EquipeEvento | null;
    equipeB?: EquipeEvento | null;
}

const PAG_W = 210;
const PAG_H = 297;
const MARGEM = 8;
const LARG_UTIL = PAG_W - MARGEM * 2;

function caixa(doc: jsPDF, x: number, y: number, w: number, h: number, rotulo: string, valor?: string, tamValor = 8.5) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...CINZA);
    doc.text(rotulo, x + 1.2, y + 2.4);
    if (valor) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        textoAjustado(doc, valor, x + 1.2, y + h - 1.6, w - 2.4, tamValor);
    }
    doc.setTextColor(0, 0, 0);
}

function faixaTitulo(doc: jsPDF, x: number, y: number, w: number, h: number, texto: string, cor: [number, number, number] = AZUL) {
    doc.setFillColor(...cor);
    doc.rect(x, y, w, h, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    textoAjustado(doc, texto, x + w / 2, y + h - 1.5, w - 3, 8, { align: 'center' });
    doc.setTextColor(0, 0, 0);
}

interface ResumoLances {
    golsPorAtleta: Map<string, number>;
    amarelos: Set<string>;
    vermelhos: Set<string>;
    faltas: Record<'A' | 'B', number[]>;
    tempos: Record<'A' | 'B', number[]>;
    placarPeriodo: Record<'A' | 'B', number[]>;
    gols: Record<'A' | 'B', LanceSumula[]>;
}

function resumirLances(lances: LanceSumula[], totalPeriodos: number): ResumoLances {
    const r: ResumoLances = {
        golsPorAtleta: new Map(), amarelos: new Set(), vermelhos: new Set(),
        faltas: { A: Array(totalPeriodos).fill(0), B: Array(totalPeriodos).fill(0) },
        tempos: { A: Array(totalPeriodos).fill(0), B: Array(totalPeriodos).fill(0) },
        placarPeriodo: { A: Array(totalPeriodos).fill(0), B: Array(totalPeriodos).fill(0) },
        gols: { A: [], B: [] },
    };
    lances.forEach(l => {
        const p = Math.min(Math.max(1, l.periodo), totalPeriodos) - 1;
        const outro = l.equipe === 'A' ? 'B' : 'A';
        switch (l.tipo) {
            case 'gol':
                r.placarPeriodo[l.equipe][p]++;
                r.gols[l.equipe].push(l);
                if (l.atletaId) r.golsPorAtleta.set(l.atletaId, (r.golsPorAtleta.get(l.atletaId) || 0) + 1);
                break;
            case 'gol_contra':
                r.placarPeriodo[outro][p]++;
                r.gols[outro].push(l);
                break;
            case 'amarelo': if (l.atletaId) r.amarelos.add(l.atletaId); break;
            case 'vermelho': if (l.atletaId) r.vermelhos.add(l.atletaId); break;
            case 'falta': r.faltas[l.equipe][p]++; break;
            case 'tempo': r.tempos[l.equipe][p]++; break;
        }
    });
    return r;
}

/** Desenha uma súmula (uma ou mais páginas) no documento já aberto. */
async function desenharSumula(doc: jsPDF, dados: DadosSumula, primeira: boolean) {
    const { evento, jogo, categoria } = dados;
    const tempo = categoria?.tempo;
    const periodos = nomesPeriodos(tempo, true);
    const preenchida = (jogo.lances?.length || 0) > 0;
    const resumo = resumirLances(jogo.lances || [], periodos.length);
    const logo = await carregarLogo();

    const atletasA = ordenarAtletas(dados.equipeA?.listaOficial?.atletas || []);
    const atletasB = ordenarAtletas(dados.equipeB?.listaOficial?.atletas || []);
    const linhasTotal = Math.max(atletasA.length, atletasB.length, 1);

    if (!primeira) doc.addPage();

    // ---------- Cabeçalho ----------
    const cabecalho = (continuacao: boolean) => {
        let y = MARGEM;
        if (logo) doc.addImage(logo, 'PNG', MARGEM, y, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...AZUL);
        doc.setFontSize(8);
        doc.text(ASSOCIACAO.nome, PAG_W / 2, y + 4, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(...VERDE);
        doc.text(continuacao ? 'SÚMULA OFICIAL — CONTINUAÇÃO' : 'SÚMULA OFICIAL DE JOGO', PAG_W / 2, y + 11, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        textoAjustado(doc, evento.nome.toUpperCase(), PAG_W / 2, y + 17, 120, 10, { align: 'center' });

        // Nº do jogo
        doc.setDrawColor(...AZUL);
        doc.setLineWidth(0.6);
        doc.rect(PAG_W - MARGEM - 26, y, 26, 20);
        doc.setFontSize(6.5);
        doc.setTextColor(...AZUL);
        doc.text('JOGO Nº', PAG_W - MARGEM - 13, y + 5, { align: 'center' });
        doc.setFontSize(20);
        doc.text(String(jogo.numero).padStart(2, '0'), PAG_W - MARGEM - 13, y + 15.5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        y += 23;

        // Faixa com o tempo de jogo configurado na categoria
        faixaTitulo(doc, MARGEM, y, LARG_UTIL, 6, `TEMPO DE JOGO: ${formatarTempoDeJogo(tempo)}`, VERDE);
        return y + 7.5;
    };

    let y = cabecalho(false);

    // ---------- Identificação ----------
    const c3 = LARG_UTIL / 3;
    caixa(doc, MARGEM, y, c3, 8, 'CATEGORIA', categoria?.nome || '-');
    caixa(doc, MARGEM + c3, y, c3, 8, 'FASE / RODADA', jogo.fase || '-');
    caixa(doc, MARGEM + 2 * c3, y, c3, 8, 'GRUPO / CHAVE', jogo.grupo || '-');
    y += 8;
    caixa(doc, MARGEM, y, c3 * 0.7, 8, 'DATA', formatarData(jogo.data));
    caixa(doc, MARGEM + c3 * 0.7, y, c3 * 0.5, 8, 'HORÁRIO', jogo.horario || '-');
    caixa(doc, MARGEM + c3 * 1.2, y, LARG_UTIL - c3 * 1.2, 8, 'LOCAL', jogo.local || evento.local || '-');
    y += 8;
    const c4 = LARG_UTIL / 4;
    caixa(doc, MARGEM, y, c4, 8, 'ÁRBITRO PRINCIPAL', jogo.arbitragem?.principal);
    caixa(doc, MARGEM + c4, y, c4, 8, 'ÁRBITRO AUXILIAR', jogo.arbitragem?.auxiliar);
    caixa(doc, MARGEM + 2 * c4, y, c4, 8, 'ANOTADOR / MESÁRIO', jogo.arbitragem?.anotador);
    caixa(doc, MARGEM + 3 * c4, y, c4, 8, 'CRONOMETRISTA', jogo.arbitragem?.cronometrista);
    y += 10;

    // ---------- Relação de atletas ----------
    const gap = 4;
    const colW = (LARG_UTIL - gap) / 2;
    const cols = { num: 9, gols: 22, ca: 7, cv: 7 };
    const nomeW = colW - cols.num - cols.gols - cols.ca - cols.cv;

    // Espaço reservado para a parte de baixo (técnico, faltas, placar, gols, ocorrências, assinaturas)
    const alturaControle = 8 + periodos.length * 5.2 + 4;
    const alturaInferior = 9 + alturaControle + 18 + 18 + 20 + 26;

    const cabecalhoTabela = (yy: number) => {
        [{ eq: 'A', nome: jogo.equipeANome }, { eq: 'B', nome: jogo.equipeBNome }].forEach((t, i) => {
            const x = MARGEM + i * (colW + gap);
            faixaTitulo(doc, x, yy, colW, 6, `EQUIPE ${t.eq}: ${(t.nome || '').toUpperCase()}`);
            const yh = yy + 6;
            doc.setFillColor(235, 242, 250);
            doc.rect(x, yh, colW, 5, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            let cx = x;
            const heads: [string, number][] = [['Nº', cols.num], ['NOME DO ATLETA', nomeW], ['GOLS', cols.gols], ['CA', cols.ca], ['CV', cols.cv]];
            heads.forEach(([h, w]) => {
                doc.rect(cx, yh, w, 5);
                doc.text(h, cx + w / 2, yh + 3.5, { align: 'center' });
                cx += w;
            });
        });
        return yy + 11;
    };

    const linhaAtleta = (x: number, yy: number, h: number, atleta?: AtletaEvento) => {
        let cx = x;
        [cols.num, nomeW, cols.gols, cols.ca, cols.cv].forEach(w => { doc.rect(cx, yy, w, h); cx += w; });
        if (!atleta) return;
        const fs = Math.min(8, h * 1.5);
        const base = yy + h / 2 + fs * 0.13;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fs);
        doc.text(atleta.camisa || '', x + cols.num / 2, base, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        textoAjustado(doc, atleta.nome.toUpperCase(), x + cols.num + 1.2, base, nomeW - 2.4, fs, { min: 5 });
        if (preenchida) {
            const g = resumo.golsPorAtleta.get(atleta.id);
            doc.setFont('helvetica', 'bold');
            if (g) doc.text(String(g), x + cols.num + nomeW + cols.gols / 2, base, { align: 'center' });
            if (resumo.amarelos.has(atleta.id)) doc.text('X', x + cols.num + nomeW + cols.gols + cols.ca / 2, base, { align: 'center' });
            if (resumo.vermelhos.has(atleta.id)) doc.text('X', x + cols.num + nomeW + cols.gols + cols.ca + cols.cv / 2, base, { align: 'center' });
        }
    };

    y = cabecalhoTabela(y);
    const espacoLinhas = PAG_H - MARGEM - alturaInferior - y;
    // Linha entre 4,6mm (mínimo legível) e 6,5mm. Se não couber tudo, continua em página adicional.
    let alturaLinha = Math.min(6.5, Math.max(4.6, espacoLinhas / linhasTotal));
    const cabemNaPrimeira = Math.floor(espacoLinhas / alturaLinha);

    let i = 0;
    const desenharBlocoLinhas = (ate: number) => {
        for (; i < ate; i++) {
            linhaAtleta(MARGEM, y, alturaLinha, atletasA[i]);
            linhaAtleta(MARGEM + colW + gap, y, alturaLinha, atletasB[i]);
            y += alturaLinha;
        }
    };

    if (linhasTotal <= cabemNaPrimeira) {
        desenharBlocoLinhas(linhasTotal);
    } else {
        // Primeira página cheia de linhas; o restante vai para páginas adicionais
        alturaLinha = 5;
        const porPagina = () => Math.floor((PAG_H - MARGEM - 8 - y) / alturaLinha);
        desenharBlocoLinhas(Math.min(linhasTotal, i + porPagina()));
        while (i < linhasTotal) {
            doc.addPage();
            y = cabecalho(true);
            y = cabecalhoTabela(y);
            const restante = linhasTotal - i;
            const capacidade = porPagina();
            // Se o restante + parte inferior cabem, desenha e segue; senão enche a página
            desenharBlocoLinhas(i + Math.min(restante, capacidade));
        }
        if (PAG_H - MARGEM - y < alturaInferior) {
            doc.addPage();
            y = cabecalho(true);
        }
    }

    // Aviso quando a equipe ainda não finalizou a relação
    const avisos: string[] = [];
    if (!dados.equipeA?.listaOficial) avisos.push(`${jogo.equipeANome}: relação oficial ainda não finalizada`);
    if (!dados.equipeB?.listaOficial) avisos.push(`${jogo.equipeBNome}: relação oficial ainda não finalizada`);

    // ---------- Técnicos ----------
    y += 1;
    caixa(doc, MARGEM, y, colW, 8, 'TÉCNICO / RESPONSÁVEL — EQUIPE A', dados.equipeA?.tecnico || '');
    caixa(doc, MARGEM + colW + gap, y, colW, 8, 'TÉCNICO / RESPONSÁVEL — EQUIPE B', dados.equipeB?.tecnico || '');
    y += 9;

    // ---------- Faltas acumuladas e pedidos de tempo (por período) ----------
    const faltasMax = categoria?.faltasPorPeriodo ?? 5;
    const temposMax = categoria?.temposPorPeriodo ?? 1;
    ['A', 'B'].forEach((eq, idx) => {
        const x = MARGEM + idx * (colW + gap);
        let yy = y;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setFillColor(235, 242, 250);
        doc.rect(x, yy, colW, 5, 'FD');
        doc.text(`EQUIPE ${eq} — CONTROLE POR PERÍODO`, x + 1.5, yy + 3.5);
        yy += 5;
        const rotW = 18;
        const blocoFaltas = faltasMax > 0 ? colW - rotW - (temposMax > 0 ? 6 + temposMax * 5 : 0) : 0;
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        if (faltasMax > 0) doc.text('FALTAS ACUMULADAS', x + rotW + 1, yy + 2.6);
        if (temposMax > 0) doc.text('TEMPO', x + colW, yy + 2.6, { align: 'right' });
        yy += 3.2;
        periodos.forEach((nome, p) => {
            doc.rect(x, yy, rotW, 5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.8);
            doc.text(nome, x + 1, yy + 3.4);
            if (faltasMax > 0) {
                const w = Math.min(7, blocoFaltas / faltasMax);
                for (let f = 0; f < faltasMax; f++) {
                    const fx = x + rotW + f * w;
                    const marcada = preenchida && f < resumo.faltas[eq as 'A' | 'B'][p];
                    if (marcada) { doc.setFillColor(40, 40, 40); doc.rect(fx, yy, w, 5, 'FD'); }
                    else doc.rect(fx, yy, w, 5);
                    doc.setTextColor(marcada ? 255 : 150, marcada ? 255 : 150, marcada ? 255 : 150);
                    doc.setFont('helvetica', 'normal');
                    doc.text(String(f + 1), fx + w / 2, yy + 3.4, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                }
            }
            if (temposMax > 0) {
                for (let t = 0; t < temposMax; t++) {
                    const tx = x + colW - (temposMax - t) * 5;
                    doc.rect(tx, yy, 5, 5);
                    if (preenchida && t < resumo.tempos[eq as 'A' | 'B'][p]) {
                        doc.setFont('helvetica', 'bold');
                        doc.text('X', tx + 2.5, yy + 3.5, { align: 'center' });
                    }
                }
            }
            yy += 5.2;
        });
    });
    y += alturaControle;

    // ---------- Placar ----------
    const placarCols = [...periodos, 'FINAL', 'PÊNALTIS'];
    const rotPlacar = 40;
    const wCol = (LARG_UTIL - rotPlacar) / placarCols.length;
    doc.setFillColor(235, 242, 250);
    doc.rect(MARGEM, y, LARG_UTIL, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('PLACAR', MARGEM + 1.5, y + 3.5);
    placarCols.forEach((c, k) => {
        const cx = MARGEM + rotPlacar + k * wCol;
        doc.rect(cx, y, wCol, 5);
        textoAjustado(doc, c, cx + wCol / 2, y + 3.5, wCol - 1, 6, { align: 'center' });
    });
    y += 5;
    (['A', 'B'] as const).forEach(eq => {
        doc.rect(MARGEM, y, rotPlacar, 6);
        doc.setFont('helvetica', 'bold');
        textoAjustado(doc, `${eq} · ${eq === 'A' ? jogo.equipeANome : jogo.equipeBNome}`, MARGEM + 1.5, y + 4.2, rotPlacar - 3, 7);
        placarCols.forEach((_, k) => {
            const cx = MARGEM + rotPlacar + k * wCol;
            doc.rect(cx, y, wCol, 6);
            let valor = '';
            if (k < periodos.length && preenchida) valor = String(resumo.placarPeriodo[eq][k]);
            if (k === periodos.length && jogo.placarA != null && jogo.placarB != null && jogo.status !== 'agendado') {
                valor = String(eq === 'A' ? jogo.placarA : jogo.placarB);
            }
            if (k === periodos.length + 1) {
                const pen = eq === 'A' ? jogo.penaltisA : jogo.penaltisB;
                if (pen != null) valor = String(pen);
            }
            if (valor) {
                doc.setFontSize(9);
                doc.text(valor, cx + wCol / 2, y + 4.3, { align: 'center' });
            }
        });
        y += 6;
    });
    y += 2;

    // ---------- Registro de gols ----------
    const golsCelulas = 18;
    ['A', 'B'].forEach((eq, idx) => {
        const x = MARGEM + idx * (colW + gap);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setFillColor(235, 242, 250);
        doc.rect(x, y, colW, 4.5, 'FD');
        doc.text(`REGISTRO DE GOLS — EQUIPE ${eq} (nº da camisa)`, x + 1.5, y + 3.2);
        const w = colW / (golsCelulas / 2);
        const lista = resumo.gols[eq as 'A' | 'B'];
        for (let k = 0; k < golsCelulas; k++) {
            const linha = Math.floor(k / (golsCelulas / 2));
            const coluna = k % (golsCelulas / 2);
            const cx = x + coluna * w;
            const cy = y + 4.5 + linha * 5.5;
            doc.rect(cx, cy, w, 5.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.setTextColor(150, 150, 150);
            doc.text(String(k + 1), cx + 0.8, cy + 1.9);
            doc.setTextColor(0, 0, 0);
            const lance = preenchida ? lista[k] : undefined;
            if (lance) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.text(lance.tipo === 'gol_contra' ? 'GC' : (lance.camisa || '?'), cx + w / 2, cy + 4.2, { align: 'center' });
            }
        }
    });
    y += 16 + 2;

    // ---------- Anotações e ocorrências ----------
    const alturaOcorr = 17;
    doc.rect(MARGEM, y, LARG_UTIL, alturaOcorr);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('ANOTAÇÕES E OCORRÊNCIAS', MARGEM + 1.5, y + 3.2);
    const textoOcorr = [...avisos.map(a => `ATENÇÃO: ${a}.`), jogo.ocorrencias || ''].filter(Boolean).join('  ');
    if (textoOcorr) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(doc.splitTextToSize(textoOcorr, LARG_UTIL - 3).slice(0, 4), MARGEM + 1.5, y + 7);
    }
    for (let l = 1; l <= 3; l++) {
        doc.setDrawColor(210, 210, 210);
        doc.line(MARGEM + 1.5, y + 4 + l * 4.2, MARGEM + LARG_UTIL - 1.5, y + 4 + l * 4.2);
    }
    doc.setDrawColor(0, 0, 0);
    y += alturaOcorr + 2;

    // ---------- Assinaturas ----------
    const assinaturas = [
        'ÁRBITRO PRINCIPAL', 'ÁRBITRO AUXILIAR', 'ANOTADOR / MESÁRIO',
        'CAPITÃO / TÉCNICO — EQUIPE A', 'CAPITÃO / TÉCNICO — EQUIPE B', 'REPRESENTANTE DA ORGANIZAÇÃO',
    ];
    const aw = LARG_UTIL / 3;
    assinaturas.forEach((a, k) => {
        const ax = MARGEM + (k % 3) * aw;
        const ay = y + 8 + Math.floor(k / 3) * 11;
        doc.line(ax + 4, ay, ax + aw - 4, ay);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.text(a, ax + aw / 2, ay + 3, { align: 'center' });
    });

    if (jogo.status === 'encerrado') {
        doc.setFontSize(5.5);
        doc.setTextColor(...CINZA);
        doc.text(`Partida encerrada em ${formatarDataHora(jogo.encerradoEm)}${jogo.encerradoPor ? ` por ${jogo.encerradoPor}` : ''} · súmula digital REAL`, PAG_W / 2, PAG_H - 3, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    }
}

/** Gera um único PDF com a súmula de cada jogo informado (uma ou mais páginas por jogo). */
export async function pdfSumulas(lista: DadosSumula[], nomeArquivo: string, modo: ModoPdf = 'baixar') {
    if (!lista.length) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    for (let k = 0; k < lista.length; k++) {
        await desenharSumula(doc, lista[k], k === 0);
    }
    entregarPdf(doc, `${nomeSeguro(nomeArquivo)}.pdf`, modo);
}
