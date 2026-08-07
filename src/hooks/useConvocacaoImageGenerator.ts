import { useCallback } from 'react';
import type { Convocacao, ConvocacaoJogador } from '../types/convocacao';

export type ConvocacaoLayout = 'geral' | 'individual';

// A arte é desenhada 100% em canvas (sem PNG de fundo), então toda a identidade
// visual vive neste arquivo e vale para os dois layouts.
const CANVAS_W = 1080;
const CANVAS_H = 1620;

const C = {
    bg: '#f5f7fa',
    navy: '#0d2a5f',
    navyDeep: '#09245c',
    navySoft: '#17428f',
    green: '#00a63a',
    greenDark: '#007a2a',
    gold: '#f4c20d',
    white: '#ffffff',
    line: '#ccd9ea'
};

const BRAND_NAME = 'RUMO AO ESPORTE';
const BRAND_TAGLINE = 'MELHORANDO A QUALIDADE DE VIDA DAS PESSOAS!';
const LOGO_URL = '/rumo-ao-esporte-logo.png';

type Family = 'Montserrat' | 'Open Sans';

const font = (weight: number, size: number, family: Family = 'Montserrat') =>
    `${weight} ${Math.round(size)}px "${family}", "Segoe UI", Arial, sans-serif`;

const setLetterSpacing = (ctx: CanvasRenderingContext2D, value: string) => {
    // letterSpacing existe no Chrome/Edge; nos demais é ignorado sem quebrar o desenho.
    (ctx as any).letterSpacing = value;
};

const loadImage = (src?: string | null): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        // Fotos vêm do Firebase Storage: sem crossOrigin o canvas fica "tainted"
        // e o toDataURL falha na hora de baixar.
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
};

const ensureFonts = async () => {
    try {
        const fonts = (document as any).fonts;
        if (!fonts?.load) return;
        await Promise.all([
            fonts.load('800 96px Montserrat'),
            fonts.load('800 32px Montserrat'),
            fonts.load('800 28px "Open Sans"'),
            fonts.load('700 24px "Open Sans"')
        ]);
        await fonts.ready;
    } catch {
        /* fonte indisponível: o canvas cai no fallback sans-serif */
    }
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
        return;
    }
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
};

/** Reduz o corpo da fonte até o texto caber em maxWidth. */
const fitFontSize = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    minSize: number,
    weight: number,
    family: Family = 'Montserrat'
) => {
    let size = startSize;
    while (size > minSize) {
        ctx.font = font(weight, size, family);
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 1;
    }
    ctx.font = font(weight, size, family);
    return size;
};

const truncate = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
        out = out.slice(0, -1);
    }
    return `${out.trim()}…`;
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
            if (lines.length === maxLines) break;
        } else {
            line = test;
        }
    }
    if (lines.length < maxLines && line) lines.push(line);
    return lines.length ? lines : [''];
};

/** Quebra o título em N linhas e escolhe o maior corpo que caiba na caixa. */
const fitTitle = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
    startSize: number,
    minSize: number
) => {
    let size = startSize;
    let lines: string[] = [text];

    while (size > minSize) {
        ctx.font = font(800, size);
        lines = wrapLines(ctx, text, maxWidth, maxLines + 1);
        const fits = lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxWidth);
        if (fits) break;
        size -= 2;
    }
    ctx.font = font(800, size);
    lines = wrapLines(ctx, text, maxWidth, maxLines);
    return { size, lines };
};

