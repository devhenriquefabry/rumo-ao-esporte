import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Target, Calculator, Minus, Plus } from 'lucide-react';

interface SimulatorProps {
    currentMRR: number;
    currentStudents: number;
    plans: any[];
    registrations: any[];
}

interface PlanRow {
    planId: string;
    planName: string;
    modalidade: string;
    monthlyValue: number; // already in R$ (not cents)
    currentStudents: number;
    targetStudents: number;
}

export default function AdminRevenueSimulator({ plans, registrations }: SimulatorProps) {
    const [operationalCosts, setOperationalCosts] = useState(0);
    const [planRows, setPlanRows] = useState<PlanRow[]>([]);

    // Build initial plan rows from real data
    useEffect(() => {
        if (!plans.length) return;

        const studentCountByPlan: Record<string, number> = {};
        registrations.forEach(reg => {
            if (reg.contractStatus === 'desativado') return; // skip disabled
            const pid = reg.planId;
            if (!pid) return;
            const numStudents = reg.alunos?.length || 1;
            studentCountByPlan[pid] = (studentCountByPlan[pid] || 0) + numStudents;
        });

        const rows: PlanRow[] = plans
            .filter(p => p.active)
            .map(p => {
                const monthlyVal = (
                    p.valores?.mensalidade?.ateVencimento ||
                    p.valor || 0
                ) / 100;

                return {
                    planId: p.id,
                    planName: p.nome,
                    modalidade: p.modalidade || '',
                    monthlyValue: monthlyVal,
                    currentStudents: studentCountByPlan[p.id] || 0,
                    targetStudents: studentCountByPlan[p.id] || 0
                };
            })
            .sort((a, b) => b.currentStudents - a.currentStudents);

        setPlanRows(rows);
    }, [plans, registrations]);

    const updateTarget = (planId: string, value: number) => {
        setPlanRows(prev => prev.map(r =>
            r.planId === planId ? { ...r, targetStudents: Math.max(0, value) } : r
        ));
    };

    const currentTotal = useMemo(() => {
        return planRows.reduce((acc, r) => acc + r.currentStudents * r.monthlyValue, 0);
    }, [planRows]);

    const projectedMRR = useMemo(() => {
        return planRows.reduce((acc, r) => acc + r.targetStudents * r.monthlyValue, 0);
    }, [planRows]);

    const growthPercent = useMemo(() => {
        if (currentTotal === 0) return 0;
        return ((projectedMRR - currentTotal) / currentTotal) * 100;
    }, [projectedMRR, currentTotal]);

    const totalCurrentStudents = planRows.reduce((a, r) => a + r.currentStudents, 0);
    const totalTargetStudents = planRows.reduce((a, r) => a + r.targetStudents, 0);
    const netProjected = projectedMRR - operationalCosts;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const modalityColors: Record<string, string> = {
        futebol: '#007d2f',
        natacao: '#0891b2',
        'natação': '#0891b2',
        voleibol: '#d97706',
        'hidroginástica': '#14b8a6',
        hidroginastica: '#14b8a6'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Result Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>MRR Atual</span>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1e293b', margin: '4px 0' }}>
                        {formatCurrency(currentTotal)}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>{totalCurrentStudents} alunos ativos</span>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(139,92,246,0.25)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>MRR Projetado</span>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', margin: '4px 0' }}>
                        {formatCurrency(projectedMRR)}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700' }}>
                        <TrendingUp size={14} color={growthPercent >= 0 ? '#a7f3d0' : '#fecaca'} />
                        <span style={{ color: growthPercent >= 0 ? '#a7f3d0' : '#fecaca' }}>
                            {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}% ({totalTargetStudents} alunos)
                        </span>
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Lucro Operacional</span>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: netProjected >= 0 ? '#059669' : '#ef4444', margin: '4px 0' }}>
                        {formatCurrency(netProjected)}
                    </h2>
                    <div style={{ position: 'relative', marginTop: '6px' }}>
                        <input
                            type="number"
                            value={operationalCosts || ''}
                            placeholder="Custos operacionais..."
                            onChange={(e) => setOperationalCosts(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: '#64748b'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Plans Table */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Calculator size={20} color="#8b5cf6" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>SIMULAÇÃO POR PLANO</h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Plano</th>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Modalidade</th>
                                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Valor/mês</th>
                                <th style={{ textAlign: 'center', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Alunos Atuais</th>
                                <th style={{ textAlign: 'center', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>Meta</th>
                                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#64748b', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>MRR Projetado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {planRows.map(row => {
                                const diff = row.targetStudents - row.currentStudents;
                                const modColor = modalityColors[row.modalidade.toLowerCase()] || '#64748b';
                                return (
                                    <tr key={row.planId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#1e293b' }}>
                                            {row.planName}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                background: modColor + '15',
                                                color: modColor,
                                                textTransform: 'uppercase'
                                            }}>
                                                {row.modalidade || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                                            {formatCurrency(row.monthlyValue)}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', color: '#64748b' }}>
                                            {row.currentStudents}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => updateTarget(row.planId, row.targetStudents - 1)}
                                                    style={{
                                                        width: '24px', height: '24px', borderRadius: '6px',
                                                        border: '1px solid #e2e8f0', background: '#f8fafc',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', padding: 0
                                                    }}
                                                >
                                                    <Minus size={12} color="#64748b" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={row.targetStudents}
                                                    onChange={(e) => updateTarget(row.planId, Number(e.target.value))}
                                                    style={{
                                                        width: '55px', textAlign: 'center', padding: '4px',
                                                        borderRadius: '8px',
                                                        border: diff !== 0 ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                                                        fontWeight: '800', fontSize: '0.85rem',
                                                        color: diff > 0 ? '#059669' : diff < 0 ? '#ef4444' : '#1e293b',
                                                        background: diff !== 0 ? '#faf5ff' : '#fff'
                                                    }}
                                                />
                                                <button
                                                    onClick={() => updateTarget(row.planId, row.targetStudents + 1)}
                                                    style={{
                                                        width: '24px', height: '24px', borderRadius: '6px',
                                                        border: '1px solid #e2e8f0', background: '#f8fafc',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', padding: 0
                                                    }}
                                                >
                                                    <Plus size={12} color="#64748b" />
                                                </button>
                                            </div>
                                            {diff !== 0 && (
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: '700',
                                                    color: diff > 0 ? '#059669' : '#ef4444'
                                                }}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                                            {formatCurrency(row.targetStudents * row.monthlyValue)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid #1e293b' }}>
                                <td colSpan={2} style={{ padding: '12px 8px', fontWeight: '900', color: '#1e293b', fontSize: '0.9rem' }}>
                                    TOTAL
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: '#64748b' }}>—</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '800', color: '#64748b' }}>
                                    {totalCurrentStudents}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '900', color: '#8b5cf6' }}>
                                    {totalTargetStudents}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '900', color: '#8b5cf6', fontSize: '1rem' }}>
                                    {formatCurrency(projectedMRR)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Target size={14} color="#8b5cf6" />
                        <strong>Dica:</strong> Altere a coluna "Meta" para simular o crescimento por plano. A projeção é atualizada em tempo real.
                    </p>
                </div>
            </div>
        </div>
    );
}
