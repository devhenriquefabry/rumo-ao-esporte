
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const CARD_QR_SIZE_MM = 12.4;
const CARD_QR_RIGHT_MM = 4.6;
const CARD_QR_TOP_MM = 3.7;
const CARD_BACK_LOGO_URL = '/real-logo-transparente.svg';
const CARD_BACK_LOGO_SIZE_MM = 13.4;
const CARD_BACK_LOGO_X_MM = 67.2;
const CARD_BACK_LOGO_Y_MM = 34.8;

const loadImageAsPngDataUrl = async (src: string) => {
    const img = new Image();
    img.src = src;
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

    const width = img.naturalWidth || 600;
    const height = img.naturalHeight || 420;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context failed');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
};

export const generateStudentCardPDF = async (student: any, responsible: any, showAlert: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void) => {
    const docPDF = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: [85.6, 54] // Standard ID card size
    });

    const pageWidth = docPDF.internal.pageSize.width;
    const pageHeight = docPDF.internal.pageSize.height;

    try {
        // Load background image
        const bgImg = new Image();
        bgImg.src = '/carteirinha.png';
        await new Promise((resolve) => { bgImg.onload = resolve; bgImg.onerror = resolve; });
        docPDF.addImage(bgImg, 'PNG', 0, 0, pageWidth, pageHeight);

        // Load student photo
        if (student.fotoUrl) {
            try {
                const response = await fetch(student.fotoUrl);
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);

                const photoData = await new Promise<string>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const size = Math.min(img.width, img.height);
                        canvas.width = size;
                        canvas.height = size;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            reject(new Error('Canvas context failed'));
                            return;
                        }

                        // Calculate center crop
                        const sx = (img.width - size) / 2;
                        const sy = (img.height - size) / 2;

                        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                        URL.revokeObjectURL(objectUrl);
                    };
                    img.onerror = (e) => {
                        URL.revokeObjectURL(objectUrl);
                        reject(e);
                    };
                    img.src = objectUrl;
                });

                docPDF.addImage(photoData, 'JPEG', 7.7, 25.7, 18.0, 18.0);
            } catch (e) {
                console.error("Error loading photo for PDF:", e);
            }
        }

        // Text coordinates
        docPDF.setFontSize(7.5);
        docPDF.setTextColor(0, 125, 47);
        docPDF.setFont('helvetica', 'bold');

        // Name Formatting Logic
        const formatName = (name: string) => {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 4) {
                for (let i = 2; i < parts.length - 1; i++) {
                    parts[i] = parts[i][0].toUpperCase() + '.';
                }
            }
            return parts.join(' ');
        };

        docPDF.text(formatName(student.nome.toUpperCase()), 39.4, 24.0);

        docPDF.setTextColor(50, 50, 50);
        docPDF.setFontSize(6.5);

        docPDF.text(student.cpf || '-', 36.8, 34.8);
        docPDF.text(student.dataNascimento || '-', 58.2, 40.2);

        // QR Code Generation
        try {
            const qrData = `${student.cpf}|${student.dataNascimento}|${student.nome}`;
            const qrCanvas = document.createElement('canvas');
            await QRCode.toCanvas(qrCanvas, qrData, { margin: 1, width: 256 });
            const qrDataUrl = qrCanvas.toDataURL('image/png');

            docPDF.addImage(qrDataUrl, 'PNG', pageWidth - CARD_QR_RIGHT_MM - CARD_QR_SIZE_MM, CARD_QR_TOP_MM, CARD_QR_SIZE_MM, CARD_QR_SIZE_MM);
        } catch (qrErr) {
            console.error("Error adding QR to PDF:", qrErr);
        }

        // =====================
        // BACK SIDE (Page 2)
        // =====================
        docPDF.addPage([85.6, 54], 'l');

        const backBgImg = new Image();
        backBgImg.src = '/verso-carteirinha.png';
        await new Promise((resolve) => { backBgImg.onload = resolve; backBgImg.onerror = resolve; });
        docPDF.addImage(backBgImg, 'PNG', 0, 0, pageWidth, pageHeight);

        docPDF.setTextColor(255, 255, 255);

        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(7);
        docPDF.text('Rumo ao Esporte 2026', 5, 6);
        docPDF.setFont('helvetica', 'normal');
        docPDF.setFontSize(5);
        docPDF.text('RESPONSÁVEL FINANCEIRO', pageWidth - 5, 6, { align: 'right' });

        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(9);
        const nomeResp = responsible.nome || '-';
        docPDF.text(nomeResp.length > 35 ? nomeResp.substring(0, 35) + '...' : nomeResp, 5, 14);

        docPDF.setFontSize(5);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text('CPF', 5, 20);
        docPDF.text('Telefone', pageWidth / 2, 20);
        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(6);
        docPDF.text(responsible.cpf || '-', 5, 24);
        docPDF.text(responsible.telefonePrincipal || '-', pageWidth / 2, 24);

        docPDF.setFontSize(5);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text('Email', 5, 30);
        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(6);
        docPDF.text(responsible.email || '-', 5, 34);

        const endereco = responsible.endereco || {};
        const enderecoStr = [endereco.rua, endereco.numero, endereco.bairro, endereco.cidade, endereco.uf].filter(Boolean).join(', ');
        docPDF.setFontSize(5);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text('Endereço', 5, 40);
        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(5.5);
        const maxCharsPerLine = 50;
        if (enderecoStr.length > maxCharsPerLine) {
            docPDF.text(enderecoStr.substring(0, maxCharsPerLine), 5, 44);
            docPDF.text(enderecoStr.substring(maxCharsPerLine, maxCharsPerLine * 2), 5, 48);
        } else {
            docPDF.text(enderecoStr || '-', 5, 44);
        }

        const logoDataUrl = await loadImageAsPngDataUrl(CARD_BACK_LOGO_URL);
        docPDF.addImage(logoDataUrl, 'PNG', CARD_BACK_LOGO_X_MM, CARD_BACK_LOGO_Y_MM, CARD_BACK_LOGO_SIZE_MM, CARD_BACK_LOGO_SIZE_MM);

        docPDF.save(`Carteirinha_${student.nome.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error('Error generating PDF card:', error);
        showAlert('Erro ao gerar PDF da carteirinha.', 'error');
    }
};
