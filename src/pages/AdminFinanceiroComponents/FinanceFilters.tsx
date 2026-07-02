import { Search, RefreshCw, Filter } from 'lucide-react';

interface FinanceFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    onRefresh: () => void;
    onSync?: () => void;
    onSmartSync?: () => void;
    onSyncSelected?: () => void;
    onSelectAll?: () => void;
    onClearAll?: () => void;
    selectedCount?: number;
    onViewManualCharges?: () => void;
    onVerifyInvoices?: () => void;
    loading: boolean;
    isSyncing?: boolean;
    readOnly?: boolean;
}

export function FinanceFilters({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    onRefresh,
    onSync,
    onSmartSync,
    onSyncSelected,
    onSelectAll,
    onClearAll,
    selectedCount = 0,
    onViewManualCharges,
    onVerifyInvoices,
    loading,
    isSyncing,
    readOnly
}: FinanceFiltersProps) {
    return (
        <div style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
            <div style={{ padding: '15px 20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>

                {/* Selection Action (ALIGNED LEFT) */}
                {!readOnly && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {selectedCount > 0 ? (
                            <>
                                <button
                                    onClick={onSyncSelected}
                                    disabled={isSyncing}
                                    style={{
                                        padding: '0 20px', height: '46px', borderRadius: '10px', border: 'none',
                                        background: '#2e7d32', color: '#fff',
                                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontWeight: '800', fontSize: '0.9rem',
                                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
                                        animation: 'pulse 2s infinite'
                                    }}
                                >
                                    <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
                                    Sincronizar {selectedCount}
                                </button>
                                <button
                                    onClick={() => onClearAll?.()}
                                    style={{
                                        padding: '0 15px', height: '46px', borderRadius: '10px', border: '1px solid #ddd',
                                        background: '#fff', color: '#666', cursor: 'pointer',
                                        fontSize: '0.8rem', fontWeight: 'bold'
                                    }}
                                >
                                    Limpar
                                </button>
                            </>
                        ) : (
                            onSelectAll && (
                                <button
                                    onClick={onSelectAll}
                                    style={{
                                        padding: '0 20px', height: '46px', borderRadius: '10px', border: '1px solid #007d2f',
                                        background: '#fff', color: '#007d2f', fontWeight: 'bold', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                                    }}
                                >
                                    Selecionar Todos
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* Search */}
                <div style={{
                    flex: 1, minWidth: '250px', position: 'relative',
                    background: '#f5f5f5', borderRadius: '10px', overflow: 'hidden',
                    border: '1px solid #e0e0e0'
                }}>
                    <Search size={18} color="#999" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por aluno ou responsável..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 12px 12px 45px', border: 'none', background: 'transparent',
                            fontSize: '0.9rem', outline: 'none'
                        }}
                    />
                </div>

                {/* Status Filter */}
                <div style={{ position: 'relative', minWidth: '180px' }}>
                    <Filter size={16} color="#666" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px',
                            border: '1px solid #e0e0e0', background: '#fff', fontSize: '0.85rem',
                            fontWeight: '600', color: '#444', cursor: 'pointer', appearance: 'none'
                        }}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pago">Pagamento em Dia (OK)</option>
                        <option value="pendente">Pagamento Pendente</option>
                        <option value="atrasado">Em Atraso (Vencido)</option>
                        <option value="vazio">Sem Cobrança</option>
                    </select>
                </div>

                {/* Other Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        style={{
                            padding: '12px', borderRadius: '10px', border: '1px solid #e0e0e0',
                            background: '#fff', color: '#666', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '46px', height: '46px'
                        }}
                        title="Atualizar Lista"
                    >
                        <RefreshCw size={20} className={loading ? 'spin' : ''} />
                    </button>

                    {!selectedCount && onSync && !readOnly && (
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            style={{
                                padding: '0 20px', height: '46px', borderRadius: '10px', border: 'none',
                                background: isSyncing ? '#e2e8f0' : '#007d2f', color: '#fff',
                                cursor: isSyncing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', fontSize: '0.9rem',
                                boxShadow: '0 4px 6px rgba(0, 125, 47, 0.2)'
                            }}
                            title="Sincronizar TODOS os alunos (Deep Sync)"
                        >
                            <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
                            {isSyncing ? '...' : 'Sincronizar'}
                        </button>
                    )}

                    {!selectedCount && onSmartSync && !readOnly && (
                        <button
                            onClick={onSmartSync}
                            disabled={isSyncing}
                            style={{
                                padding: '0 15px', height: '46px', borderRadius: '10px', border: '1px solid #007d2f',
                                background: isSyncing ? '#fff' : '#fff', color: '#007d2f',
                                cursor: isSyncing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', fontSize: '0.9rem'
                            }}
                            title="Verificar apenas pendentes e atrasados (Rápido)"
                        >
                            <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
                            {isSyncing ? '...' : 'Verificar Pagamentos'}
                        </button>
                    )}

                    {!selectedCount && onVerifyInvoices && !readOnly && (
                        <button
                            onClick={onVerifyInvoices}
                            disabled={isSyncing}
                            style={{
                                padding: '0 15px', height: '46px', borderRadius: '10px', border: '1px solid #006d77',
                                background: '#e6fffa', color: '#006d77',
                                cursor: isSyncing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '700', fontSize: '0.85rem'
                            }}
                            title="Comparar faturas pagas no sistema com status real no Asaas"
                        >
                            <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
                            Verificar Faturas
                        </button>
                    )}
                </div>

                {onViewManualCharges && !selectedCount && !readOnly && (
                    <button
                        onClick={onViewManualCharges}
                        style={{
                            padding: '0 15px', height: '46px', borderRadius: '10px', border: '1px solid #ddd',
                            background: '#fff', color: '#666', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 'bold'
                        }}
                        title="Ver todas as cobranças manuais"
                    >
                        Ver Lançamentos Manuais
                    </button>
                )}
            </div>
        </div>
    );
}
