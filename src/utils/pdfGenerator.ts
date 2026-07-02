
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

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
        docPDF.setTextColor(0, 125, 47); // Arena Green
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

            docPDF.addImage(qrDataUrl, 'PNG', 66.8, 3.2, 15.4, 15.4);
        } catch (qrErr) {
            console.error("Error adding QR to PDF:", qrErr);
        }

        // =====================
        // BACK SIDE (Page 2)
        // =====================
        docPDF.addPage([85.6, 54], 'l');

        docPDF.setFillColor(0, 0, 0);
        docPDF.rect(0, 0, pageWidth, pageHeight, 'F');

        docPDF.setTextColor(255, 255, 255);

        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(7);
        docPDF.text('Arena Simonésia 2026', 5, 6);
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

        const logoImg = new Image();
        logoImg.src = '/arena-logo-transparent.png';
        await new Promise((resolve) => { logoImg.onload = resolve; logoImg.onerror = resolve; });
        docPDF.addImage(logoImg, 'JPEG', pageWidth - 14, pageHeight - 10, 10, 7);

        docPDF.save(`Carteirinha_${student.nome.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error('Error generating PDF card:', error);
        showAlert('Erro ao gerar PDF da carteirinha.', 'error');
    }
};
