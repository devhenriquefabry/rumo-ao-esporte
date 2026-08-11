import { jsPDF } from 'jspdf';

const ASSOCIACAO = {
    nome: 'Associação Rumo ao Esporte e ao Lazer - REAL',
    cnpj: '60.642.277/0001-40',
    endereco: 'Av. Cota Emerick, 87, Fundos - Loja Doce Luiza, Centro, Martins Soares/MG, CEP 36.972-000',
    email: 'rumoaoesporte@gmail.com',
    telefone: '(33) 9978-6088',
    logo: '/rumo-ao-esporte-logo.png',
    assinatura: '/assinatura-associacao.png'
};

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function centenaPorExtenso(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100);
    const d = n % 100;
    const parts: string[] = [];
    if (c > 0) parts.push(CENTENAS[c]);
    if (d > 0) {
        if (d < 10) parts.push(UNIDADES[d]);
        else if (d < 20) parts.push(DEZ_A_DEZENOVE[d - 10]);
        else {
            const du = Math.floor(d / 10);
            const u = d % 10;
            parts.push(u > 0 ? `${DEZENAS[du]} e ${UNIDADES[u]}` : DEZENAS[du]);
        }
    }
    return parts.join(' e ');
}

function inteiroPorExtenso(n: number): string {
    if (n === 0) return 'zero';
    const milhoes = Math.floor(n / 1000000);
    const milhares = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;
    const parts: string[] = [];
    if (milhoes > 0) parts.push(`${milhoes === 1 ? 'um milhão' : `${centenaPorExtenso(milhoes)} milhões`}`);
    if (milhares > 0) parts.push(`${milhares === 1 ? 'mil' : `${centenaPorExtenso(milhares)} mil`}`);
    if (resto > 0) parts.push(centenaPorExtenso(resto));
    if (parts.length <= 1) return parts.join('');
    // "e" liga apenas quando o último grupo é < 100 (ou é o único resto); grupos de milhar/milhão são separados por vírgula
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).join(', ');
    const useE = resto === 0 || resto < 100;
    return useE ? `${head} e ${last}` : `${head}, ${last}`;
}

