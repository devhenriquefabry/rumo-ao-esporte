import React from 'react';
import { Users, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
    modalityFilter: string;
    onPendingClick?: () => void;
    stats: {
        total: number;
        approvedCount: number;
        notApprovedCount: number;
        pendingCount: number;
        pendingAmount: number;
        pendingNames: string[];
        revenue: number;
        toReceive: number;
        revenueLastMonth: number;
        toReceiveLastMonth: number;
        mrr: number;
    };
}

const fmt = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const lastMonthLabel = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
};

export const StatsCards: React.FC<StatsCardsProps> = ({ modalityFilter, stats, onPendingClick }) => {
    const prevMonth = lastMonthLabel();
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>

            {/* Alunos */}
            <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderLeft: '4px solid #00a63a' }}>
                <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '5px' }}>ALUNOS ({modalityFilter.toUpperCase()})</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#333' }}>
                    <Users size={24} color="#00a63a" /> {stats.total}
                </div>
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '0.75rem' }}>
                    <div style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ {stats.approvedCount} Aprovados</div>
                    <div style={{ color: '#f57c00', fontWeight: 'bold' }}>⚠ {stats.notApprovedCount} Pendentes</div>
                </div>
            </div>

            {/* Em Atraso */}
            <div
                className="stat-card interactive-card"
                onClick={onPendingClick}
                style={{
                    background: '#fff',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #00a63a',
                    cursor: onPendingClick ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div style={{ color: '#00a63a', fontSize: '0.9rem', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>EM ATRASO E PENDENTE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>{stats.pendingCount}</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#00a63a', marginBottom: '15px' }}>{fmt(stats.pendingAmount)}</div>
                
                {stats.pendingCount > 0 ? (
                    <button 
                        style={{
                            background: '#00a63a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 15px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            width: 'fit-content'
                        }}
                    >
                        Ver Alunos
                    </button>
                ) : (
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Nenhum valor pendente</div>
                )}
            </div>

            {/* MRR */}
            <div className="stat-card" style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(30, 41, 59, 0.3)', borderLeft: '4px solid #0f172a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <TrendingUp size={18} color="rgba(255,255,255,0.7)" />
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>RECEITA MENSAL (MRR)</div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>{fmt(stats.mrr)}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                    Previsão baseada nos planos ({modalityFilter.toUpperCase()})
                </div>
            </div>

            {/* Receita Recebida / A Receber */}
            <div className="stat-card" style={{ background: '#00a63a', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 125, 47, 0.2)', borderLeft: '4px solid #9a1a1f' }}>

                {/* Labels esse mês */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        RECEBIDA · ESSE MÊS
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'right' }}>
                        A RECEBER · ESSE MÊS
                    </div>
                </div>

                {/* Valores principais */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>{fmt(stats.revenue)}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffcdd2', textAlign: 'right' }}>{fmt(stats.toReceive)}</div>
                </div>

                {/* Mês anterior */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                                Recebido · {prevMonth}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', fontWeight: '700' }}>
                                {fmt(stats.revenueLastMonth)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem', textTransform: 'uppercase', marginBottom: '2px' }}>
                                A receber · {prevMonth}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', fontWeight: '700' }}>
                                {fmt(stats.toReceiveLastMonth)}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
};
