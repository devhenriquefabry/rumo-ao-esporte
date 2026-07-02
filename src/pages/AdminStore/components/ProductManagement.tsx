import { useState, useEffect, useRef } from 'react';
import { db } from '../../../firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { StoreProduct, ProductVariation, PaymentMethodType } from '../../../types/store';
import { Plus, Edit2, Trash2, Image as ImageIcon, Check, Upload, Loader, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';
import { compressImage } from '../../../utils/imageUtils';

const CHIP_STYLE = (active?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
    cursor: 'pointer', transition: 'all 0.15s',
    background: active ? '#00237f' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
    border: active ? '1px solid #00237f' : '1px solid #e2e8f0',
});

const INPUT_STYLE: React.CSSProperties = {
    width: '100%', padding: '10px', borderRadius: '8px',
    border: '1px solid #ddd', boxSizing: 'border-box' as const
};

// Taxas Asaas para repasse (Gross-up)
const calculateAdjustedPrice = (basePrice: number, installments: number) => {
    let rate = 0;
    const fixedFee = 0.49;
    if (installments === 1) rate = 0.0299;
    else if (installments <= 6) rate = 0.0349;
    else if (installments <= 12) rate = 0.0399;
    else rate = 0.0429;
    return (basePrice + fixedFee) / (1 - rate);
};

