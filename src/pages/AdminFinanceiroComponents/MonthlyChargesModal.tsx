import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CalendarDays, AlertTriangle, CheckCircle2, ShieldOff, Ban, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';
import type { StudentData } from '../../utils/financialTypes';
import type { Plan } from '../../utils/planService';
import type { PaymentProviderConfig } from '../../utils/paymentProviderConfig';
import { getPaymentProviderLabel } from '../../utils/paymentProviderConfig';
import {
    buildMonthlyChargesPreview,
    generateMonthlyCharges,
    formatCents,
    formatDateBR,
    suggestNextDueDate,
    type MonthlyChargeResult,
    type MonthlyChargesPreview
} from '../../utils/monthlyCharges';

interface MonthlyChargesModalProps {
    isOpen: boolean;
    onClose: () => void;
    registrations: StudentData[];
    plans: Plan[];
    workerUrl: string;
    paymentConfig: PaymentProviderConfig;
    onFinished: () => void;
    onRegistrationUpdated?: (registrationId: string, status: Record<string, any>) => void;
}

type SectionId = 'toCreate' | 'alreadyCharged' | 'needsReview' | 'exempt' | 'blocked';

const CARD_COLORS: Record<SectionId, { bg: string; border: string; text: string }> = {
    toCreate: { bg: '#f0fdf4', border: '#00a63a', text: '#00a63a' },
    alreadyCharged: { bg: '#f5f5f5', border: '#ddd', text: '#666' },
    needsReview: { bg: '#fff8e1', border: '#ffca28', text: '#a06800' },
    exempt: { bg: '#f3f0ff', border: '#c4b5fd', text: '#6d4aff' },
    blocked: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' }
};