const formatDate = (dataUnix: number) => {
    const date = new Date(dataUnix);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} DE ${month} DE ${date.getFullYear()} • ${time}H`;
};

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string) => {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.45;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
};

/** Faixas diagonais nos cantos (assinatura da arte de referência). */
const drawCornerRibbons = (ctx: CanvasRenderingContext2D) => {
    const band = (from: number, to: number, color: string, corner: 'tl' | 'br') => {
        ctx.save();
        ctx.beginPath();
        if (corner === 'tl') {
            ctx.moveTo(from, 0);
            ctx.lineTo(to, 0);
            ctx.lineTo(0, to);
            ctx.lineTo(0, from);
        } else {
            ctx.moveTo(CANVAS_W - from, CANVAS_H);
            ctx.lineTo(CANVAS_W - to, CANVAS_H);
            ctx.lineTo(CANVAS_W, CANVAS_H - to);
            ctx.lineTo(CANVAS_W, CANVAS_H - from);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    };

    band(0, 96, C.green, 'tl');
    band(112, 250, C.navy, 'tl');
    band(0, 96, C.navy, 'br');
    band(112, 250, C.green, 'br');
};

const drawBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Brilho suave para o fundo não ficar chapado
    const glow = ctx.createRadialGradient(CANVAS_W * 0.5, CANVAS_H * 0.25, 0, CANVAS_W * 0.5, CANVAS_H * 0.25, CANVAS_W * 0.9);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(220,229,242,0.45)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawCornerRibbons(ctx);
};

/** Escudo circular com anel branco — recebe o logo da marca ou do time. */
const drawCrest = (
    ctx: CanvasRenderingContext2D,
    logo: HTMLImageElement | null,
    cx: number,
    cy: number,
    radius: number
) => {
    ctx.save();
    ctx.shadowColor = 'rgba(13,42,95,0.28)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = C.navyDeep;
    ctx.fill();
    ctx.restore();

    if (logo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
        ctx.clip();
        const ratio = logo.width / logo.height;
        let dw = (radius - 6) * 2;
        let dh = dw;
        if (ratio > 1) dh = dw / ratio;
        else dw = dh * ratio;
        ctx.drawImage(logo, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
};

/** Selo hexagonal (estilo bandeirola) usado para o ano do evento. */
const drawHexBadge = (
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    width: number,
    height: number
) => {
    const half = width / 2;
    const notch = height * 0.42;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - height / 2);
    ctx.lineTo(cx + half - notch, cy - height / 2);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx + half - notch, cy + height / 2);
    ctx.lineTo(cx - half, cy + height / 2);
    ctx.lineTo(cx - half + notch, cy);
    ctx.closePath();
    const fill = ctx.createLinearGradient(cx - half, cy, cx + half, cy);
    fill.addColorStop(0, C.green);
    fill.addColorStop(1, C.greenDark);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.white;
    setLetterSpacing(ctx, '3px');
    fitFontSize(ctx, text, width - notch * 2.4, height * 0.55, 14, 800);
    ctx.fillText(text, cx, cy + 2);
    setLetterSpacing(ctx, '0px');
    ctx.restore();

    // Traços laterais
    ctx.save();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - half - 18, cy);
    ctx.lineTo(cx - half - 96, cy);
    ctx.moveTo(cx + half + 18, cy);
    ctx.lineTo(cx + half + 96, cy);
    ctx.stroke();
    ctx.restore();
};

/** Linha de estrelas com traços — enfeite acima do título. */
const drawStarsRow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1) => {
    const gap = 46 * scale;
    const radius = 17 * scale;
    drawStar(ctx, cx - gap, cy, radius, C.navy);
    drawStar(ctx, cx, cy, radius * 1.1, C.green);
    drawStar(ctx, cx + gap, cy, radius, C.navy);

    ctx.save();
    ctx.lineWidth = 5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.strokeStyle = C.green;
    ctx.moveTo(cx - gap - 34 * scale, cy);
    ctx.lineTo(cx - gap - 120 * scale, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = C.navy;
    ctx.moveTo(cx + gap + 34 * scale, cy);
    ctx.lineTo(cx + gap + 120 * scale, cy);
    ctx.stroke();
    ctx.restore();
};

interface InfoBarData {
    badge: string;
    line1: string;
    line2: string;
}

const drawInfoBar = (
    ctx: CanvasRenderingContext2D,
    data: InfoBarData,
    x: number,
    y: number,
    width: number,
    height: number
) => {
    ctx.save();
    roundRect(ctx, x, y, width, height, 18);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const badgeW = Math.min(width * 0.3, 300);
    ctx.save();
    roundRect(ctx, x, y, badgeW, height, 18);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.white;
    setLetterSpacing(ctx, '2px');
    fitFontSize(ctx, data.badge, badgeW - 40, height * 0.42, 14, 800);
    ctx.fillText(data.badge, x + badgeW / 2, y + height / 2);
    setLetterSpacing(ctx, '0px');
    ctx.restore();

    // Divisória vertical
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + badgeW + 34, y + 18);
    ctx.lineTo(x + badgeW + 34, y + height - 18);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const textX = x + badgeW + 62;
    const textWidth = width - badgeW - 90;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.navy;
    fitFontSize(ctx, data.line1, textWidth, height * 0.26, 13, 800, 'Open Sans');
    // Sem segunda linha, a data ocupa o centro da barra
    ctx.fillText(data.line1, textX, y + (data.line2 ? height * 0.34 : height * 0.5));

    if (data.line2) {
        ctx.fillStyle = C.navySoft;
        fitFontSize(ctx, data.line2, textWidth, height * 0.24, 12, 700, 'Open Sans');
        ctx.fillText(data.line2, textX, y + height * 0.68);
    }
    ctx.restore();
};

const drawBanner = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    background: string,
    dashColor: string
) => {
    ctx.save();
    roundRect(ctx, x, y, width, height, 16);
    ctx.fillStyle = background;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.white;
    setLetterSpacing(ctx, '5px');
    const size = fitFontSize(ctx, text, width * 0.6, height * 0.52, 16, 800);
    ctx.fillText(text, x + width / 2, y + height / 2);
    const textWidth = ctx.measureText(text).width;
    setLetterSpacing(ctx, '0px');

    ctx.strokeStyle = dashColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const dashStart = x + width / 2 - textWidth / 2 - 28;
    const dashEnd = x + width / 2 + textWidth / 2 + 28;
    ctx.beginPath();
    ctx.moveTo(dashStart, y + height / 2);
    ctx.lineTo(dashStart - Math.max(40, size), y + height / 2);
    ctx.moveTo(dashEnd, y + height / 2);
    ctx.lineTo(dashEnd + Math.max(40, size), y + height / 2);
    ctx.stroke();
    ctx.restore();
};

interface NamesCardOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    players: ConvocacaoJogador[];
    showNumbers: boolean;
    columns?: number;
}

/** Cartão branco com a lista de nomes em colunas e separador pontilhado. */
const drawNamesCard = (ctx: CanvasRenderingContext2D, options: NamesCardOptions) => {
    const { x, y, width, height, players, showNumbers } = options;

    ctx.save();
    roundRect(ctx, x, y, width, height, 20);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (players.length === 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#8ea3c0';
        ctx.font = font(700, 26, 'Open Sans');
        ctx.fillText('Nenhum atleta nesta lista', x + width / 2, y + height / 2);
        ctx.restore();
        return;
    }

    const padX = 36;
    const padY = 26;
    const columns = options.columns ?? (players.length > 8 ? 2 : 1);
    const rows = Math.ceil(players.length / columns);
    const innerW = width - padX * 2;
    const colGap = columns > 1 ? 48 : 0;
    const colW = (innerW - colGap * (columns - 1)) / columns;
    const rowH = Math.min(86, (height - padY * 2) / rows);
    // Centraliza o bloco de nomes quando sobra altura no cartão
    const listTop = y + Math.max(padY, (height - rows * rowH) / 2);

    // Um único corpo de fonte para toda a lista: o maior em que todos os nomes
    // cabem. Sem isso cada linha ficaria com um tamanho diferente.
    const numbered = showNumbers && players.some(p => !!p.numero);
    let nameSize = Math.min(rowH * 0.52, 34);
    let numberOffset = 0;
    while (nameSize > 12) {
        ctx.font = font(800, nameSize);
        numberOffset = numbered
            ? Math.max(...players.map(p => (p.numero ? ctx.measureText(`${p.numero}.`).width : 0))) + 16
            : 0;
        ctx.font = font(800, nameSize, 'Open Sans');
        if (players.every(p => ctx.measureText(p.nome).width <= colW - numberOffset)) break;
        nameSize -= 1;
    }

    if (columns > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + width / 2, listTop);
        ctx.lineTo(x + width / 2, listTop + rows * rowH);
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    players.forEach((player, index) => {
        const column = Math.floor(index / rows);
        const row = index % rows;
        const colX = x + padX + column * (colW + colGap);
        const centerY = listTop + row * rowH + rowH / 2;

        const nameX = colX + numberOffset;

        if (numbered && player.numero) {
            ctx.save();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = C.green;
            ctx.font = font(800, nameSize);
            ctx.fillText(`${player.numero}.`, colX, centerY);
            ctx.restore();
        }

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = C.navy;
        ctx.font = font(800, nameSize, 'Open Sans');
        const maxNameWidth = colW - numberOffset;
        ctx.fillText(truncate(ctx, player.nome, maxNameWidth), nameX, centerY);
        ctx.restore();

        // Linha pontilhada de base
        if (row < rows - 1) {
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([6, 8]);
            ctx.strokeStyle = 'rgba(13,42,95,0.18)';
            ctx.lineWidth = 2;
            ctx.moveTo(colX, centerY + rowH / 2 - 2);
            ctx.lineTo(colX + colW, centerY + rowH / 2 - 2);
            ctx.stroke();
            ctx.restore();
        }
    });
};

const drawFooter = (ctx: CanvasRenderingContext2D, tecnico?: string) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (tecnico) {
        ctx.fillStyle = C.navy;
        ctx.font = font(800, 24, 'Open Sans');
        setLetterSpacing(ctx, '2px');
        ctx.fillText(`TÉCNICO: ${tecnico.toUpperCase()}`, CANVAS_W / 2, CANVAS_H - 96, CANVAS_W - 460);
    }

    ctx.fillStyle = 'rgba(13,42,95,0.55)';
    ctx.font = font(700, 17, 'Open Sans');
    setLetterSpacing(ctx, '3px');
    ctx.fillText(BRAND_TAGLINE, CANVAS_W / 2, CANVAS_H - 54, CANVAS_W - 460);
    setLetterSpacing(ctx, '0px');
    ctx.restore();
};

const buildInfoBarData = (convocacao: Convocacao): InfoBarData => {
    const categoria = (convocacao.categoria || '').trim();
    const casa = (convocacao.casaNome || BRAND_NAME).trim();
    const rival = (convocacao.rivalNome || '').trim();

    const badge = (categoria || casa || BRAND_NAME).toUpperCase();

    const line1 = convocacao.showDataJogo !== false && convocacao.dataUnix
        ? formatDate(convocacao.dataUnix)
        : 'DATA A CONFIRMAR';

    let line2 = '';
    if (rival) line2 = `${casa.toUpperCase()}  X  ${rival.toUpperCase()}`;
    else if (categoria && casa) line2 = casa.toUpperCase();
    else if (convocacao.tecnico) line2 = `TÉC. ${convocacao.tecnico.toUpperCase()}`;

    return { badge, line1, line2 };
};

const renderGeral = (
    ctx: CanvasRenderingContext2D,
    convocacao: Convocacao,
    assets: { logo: HTMLImageElement | null; casaLogo: HTMLImageElement | null }
) => {
    const M = 68;
    const contentW = CANVAS_W - M * 2;
    const jogadores = convocacao.jogadores || [];
    const titulares = jogadores.filter(j => j.categoria === 'titular');
    const reservas = jogadores.filter(j => j.categoria === 'reserva');
    const showNumbers = convocacao.showNumbers !== false;

    drawBackground(ctx);

    // Escudo à direita
    const crestRadius = 176;
    const crestX = CANVAS_W - M - crestRadius - 4;
    const crestY = 330;
    drawCrest(ctx, assets.casaLogo || assets.logo, crestX, crestY, crestRadius);

    // Bloco de título à esquerda (largura limitada para não encostar no escudo)
    const titleColX = M;
    const titleColW = crestX - crestRadius - 34 - titleColX;
    const titleCenter = titleColX + titleColW / 2;

    drawStarsRow(ctx, titleCenter, 148);

    const { size: titleSize, lines: titleLines } = fitTitle(
        ctx,
        (convocacao.jogo || 'CONVOCAÇÃO').toUpperCase(),
        titleColW,
        3,
        94,
        34
    );

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.navy;
    setLetterSpacing(ctx, '-1px');
    let titleY = 240;
    titleLines.forEach((line, i) => {
        ctx.fillText(line, titleCenter, titleY + i * titleSize * 1.02);
    });
    titleY += (titleLines.length - 1) * titleSize * 1.02;
    setLetterSpacing(ctx, '0px');
    ctx.restore();

    const year = new Date(convocacao.dataUnix || Date.now()).getFullYear().toString();
    const hexY = titleY + titleSize * 0.72 + 56;
    drawHexBadge(ctx, year, titleCenter, hexY, 268, 76);

    // Barra de informações: acompanha o título, sem colidir com o escudo
    const infoY = Math.max(hexY + 108, crestY + crestRadius + 56);
    const infoH = 138;
    drawInfoBar(ctx, buildInfoBarData(convocacao), M, infoY, contentW, infoH);

    // Listas (alturas proporcionais ao número de linhas, centralizadas no espaço livre)
    const bannerH = 80;
    const gap = 16;
    const areaTop = infoY + infoH + 40;
    const areaBottom = CANVAS_H - (convocacao.tecnico ? 132 : 96);
    const available = areaBottom - areaTop;

    const groups: { title: string; bg: string; dash: string; players: ConvocacaoJogador[] }[] = [
        { title: 'CONVOCADOS', bg: C.navy, dash: C.green, players: titulares }
    ];
    if (reservas.length > 0) {
        groups.push({ title: 'RESERVAS', bg: C.green, dash: C.navy, players: reservas });
    }

    const TARGET_ROW = 56;
    const CARD_PAD = 56;
    const blocks = groups.map(group => {
        const columns = group.players.length > 8 ? 2 : 1;
        const rows = Math.max(1, Math.ceil(group.players.length / columns));
        return { ...group, desired: rows * TARGET_ROW + CARD_PAD };
    });

    const chrome = blocks.length * (bannerH + gap) + (blocks.length - 1) * gap * 2;
    const desiredTotal = blocks.reduce((sum, b) => sum + b.desired, 0);
    const maxCards = available - chrome;
    // Encolhe quando não cabe e estica (até 1.6x) quando sobra espaço, para o
    // bloco de listas não deixar um buraco no meio da arte.
    const scale = Math.min(maxCards / desiredTotal, 1.6);
    const usedTotal = desiredTotal * scale + chrome;

    let cursorY = areaTop + Math.max(0, (available - usedTotal) / 2);
    blocks.forEach((block, index) => {
        if (index > 0) cursorY += gap * 2;
        drawBanner(ctx, block.title, M, cursorY, contentW, bannerH, block.bg, block.dash);
        cursorY += bannerH + gap;
        const cardH = Math.max(110, block.desired * scale);
        drawNamesCard(ctx, {
            x: M,
            y: cursorY,
            width: contentW,
            height: cardH,
            players: block.players,
            showNumbers
        });
        cursorY += cardH;
    });

    drawFooter(ctx, convocacao.tecnico);
};

const renderIndividual = (
    ctx: CanvasRenderingContext2D,
    convocacao: Convocacao,
    assets: {
        logo: HTMLImageElement | null;
        casaLogo: HTMLImageElement | null;
        highlight: HTMLImageElement | null;
    }
) => {
    const M = 62;
    const jogadores = convocacao.jogadores || [];
    const titulares = jogadores.filter(j => j.categoria === 'titular');
    const reservas = jogadores.filter(j => j.categoria === 'reserva');
    const showNumbers = convocacao.showNumbers !== false;
    // Com muitos nomes a coluna estreita fica ilegível: nesse caso só os titulares.
    const listaAtletas = titulares.length + reservas.length > 18 ? titulares : [...titulares, ...reservas];

    drawBackground(ctx);

    const panelTop = 0;
    const panelBottom = CANVAS_H * 0.79;
    const panelLeftTop = CANVAS_W * 0.54;
    const panelLeftBottom = CANVAS_W * 0.46;

    // Painel azul diagonal com a foto do atleta
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(panelLeftTop, panelTop);
    ctx.lineTo(CANVAS_W, panelTop);
    ctx.lineTo(CANVAS_W, panelBottom);
    ctx.lineTo(panelLeftBottom, panelBottom);
    ctx.closePath();
    const panel = ctx.createLinearGradient(panelLeftBottom, 0, CANVAS_W, panelBottom);
    panel.addColorStop(0, C.navySoft);
    panel.addColorStop(1, C.navyDeep);
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.clip();

    if (assets.highlight) {
        const img = assets.highlight;
        const regionH = panelBottom - panelTop - 20;
        const regionW = CANVAS_W - panelLeftBottom;
        // "Contain" pela altura para o atleta aparecer inteiro, alinhado à base.
        const scale = Math.min(regionH / img.height, (regionW * 1.25) / img.width);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, CANVAS_W - (regionW + dw) / 2, panelBottom - dh, dw, dh);
    }
    ctx.restore();

    // Escudo no topo direito, sobre o painel
    drawCrest(ctx, assets.casaLogo || assets.logo, CANVAS_W - M - 80, 128, 80);

    // Coluna esquerda: título + lista
    const colX = M;
    const colW = CANVAS_W * 0.44 - M;
    const colCenter = colX + colW / 2;

    drawStarsRow(ctx, colCenter, 108, 0.72);

    const { size: titleSize, lines: titleLines } = fitTitle(
        ctx,
        (convocacao.jogo || 'CONVOCAÇÃO').toUpperCase(),
        colW,
        3,
        56,
        22
    );

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.navy;
    let titleY = 168;
    titleLines.forEach((line, i) => {
        ctx.fillText(line, colCenter, titleY + i * titleSize * 1.05);
    });
    titleY += (titleLines.length - 1) * titleSize * 1.05;
    ctx.restore();

    const year = new Date(convocacao.dataUnix || Date.now()).getFullYear().toString();
    const hexY = titleY + titleSize * 0.7 + 40;
    drawHexBadge(ctx, year, colCenter, hexY, 172, 58);

    const bannerH = 62;
    const listTop = hexY + 76;
    const listBottom = panelBottom - 24;
    drawBanner(ctx, 'CONVOCADOS', colX, listTop, colW, bannerH, C.navy, C.green);
    drawNamesCard(ctx, {
        x: colX,
        y: listTop + bannerH + 12,
        width: colW,
        height: Math.max(160, listBottom - (listTop + bannerH + 12)),
        players: listaAtletas,
        showNumbers,
        columns: 1
    });

    // Barra de informações ocupando a largura toda, abaixo do painel
    const contentW = CANVAS_W - M * 2;
    drawInfoBar(ctx, buildInfoBarData(convocacao), M, panelBottom + 30, contentW, 122);

    drawFooter(ctx, convocacao.tecnico);
};

/** Renderiza a arte e devolve um data URL PNG. Exportado para uso fora de componentes React. */
export async function generateConvocacaoImage(
    convocacao: Convocacao,
    layout: ConvocacaoLayout = 'geral',
    highlightUrl?: string
): Promise<string> {
    await ensureFonts();

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context indisponível');

    const [logo, casaLogo, highlight] = await Promise.all([
        loadImage(LOGO_URL),
        loadImage(convocacao.casaLogo),
        layout === 'individual' ? loadImage(highlightUrl) : Promise.resolve(null)
    ]);

    if (layout === 'individual') {
        renderIndividual(ctx, convocacao, { logo, casaLogo, highlight });
    } else {
        renderGeral(ctx, convocacao, { logo, casaLogo });
    }

    return canvas.toDataURL('image/png');
}

export function useConvocacaoImageGenerator() {
    const generateImage = useCallback(generateConvocacaoImage, []);

    const dataURLtoBlob = (dataurl: string) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const downloadImage = useCallback(
        async (convocacao: Convocacao, layout: ConvocacaoLayout = 'geral', highlightUrl?: string) => {
            try {
                const dataUrl = await generateImage(convocacao, layout, highlightUrl);
                const blob = dataURLtoBlob(dataUrl);
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.download = `Convocacao-${layout}-${(convocacao.jogo || 'evento').replace(/\s+/g, '-')}.png`;
                link.href = blobUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Não revogamos imediatamente para garantir que o "Ver" (Preview) do iOS funcione
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000 * 60);

                return true;
            } catch (error) {
                console.error('Generator error:', error);
                return false;
            }
        },
        [generateImage]
    );

    return { generateImage, downloadImage };
}
