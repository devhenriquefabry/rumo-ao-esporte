import { useState, useMemo, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Download, Filter, Settings, X, Check, Columns } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { tenantProfile } from '../../config/tenantProfile';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64ImageFromURL } from '../AdminDashboard/utils/pdfUtils';

interface AdminReportsProps {
    registrations: any[];
    plans: any[];
    turmas?: any[];
}

interface ReportCategory {
    id: string;
    label: string;
    color: string;
}

interface ReportGroup {
    title: string;
    color: string;
    categories: ReportCategory[];
}

interface ColumnOption {
    id: string;
    label: string;
    getValue: (reg: any, plans: any[], turmas?: any[]) => string;
}

const ALL_COLUMNS: ColumnOption[] = [
    { id: 'aluno', label: 'Aluno', getValue: (reg) => reg.alunos?.[0]?.nome || 'N/A' },
    { id: 'modalidade', label: 'Modalidade', getValue: (reg) => (reg.modalidade || '').toUpperCase() },
    { id: 'plano', label: 'Plano', getValue: (reg, plans) => plans.find(p => p.id === reg.planId)?.nome || 'Sem plano' },
    {
        id: 'valor', label: 'Valor', getValue: (reg, plans) => {
            const plan = plans.find(p => p.id === reg.planId);
            if (!plan) return '—';
            const val = (plan.valores?.mensalidade?.ateVencimento || plan.associado?.mensalidade?.ateVencimento || plan.naoAssociado?.mensalidade?.ateVencimento || plan.valor || 0) / 100;
            return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    },
    { id: 'status', label: 'Status', getValue: (reg) => reg.contractStatus === 'aprovado' ? 'APROVADO' : reg.contractStatus === 'desativado' ? 'DESATIVADO' : 'PENDENTE' },
    { id: 'telefone', label: 'Telefone', getValue: (reg) => reg.responsavel?.telefonePrincipal || reg.responsavel?.celular || '' },
    { id: 'responsavel', label: 'Responsável', getValue: (reg) => reg.responsavel?.nome || '' },
    { id: 'dataNascimento', label: 'Data Nascimento', getValue: (reg) => reg.alunos?.[0]?.dataNascimento || '' },
    {
        id: 'turma', label: 'Turma', getValue: (reg, _plans, turmas) => {
            const turmaId = reg.alunos?.[0]?.turmaId;
            if (!turmaId || !turmas) return '';
            const turma = turmas.find((t: any) => t.id === turmaId);
            return turma ? `${turma.nome}${turma.horario ? ' (' + turma.horario + ')' : ''}` : '';
        }
    }
];

const DEFAULT_COLUMNS = ['aluno', 'plano', 'status', 'telefone'];

// Mapa de modalidades → grupos de relatórios
const allReportGroups: ReportGroup[] = [
    {
        title: 'FUTEBOL', color: '#00a63a',
        categories: [
            { id: 'futebol_geral', label: 'Todos os Alunos', color: '#00a63a' },
            { id: 'futebol_bolsista_50', label: 'Bolsistas 50%', color: '#8b5cf6' },
            { id: 'futebol_bolsista_integral', label: 'Bolsistas Integral', color: '#6d28d9' }
        ]
    },
    {
        title: 'NATAÇÃO', color: '#0891b2',
        categories: [
            { id: 'natacao_geral', label: 'Todos os Alunos', color: '#0891b2' },
            { id: 'natacao_bolsista_50', label: 'Bolsistas 50%', color: '#8b5cf6' },
            { id: 'natacao_bolsista_integral', label: 'Bolsistas Integral', color: '#6d28d9' }
        ]
    },
    {
        title: 'HIDROGINÁSTICA', color: '#14b8a6',
        categories: [
            { id: 'hidro_geral', label: 'Todos os Alunos', color: '#14b8a6' }
        ]
    },
    {
        title: 'VOLEIBOL', color: '#d97706',
        categories: [
            { id: 'voleibol_geral', label: 'Todos os Alunos', color: '#d97706' }
        ]
    },
    {
        title: 'COMPETIÇÃO', color: '#7c3aed',
        categories: [
            { id: 'alunos_competicao', label: 'Alunos Competição', color: '#7c3aed' }
        ]
    },
    {
        title: 'VISÃO GERAL', color: '#1e293b',
        categories: [
            { id: 'todos_bolsistas', label: 'Todos Bolsistas', color: '#8b5cf6' },
            { id: 'todos_aprovados', label: 'Todos Aprovados', color: '#059669' },
            { id: 'todos_pendentes', label: 'Todos Pendentes', color: '#f59e0b' },
            { id: 'todos_desativados', label: 'Todos Desativados', color: '#94a3b8' }
        ]
    }
];

// Filtra grupos de relatórios com base nas modalidades do tenant
const tenantModalities = tenantProfile.modalities.map(m => m.toUpperCase());
const reportGroups: ReportGroup[] = allReportGroups.filter(group => group.title === 'FUTEBOL' && tenantModalities.includes('FUTEBOL'));

const CONFIG_DOC_ID = 'report_category_configs';

export default function AdminReports({ registrations, plans, turmas = [] }: AdminReportsProps) {
    const [expandedGroup, setExpandedGroup] = useState<string | null>(reportGroups[0]?.title || null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'aprovado' | 'pendente' | 'desativado'>('all');

    // Plan config per category
    const [categoryConfigs, setCategoryConfigs] = useState<Record<string, string[]>>({});
    const [configModal, setConfigModal] = useState<{ categoryId: string; selectedPlanIds: string[] } | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);

    // Column config
    const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
    const [columnsModal, setColumnsModal] = useState(false);
    const [tempColumns, setTempColumns] = useState<string[]>(DEFAULT_COLUMNS);

    // Load configs from Firebase
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setCategoryConfigs(data.configs || {});
                    if (data.columns?.length) setSelectedColumns(data.columns);
                }
            } catch (err) {
                console.error('Error loading report configs:', err);
            }
        };
        loadConfigs();
    }, []);

    const saveConfig = async (categoryId: string, planIds: string[]) => {
        setSavingConfig(true);
        try {
            const newConfigs = { ...categoryConfigs, [categoryId]: planIds };
            setCategoryConfigs(newConfigs);
            const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
            await setDoc(docRef, { configs: newConfigs }, { merge: true });
            setConfigModal(null);
        } catch (err) {
            console.error('Error saving report config:', err);
        } finally {
            setSavingConfig(false);
        }
    };

    const saveColumns = async (cols: string[]) => {
        setSelectedColumns(cols);
        setColumnsModal(false);
        try {
            const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
            await setDoc(docRef, { columns: cols }, { merge: true });
        } catch (err) {
            console.error('Error saving columns:', err);
        }
    };

    const filteredRegs = useMemo(() => {
        if (statusFilter === 'all') return registrations.filter(r => r.contractStatus !== 'desativado' && r.status !== 'desativado');
        if (statusFilter === 'aprovado') return registrations.filter(r => r.contractStatus === 'aprovado');
        if (statusFilter === 'pendente') return registrations.filter(r => r.contractStatus !== 'aprovado' && r.contractStatus !== 'desativado' && r.status !== 'desativado');
        if (statusFilter === 'desativado') return registrations.filter(r => r.contractStatus === 'desativado');
        return registrations;
    }, [registrations, statusFilter]);

    const getCategoryData = (categoryId: string) => {
        const configuredPlanIds = categoryConfigs[categoryId];
        if (configuredPlanIds && configuredPlanIds.length > 0) {
            return filteredRegs.filter(reg => configuredPlanIds.includes(reg.planId));
        }
        return [];
    };

    const getStudentCount = (regs: any[]) => regs.reduce((acc, r) => acc + (r.alunos?.length || 0), 0);

    const activeColumns = ALL_COLUMNS.filter(c => selectedColumns.includes(c.id));


    const exportCategoryPDF = async (category: ReportCategory, data: any[]) => {
        const pdfDoc = new jsPDF();
        pdfDoc.setFontSize(16);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text(`Relatório: ${category.label}`, 14, 20);
        pdfDoc.setFontSize(10);
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.text(`Total: ${data.length} cadastros | ${getStudentCount(data)} alunos`, 14, 28);
        pdfDoc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 34);

        // Fetch photos as base64 in batches
        const photoDataMap: Record<number, string | null> = {};
        const batchSize = 5;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await Promise.all(batch.map(async (reg, batchIdx) => {
                const globalIdx = i + batchIdx;
                const fotoUrl = reg.alunos?.[0]?.fotoUrl;
                if (fotoUrl) {
                    try {
                        const fetchImg = getBase64ImageFromURL(fotoUrl);
                        photoDataMap[globalIdx] = await Promise.race([
                            fetchImg,
                            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
                        ]) as string;
                    } catch (e) {
                        console.warn(`Erro ao carregar foto do aluno no relatório: ${reg.alunos?.[0]?.nome}`, e);
                        photoDataMap[globalIdx] = null;
                    }
                }
            }));
        }

        const pdfColumns = activeColumns.filter(c => c.id !== 'foto');
        const allHeaders = ['Foto', ...pdfColumns.map(c => c.label)];
        const body = data.map(reg => ['', ...pdfColumns.map(c => c.getValue(reg, plans, turmas))]);

        autoTable(pdfDoc, {
            startY: 40,
            head: [allHeaders],
            body: body,
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
            headStyles: { fillColor: [0, 125, 47], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            columnStyles: { 0: { cellWidth: 15, minCellHeight: 16 } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            tableWidth: 'auto',
            margin: { left: 14, right: 14 },
            didDrawCell: (cellData) => {
                if (cellData.section === 'body' && cellData.column.index === 0) {
                    const photo = photoDataMap[cellData.row.index];
                    if (photo) {
                        try {
                            const size = 12;
                            const x = cellData.cell.x + (cellData.cell.width - size) / 2;
                            const y = cellData.cell.y + (cellData.cell.height - size) / 2;
                            const base64Data = photo.split(',')[1] || photo;
                            const format = photo.includes('png') ? 'PNG' : 'JPEG';
                            pdfDoc.addImage(base64Data, format, x, y, size, size);
                        } catch (e) {
                            console.error("Error drawing photo in report PDF:", e);
                        }
                    }
                }
            }
        });

        pdfDoc.save(`relatorio_${category.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const openConfigModal = (categoryId: string) => {
        setConfigModal({ categoryId, selectedPlanIds: categoryConfigs[categoryId] || [] });
    };

    const togglePlanInModal = (planId: string) => {
        if (!configModal) return;
        setConfigModal(prev => {
            if (!prev) return null;
            return {
                ...prev,
                selectedPlanIds: prev.selectedPlanIds.includes(planId)
                    ? prev.selectedPlanIds.filter(id => id !== planId)
                    : [...prev.selectedPlanIds, planId]
            };
        });
    };

    return (
        <div className="animate-fade-in" style={{ marginTop: '20px' }}>

            {/* ======= PLAN CONFIG MODAL ======= */}
            {configModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    onClick={() => setConfigModal(null)}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>Configurar Relatório</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Selecione quais planos pertencem a esta categoria</p>
                            </div>
                            <button onClick={() => setConfigModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} color="#94a3b8" />
                            </button>
                        </div>
                        <div style={{ padding: '16px 20px', maxHeight: '50vh', overflowY: 'auto' }}>
                            {plans.filter(p => p.active).map(plan => {
                                const isSelected = configModal.selectedPlanIds.includes(plan.id);
                                const monthlyVal = (plan.valores?.mensalidade?.ateVencimento || plan.associado?.mensalidade?.ateVencimento || plan.naoAssociado?.mensalidade?.ateVencimento || plan.valor || 0) / 100;
                                return (
                                    <div key={plan.id} onClick={() => togglePlanInModal(plan.id)} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                                        border: isSelected ? '2px solid #00a63a' : '1px solid #f1f5f9', background: isSelected ? '#fef2f2' : '#fff',
                                        marginBottom: '8px', transition: 'all 0.15s'
                                    }}>
                                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #00a63a' : '2px solid #d1d5db', background: isSelected ? '#00a63a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {isSelected && <Check size={14} color="#fff" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{plan.nome}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                                                {plan.modalidade?.toUpperCase() || 'SEM MODALIDADE'} • {monthlyVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {plans.filter(p => !p.active).length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', padding: '10px 0 6px', marginTop: '8px', borderTop: '1px solid #f1f5f9' }}>Planos Inativos</div>
                                    {plans.filter(p => !p.active).map(plan => {
                                        const isSelected = configModal.selectedPlanIds.includes(plan.id);
                                        return (
                                            <div key={plan.id} onClick={() => togglePlanInModal(plan.id)} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                                border: isSelected ? '2px solid #94a3b8' : '1px solid #f1f5f9', background: isSelected ? '#f8fafc' : '#fff',
                                                marginBottom: '8px', opacity: 0.7
                                            }}>
                                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #94a3b8' : '2px solid #d1d5db', background: isSelected ? '#94a3b8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {isSelected && <Check size={14} color="#fff" />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem' }}>{plan.nome} <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(inativo)</span></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                        <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>{configModal.selectedPlanIds.length} plano(s)</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setConfigModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={() => saveConfig(configModal.categoryId, configModal.selectedPlanIds)} disabled={savingConfig} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', opacity: savingConfig ? 0.7 : 1 }}>
                                    {savingConfig ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ======= COLUMNS CONFIG MODAL ======= */}
            {columnsModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    onClick={() => setColumnsModal(false)}>
                    <div className="animate-scale-in" style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: '900' }}>Colunas do Relatório</h3>
                            <button onClick={() => setColumnsModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={20} color="#94a3b8" />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>Selecione as colunas que serão exibidas na tabela e no PDF:</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            {ALL_COLUMNS.map(col => {
                                const isSelected = tempColumns.includes(col.id);
                                return (
                                    <label key={col.id} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '14px 10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                        background: isSelected ? '#fef2f2' : '#f8fafc',
                                        border: `2px solid ${isSelected ? '#00a63a' : '#e2e8f0'}`,
                                        position: 'relative', minHeight: '50px', transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                                setTempColumns(prev =>
                                                    prev.includes(col.id)
                                                        ? prev.filter(c => c !== col.id)
                                                        : [...prev, col.id]
                                                );
                                            }}
                                            style={{ position: 'absolute', top: '6px', right: '6px', accentColor: '#00a63a', width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isSelected ? '#00a63a' : '#64748b' }}>{col.label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setColumnsModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: '700', cursor: 'pointer', color: '#64748b' }}>Cancelar</button>
                            <button onClick={() => saveColumns(tempColumns)} disabled={tempColumns.length === 0} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: '700', cursor: 'pointer', opacity: tempColumns.length === 0 ? 0.5 : 1 }}>Salvar Colunas</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======= HEADER: FILTERS + COLUMNS BUTTON ======= */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: '800', fontSize: '0.8rem' }}>
                        <Filter size={16} /> FILTRAR:
                    </div>
                    {[
                        { id: 'all', label: 'TODOS' },
                        { id: 'aprovado', label: 'APROVADOS' },
                        { id: 'pendente', label: 'PENDENTES' },
                        { id: 'desativado', label: 'DESATIVADOS' }
                    ].map(opt => (
                        <button key={opt.id} onClick={() => setStatusFilter(opt.id as any)} style={{
                            padding: '6px 14px', borderRadius: '8px',
                            border: statusFilter === opt.id ? '2px solid #00a63a' : '1px solid #e2e8f0',
                            background: statusFilter === opt.id ? '#fef2f2' : '#fff',
                            color: statusFilter === opt.id ? '#00a63a' : '#64748b',
                            fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s'
                        }}>{opt.label}</button>
                    ))}
                </div>

                <button onClick={() => { setTempColumns([...selectedColumns]); setColumnsModal(true); }} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px',
                    border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '700',
                    fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                }}>
                    <Columns size={16} /> COLUNAS ({selectedColumns.length})
                </button>
            </div>

            {/* ======= REPORT GROUPS ======= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reportGroups.map(group => {
                    const isGroupExpanded = expandedGroup === group.title;
                    return (
                        <div key={group.title} style={{
                            background: '#fff', borderRadius: '16px', overflow: 'hidden',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
                            border: `1px solid ${isGroupExpanded ? group.color + '40' : '#f1f5f9'}`
                        }}>
                            <button onClick={() => setExpandedGroup(isGroupExpanded ? null : group.title)} style={{
                                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '16px 20px', background: isGroupExpanded ? group.color : '#fff',
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FileText size={18} color={isGroupExpanded ? '#fff' : group.color} />
                                    <span style={{ fontWeight: '900', fontSize: '0.95rem', color: isGroupExpanded ? '#fff' : '#1e293b', letterSpacing: '0.5px' }}>{group.title}</span>
                                    <span style={{ background: isGroupExpanded ? 'rgba(255,255,255,0.2)' : group.color + '15', color: isGroupExpanded ? '#fff' : group.color, padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' }}>
                                        {group.categories.length} relatórios
                                    </span>
                                </div>
                                {isGroupExpanded ? <ChevronUp size={18} color="#fff" /> : <ChevronDown size={18} color="#94a3b8" />}
                            </button>

                            {isGroupExpanded && (
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {group.categories.map(category => {
                                        const hasConfig = (categoryConfigs[category.id]?.length || 0) > 0;
                                        const data = getCategoryData(category.id);
                                        const studentCount = getStudentCount(data);
                                        const isCatExpanded = expandedCategory === category.id;
                                        const configPlanCount = categoryConfigs[category.id]?.length || 0;

                                        return (
                                            <div key={category.id} style={{ borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden', background: isCatExpanded ? '#fafbfc' : '#fff' }}>
                                                {/* Category Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}
                                                    onClick={() => setExpandedCategory(isCatExpanded ? null : category.id)}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: category.color }} />
                                                        <span style={{ fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>{category.label}</span>
                                                        {hasConfig ? (
                                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{configPlanCount} plano(s)</span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#f59e0b', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>NÃO CONFIGURADO</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ fontWeight: '900', color: category.color, fontSize: '1.1rem' }}>{data.length}</span>
                                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '4px' }}>cadastros ({studentCount} alunos)</span>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); openConfigModal(category.id); }} title="Configurar planos" style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px',
                                                            border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                                                        }}>
                                                            <Settings size={12} /> ⚙
                                                        </button>
                                                        {data.length > 0 && (
                                                            <button onClick={(e) => { e.stopPropagation(); exportCategoryPDF(category, data); }} title="Exportar PDF" style={{
                                                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px',
                                                                border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                                                            }}>
                                                                <Download size={12} /> PDF
                                                            </button>
                                                        )}
                                                        {isCatExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                                                    </div>
                                                </div>

                                                {/* Student Table */}
                                                {isCatExpanded && data.length > 0 && (
                                                    <div style={{ padding: '0 16px 16px', maxHeight: '400px', overflowY: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>#</th>
                                                                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Foto</th>
                                                                    {activeColumns.filter(c => c.id !== 'foto').map(col => (
                                                                        <th key={col.id} style={{ textAlign: 'left', padding: '8px 6px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>{col.label}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {data.map((reg: any, idx: number) => (
                                                                    <tr key={reg.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                                                                        onClick={() => window.location.href = `/admin/details/${reg.id}`}
                                                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                                                        <td style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: '600' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '4px 6px' }}>
                                                                            {(() => {
                                                                                const fotoUrl = reg.alunos?.[0]?.fotoUrl;
                                                                                return fotoUrl
                                                                                    ? <img src={fotoUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                                    : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9' }} />;
                                                                            })()}
                                                                        </td>
                                                                        {activeColumns.filter(c => c.id !== 'foto').map(col => {
                                                                            const val = col.getValue(reg, plans, turmas);

                                                                            if (col.id === 'status') {
                                                                                return (
                                                                                    <td key={col.id} style={{ padding: '8px 6px' }}>
                                                                                        <span style={{
                                                                                            display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
                                                                                            fontSize: '0.65rem', fontWeight: '800',
                                                                                            background: val === 'APROVADO' ? '#dcfce7' : val === 'DESATIVADO' ? '#f1f5f9' : '#fef3c7',
                                                                                            color: val === 'APROVADO' ? '#16a34a' : val === 'DESATIVADO' ? '#94a3b8' : '#d97706'
                                                                                        }}>{val}</span>
                                                                                    </td>
                                                                                );
                                                                            }
                                                                            return <td key={col.id} style={{ padding: '8px 6px', fontWeight: col.id === 'aluno' ? '700' : '400', color: col.id === 'aluno' ? '#1e293b' : '#64748b' }}>{val}</td>;
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {isCatExpanded && !hasConfig && (
                                                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#f59e0b', fontSize: '0.85rem' }}>
                                                        <p style={{ margin: 0, fontWeight: '700' }}>⚠ Configure quais planos pertencem a esta categoria.</p>
                                                        <button onClick={() => openConfigModal(category.id)} style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '8px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                            Configurar Agora
                                                        </button>
                                                    </div>
                                                )}

                                                {isCatExpanded && hasConfig && data.length === 0 && (
                                                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                        Nenhum cadastro encontrado nesta categoria.
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