export function valorPorExtenso(valor: number): string {
    const reais = Math.floor(valor);
    const centavos = Math.round((valor - reais) * 100);
    const reaisStr = `${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`;
    if (centavos === 0) return reaisStr;
    const centavosStr = `${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
    return `${reaisStr} e ${centavosStr}`;
}

function formatDateBR(value?: string | null): string {
    if (!value) return '-';
    const datePart = value.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (!year || !month || !day) return '-';
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function extractStudentName(description?: string): string {
    if (!description) return '-';
    // Formato usual: "MENSALIDADE AGO - NOME DO ALUNO (MODALIDADE)"
    const semModalidade = description.replace(/\([^)]*\)\s*$/, '').trim();
    const partes = semModalidade.split(' - ');
    return (partes.length > 1 ? partes.slice(1).join(' - ') : semModalidade).trim() || '-';
}

function loadImageAsDataUrl(src: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(null); return; }
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

interface ReceiptPayment {
    id: string;
    description?: string;
    value: number;
    dueDate: string;
    status: string;
    billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
    externalReference?: string;
    paymentDate?: string | null;
    totalPaid?: number | null;
}

export async function generatePaymentReceiptPDF(payment: ReceiptPayment, responsibleName?: string) {
    const docPDF = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = docPDF.internal.pageSize.width;
    const margin = 18;
    let y = 18;

    const logo = await loadImageAsDataUrl(ASSOCIACAO.logo);
    if (logo) {
        docPDF.addImage(logo, 'PNG', margin, y - 6, 20, 20);
    }

    docPDF.setFont('helvetica', 'bold');
    docPDF.setFontSize(12);
    docPDF.setTextColor(0, 60, 30);
    docPDF.text(ASSOCIACAO.nome.toUpperCase(), margin + (logo ? 24 : 0), y);
    y += 5;

    docPDF.setFont('helvetica', 'normal');
    docPDF.setFontSize(8);
    docPDF.setTextColor(90, 90, 90);
    docPDF.text(`CNPJ ${ASSOCIACAO.cnpj}`, margin + (logo ? 24 : 0), y);
    y += 4;
    docPDF.text(ASSOCIACAO.endereco, margin + (logo ? 24 : 0), y, { maxWidth: pageWidth - margin * 2 - (logo ? 24 : 0) });
    y += 4;
    docPDF.text(`${ASSOCIACAO.email}  |  ${ASSOCIACAO.telefone}`, margin + (logo ? 24 : 0), y);

    y += 12;
    docPDF.setDrawColor(0, 166, 58);
    docPDF.setLineWidth(0.6);
    docPDF.line(margin, y, pageWidth - margin, y);
    y += 12;

    docPDF.setFont('helvetica', 'bold');
    docPDF.setFontSize(16);
    docPDF.setTextColor(0, 0, 0);
    docPDF.text('RECIBO DE PAGAMENTO', pageWidth / 2, y, { align: 'center' });
    y += 6;

    docPDF.setFont('helvetica', 'normal');
    docPDF.setFontSize(9);
    docPDF.setTextColor(120, 120, 120);
    docPDF.text(`Nº ${payment.externalReference || payment.id}`, pageWidth / 2, y, { align: 'center' });
    y += 14;

    const alunoNome = extractStudentName(payment.description);
    const valorFormatado = `R$ ${payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    docPDF.setFont('helvetica', 'normal');
    docPDF.setFontSize(11);
    docPDF.setTextColor(30, 30, 30);
    const paragraph = `A ${ASSOCIACAO.nome}, inscrita no CNPJ nº ${ASSOCIACAO.cnpj}, declara ter recebido de ${responsibleName ? responsibleName.toUpperCase() : 'RESPONSÁVEL FINANCEIRO'} a quantia de ${valorFormatado} (${valorPorExtenso(payment.value)}), referente a "${payment.description || 'mensalidade'}"${alunoNome !== '-' ? `, do(a) atleta ${alunoNome.toUpperCase()}` : ''}.`;
    const lines = docPDF.splitTextToSize(paragraph, pageWidth - margin * 2);
    docPDF.text(lines, margin, y);
    y += lines.length * 6 + 10;

    const fields: [string, string][] = [
        ['Valor pago', valorFormatado],
        ['Forma de pagamento', payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType === 'PIX' ? 'Pix' : payment.status === 'RECEIVED_IN_CASH' ? 'Dinheiro' : '-'],
        ['Data de vencimento', formatDateBR(payment.dueDate)],
        ['Data do pagamento', formatDateBR(payment.paymentDate) !== '-' ? formatDateBR(payment.paymentDate) : 'Confirmado no sistema'],
        ['Status', 'PAGO'],
    ];

    docPDF.setFontSize(10);
    fields.forEach(([label, value]) => {
        docPDF.setFont('helvetica', 'bold');
        docPDF.setTextColor(60, 60, 60);
        docPDF.text(`${label}:`, margin, y);
        docPDF.setFont('helvetica', 'normal');
        docPDF.setTextColor(20, 20, 20);
        docPDF.text(value, margin + 55, y);
        y += 7;
    });

    y += 10;
    const assinatura = await loadImageAsDataUrl(ASSOCIACAO.assinatura);
    if (assinatura) {
        const sigWidth = 45;
        const sigHeight = 17;
        docPDF.addImage(assinatura, 'PNG', pageWidth / 2 - sigWidth / 2, y, sigWidth, sigHeight);
        y += sigHeight;
    } else {
        y += 6;
    }

    docPDF.setDrawColor(200, 200, 200);
    docPDF.setLineWidth(0.3);
    docPDF.line(pageWidth / 2 - 35, y, pageWidth / 2 + 35, y);
    y += 5;
    docPDF.setFont('helvetica', 'bold');
    docPDF.setFontSize(9);
    docPDF.setTextColor(30, 30, 30);
    docPDF.text(ASSOCIACAO.nome, pageWidth / 2, y, { align: 'center' });
    y += 4;
    docPDF.setFont('helvetica', 'normal');
    docPDF.setFontSize(8);
    docPDF.setTextColor(120, 120, 120);
    docPDF.text(`CNPJ ${ASSOCIACAO.cnpj}`, pageWidth / 2, y, { align: 'center' });

    const now = new Date();
    const emissao = `Documento emitido eletronicamente pelo sistema de gestão da associação em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}.`;
    docPDF.setFontSize(7);
    docPDF.setTextColor(150, 150, 150);
    docPDF.text(emissao, pageWidth / 2, 285, { align: 'center' });

    const fileName = `Recibo_${(alunoNome !== '-' ? alunoNome : 'Pagamento').replace(/\s+/g, '_')}_${formatDateBR(payment.dueDate).replace(/\//g, '-')}.pdf`;
    docPDF.save(fileName);
}
