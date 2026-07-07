import { useCallback } from 'react';
import type { Convocacao } from '../types/convocacao';

export function useConvocacaoImageGenerator() {

    const generateImage = useCallback(async (convocacao: Convocacao, layout: 'geral' | 'individual' = 'geral', highlightUrl?: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Canvas context not available"));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = layout === 'individual' ? '/convocacao-individual.png' : '/convocacao.png';

            img.onload = async () => {
                // Set canvas dimensions to match the image exactly
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw background image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);



                // Canvas setup for text
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                const canvasW = canvas.width;
                const canvasH = canvas.height;

                // Helper to format name: First Name + Prepositions + First Surname
                const formatDisplayName = (fullName: string) => {
                    if (!fullName) return '';
                    const parts = fullName.trim().split(/\s+/);
                    if (parts.length <= 1) return fullName;

                    const prepositions = ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'];
                    let result = parts[0];

                    for (let i = 1; i < parts.length; i++) {
                        const part = parts[i];
                        const partUpper = part.toUpperCase();
                        result += ' ' + part;
                        if (!prepositions.includes(partUpper)) {
                            break;
                        }
                    }

                    return result;
                };

                const redColor = '#E31B23';
                const grayColor = '#AAAAAA';
                const darkText = '#111111';

                const titulares = convocacao.jogadores.filter(j => j.categoria === 'titular');
                const reservas = convocacao.jogadores.filter(j => j.categoria === 'reserva');

                // Data de jogo comum para ambos
                const dateObj = new Date(convocacao.dataUnix);
                const day = dateObj.getDate().toString().padStart(2, '0');
                const month = dateObj.toLocaleDateString('pt-BR', { month: '2-digit' }).toUpperCase();
                const year = dateObj.getFullYear();
                const gameTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // HIGHLIGHT IMAGE (If layout is individual and URL provided)
                // Desenhar ANTES dos textos para garantir que o texto fique por cima (Z-Index)
                if (layout === 'individual' && highlightUrl) {
                    try {
                        const hImg = new Image();
                        hImg.crossOrigin = 'Anonymous';
                        await new Promise((res, rej) => {
                            hImg.onload = res;
                            hImg.onerror = rej;
                            hImg.src = highlightUrl;
                        });

                        const scale = (canvas.height * 0.9) / hImg.height;
                        const w = hImg.width * scale;
                        const h = canvas.height * 0.9;

                        let x = canvas.width - w - (canvas.width * 0.08);
                        if (x < canvas.width * 0.38) {
                            x = canvas.width * 0.38;
                        }

                        const y = canvas.height - h;
                        ctx.drawImage(hImg, x, y, w, h);
                    } catch (e) {
                        console.warn('Failed to load highlight image:', e);
                    }
                }

                if (layout === 'individual') {
                    // ============================================
                    // LAYOUT INDIVIDUAL (Flamengo/Copinha Style)
                    // ============================================

                    const leftMargin = canvasW * 0.085;
                    const headerMaxWidth = (canvasW * 0.62) - leftMargin;
                    const maxWidth = (canvasW * 0.5) - leftMargin; // Mantido para o corpo do texto

                    // 1. HEADER (Top Left)
                    const headerY = canvasH * 0.05;
                    const logoSize = canvasH * 0.065;

                    let textX = leftMargin;

                    const drawLogo = async (url: string, x: number, y: number, size: number) => {
                        if (!url) return;
                        try {
                            const logoImg = new Image();
                            logoImg.crossOrigin = 'Anonymous';
                            await new Promise((res, rej) => {
                                logoImg.onload = res;
                                logoImg.onerror = rej;
                                logoImg.src = url;
                            });
                            let dw = size;
                            let dh = size;
                            const ratio = logoImg.width / logoImg.height;
                            if (ratio > 1) { dh = size / ratio; } else { dw = size * ratio; }
                            ctx.drawImage(logoImg, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
                        } catch (e) { console.warn('Falha logo:', e) }
                    };

                    const hasRivalInfo = !!(convocacao.rivalNome || convocacao.rivalLogo);
                    const hasLogos = convocacao.casaLogo || convocacao.rivalLogo;
                    const isJustEvent = !hasRivalInfo; // Se não houver rival, é só o jogo.

                    let logosDrawn = 0;
                    if (hasLogos) {
                        if (convocacao.casaLogo) {
                            await drawLogo(convocacao.casaLogo, leftMargin, headerY, logoSize);
                            logosDrawn++;
                        }
                        if (convocacao.rivalLogo) {
                            await drawLogo(convocacao.rivalLogo, leftMargin + (logosDrawn * (logoSize + 5)), headerY, logoSize);
                            logosDrawn++;
                        }
                        textX = leftMargin + (logosDrawn * logoSize) + (logosDrawn > 1 ? 15 : 10);
                    }

                    // NOME DO CAMPEONATO / JOGO E CONFRONTO
                    if (isJustEvent) {
                        // Se não tem nem logo e nem nomes definidos, exibe apenas o titulo do evento gigante em vermelho
                        ctx.font = `900 ${canvasH * 0.024}px "Montserrat", sans-serif`;
                        ctx.fillStyle = redColor;
                        ctx.textAlign = 'left';
                        ctx.fillText(convocacao.jogo.toUpperCase(), textX, headerY + (logoSize * 0.45), maxWidth);
                    } else if (!hasLogos) {
                        // Sem logo, mas tem algum nome preenchido. O título do jogo fica em segundo plano.
                        ctx.font = `900 ${canvasH * 0.015}px "Montserrat", sans-serif`;
                        ctx.fillStyle = redColor;
                        ctx.textAlign = 'left';
                        ctx.fillText(convocacao.jogo.toUpperCase(), textX, headerY + (logoSize * 0.2), maxWidth);

                        // Confronto (Time da Casa em Vermelho, restante em Preto) - Proporcional e Maior
                        ctx.font = `900 ${canvasH * 0.032}px "Montserrat", sans-serif`;
                        const casaName = (convocacao.casaNome || 'Rumo ao Esporte').toUpperCase();
                        const rivalName = (convocacao.rivalNome || 'RIVAL').toUpperCase();


                        const finalY = headerY + (logoSize * 0.55);
                        (ctx as any).letterSpacing = "1.5px";

                        const casaW = ctx.measureText(casaName).width;
                        const xW = ctx.measureText(' X ').width;
                        const availRival = headerMaxWidth - casaW - xW;
                        const fullRivalW = ctx.measureText(rivalName).width;

                        if (fullRivalW > availRival && rivalName.includes(' ')) {
                            // Quebra o rival: Parte 1 para CIMA, Parte 2 na linha do X
                            const words = rivalName.split(' ');
                            let r1 = "";
                            let r2 = "";

                            // Tenta encaixar as últimas palavras na linha 2 (greedy from end)
                            for (let i = words.length - 1; i >= 0; i--) {
                                const test = r2 ? words[i] + " " + r2 : words[i];
                                if (ctx.measureText(test).width <= availRival) {
                                    r2 = test;
                                } else {
                                    r1 = words.slice(0, i + 1).join(' ');
                                    break;
                                }
                            }

                            const lineHeight = (canvasH * 0.032) * 0.85;
                            const rMaxWidth = headerMaxWidth - (casaW + xW);

                            // Linha 1 (Cima)
                            ctx.fillStyle = darkText;
                            ctx.fillText(r1, textX + casaW + xW, finalY - lineHeight, rMaxWidth);

                            // Linha 2 (Principal)
                            ctx.fillStyle = redColor;
                            ctx.fillText(casaName, textX, finalY);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(' X ', textX + casaW, finalY);
                            ctx.fillStyle = darkText;
                            ctx.fillText(r2, textX + casaW + xW, finalY, rMaxWidth);
                        } else {
                            ctx.fillStyle = redColor;
                            ctx.fillText(casaName, textX, finalY);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(' X ', textX + casaW, finalY);
                            ctx.fillStyle = darkText;
                            ctx.fillText(rivalName, textX + casaW + xW, finalY, headerMaxWidth - casaW - xW);
                        }
                        (ctx as any).letterSpacing = "0px";
                    } else {
                        // Com logo, tamanho padrao
                        ctx.font = `800 ${canvasH * 0.013}px "Montserrat", sans-serif`;
                        ctx.fillStyle = darkText;
                        ctx.textAlign = 'left';
                        ctx.fillText(convocacao.jogo.toUpperCase(), textX, headerY + (logoSize * 0.2), maxWidth);

                        // Confronto (Time da Casa em Vermelho, restante em Preto) - Proporcional e Maior
                        ctx.font = `900 ${canvasH * 0.024}px "Montserrat", sans-serif`;
                        const casaNameIndiv = (convocacao.casaNome || 'Rumo ao Esporte').toUpperCase();
                        const rivalNameIndiv = (convocacao.rivalNome || 'RIVAL').toUpperCase();


                        const finalYIndiv = headerY + (logoSize * 0.55);
                        (ctx as any).letterSpacing = "1.5px";

                        const casaWIndiv = ctx.measureText(casaNameIndiv).width;
                        const xWIndiv = ctx.measureText(' X ').width;
                        const availRivalIndiv = headerMaxWidth - casaWIndiv - xWIndiv;
                        const fullRivalWIndiv = ctx.measureText(rivalNameIndiv).width;

                        if (fullRivalWIndiv > availRivalIndiv && rivalNameIndiv.includes(' ')) {
                            // Quebra o rival: Parte 1 para CIMA, Parte 2 na linha do X
                            const words = rivalNameIndiv.split(' ');
                            let r1 = "";
                            let r2 = "";

                            for (let i = words.length - 1; i >= 0; i--) {
                                const test = r2 ? words[i] + " " + r2 : words[i];
                                if (ctx.measureText(test).width <= availRivalIndiv) {
                                    r2 = test;
                                } else {
                                    r1 = words.slice(0, i + 1).join(' ');
                                    break;
                                }
                            }

                            const lineHeightIndiv = (canvasH * 0.024) * 0.85;
                            const rMaxWidthIndiv = headerMaxWidth - (casaWIndiv + xWIndiv);

                            // Linha 1 (Cima)
                            ctx.fillStyle = darkText;
                            ctx.fillText(r1, textX + casaWIndiv + xWIndiv, finalYIndiv - lineHeightIndiv, rMaxWidthIndiv);

                            // Linha 2 (Principal)
                            ctx.fillStyle = redColor;
                            ctx.fillText(casaNameIndiv, textX, finalYIndiv);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(' X ', textX + casaWIndiv, finalYIndiv);
                            ctx.fillStyle = darkText;
                            ctx.fillText(r2, textX + casaWIndiv + xWIndiv, finalYIndiv, rMaxWidthIndiv);
                        } else {
                            ctx.fillStyle = redColor;
                            ctx.fillText(casaNameIndiv, textX, finalYIndiv);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(' X ', textX + casaWIndiv, finalYIndiv);
                            ctx.fillStyle = darkText;
                            ctx.fillText(rivalNameIndiv, textX + casaWIndiv + xWIndiv, finalYIndiv, headerMaxWidth - casaWIndiv - xWIndiv);
                        }
                        (ctx as any).letterSpacing = "0px";
                    }

                    // DATA E HORA
                    if (convocacao.showDataJogo !== false) {
                        ctx.font = `800 ${canvasH * 0.013}px "Montserrat", sans-serif`;
                        ctx.fillStyle = darkText;
                        const dateText = `${day}/${month}/${year} - ${gameTime}H`;
                        ctx.fillText(dateText, textX, headerY + (logoSize * 0.9), maxWidth);
                    }

                    // 2. TITULARES
                    const startYTits = convocacao.showDataJogo !== false ? canvasH * 0.155 : canvasH * 0.135;
                    const lineHeight = canvasH * 0.027;

                    for (let i = 0; i < titulares.length; i++) {
                        const t = titulares[i];
                        const y = startYTits + (i * lineHeight);

                        let nameX = leftMargin;
                        if (t.numero && convocacao.showNumbers !== false) {
                            ctx.font = `800 ${canvasH * 0.016}px "Montserrat", sans-serif`;
                            ctx.fillStyle = redColor;
                            ctx.textAlign = 'left';
                            ctx.fillText(t.numero, leftMargin, y);
                            nameX = leftMargin + (canvasW * 0.04);
                        }

                        ctx.font = `800 ${canvasH * 0.015}px "Montserrat", sans-serif`;
                        ctx.fillStyle = darkText;
                        ctx.textAlign = 'left';
                        (ctx as any).letterSpacing = "-1px";

                        // Limit width of names
                        const maxNameWidth = maxWidth - (nameX - leftMargin);

                        ctx.save();
                        ctx.scale(1, 1.12);
                        ctx.fillText(formatDisplayName(t.nome).toUpperCase(), nameX, y / 1.12, maxNameWidth);
                        ctx.restore();

                        (ctx as any).letterSpacing = "0px";
                    }



                    // 4. RESERVAS (Uma coluna vertical, começa abaixo do RESERVAS : que está na arte estática)
                    const resStartLineY = canvasH * 0.63;
                    const resLineHeight = canvasH * 0.016;
                    const colX = leftMargin;
                    const resMaxWidth = maxWidth;

                    for (let i = 0; i < reservas.length; i++) {
                        const r = reservas[i];
                        const rY = resStartLineY + (i * resLineHeight);

                        let rNameX = colX;
                        if (r.numero && convocacao.showNumbers !== false) {
                            ctx.font = `800 ${canvasH * 0.0115}px "Montserrat", sans-serif`;
                            ctx.fillStyle = darkText;
                            ctx.textAlign = 'left';
                            ctx.fillText(r.numero, colX, rY);
                            rNameX = colX + (canvasW * 0.035);
                        }

                        ctx.font = `800 ${canvasH * 0.0105}px "Montserrat", sans-serif`;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.textAlign = 'left';
                        (ctx as any).letterSpacing = "-1px";

                        const maxResNameWidth = resMaxWidth - (rNameX - colX);

                        ctx.save();
                        ctx.scale(1, 1.12);
                        ctx.fillText(formatDisplayName(r.nome).toUpperCase(), rNameX, rY / 1.12, maxResNameWidth);
                        ctx.restore();

                        (ctx as any).letterSpacing = "0px";
                    }

                    // 5. TÉCNICO (Posicionado logo acima da linha vermelha do rodapé)
                    if (convocacao.tecnico) {
                        const techY = canvasH * 0.815;
                        ctx.font = `800 ${canvasH * 0.014}px "Montserrat", sans-serif`;
                        ctx.textAlign = 'left';

                        ctx.fillStyle = darkText;
                        ctx.fillText('TÉC. ', leftMargin, techY);

                        const techWidth = ctx.measureText('TÉC. ').width;
                        ctx.fillStyle = '#FFFFFF';
                        const maxTechNameWidth = maxWidth - techWidth;
                        ctx.fillText(convocacao.tecnico.toUpperCase(), leftMargin + techWidth, techY, maxTechNameWidth);
                    }

                } else {
                    // ============================================
                    // LAYOUT GERAL (Rumo ao Esporte)
                    // ============================================
                    const bannerWidth = canvasW * 0.12;
                    const contentLeft = bannerWidth + (canvasW * 0.04);

                    // 1. Desenha "STARTING XI" Vertical
                    ctx.save();
                    ctx.translate(bannerWidth * 0.5, canvasH * 0.15);
                    ctx.rotate(-Math.PI / 2);
                    ctx.font = `800 ${canvasH * 0.025}px "Montserrat", sans-serif`;
                    ctx.fillStyle = '#333333';
                    ctx.textAlign = 'center';
                    ctx.restore();

                    // 2. NOME DO JOGO
                    ctx.font = `800 ${canvasH * 0.020}px "Montserrat", sans-serif`;
                    ctx.fillStyle = redColor;
                    ctx.textAlign = 'left';
                    ctx.fillText(convocacao.jogo.toUpperCase(), contentLeft, canvasH * 0.145);

                    // 3. Data e Hora
                    if (convocacao.showDataJogo !== false) {
                        const monthText = dateObj.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
                        const fullInfo = `${day} ${monthText} | ${gameTime}H`;

                        ctx.font = `800 ${canvasH * 0.020}px "Montserrat", sans-serif`;
                        ctx.fillStyle = grayColor;
                        ctx.textAlign = 'left';
                        ctx.fillText(fullInfo, contentLeft, canvasH * 0.175);
                    }

                    // Separator
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 1;
                    ctx.moveTo(contentLeft, canvasH * 0.195);
                    ctx.lineTo(contentLeft + 250, canvasH * 0.195);
                    ctx.stroke();

                    // TITULARES
                    const startYTits = convocacao.showDataJogo !== false ? canvasH * 0.20 : canvasH * 0.175;
                    const hasManyTitulares = titulares.length > 12;
                    const titLineHeight = hasManyTitulares ? canvasH * 0.022 : canvasH * 0.026;
                    const numFontSize = hasManyTitulares ? canvasH * 0.014 : canvasH * 0.017;
                    const nameFontSize = hasManyTitulares ? canvasH * 0.014 : canvasH * 0.017;

                    for (let i = 0; i < titulares.length; i++) {
                        const t = titulares[i];
                        const y = startYTits + (i * titLineHeight);

                        if (t.numero && convocacao.showNumbers !== false) {
                            ctx.font = `800 ${numFontSize}px "Montserrat", sans-serif`;
                            ctx.fillStyle = redColor;
                            ctx.textAlign = 'right';
                            ctx.fillText(t.numero, contentLeft + (canvasW * 0.03), y);
                        }

                        ctx.font = `800 ${nameFontSize}px "Montserrat", sans-serif`;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.textAlign = 'left';

                        const nameX = contentLeft + (t.numero && convocacao.showNumbers !== false ? canvasW * 0.07 : canvasW * 0.01);
                        ctx.fillText(formatDisplayName(t.nome).toUpperCase(), nameX, y);
                    }

                    // RESERVAS
                    if (reservas.length > 0) {
                        const boxTop = canvasH * 0.60;
                        const boxLeft = canvasW * 0.12;
                        const boxWidth = canvasW * 0.42;

                        ctx.font = `800 ${canvasH * 0.011}px "Montserrat", sans-serif`;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.textAlign = 'left';
                        ctx.fillText('SUBSTITUTOS', boxLeft, boxTop + (canvasH * 0.022));

                        ctx.font = `700 ${canvasH * 0.009}px "Open Sans", sans-serif`;
                        const resNames = reservas.map(r => formatDisplayName(r.nome).toUpperCase()).join(', ');

                        const words = resNames.split(' ');
                        let line = '';
                        let lineCount = 0;
                        const resStartLineY = boxTop + (canvasH * 0.045);
                        const resLineHeight = canvasH * 0.012;

                        for (let n = 0; n < words.length; n++) {
                            const testLine = line + words[n] + ' ';
                            const metrics = ctx.measureText(testLine);
                            if (metrics.width > boxWidth && n > 0) {
                                ctx.fillText(line.trim(), boxLeft, resStartLineY + (lineCount * resLineHeight));
                                line = words[n] + ' ';
                                lineCount++;
                            } else {
                                line = testLine;
                            }
                        }
                        ctx.fillText(line.trim(), boxLeft, resStartLineY + (lineCount * resLineHeight));
                    }



                    // CONFRONTO (Opcional)
                    // Só desenha bloco de confronto se tem rival
                    const hasConfronto = !!(convocacao.rivalNome || convocacao.rivalLogo);
                    const logoSizeConf = canvasH * 0.065;
                    const vsX = canvasW * 0.32;
                    const vsY = canvasH * 0.77;
                    const spacing = canvasW * 0.11;

                    if (hasConfronto) {

                        const drawTeam = async (name: string | undefined, logoUrl: string | undefined, x: number) => {
                            if (logoUrl) {
                                try {
                                    const tImg = new Image();
                                    tImg.crossOrigin = 'Anonymous';
                                    await new Promise((res, rej) => {
                                        tImg.onload = res;
                                        tImg.onerror = rej;
                                        tImg.src = logoUrl;
                                    });
                                    let dw = logoSizeConf;
                                    let dh = logoSizeConf;
                                    const ratio = tImg.width / tImg.height;
                                    if (ratio > 1) { dh = logoSizeConf / ratio; } else { dw = logoSizeConf * ratio; }
                                    ctx.drawImage(tImg, x - (dw / 2), vsY - (dh / 2), dw, dh);
                                } catch (e) { }
                            }
                            if (name) {
                                ctx.font = `800 ${canvasH * 0.010}px "Montserrat", sans-serif`;
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.fillText(name.toUpperCase(), x, vsY + (logoSizeConf / 2) + (canvasH * 0.020));
                            }
                        };

                        await drawTeam(convocacao.casaNome, convocacao.casaLogo, vsX - spacing);
                        ctx.font = `900 ${canvasH * 0.018}px "Montserrat", sans-serif`;
                        ctx.fillStyle = redColor;
                        ctx.textAlign = 'center';
                        ctx.fillText('VS', vsX, vsY);
                        await drawTeam(convocacao.rivalNome, convocacao.rivalLogo, vsX + spacing);
                    }

                    // TÉCNICO (Sempre desenha se houver nome, independente de confronto)
                    if (convocacao.tecnico) {
                        const techY = vsY + (logoSizeConf / 2) + (canvasH * 0.055);

                        ctx.font = `600 ${canvasH * 0.008}px "Open Sans", sans-serif`;
                        ctx.fillStyle = grayColor;
                        ctx.textAlign = 'left';
                        ctx.fillText('TÉCNICO | TREINADOR', contentLeft, techY);

                        ctx.font = `800 ${canvasH * 0.013}px "Montserrat", sans-serif`;
                        ctx.fillStyle = '#FFFFFF';
                        const coachName = (convocacao.tecnico || '').toUpperCase();
                        ctx.fillText(coachName, contentLeft, techY + (canvasH * 0.022), canvasW * 0.45);
                    }
                } // Fim Geral

                resolve(canvas.toDataURL('image/png'));
            };

            img.onerror = () => {
                reject(new Error("Failed to load base image from /public"));
            };
        });
    }, []);

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

    const downloadImage = useCallback(async (convocacao: Convocacao, layout: 'geral' | 'individual' = 'geral', highlightUrl?: string) => {
        try {
            const dataUrl = await generateImage(convocacao, layout, highlightUrl);
            const blob = dataURLtoBlob(dataUrl);
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.download = `Convocacao-${layout}-${convocacao.jogo.replace(/\s+/g, '-')}.png`;
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Não revogamos imediatamente para garantir que o "Ver" (Preview) do iOS funcione
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000 * 60); // Revoga após 1 minuto

            return true;
        } catch (error) {
            console.error("Generator error:", error);
            return false;
        }
    }, [generateImage]);

    return { generateImage, downloadImage };
}
