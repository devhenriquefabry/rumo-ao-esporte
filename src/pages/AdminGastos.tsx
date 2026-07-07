import { useState, useEffect } from 'react';
import {
    FileText,
    Calendar,
    DollarSign,
    CheckCircle,
    Search,
    Plus,
    Trash2,
    X,
    Loader2,
    Printer,
    Camera
} from 'lucide-react';

import { useDialog } from '../context/CustomDialogContext';
import { expenseService } from '../utils/expenseService';
import { compressImage } from '../utils/imageUtils';


interface Expense {
    id: string;
    value: number;
    description: string;
    identificationField?: string;
    scheduleDate: string; // ou "dueDate" dependendo da API
    transactionReceiptUrl?: string;
    observations?: string;
    category?: string;
}

export default function AdminGastos() {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [filter, setFilter] = useState('');
    const { showAlert, showConfirm } = useDialog();
    const workerUrl = import.meta.env.VITE_WORKER_URL;

    // Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        transactionReceiptUrl: '',
        description: '',
        value: '',
        dueDate: new Date().toISOString().split('T')[0],
        observations: '',
        category: 'Outros'
    });


    const fetchExpenses = async () => {
        try {
            setLoading(true);
            if (!workerUrl) throw new Error("Worker URL not configured");

            const data = await expenseService.listExpenses(workerUrl);
            setExpenses(data as any);


        } catch (error: any) {
            console.error("Erro ao buscar gastos:", error);
            showAlert("Erro ao carregar despesas: " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const compressedBlob = await compressImage(file);
            const formData = new FormData();
            formData.append('file', compressedBlob, file.name);
            formData.append('folder', 'rumo_ao_esporte_2026_expenses');

            const workerUrl = import.meta.env.VITE_WORKER_URL;
            const res = await fetch(`${workerUrl}/images/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Upload failed');

            const url = result.data?.url || result.url;
            setForm(prev => ({ ...prev, transactionReceiptUrl: url }));
        } catch (error: any) {
            console.error("Upload error:", error);
            showAlert('Erro ao enviar comprovante: ' + error.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {

        e.preventDefault();
        if (!form.description || !form.value) {
            showAlert("Preencha os campos obrigatórios.", "warning");
            return;
        }

        setIsSaving(true);
        try {
            const numericValue = parseFloat(form.value.replace(',', '.')) * 100;
            await expenseService.createExpense(workerUrl, {
                description: form.description,
                value: numericValue,
                dueDate: form.dueDate,
                observations: form.observations,
                category: form.category,
                transactionReceiptUrl: form.transactionReceiptUrl
            });

            showAlert("Despesa registrada com sucesso!", "success");
            setShowAddModal(false);
            setForm({
                transactionReceiptUrl: '',
                description: '',
                value: '',
                dueDate: new Date().toISOString().split('T')[0],
                observations: '',
                category: 'Outros'
            });

            fetchExpenses();
        } catch (error: any) {
            showAlert("Erro ao salvar despesa: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteExpense = (id: string) => {
        showConfirm(
            "Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita no Asaas.",
            async () => {
                try {
                    setLoading(true);
                    await expenseService.deleteExpense(workerUrl, id);
                    showAlert("Despesa excluída com sucesso.", "success");
                    fetchExpenses();
                } catch (error: any) {
                    showAlert("Erro ao excluir: " + error.message, "error");
                } finally {
                    setLoading(false);
                }
            },
            'error'
        );
    };


    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const filteredExpenses = expenses.filter(e =>
        e.description?.toLowerCase().includes(filter.toLowerCase()) ||
        e.observations?.toLowerCase().includes(filter.toLowerCase()) ||
        e.category?.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <style>{`
                .btn-primary:active { transform: scale(0.98); }
                .native-input:focus { border-color: #00a63a; outline: none; box-shadow: 0 0 0 2px rgba(23, 66, 143, 0.14); }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DollarSign size={28} color="#00a63a" />
                        Despesas (Contas a Pagar)
                    </h1>
                    <p style={{ color: '#6b7280', marginTop: '5px' }}>Gestão de gastos registrados no Asaas.</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: "translateY(-50%)", color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Filtrar despesas..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{
                                padding: '10px 10px 10px 35px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                width: '220px'
                            }}
                            className="native-input"
                        />
                    </div>

                    <button
                        onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            const total = filteredExpenses.reduce((acc, exp) => acc + exp.value, 0);

                            printWindow.document.write(`
                                <html>
                                <head>
                                    <title>Relatório de Despesas - Rumo ao Esporte 2026</title>
                                    <style>
                                        body { font-family: sans-serif; padding: 20px; }
                                        h1 { color: #00a63a; text-align: center; }
                                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                        th { background-color: #f8fafc; color: #334155; }
                                        tr:nth-child(even) { background-color: #f1f5f9; }
                                        .total { margin-top: 30px; text-align: right; font-size: 1.2rem; font-weight: bold; color: #00a63a; border-top: 2px solid #00a63a; padding-top: 10px; }
                                        .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 0.8rem; }
                                        @media print { .no-print { display: none; } }
                                    </style>
                                </head>
                                <body>
                                    <h1>RELATÓRIO DE DESPESAS - Rumo ao Esporte 2026</h1>
                                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                                    
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Data</th>
                                                <th>Descrição</th>
                                                <th>Categoria</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${filteredExpenses.map(exp => `
                                                <tr>
                                                    <td>${formatDate(exp.scheduleDate)}</td>
                                                    <td>${exp.description}</td>
                                                    <td>${exp.category || '-'}</td>
                                                    <td>${formatCurrency(exp.value)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>

                                    <div class="total">TOTAL: ${formatCurrency(total)}</div>
                                    
                                    <div class="footer">
                                        Sisteminha de Contrato - Rumo ao Esporte 2026
                                    </div>

                                    <script>
                                        window.onload = () => {
                                            window.print();
                                            // window.close(); // Opcional
                                        };
                                    </script>
                                </body>
                                </html>
                            `);
                            printWindow.document.close();
                        }}
                        style={{
                            background: '#fff',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                        }}
                        className="btn-secondary"
                    >
                        <Printer size={20} /> Relatório
                    </button>


                    <button
                        onClick={() => setShowAddModal(true)}

                        style={{
                            background: '#00a63a',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 125, 47, 0.2)'
                        }}
                        className="btn-primary"
                    >
                        <Plus size={20} /> Novo Gasto
                    </button>
                </div>
            </div>

            {loading && expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#6b7280' }}>
                    <Loader2 className="spin" size={32} style={{ margin: '0 auto 15px', color: '#00a63a' }} />
                    <p>Carregando despesas...</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }}>Data Prevista</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }}>Descrição</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }}>Valor</th>
                                <th style={{ padding: '16px', textAlign: 'center', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                                        Nenhuma despesa encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((expense) => (
                                    <tr key={expense.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '16px', fontSize: '0.9rem', color: '#111827' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={16} color="#9ca3af" />
                                                {formatDate(expense.scheduleDate)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 600, color: '#111827' }}>{expense.description || "Sem descrição"}</div>
                                            {(expense.category || expense.observations) && (
                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                                    {expense.category && <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>{expense.category}</span>}
                                                    {expense.observations && <span>{expense.observations}</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '0.95rem', fontWeight: 700, color: '#00a63a' }}>
                                            {formatCurrency(expense.value)}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                {expense.transactionReceiptUrl && (
                                                    <a
                                                        href={expense.transactionReceiptUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#2563eb', padding: '6px', borderRadius: '6px', background: '#eff6ff' }}
                                                        title="Ver Recibo"
                                                    >
                                                        <FileText size={18} />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                    style={{ color: '#dc2626', padding: '6px', borderRadius: '6px', background: '#fef2f2', border: 'none', cursor: 'pointer' }}
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Novo Gasto */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="animate-scale-in" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>Registrar Novo Gasto</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddExpense} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {/* Upload de Comprovante - PRIMEIRO (Opcional) */}
                            <div style={{ padding: '15px', border: '2px dashed #e2e8f0', borderRadius: '12px', textAlign: 'center', background: '#f8fafc' }}>
                                {form.transactionReceiptUrl ? (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img src={form.transactionReceiptUrl} alt="Comprovante" style={{ maxHeight: '100px', borderRadius: '8px' }} />
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, transactionReceiptUrl: '' })}
                                            style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                {uploading ? <Loader2 size={18} className="animate-spin" color="#00a63a" /> : <Camera size={18} color="#00a63a" />}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>ANEXAR COMPROVANTE (OPCIONAL)</span>
                                            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploading} />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Descrição <span style={{ color: '#ef4444' }}>*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Aluguel da Quadra, Luz, Salário..."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    className="native-input"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Valor (R$) <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="0,00"
                                        value={form.value}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/\D/g, "");
                                            if (val) {
                                                const floatVal = (parseInt(val) / 100).toFixed(2);
                                                setForm({ ...form, value: floatVal.replace('.', ',') });
                                            } else {
                                                setForm({ ...form, value: '' });
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                        className="native-input"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Vencimento <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        type="date"
                                        required
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                        className="native-input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Categoria</label>
                                <select
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    className="native-input"
                                >
                                    <option value="Salários">Salários</option>
                                    <option value="Aluguel">Aluguel</option>
                                    <option value="Manutenção">Manutenção</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Equipamentos">Equipamentos</option>
                                    <option value="Serviços (Luz/Água)">Serviços (Luz/Água)</option>
                                    <option value="Taxas">Taxas</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Observações</label>
                                <textarea
                                    placeholder="Detalhes adicionais..."
                                    rows={2}
                                    value={form.observations}
                                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none' }}
                                    className="native-input"
                                />
                            </div>


                            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {isSaving ? <Loader2 className="spin" size={18} /> : <CheckCircle size={18} />}
                                    {isSaving ? 'Salvando...' : 'Salvar Gasto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