export const MonthlyChargesModal: React.FC<MonthlyChargesModalProps> = ({
    isOpen,
    onClose,
    registrations,
    plans,
    workerUrl,
    paymentConfig,
    onFinished,
    onRegistrationUpdated
}) => {
    const { showAlert, showConfirm } = useDialog();
    const [dueDate, setDueDate] = useState(() => suggestNextDueDate(10));
    const [preview, setPreview] = useState<MonthlyChargesPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0, name: '' });
    const [result, setResult] = useState<MonthlyChargeResult | null>(null);
    const [openSection, setOpenSection] = useState<SectionId | null>(null);

    const loadPreview = useCallback(async (targetDate: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
        setLoadingPreview(true);
        setPreviewError('');
        try {
            setPreview(await buildMonthlyChargesPreview(targetDate, registrations, plans));
        } catch (error: any) {
            console.error('[MonthlyCharges] Erro na prévia:', error);
            setPreview(null);
            setPreviewError(error?.message || 'Não foi possível carregar a prévia.');
        } finally {
            setLoadingPreview(false);
        }
    }, [registrations, plans]);

    useEffect(() => {
        if (!isOpen) return;
        // Durante a geração a lista de cadastros muda a cada fatura criada; recalcular
        // a prévia ali só geraria leituras extras e números piscando na tela.
        if (generating) return;
        loadPreview(dueDate);
    }, [isOpen, dueDate, generating, loadPreview]);

    const sections = useMemo(() => {
        if (!preview) return [];
        return [
            { id: 'toCreate' as SectionId, label: 'A gerar', icon: Zap, count: preview.toCreate.length },
            { id: 'alreadyCharged' as SectionId, label: 'Já têm', icon: CheckCircle2, count: preview.alreadyCharged.length },
            { id: 'needsReview' as SectionId, label: 'Revisar', icon: AlertTriangle, count: preview.needsReview.length },
            { id: 'exempt' as SectionId, label: 'Isentos', icon: ShieldOff, count: preview.exempt.length },
            { id: 'blocked' as SectionId, label: 'Bloqueados', icon: Ban, count: preview.blocked.length }
        ];
    }, [preview]);

    useEffect(() => {
        if (!isOpen) return;
        setResult(null);
        setOpenSection(null);
    }, [isOpen]);

    if (!isOpen) return null;

    const runGeneration = async () => {
        if (!preview || preview.toCreate.length === 0) return;
        setGenerating(true);
        setResult(null);
        setProgress({ done: 0, total: preview.toCreate.length, name: '' });
        try {
            const generated = await generateMonthlyCharges({
                dueDate: preview.dueDate,
                targets: preview.toCreate,
                workerUrl,
                paymentConfig,
                onProgress: (done, total, name) => setProgress({ done, total, name }),
                onRegistrationUpdated
            });
            setResult(generated);
            if (generated.errors.length === 0) {
                showAlert(`${generated.created.length} cobranças geradas com vencimento em ${formatDateBR(preview.dueDate)}.`, 'success');
            } else {
                showAlert(`${generated.created.length} geradas e ${generated.errors.length} com erro. Confira a lista.`, 'warning');
            }
            onFinished();
        } catch (error: any) {
            console.error('[MonthlyCharges] Erro na geração:', error);
            showAlert(error?.message || 'Erro ao gerar as cobranças.', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirm = () => {
        if (!preview || preview.toCreate.length === 0) return;
        showConfirm(
            `Serão criadas ${preview.toCreate.length} cobranças PIX de verdade, no total de ${formatCents(preview.totalCents)}, ` +
            `com vencimento em ${formatDateBR(preview.dueDate)}. Os responsáveis poderão pagar assim que a fatura abrir. Confirma?`,
            runGeneration,
            'warning',
            `Gerar mensalidades de ${preview.monthLabel}`
        );
    };

    const renderList = (id: SectionId) => {
        if (!preview || openSection !== id) return null;

        const rows: Array<{ key: string; title: string; detail: string }> = (() => {
            switch (id) {
                case 'toCreate':
                    return preview.toCreate.map(t => ({
                        key: t.registration.id,
                        title: `${t.studentName || t.responsibleName}`,
                        detail: `${t.responsibleName} · ${formatCents(t.valueCents)}`
                    }));
                case 'alreadyCharged':
                case 'needsReview':
                    return preview[id].map(t => ({
                        key: t.registration.id,
                        title: `${t.studentName || t.responsibleName}`,
                        detail: t.invoices
                            .map(inv => `${inv.description || 'Fatura'} · venc ${formatDateBR(inv.dueDate)} · ${inv.status}`)
                            .join(' | ')
                    }));
                default:
                    return preview[id].map(t => ({
                        key: t.registration.id,
                        title: `${t.studentName || t.responsibleName}`,
                        detail: `${t.responsibleName} · ${t.reason}`
                    }));
            }
        })();

        if (rows.length === 0) {
            return <div style={{ padding: '12px 16px', color: '#999', fontSize: '0.85rem' }}>Nenhum cadastro neste grupo.</div>;
        }

        return (
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '10px', margin: '0 0 16px' }}>
                {rows.map((row, index) => (
                    <div
                        key={row.key}
                        style={{
                            padding: '10px 14px',
                            borderBottom: index === rows.length - 1 ? 'none' : '1px solid #f2f2f2',
                            display: 'flex', flexDirection: 'column', gap: '2px'
                        }}
                    >
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#333' }}>{row.title}</span>
                        <span style={{ fontSize: '0.75rem', color: '#777' }}>{row.detail}</span>
                    </div>
                ))}
            </div>
        );
    };

    const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
            onClick={() => { if (!generating) onClose(); }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px',
                    maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
                }}
            >
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#00a63a' }}>Gerar Mensalidades do Mês</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#777' }}>
                            Abre a mensalidade de todos os alunos ativos de uma vez, sem duplicar quem já tem fatura. Provedor: {getPaymentProviderLabel(paymentConfig)}.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={generating}
                        style={{
                            border: 'none', background: 'transparent', cursor: generating ? 'not-allowed' : 'pointer',
                            color: '#999', padding: '4px', opacity: generating ? 0.4 : 1
                        }}
                        title={generating ? 'Aguarde a geração terminar' : 'Fechar'}
                    >
                        <X size={22} />
                    </button>
                </div>

                <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '18px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#666', marginBottom: '6px' }}>
                                VENCIMENTO
                            </label>
                            <div style={{ position: 'relative' }}>
                                <CalendarDays size={16} color="#999" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="date"
                                    value={dueDate}
                                    disabled={generating}
                                    onChange={e => setDueDate(e.target.value)}
                                    style={{
                                        padding: '11px 12px 11px 36px', borderRadius: '10px', border: '1px solid #e0e0e0',
                                        fontSize: '0.9rem', fontWeight: 700, color: '#333', minWidth: '190px'
                                    }}
                                />
                            </div>
                        </div>
                        {preview && (
                            <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d' }}>MÊS DE REFERÊNCIA</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00a63a' }}>
                                    {preview.monthLabel} · {formatDateBR(preview.dueDate)}
                                </div>
                            </div>
                        )}
                    </div>

                    {loadingPreview && (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>Calculando prévia...</div>
                    )}

                    {previewError && !loadingPreview && (
                        <div style={{ padding: '14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: '0.85rem' }}>
                            {previewError}
                        </div>
                    )}

                    {preview && !loadingPreview && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                                {sections.map(section => {
                                    const colors = CARD_COLORS[section.id];
                                    const Icon = section.icon;
                                    const isOpenSection = openSection === section.id;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setOpenSection(isOpenSection ? null : section.id)}
                                            style={{
                                                padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                                background: colors.bg, border: `1px solid ${isOpenSection ? colors.text : colors.border}`,
                                                display: 'flex', flexDirection: 'column', gap: '4px'
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: colors.text }}>
                                                <Icon size={14} />
                                                {section.label.toUpperCase()}
                                                {isOpenSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                            </span>
                                            <span style={{ fontSize: '1.35rem', fontWeight: 900, color: colors.text }}>{section.count}</span>
                                            {section.id === 'toCreate' && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.text }}>
                                                    {formatCents(preview.totalCents)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {sections.map(section => (
                                <React.Fragment key={`list-${section.id}`}>{renderList(section.id)}</React.Fragment>
                            ))}

                            {preview.needsReview.length > 0 && (
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fff8e1', border: '1px solid #ffca28', fontSize: '0.8rem', color: '#7a5200', marginBottom: '14px' }}>
                                    <strong>{preview.needsReview.length} cadastro(s) para revisar:</strong> têm fatura vencendo neste mês, mas descrita como outro mês
                                    (normalmente atraso reemitido). Eles ficam de fora da geração — confira no cadastro antes de cobrar à parte.
                                </div>
                            )}

                            {preview.blocked.length > 0 && (
                                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', fontSize: '0.8rem', color: '#b91c1c', marginBottom: '14px' }}>
                                    <strong>{preview.blocked.length} bloqueado(s):</strong> corrija o CPF do responsável ou o plano do aluno e gere de novo — a fatura desses seria recusada pelo banco.
                                </div>
                            )}
                        </>
                    )}

                    {generating && (
                        <div style={{ marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#444', marginBottom: '6px' }}>
                                <span>Gerando {progress.done}/{progress.total}{progress.name ? ` · ${progress.name}` : ''}</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div style={{ height: '10px', background: '#eee', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${progressPercent}%`, height: '100%', background: '#00a63a', transition: 'width 0.3s ease' }} />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '8px' }}>
                                Não feche esta janela. Cada fatura é criada individualmente no banco.
                            </p>
                        </div>
                    )}

                    {result && !generating && (
                        <div style={{ marginTop: '10px', padding: '14px', borderRadius: '12px', background: result.errors.length ? '#fff8e1' : '#f0fdf4', border: `1px solid ${result.errors.length ? '#ffca28' : '#bbf7d0'}` }}>
                            <div style={{ fontWeight: 900, color: result.errors.length ? '#a06800' : '#00a63a', fontSize: '0.9rem' }}>
                                {result.created.length} cobrança(s) criada(s){result.errors.length ? ` · ${result.errors.length} com erro` : ''}
                            </div>
                            {result.errors.length > 0 && (
                                <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.78rem', color: '#7a5200' }}>
                                    {result.errors.map(err => (
                                        <li key={err.registrationId}>{err.studentName}: {err.error}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 22px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                        onClick={onClose}
                        disabled={generating}
                        style={{
                            padding: '12px 20px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff',
                            color: '#666', fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {result ? 'Fechar' : 'Cancelar'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={generating || loadingPreview || !preview || preview.toCreate.length === 0}
                        style={{
                            padding: '12px 22px', borderRadius: '10px', border: 'none',
                            background: (!preview || preview.toCreate.length === 0 || generating || loadingPreview) ? '#e2e8f0' : '#00a63a',
                            color: (!preview || preview.toCreate.length === 0 || generating || loadingPreview) ? '#94a3b8' : '#fff',
                            fontWeight: 900, cursor: (!preview || preview.toCreate.length === 0 || generating || loadingPreview) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <Zap size={17} />
                        {generating
                            ? 'Gerando...'
                            : preview && preview.toCreate.length > 0
                                ? `Gerar ${preview.toCreate.length} cobranças · ${formatCents(preview.totalCents)}`
                                : 'Nada a gerar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
