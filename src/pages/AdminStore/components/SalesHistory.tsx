import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import type { StoreOrder } from '../../../types/store';
import { ShoppingBag, CheckCircle, XCircle, Clock, Search, ExternalLink, Trash2, Filter, User } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';

export default function SalesHistory() {
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const { showAlert, showConfirm } = useDialog();
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'rae_store_orders'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreOrder));
            setOrders(data);
        } catch (error) {
            console.error("Erro ao buscar histórico de vendas:", error);
            showAlert('Erro ao carregar histórico.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        let msg = '';
        if (newStatus === 'delivered') msg = 'Marcar como Entregue/Retirado?';
        else if (newStatus === 'cancelled') msg = 'Cancelar este pedido?';

        showConfirm(msg, async () => {
            try {
                // If cancelling, try to cancel in Asaas as well
                if (newStatus === 'cancelled') {
                    // Try to get the order first to fetch invoiceId
                    const orderToCancel = orders.find(o => o.id === orderId);
                    if (orderToCancel?.invoiceId) {
                        try {
                            await fetch(`${workerUrl}/payments/${orderToCancel.invoiceId}`, { method: 'DELETE' });
                        } catch (e) {
                            console.error('Asaas cancellation soft fail:', e);
                        }
                    }
                }

                await updateDoc(doc(db, 'rae_store_orders', orderId), {
                    status: newStatus,
                    updatedAt: new Date().toISOString()
                });
                showAlert('Pedido atualizado!', 'success');
                fetchOrders();
            } catch (error) {
                console.error("Erro ao atualizar pedido:", error);
                showAlert('Erro ao atualizar.', 'error');
            }
        }, 'warning', 'Atualizar Pedido');
    };

    const handleDeleteOrder = async (order: StoreOrder) => {
        showConfirm('Tem certeza que deseja EXCLUIR este registro? O estoque será devolvido.', async () => {
            try {
                // Delete in Asaas
                if (order.invoiceId) {
                    try {
                        await fetch(`${workerUrl}/payments/${order.invoiceId}`, { method: 'DELETE' });
                    } catch (e) {
                        console.error('Asaas deletion soft fail:', e);
                    }
                }

                // Delete doc
                await deleteDoc(doc(db, 'rae_store_orders', order.id!));

                // Restore stock
                for (const item of order.items) {
                    await updateDoc(doc(db, 'rae_store_products', item.productId), {
                        stock: increment(item.quantity)
                    });
                }

                showAlert('Pedido excluído e estoque restaurado.', 'success');
                fetchOrders();
            } catch (error) {
                console.error("Erro ao excluir pedido:", error);
                showAlert('Erro ao excluir pedido.', 'error');
            }
        }, 'error', 'Excluir Registro');
    };

    const handleMarkAsPaid = async (order: StoreOrder) => {
        showConfirm('Confirmar recebimento deste pedido?', async () => {
            try {
                if (order.invoiceId) {
                    await fetch(`${workerUrl}/payments/${order.invoiceId}/receive-in-cash`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            value: order.totalAmount,
                            paymentDate: new Date().toISOString().split('T')[0],
                            notify: false
                        })
                    });
                }

                await updateDoc(doc(db, 'rae_store_orders', order.id!), {
                    status: 'paid',
                    updatedAt: new Date().toISOString()
                });

                showAlert('Marcado como pago com sucesso!', 'success');
                fetchOrders();
            } catch (error) {
                console.error("Erro ao dar baixa manual:", error);
                showAlert('Erro ao marcar como pago.', 'error');
            }
        }, 'warning', 'Confirmar Recebimento');
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'paid':
                return <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><CheckCircle size={12} /> PAGO (A RETIRAR)</span>;
            case 'pending_payment':
                return <span style={{ background: '#fff8e1', color: '#f57f17', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><Clock size={12} /> AGUARDANDO PIX</span>;
            case 'delivered':
                return <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><CheckCircle size={12} /> ENTREGUE</span>;
            case 'cancelled':
                return <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><XCircle size={12} /> CANCELADO</span>;
            default:
                return <span>{status}</span>;
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (o.id && o.id.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0, color: '#17428f', fontSize: '1.2rem' }}>Histórico de Vendas</h2>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} color="#888" style={{ position: 'absolute', left: 12, top: 12 }} />
                        <input
                            type="text"
                            placeholder="Buscar por aluno ou pedido ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Filter size={18} color="#888" style={{ position: 'absolute', left: 12, top: 12 }} />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            style={{ padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', appearance: 'none', paddingRight: '30px' }}
                        >
                            <option value="all">Todos os Status</option>
                            <option value="pending_payment">Aguardando PIX</option>
                            <option value="paid">Pago (A Retirar)</option>
                            <option value="delivered">Entregue</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Carregando vendas...</div>
            ) : filteredOrders.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #ccc' }}>
                    <ShoppingBag size={48} color="#ccc" style={{ marginBottom: '10px' }} />
                    <p style={{ color: '#666', margin: 0 }}>Nenhuma venda encontrada.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {filteredOrders.map(order => (
                        <div key={order.id} style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', borderBottom: '1px solid #f0f0f0', paddingBottom: '15px', marginBottom: '15px' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb' }}>
                                            {order.customerPhotoUrl ? (
                                                <img src={order.customerPhotoUrl} alt={order.customerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <User size={20} color="#9ca3af" />
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <h3 style={{ margin: 0, color: '#333', fontSize: '1.1rem' }}>{order.customerName}</h3>
                                                <StatusBadge status={order.status} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', display: 'flex', gap: '15px' }}>
                                        <span>Data: {new Date(order.createdAt).toLocaleString('pt-BR')}</span>
                                        <span>ID: {order.id}</span>
                                        {order.invoiceUrl ? (
                                            <a href={order.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: '#17428f', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                Fatura <ExternalLink size={12} />
                                            </a>
                                        ) : order.invoiceId ? (
                                            <a href={`https://www.asaas.com/c/${order.invoiceId}`} target="_blank" rel="noreferrer" style={{ color: '#17428f', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                Asaas <ExternalLink size={12} />
                                            </a>
                                        ) : null}
                                        {order.receiptUrl && (
                                            <a href={order.receiptUrl} target="_blank" rel="noreferrer" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginLeft: '8px' }}>
                                                Comprovante <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total do Pedido</span>
                                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2e7d32' }}>R$ {order.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: order.status === 'paid' ? '20px' : '0' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>Itens:</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#444', fontSize: '0.9rem' }}>
                                    {order.items.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: '6px' }}>
                                            <strong>{item.quantity}x</strong> {item.name} {item.size && ` (Tam: ${item.size})`} - R$ {item.price.toFixed(2)}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Actions for active orders */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f0f0f0', paddingTop: '15px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handleDeleteOrder(order)}
                                    style={{ background: 'transparent', color: '#c62828', border: '1px solid #c62828', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}
                                >
                                    <Trash2 size={16} /> EXCLUIR
                                </button>

                                {order.status === 'pending_payment' && (
                                    <button
                                        onClick={() => handleMarkAsPaid(order)}
                                        style={{ background: '#17428f', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <CheckCircle size={16} /> JÁ RECEBIDO
                                    </button>
                                )}

                                {(order.status === 'paid' || order.status === 'pending_payment') && (
                                    <button
                                        onClick={() => handleUpdateStatus(order.id!, 'cancelled')}
                                        style={{ background: 'transparent', color: '#c62828', border: '1px solid #c62828', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                                    >
                                        CANCELAR
                                    </button>
                                )}

                                {order.status === 'paid' && (
                                    <button
                                        onClick={() => handleUpdateStatus(order.id!, 'delivered')}
                                        style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <CheckCircle size={16} />
                                        MARCAR COMO ENTREGUE
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )
            }
        </div >
    );
}
