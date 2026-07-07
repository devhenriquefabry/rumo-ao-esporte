import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';

interface AsaasBalanceProps {
    workerUrl: string;
}

export const AsaasBalance = ({ workerUrl }: AsaasBalanceProps) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchBalance = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await fetch(`${workerUrl}/finance/balance`);
            const data = await res.json();
            
            if (data && typeof data.balance === 'number') {
                setBalance(data.balance);
                setLastUpdate(new Date());
            } else if (data && typeof data.value === 'number') {
                // Algumas APIs do Asaas retornam 'value' em vez de 'balance' em certos contextos
                setBalance(data.value);
                setLastUpdate(new Date());
            } else {
                console.error('Invalid balance data:', data);
                setError(true);
            }
        } catch (err) {
            console.error('Error fetching Asaas balance:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [workerUrl]);

    useEffect(() => {
        fetchBalance();
        // Atualiza a cada 5 minutos
        const interval = setInterval(fetchBalance, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    return (
        <div 
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '12px 18px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.3s ease',
                cursor: 'default',
                userSelect: 'none'
            }}
            className="asaas-balance-float"
        >
            <div style={{
                background: '#00a63a',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
            }}>
                <Wallet size={20} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: '700', 
                    color: '#888', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    Saldo Asaas
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {loading && !balance ? (
                        <div className="skeleton-text" style={{ width: '80px', height: '20px', background: '#eee', borderRadius: '4px' }} />
                    ) : error ? (
                        <span style={{ fontSize: '1rem', fontWeight: '800', color: '#00a63a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={16} /> Erro
                        </span>
                    ) : (
                        <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1a1a1a' }}>
                            {balance !== null ? balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </span>
                    )}
                </div>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    fetchBalance();
                }}
                disabled={loading}
                style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    color: '#888',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    marginLeft: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                title={lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR')}` : 'Atualizar'}
            >
                <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
            </button>

            <style>{`
                .asaas-balance-float:hover {
                    background: rgba(255, 255, 255, 0.9) !important;
                    transform: translateY(-2px);
                    boxShadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                .skeleton-text {
                    animation: pulse 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