export default function ProductManagement() {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const { showAlert, showConfirm } = useDialog();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        stock: '',
        imageUrl: '',
        active: true,
    });

    // Sizes state
    const [hasSizes, setHasSizes] = useState(false);
    const [sizes, setSizes] = useState<string[]>([]);
    const [newSize, setNewSize] = useState('');

    // Variations state
    const [variations, setVariations] = useState<ProductVariation[]>([]);
    const [newVariationName, setNewVariationName] = useState('');
    const [newVariationOption, setNewVariationOption] = useState<Record<number, string>>({});

    // Payment methods state
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>(['PIX']);
    const [maxInstallments, setMaxInstallments] = useState(1);

    const togglePaymentMethod = (method: PaymentMethodType) => {
        setPaymentMethods(prev =>
            prev.includes(method)
                ? prev.filter(m => m !== method)
                : [...prev, method]
        );
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'uba_store_products'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProduct));
            setProducts(data);
        } catch (error) {
            console.error("Erro ao buscar produtos:", error);
            showAlert('Erro ao carregar produtos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const resetForm = () => {
        setFormData({ name: '', description: '', price: '', stock: '', imageUrl: '', active: true });
        setHasSizes(false);
        setSizes([]);
        setNewSize('');
        setVariations([]);
        setNewVariationName('');
        setNewVariationOption({});
        setPaymentMethods(['PIX']);
        setMaxInstallments(1);
        setSelectedFile(null);
        setPreviewUrl('');
    };

    const handleOpenModal = (product?: StoreProduct) => {
        resetForm();
        if (product) {
            setEditingProduct(product);
            setPreviewUrl(product.imageUrl);
            setFormData({
                name: product.name,
                description: product.description,
                price: product.price.toString(),
                stock: product.stock.toString(),
                imageUrl: product.imageUrl,
                active: product.active,
            });
            setHasSizes(product.hasSizes ?? (product.sizes && product.sizes.length > 0) ?? false);
            setSizes(product.sizes || []);
            setVariations(product.variations || []);
            setPaymentMethods(product.paymentMethods && product.paymentMethods.length > 0 ? product.paymentMethods : ['PIX']);
            setMaxInstallments(product.maxInstallments || 1);
        } else {
            setEditingProduct(null);
        }
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    // ── Sizes helpers ──────────────────────────────────────────────────────────
    const addSize = () => {
        const trimmed = newSize.trim().toUpperCase();
        if (trimmed && !sizes.includes(trimmed)) {
            setSizes(prev => [...prev, trimmed]);
        }
        setNewSize('');
    };

    const removeSize = (s: string) => setSizes(prev => prev.filter(x => x !== s));

    // ── Variations helpers ─────────────────────────────────────────────────────
    const addVariation = () => {
        const name = newVariationName.trim();
        if (!name) return;
        if (variations.some(v => v.name.toLowerCase() === name.toLowerCase())) {
            showAlert('Já existe uma variação com esse nome.', 'warning');
            return;
        }
        setVariations(prev => [...prev, { name, options: [] }]);
        setNewVariationName('');
    };

    const removeVariation = (idx: number) => {
        setVariations(prev => prev.filter((_, i) => i !== idx));
    };

    const addVariationOption = (idx: number) => {
        const opt = (newVariationOption[idx] || '').trim();
        if (!opt) return;
        setVariations(prev => prev.map((v, i) => {
            if (i !== idx) return v;
            if (v.options.includes(opt)) return v;
            return { ...v, options: [...v.options, opt] };
        }));
        setNewVariationOption(prev => ({ ...prev, [idx]: '' }));
    };

    const removeVariationOption = (varIdx: number, opt: string) => {
        setVariations(prev => prev.map((v, i) => {
            if (i !== varIdx) return v;
            return { ...v, options: v.options.filter(o => o !== opt) };
        }));
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            const priceNum = parseFloat(formData.price.replace(',', '.'));
            const stockNum = parseInt(formData.stock, 10);

            if (isNaN(priceNum) || isNaN(stockNum)) {
                showAlert('Preço ou estoque inválido.', 'warning');
                setUploading(false);
                return;
            }

            if (hasSizes && sizes.length === 0) {
                showAlert('Adicione pelo menos um tamanho, ou desmarque a opção de tamanhos.', 'warning');
                setUploading(false);
                return;
            }

            // Validate variations
            const invalidVar = variations.find(v => v.options.length === 0);
            if (invalidVar) {
                showAlert(`A variação "${invalidVar.name}" não tem opções. Adicione pelo menos uma opção ou remova a variação.`, 'warning');
                setUploading(false);
                return;
            }

            let finalImageUrl = formData.imageUrl;

            if (selectedFile) {
                try {
                    const compressed = await compressImage(selectedFile);
                    const fileFormData = new FormData();
                    fileFormData.append('file', compressed, selectedFile.name);
                    fileFormData.append('folder', 'uba_store_products');
                    const workerUrl = import.meta.env.VITE_WORKER_URL;
                    const res = await fetch(`${workerUrl}/images/upload`, { method: 'POST', body: fileFormData });
                    if (!res.ok) throw new Error('Falha no upload da imagem');
                    const uploadData = await res.json();
                    finalImageUrl = uploadData.data?.url || uploadData.url;
                } catch (uploadError: any) {
                    showAlert('Erro ao fazer upload da imagem.', 'error');
                    setUploading(false);
                    return;
                }
            }

            if (!finalImageUrl) {
                showAlert('Por favor, selecione uma imagem para o produto.', 'warning');
                setUploading(false);
                return;
            }

            if (paymentMethods.length === 0) {
                showAlert('Selecione pelo menos uma forma de pagamento.', 'warning');
                setUploading(false);
                return;
            }

            const productData: any = {
                name: formData.name,
                description: formData.description,
                price: priceNum,
                stock: stockNum,
                imageUrl: finalImageUrl,
                active: formData.active,
                hasSizes,
                sizes: hasSizes ? sizes : [],
                variations: variations.length > 0 ? variations : [],
                paymentMethods,
                maxInstallments: paymentMethods.includes('CREDIT_CARD') ? maxInstallments : 1,
                updatedAt: new Date().toISOString()
            };

            if (editingProduct?.id) {
                await setDoc(doc(db, 'uba_store_products', editingProduct.id), productData, { merge: true });
                showAlert('Produto atualizado com sucesso!', 'success');
            } else {
                const uniqueId = `prod_${Date.now()}`;
                productData.createdAt = new Date().toISOString();
                await setDoc(doc(db, 'uba_store_products', uniqueId), productData);
                showAlert('Produto criado com sucesso!', 'success');
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            showAlert('Erro ao salvar produto.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        showConfirm(`Tem certeza que deseja excluir o produto "${name}"?`, async () => {
            try {
                await deleteDoc(doc(db, 'uba_store_products', id));
                showAlert('Produto excluído com sucesso.', 'success');
                fetchProducts();
            } catch (error) {
                showAlert('Erro ao excluir produto.', 'error');
            }
        }, 'warning', 'Excluir Produto');
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#00237f', fontSize: '1.2rem' }}>Produtos Cadastrados</h2>
                <button
                    onClick={() => handleOpenModal()}
                    style={{ background: '#007d2f', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                    <Plus size={18} /> NOVO PRODUTO
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Carregando produtos...</div>
            ) : products.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #ccc' }}>
                    <ImageIcon size={48} color="#ccc" style={{ marginBottom: '10px' }} />
                    <p style={{ color: '#666', margin: 0 }}>Nenhum produto cadastrado na loja.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {products.map(product => (
                        <div key={product.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', opacity: product.active ? 1 : 0.6 }}>
                            <div style={{ height: '180px', background: '#f5f7fa', position: 'relative' }}>
                                {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                        <ImageIcon size={40} />
                                    </div>
                                )}
                                {!product.active && (
                                    <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>INATIVO</div>
                                )}
                            </div>
                            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>{product.name}</h3>
                                    <span style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '1.1rem' }}>R$ {product.price.toFixed(2)}</span>
                                </div>
                                <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.85rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {product.description}
                                </p>
                                {/* Badges de tamanhos e variações */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                                    {product.hasSizes && product.sizes && product.sizes.length > 0 && (
                                        <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                            Tamanhos: {product.sizes.join(', ')}
                                        </span>
                                    )}
                                    {product.variations && product.variations.map(v => (
                                        <span key={v.name} style={{ fontSize: '0.7rem', background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                            {v.name}: {v.options.slice(0, 3).join(', ')}{v.options.length > 3 ? '...' : ''}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                    <span style={{ fontSize: '0.85rem', color: product.stock > 0 ? '#555' : '#c62828', fontWeight: 'bold' }}>
                                        Estoque: {product.stock}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleOpenModal(product)} style={{ background: '#f5f7fa', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#00237f' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(product.id!, product.name)} style={{ background: '#ffebee', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#c62828' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── MODAL ───────────────────────────────────────────────────────── */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                            <h3 style={{ margin: 0, color: '#00237f' }}>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>&times;</button>
                        </div>

                        <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* ── Imagem ──────────────────────────────────────── */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ width: '180px', height: '180px', borderRadius: '16px', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: uploading ? 'not-allowed' : 'pointer' }}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <>
                                            <Upload size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>ADICIONAR FOTO</span>
                                        </>
                                    )}
                                    {uploading && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Loader className="animate-spin" color="#00237f" />
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} disabled={uploading} />
                                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ marginTop: '12px', background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                                    {previewUrl ? 'Trocar Imagem' : 'Selecionar Arquivo'}
                                </button>
                            </div>

                            {/* ── Nome ────────────────────────────────────────── */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Nome do Produto *</label>
                                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={INPUT_STYLE} />
                            </div>

                            {/* ── Descrição ───────────────────────────────────── */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Descrição *</label>
                                <textarea required rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
                            </div>

                            {/* ── Preço / Estoque ─────────────────────────────── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Preço (R$) *</label>
                                    <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} style={INPUT_STYLE} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Estoque *</label>
                                    <input type="number" required value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} style={INPUT_STYLE} />
                                </div>
                            </div>

                            {/* ── Tamanhos ─────────────────────────────────────── */}
                            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <button
                                    type="button"
                                    onClick={() => setHasSizes(prev => !prev)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {/* Toggle visual */}
                                        <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: hasSizes ? '#00237f' : '#cbd5e1', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', top: '3px', left: hasSizes ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                        </div>
                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Este produto tem tamanhos?</span>
                                    </div>
                                    {hasSizes ? <ChevronUp size={18} color="#666" /> : <ChevronDown size={18} color="#666" />}
                                </button>

                                {hasSizes && (
                                    <div style={{ padding: '0 16px 16px' }}>
                                        {/* Chips existentes */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px', marginBottom: '10px' }}>
                                            {sizes.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nenhum tamanho adicionado ainda.</span>}
                                            {sizes.map(s => (
                                                <span key={s} style={CHIP_STYLE(true)}>
                                                    {s}
                                                    <button type="button" onClick={() => removeSize(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0, marginLeft: '2px' }}>
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        {/* Input novo tamanho */}
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="Ex: P, M, G, 38..."
                                                value={newSize}
                                                onChange={e => setNewSize(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
                                                style={{ ...INPUT_STYLE, flex: 1 }}
                                            />
                                            <button type="button" onClick={addSize} style={{ padding: '10px 14px', background: '#00237f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Variações ────────────────────────────────────── */}
                            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>Variações (Ex: Cor, Modelo...)</span>
                                </div>

                                {variations.map((v, idx) => (
                                    <div key={idx} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#00237f', fontSize: '0.9rem' }}>{v.name}</span>
                                            <button type="button" onClick={() => removeVariation(idx)} style={{ background: '#ffebee', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#c62828', display: 'flex' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        {/* Chips de opções */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                            {v.options.length === 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Adicione opções abaixo</span>}
                                            {v.options.map(opt => (
                                                <span key={opt} style={CHIP_STYLE(true)}>
                                                    {opt}
                                                    <button type="button" onClick={() => removeVariationOption(idx, opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                                                        <X size={11} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        {/* Adicionar opção */}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <input
                                                type="text"
                                                placeholder={`Ex: Azul, Vermelho...`}
                                                value={newVariationOption[idx] || ''}
                                                onChange={e => setNewVariationOption(prev => ({ ...prev, [idx]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariationOption(idx); } }}
                                                style={{ ...INPUT_STYLE, flex: 1, fontSize: '0.85rem' }}
                                            />
                                            <button type="button" onClick={() => addVariationOption(idx)} style={{ padding: '8px 12px', background: '#00237f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Adicionar nova variação */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <input
                                        type="text"
                                        placeholder="Nome da variação (ex: Cor)"
                                        value={newVariationName}
                                        onChange={e => setNewVariationName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariation(); } }}
                                        style={{ ...INPUT_STYLE, flex: 1, fontSize: '0.85rem' }}
                                    />
                                    <button type="button" onClick={addVariation} style={{ padding: '10px 14px', background: '#007d2f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        <Plus size={16} /> Variação
                                    </button>
                                </div>
                            </div>

                            {/* ── Formas de Pagamento ─────────────────────────── */}
                            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333', marginBottom: '12px' }}>
                                    Formas de Pagamento Aceitas *
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                    {([
                                        { key: 'PIX', label: 'PIX', color: '#00b894' },
                                        { key: 'BOLETO', label: 'Boleto', color: '#0984e3' },
                                        { key: 'CREDIT_CARD', label: 'Cartão', color: '#6c5ce7' },
                                    ] as { key: PaymentMethodType; label: string; color: string }[]).map(({ key, label, color }) => {
                                        const active = paymentMethods.includes(key);
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => togglePaymentMethod(key)}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: active ? color : '#fff',
                                                    color: active ? '#fff' : '#64748b',
                                                    border: `2px solid ${active ? color : '#e2e8f0'}`,
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}
                                            >
                                                {active && <Check size={14} />} {label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Parcelas no cartão */}
                                {paymentMethods.includes('CREDIT_CARD') && (
                                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                                            Máximo de Parcelas no Cartão
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <select
                                                value={maxInstallments}
                                                onChange={e => setMaxInstallments(Number(e.target.value))}
                                                style={{ ...INPUT_STYLE, width: 'auto', minWidth: '100px' }}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                                                    <option key={n} value={n}>{n}x</option>
                                                ))}
                                            </select>
                                            {formData.price && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => {
                                                        const val = parseFloat(formData.price.replace(',', '.'));
                                                        if (isNaN(val)) return null;
                                                        const adjustedTotal = calculateAdjustedPrice(val, n);
                                                        return (
                                                            <span key={n} style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                                                {n}x R$ {(adjustedTotal / n).toFixed(2)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Ativo ────────────────────────────────────────── */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f7fa', padding: '15px', borderRadius: '8px' }}>
                                <input type="checkbox" id="active" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} style={{ transform: 'scale(1.2)' }} />
                                <label htmlFor="active" style={{ cursor: 'pointer', fontWeight: 'bold', color: '#333', margin: 0 }}>Produto Ativo (Visível na loja)</label>
                            </div>

                            {/* ── Botões ───────────────────────────────────────── */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', position: 'sticky', bottom: 0, background: '#fff', paddingTop: '10px' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', fontWeight: 'bold', cursor: 'pointer', color: '#666' }}>Cancelar</button>
                                <button type="submit" disabled={uploading} style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: uploading ? '#ccc' : '#007d2f', fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {uploading ? <Loader className="animate-spin" size={18} /> : <Check size={18} />}
                                    {uploading ? 'SALVANDO...' : 'SALVAR PRODUTO'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
