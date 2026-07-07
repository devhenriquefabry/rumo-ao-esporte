import { useState } from 'react';
import StoreConfiguration from './components/StoreConfiguration';
import ProductManagement from './components/ProductManagement';
import SalesHistory from './components/SalesHistory';
import RegisterSaleModal from './components/RegisterSaleModal';
import { Store, ShoppingBag, Settings, Tag, PlusCircle } from 'lucide-react';

export default function AdminStore() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'sales' | 'config'>('products');
    const [showSaleModal, setShowSaleModal] = useState(false);

    return (
        <div style={{ paddingBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
                <div style={{ background: '#17428f', color: '#fff', padding: '15px', borderRadius: '14px', display: 'flex' }}>
                    <Store size={28} />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, color: '#17428f', fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Loja do Clube</h1>
                    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.95rem' }}>Gerencie produtos virtuais e físicos, vendas e configurações da loja.</p>
                </div>
                <button
                    onClick={() => setShowSaleModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                        background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '12px',
                        fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
                        boxShadow: '0 4px 12px rgba(46,125,50,0.3)', transition: 'all 0.2s',
                    }}
                >
                    <PlusCircle size={20} />
                    Registrar Venda
                </button>
            </div>

            {/* Navegação por Abas */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
                <TabButton
                    active={activeTab === 'products'}
                    onClick={() => setActiveTab('products')}
                    icon={<Tag size={18} />}
                    label="Gerir Produtos"
                />
                <TabButton
                    active={activeTab === 'sales'}
                    onClick={() => setActiveTab('sales')}
                    icon={<ShoppingBag size={18} />}
                    label="Histórico de Vendas"
                />
                <TabButton
                    active={activeTab === 'config'}
                    onClick={() => setActiveTab('config')}
                    icon={<Settings size={18} />}
                    label="Configurações"
                />
            </div>

            {/* Conteúdo Dinâmico */}
            <div>
                {activeTab === 'products' && <ProductManagement />}
                {activeTab === 'sales' && <SalesHistory />}
                {activeTab === 'config' && <StoreConfiguration />}
            </div>

            {/* Modal de Registro de Venda */}
            <RegisterSaleModal
                isOpen={showSaleModal}
                onClose={() => setShowSaleModal(false)}
                onSaleComplete={() => {
                    if (activeTab === 'sales') {
                        // Force refresh by toggling tab
                        setActiveTab('products');
                        setTimeout(() => setActiveTab('sales'), 50);
                    }
                }}
            />
        </div>
    );
}

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: active ? '#17428f' : '#fff',
            color: active ? '#fff' : '#666',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: active ? '0 4px 10px rgba(0, 35, 127, 0.2)' : '0 2px 5px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
        }}
    >
        {icon}
        {label}
    </button>
);
