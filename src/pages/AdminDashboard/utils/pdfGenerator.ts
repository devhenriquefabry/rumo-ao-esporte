import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64ImageFromURL } from './pdfUtils';
import type { Student, Turma } from '../types';
import type { Plan } from '../../../utils/planService';
import { SORT_OPTIONS } from '../constants';

export const generatePDF = async (
    modality: string,
    students: Student[],
    turmas: Turma[],
    plans: Plan[],
    selectedColumns: string[],
    sortBy?: string
) => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(16);
    doc.setTextColor(0, 125, 47);
    doc.text(`Relatório Geral - ${modality.toUpperCase()}`, 14, yPos);
    yPos += 8;

    if (sortBy) {
        const sortOpt = SORT_OPTIONS.find(opt => opt.id === sortBy);
        if (sortOpt) {
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Ordenação: ${sortOpt.label}`, 14, yPos);
            yPos += 8;
        }
    }
    yPos += 2;

    // Processamento em lotes para garantir o carregamento das fotos sem sobrecarregar a rede/memória
    const tableData: any[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < students.length; i += batchSize) {
        const batch = students.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (item) => {
            let turmaNome = '-';
            if (item.aluno?.turmaId) {
                const t = turmas.find((t: any) => t.id === item.aluno?.turmaId);
                if (t) turmaNome = `${t.nome} (${t.horario})`;
            }

            let photoData = null;
            if (item.aluno?.fotoUrl) {
                try {
                    // Timeout maior para garantir carregamento em conexões lentas
                    const fetchImg = getBase64ImageFromURL(item.aluno.fotoUrl);
                    photoData = await Promise.race([
                        fetchImg, 
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                    ]);
                } catch (e) {
                    console.warn(`Falha ao carregar foto do aluno: ${item.aluno?.nome}`, e);
                }
            }

            const f = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            return {
                photo: photoData,
                name: item.aluno?.nome?.toUpperCase() || '-',
                turma: turmaNome,
                birth: item.aluno?.dataNascimento || '-',
                resp: item.responsavel?.nome?.toUpperCase() || '-',
                contact: item.responsavel?.telefonePrincipal || item.responsavel?.celular || item.responsavel?.telefone || '-',
                plano: (() => {
                    const plan = plans.find(p => p.id === item.planId);
                    if (!plan) return '-';
                    if (plan.valores?.mensalidade) {
                        return `${plan.nome} (${f(plan.valores.mensalidade.ateVencimento)} / ${f(plan.valores.mensalidade.aposVencimento)})`;
                    }
                    if (plan.valor) return `${plan.nome} (${f(plan.valor)})`;
                    return plan.nome;
                })(),
                statusFin: item.financialPendingAmount > 0 ? `${item.financialPendingDescription || 'PENDENTE'}\n ` : 'EM DIA',
                whatsappUrl: generateWhatsAppUrl(item)
            };
        }));
        tableData.push(...batchResults);
    }
    const columns = getVisibleColumns(selectedColumns);

    autoTable(doc, {
        startY: yPos,
        columns: columns.map(col => ({ header: col.header, dataKey: col.id })),
        body: tableData.map(row => {
            const mappedRow: any = {};
            columns.forEach(col => {
                mappedRow[col.id] = col.id === 'photo' ? '' : (row as any)[col.id] || '-';
            });
            return mappedRow;
        }),
        theme: 'grid',
        headStyles: { fillColor: [0, 125, 47], textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        columnStyles: {
            photo: { cellWidth: 15, minCellHeight: 18 },
            statusFin: { cellWidth: 35 } // Dando espaço para o botão COBRAR
        },
        tableWidth: 'auto',
        margin: { left: 14, right: 14 },
        didDrawCell: (data) => handleCellDrawing(data, doc, columns, tableData, selectedColumns),
        alternateRowStyles: { fillColor: [248, 249, 250] }
    });

    doc.save(`lista-${modality}.pdf`);
};

// Helper functions (could be moved if file gets too long)
function getVisibleColumns(selected: string[]) {
    return [
        { id: 'photo', header: 'Foto' },
        { id: 'name', header: 'Nome do Aluno' },
        { id: 'birth', header: 'Nascimento' },
        { id: 'turma', header: 'Turma' },
        { id: 'plano', header: 'Plano / Valores' },
        { id: 'statusFin', header: 'Pendência' },
        { id: 'resp', header: 'Responsável' },
        { id: 'contact', header: 'Contato' }
    ].filter(col => selected.includes(col.id) && col.id !== 'waButton');
}

function generateWhatsAppUrl(item: Student) {
    if (item.financialPendingAmount <= 0) return null;
    const rawPhone = item.responsavel?.telefonePrincipal || item.responsavel?.celular || item.responsavel?.telefone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return null;
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const studentName = (item.aluno?.nome || 'aluno').trim();
    const pendingDesc = item.financialPendingDescription || 'parcela em aberto';
    const pendingAmount = (item.financialPendingAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const invoiceUrl = item.financialInvoiceUrl || '';

    const msg = [
        `https://arenasimonesia.web.app`,
        ``,
        `Olá, tudo bem?`,
        ``,
        `Notamos uma pendência financeira referente ao aluno(a) *${studentName}*:`,
        `*Item:* ${pendingDesc}`,
        `*Valor:* ${pendingAmount}`,
        ``,
        `É muito importante manter as mensalidades em dia para garantir o acesso ao sistema.`,
        invoiceUrl ? `Link para pagamento: ${invoiceUrl}` : '',
        ``,
        `Caso já tenha pago, por favor desconsidere. Atenciosamente, Equipe Arena Simonésia.`
    ].filter(Boolean).join('\n');

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function handleCellDrawing(data: any, doc: jsPDF, columns: any[], tableData: any[], selectedColumns: string[]) {
    const photoIdx = columns.findIndex(c => c.id === 'photo');
    const statusFinIdx = columns.findIndex(c => c.id === 'statusFin');
    const showWaButton = selectedColumns.includes('waButton');

    if (data.section === 'body') {
        // Draw Photo
        if (data.column.index === photoIdx) {
            const photoData = tableData[data.row.index]?.photo;
            if (photoData) {
                try {
                    const padding = 1;
                    const size = Math.min(data.cell.width, data.cell.height) - (padding * 2);
                    const x = data.cell.x + (data.cell.width - size) / 2;
                    const y = data.cell.y + (data.cell.height - size) / 2;

                    // Removendo prefixo data:image/...;base64, se presente para compatibilidade extra
                    const base64Data = photoData.split(',')[1] || photoData;
                    const format = photoData.includes('png') ? 'PNG' : 'JPEG';

                    doc.addImage(base64Data, format, x, y, size, size);
                } catch (e) {
                    // Se falhar com o split, tenta direto
                    try {
                        doc.addImage(photoData, 'JPEG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2);
                    } catch (err) {
                        console.error("Error drawing photo in PDF:", err);
                    }
                }
            }
        }

        // Draw WhatsApp Button
        if (showWaButton && data.column.index === statusFinIdx) {
            const url = tableData[data.row.index]?.whatsappUrl;
            if (url) {
                const padding = 1;
                const btnWidth = 18;
                const btnHeight = 4;
                const x = data.cell.x + (data.cell.width - btnWidth) / 2;
                const y = data.cell.y + data.cell.height - btnHeight - padding;

                doc.setFillColor(37, 211, 102);
                doc.roundedRect(x, y, btnWidth, btnHeight, 0.5, 0.5, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(5.5);
                doc.text("COBRAR", x + btnWidth / 2, y + 3, { align: 'center' });
                doc.link(x, y, btnWidth, btnHeight, { url });
            }
        }
    }
}

export const generateOverduePDF = async (data: any[], showWaButton: boolean) => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(16);
    doc.setTextColor(0, 125, 47);
    doc.text(`Relatório de Inadimplência - ${new Date().toLocaleDateString('pt-BR')}`, 14, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total de inadimplentes: ${data.length}`, 14, yPos);
    yPos += 10;

    // Processamento em lotes para inadimplentes
    const tableData: any[] = [];
    const batchSize = 5;

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (reg) => {
            let photoData = null;
            if (reg.alunos?.[0]?.fotoUrl) {
                try {
                    const fetchImg = getBase64ImageFromURL(reg.alunos[0].fotoUrl);
                    photoData = await Promise.race([
                        fetchImg, 
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                    ]);
                } catch (e) {
                    console.warn(`Falha ao carregar foto do aluno inadimplente: ${reg.alunos?.[0]?.nome}`, e);
                }
            }

            const pendingItemsText = reg.pendingItems
                ? reg.pendingItems.map((p: any) => `${p.description}: R$ ${p.value.toFixed(2)}`).join('\n')
                : reg.financialPendingDescription || 'Pendência';

            return {
                photo: photoData,
                name: reg.alunos?.[0]?.nome?.toUpperCase() || '-',
                resp: reg.responsavel?.nome?.toUpperCase() || '-',
                contact: reg.responsavel?.telefonePrincipal || '-',
                pendencia: `${pendingItemsText}\nTOTAL: R$ ${reg.financialPendingAmount.toFixed(2)}`,
                days: `${reg.daysOverdue} dias`,
                whatsappUrl: generateWhatsAppUrl({
                    ...reg,
                    aluno: reg.alunos?.[0]
                } as any)
            };
        }));
        tableData.push(...batchResults);
    }

    const columns = [
        { id: 'photo', header: 'Foto' },
        { id: 'name', header: 'Aluno' },
        { id: 'resp', header: 'Responsável' },
        { id: 'contact', header: 'Contato' },
        { id: 'pendencia', header: 'Pendência' },
        { id: 'days', header: 'Atraso' }
    ];

    autoTable(doc, {
        startY: yPos,
        columns: columns.map(col => ({ header: col.header, dataKey: col.id })),
        body: tableData.map(row => {
            const mappedRow: any = {};
            columns.forEach(col => {
                mappedRow[col.id] = col.id === 'photo' ? '' : (row as any)[col.id] || '-';
            });
            return mappedRow;
        }),
        theme: 'grid',
        headStyles: { fillColor: [0, 125, 47], textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        columnStyles: {
            photo: { cellWidth: 15, minCellHeight: 18 },
            pendencia: { cellWidth: 40 },
            days: { cellWidth: 12, halign: 'center' }
        },
        tableWidth: 'auto',
        margin: { left: 14, right: 14 },
        didDrawCell: (cellData) => {
            const photoIdx = columns.findIndex(c => c.id === 'photo');
            const pendenciaIdx = columns.findIndex(c => c.id === 'pendencia');

            if (cellData.section === 'body') {
                // Photo Drawing
                if (cellData.column.index === photoIdx) {
                    const photo = tableData[cellData.row.index]?.photo;
                    if (photo) {
                        try {
                            const size = 12;
                            const x = cellData.cell.x + (cellData.cell.width - size) / 2;
                            const y = cellData.cell.y + (cellData.cell.height - size) / 2;
                            const base64Data = (photo as any).split(',')[1] || photo;
                            const format = (photo as any).includes('png') ? 'PNG' : 'JPEG';
                            doc.addImage(base64Data, format, x, y, size, size);
                        } catch (e) {
                            console.error("Error drawing photo in overdue PDF:", e);
                        }
                    }
                }

                // WhatsApp Button
                if (showWaButton && cellData.column.index === pendenciaIdx) {
                    const url = tableData[cellData.row.index]?.whatsappUrl;
                    if (url) {
                        const padding = 1;
                        const btnWidth = 18;
                        const btnHeight = 4;
                        const x = cellData.cell.x + (cellData.cell.width - btnWidth) / 2;
                        const y = cellData.cell.y + cellData.cell.height - btnHeight - padding;

                        doc.setFillColor(37, 211, 102);
                        doc.roundedRect(x, y, btnWidth, btnHeight, 0.5, 0.5, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(5.5);
                        doc.text("COBRAR", x + btnWidth / 2, y + 3, { align: 'center' });
                        doc.link(x, y, btnWidth, btnHeight, { url });
                    }
                }
            }
        },
        alternateRowStyles: { fillColor: [248, 249, 250] }
    });

    doc.save(`inadimplentes-${new Date().toISOString().split('T')[0]}.pdf`);
};
