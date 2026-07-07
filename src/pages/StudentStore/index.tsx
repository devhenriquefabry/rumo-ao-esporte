import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import type { StoreProduct, StoreOrder } from '../../types/store';
import { ShoppingBag, Search, Tag, AlertCircle, Clock, CheckCircle, Package, ExternalLink } from 'lucide-react';
import CheckoutPixModal from './components/CheckoutPixModal';

export default function StudentStore() {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [storeEnabled, setStoreEnabled] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
    const [activeTab, setActiveTab] = useState<'store' | 'orders'>('store');

    const fetchOrders = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = query(
                collection(db, 'rae_store_orders'),
                where('customerEmail', '==', user.email),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            const fetchedOrders: StoreOrder[] = [];
            snap.forEach(doc => fetchedOrders.push({ id: doc.id, ...doc.data() } as StoreOrder));
            setOrders(fetchedOrders);
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
    };

    useEffect(() => {
        const fetchStoreData = async () => {
            setLoading(true);
            try {
                // Check if store is enabled
                const storeSettings = await getDoc(doc(db, 'system_settings', 'store'));
                if (storeSettings.exists() && storeSettings.data().enabled === false) {
                    setStoreEnabled(false);
                    setLoading(false);
                    return;
                }

                // Fetch active products
                const q = query(collection(db, 'rae_store_products'), where('active', '==', true));
                const snap = await getDocs(q);
                const fetchedProducts: StoreProduct[] = [];
                snap.forEach(doc => {
                    fetchedProducts.push({ id: doc.id, ...doc.data() } as StoreProduct);
                });

                // Sort by creation or name
                fetchedProducts.sort((a, b) => a.name.localeCompare(b.name));
                setProducts(fetchedProducts);

                // Fetch orders
                await fetchOrders();
            } catch (error) {
                console.error("Error fetching store data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStoreData();
    }, []);

    const handleBuyClick = (product: StoreProduct) => {
        setSelectedProduct(product);
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', background: '#f5f5f5' }}>
                <p style={{ color: '#666' }}>Carregando loja...</p>
            </div>
        );
    }

    if (!storeEnabled) {
        return (
            <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{ background: '#fff', padding: '40px 20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <ShoppingBag size={48} color="#ccc" style={{ marginBottom: '20px' }} />
                    <h2 style={{ color: '#333' }}>Loja Temporariamente Indisponível</h2>
                    <p style={{ color: '#666', marginTop: '10px' }}>A loja do clube está fechada no momento. Volte mais tarde!</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '15px 15px 80px 15px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
                <button
                    onClick={() => setActiveTab('store')}
                    style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: activeTab === 'store' ? '#17428f' : '#fff',
                        color: activeTab === 'store' ? '#fff' : '#17428f',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <ShoppingBag size={18} /> Vitrine
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: activeTab === 'orders' ? '#17428f' : '#fff',
                        color: activeTab === 'orders' ? '#fff' : '#17428f',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Clock size={18} /> Meus Pedidos
                </button>
            </div>

            {activeTab === 'store' ? (
                <>
                    {/* Header / Hero */}
                    <div style={{
                        background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)',
                        borderRadius: '16px',
                        padding: '20px 20px',
                        color: '#fff',
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        boxShadow: '0 4px 15px rgba(0,35,127,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <ShoppingBag size={24} color="#ffd700" />
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Loja do Clube</h1>
                        </div>
                        <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '15px', maxWidth: '600px' }}>
                            Uniformes, acessórios e itens exclusivos.
                        </p>

                        <div style={{
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '10px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            maxWidth: '350px',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <Search size={18} color="#fff" style={{ opacity: 0.7 }} />
                            <input
                                type="text"
                                placeholder="Buscar produtos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    outline: 'none',
                                    padding: '8px',
                                    width: '100%',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Product Grid */}
                    {filteredProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                            <AlertCircle size={32} color="#ccc" style={{ marginBottom: '10px' }} />
                            <p>Nenhum produto encontrado.</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '25px'
                        }}>
                            {filteredProducts.map(product => (
                                <div key={product.id} style={{
                                    background: '#fff',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                    transition: 'transform 0.2s, boxShadow 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-5px)';
                                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                                    }}
                                    onClick={() => handleBuyClick(product)}
                                >
                                    {/* Product Image */}
                                    <div style={{
                                        width: '100%',
                                        paddingTop: '100%', // 1:1 Aspect Ratio
                                        position: 'relative',
                                        background: '#f8f9fa'
                                    }}>
                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0, left: 0,
                                                    width: '100%', height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0, left: 0,
                                                width: '100%', height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#ccc'
                                            }}>
                                                <ShoppingBag size={48} />
                                            </div>
                                        )}
                                        {product.stock <= 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '10px', right: '10px',
                                                background: 'rgba(239, 68, 68, 0.9)',
                                                color: '#fff',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                backdropFilter: 'blur(4px)'
                                            }}>Esgotado</div>
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: '800', lineHeight: '1.2' }}>{product.name}</h3>
                                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                                                {product.description}
                                            </p>
                                        </div>

                                        {/* Badges de opções */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {product.hasSizes && product.sizes && product.sizes.length > 0 && (
                                                <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    Tam: {product.sizes.join(' · ')}
                                                </span>
                                            )}
                                            {product.variations?.map(v => (
                                                <span key={v.name} style={{ fontSize: '0.65rem', background: '#fce7f3', color: '#9d174d', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    {v.name}: {v.options.slice(0, 3).join(', ')}{v.options.length > 3 ? '...' : ''}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Formas de pagamento aceitas */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                            {((product.paymentMethods && product.paymentMethods.length > 0) ? product.paymentMethods : ['PIX']).map((pm: any) => {
                                                const labels: Record<string, string> = { PIX: '⚡ PIX', BOLETO: '🏦 Boleto', CREDIT_CARD: '💳 Cartão' };
                                                const colors: Record<string, string> = { PIX: '#d1fae5', BOLETO: '#dbeafe', CREDIT_CARD: '#ede9fe' };
                                                const textColors: Record<string, string> = { PIX: '#065f46', BOLETO: '#1e40af', CREDIT_CARD: '#4c1d95' };
                                                return (
                                                    <span key={pm} style={{ fontSize: '0.62rem', background: colors[pm], color: textColors[pm], padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                        {labels[pm]}
                                                    </span>
                                                );
                                            })}
                                            {product.paymentMethods?.includes('CREDIT_CARD') && product.maxInstallments && product.maxInstallments > 1 && (
                                                <span style={{ fontSize: '0.62rem', background: '#f5f3ff', color: '#5b21b6', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    até {product.maxInstallments}x
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', color: '#17428f' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>R$</span>
                                                <span style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px' }}>{product.price.toFixed(2)}</span>
                                            </div>

                                            <button
                                                disabled={product.stock <= 0}
                                                style={{
                                                    width: '100%',
                                                    background: product.stock > 0 ? 'linear-gradient(135deg, #00a63a 0%, #a81d22 100%)' : '#f1f5f9',
                                                    color: product.stock > 0 ? '#fff' : '#94a3b8',
                                                    border: 'none',
                                                    padding: '10px',
                                                    borderRadius: '10px',
                                                    fontWeight: '900',
                                                    fontSize: '0.85rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    boxShadow: product.stock > 0 ? '0 4px 10px rgba(0, 125, 47, 0.2)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => {
                                                    if (product.stock > 0) {
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                        e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 166, 58, 0.28)';
                                                    }
                                                }}
                                                onMouseOut={(e) => {
                                                    if (product.stock > 0) {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 125, 47, 0.2)';
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (product.stock > 0) handleBuyClick(product);
                                                }}
                                            >
                                                {product.stock > 0 ? (
                                                    <><Tag size={16} /> Comprar Agora</>
                                                ) : (
                                                    'Esgotado'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* Orders View */
                <div>
                    <h2 style={{ color: '#17428f', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Package /> Histórico de Pedidos
                    </h2>

                    {orders.length === 0 ? (
                        <div style={{ background: '#fff', padding: '60px 40px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <ShoppingBag size={64} color="#e5e7eb" style={{ marginBottom: '20px' }} />
                            <h3 style={{ color: '#333' }}>Você ainda não fez nenhum pedido</h3>
                            <p style={{ color: '#666', marginTop: '10px' }}>Seus pedidos aparecerão aqui assim que você realizar uma compra.</p>
                            <button
                                onClick={() => setActiveTab('store')}
                                style={{ marginTop: '20px', background: '#00a63a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                IR PARA A LOJA
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {orders.map(order => (
                                <div key={order.id} style={{
                                    background: '#fff',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '15px',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : 'Data Indisponível'} • #{order.id?.slice(-6).toUpperCase()}
                                        </div>
                                        <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#1e293b' }}>
                                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                            {order.items[0].size && (
                                                <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                    TAM: {order.items[0].size}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                PIX
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total</div>
                                            <div style={{ fontWeight: '900', fontSize: '1.3rem', color: '#16a34a' }}>R$ {order.totalAmount.toFixed(2)}</div>
                                        </div>

                                        <div style={{
                                            padding: '8px 16px',
                                            borderRadius: '30px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: order.status === 'delivered' ? '#dcfce7' : order.status === 'paid' ? '#f0fdf4' : '#fefce8',
                                            color: order.status === 'delivered' ? '#166534' : order.status === 'paid' ? '#15803d' : '#854d0e'
                                        }}>
                                            {order.status === 'delivered' ? (
                                                <><CheckCircle size={16} /> Entregue</>
                                            ) : order.status === 'paid' ? (
                                                <><Package size={16} /> Disponível para Retirada</>
                                            ) : (
                                                <><Clock size={16} /> Pendente</>
                                            )}
                                        </div>

                                        {order.invoiceId && (
                                            <a
                                                href={`https://www.asaas.com/cobranca/${order.invoiceId}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    color: '#64748b',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    background: '#f8fafc',
                                                    display: 'flex'
                                                }}
                                                title="Ver Fatura"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedProduct && (
                <CheckoutPixModal
                    isOpen={!!selectedProduct}
                    onClose={() => {
                        setSelectedProduct(null);
                        fetchOrders(); // Refresh orders after possible purchase
                    }}
                    product={selectedProduct}
                />
            )}
        </div>

    );
}
