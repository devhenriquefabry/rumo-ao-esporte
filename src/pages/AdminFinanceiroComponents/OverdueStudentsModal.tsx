
import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ExternalLink, User, Settings, Send, RefreshCw, AlertCircle } from 'lucide-react';
import type { StudentData } from '../../utils/financialTypes';
import { loadWhatsAppConfig, sendWhatsAppBatch, sendWhatsApp } from '../AdminMensagens/whatsappUtils';
import type { WhatsAppFullConfig, BatchProgress } from '../AdminMensagens/whatsappUtils';

interface OverdueStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    overdueStudents: StudentData[];
    onSelectStudent: (student: StudentData) => void;
}

const DEFAULT_TEMPLATE = `Olá, {responsavel}! 👋
Gostaríamos de lembrá-lo(a) de que existe um débito pendente:

Aluno(a): *{nome}*
Valor: *{valor}*
Vencimento: *{vencimento}*

Por favor, regularize o quanto antes para evitar a suspensão das atividades.

Dúvidas? Entre em contato conosco. 🙏`;

const fmt = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const OverdueStudentsModal: React.FC<OverdueStudentsModalProps> = ({ 
    isOpen, 
    onClose, 
    overdueStudents,
    onSelectStudent
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [config, setConfig] = useState<WhatsAppFullConfig | null>(null);
    const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
    const isMobile = window.innerWidth < 1024;

    useEffect(() => {
        if (isOpen) {
            loadWhatsAppConfig().then(setConfig);
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isOpen]);

    const filtered = useMemo(() => {
        return overdueStudents.filter(s => 
            (s.alunos[0]?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.responsavel?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [overdueStudents, searchTerm]);

    const handleSendBatchMessages = async (toTestNumber: boolean = false) => {
        if (!config) {
            alert("Configuração do WhatsApp não encontrada.");
            return;
        }

        const confirmMsg = (config.modoTeste || toTestNumber)
            ? `[MODO TESTE]\n\nDeseja enviar mensagens de cobrança para ${overdueStudents.length} alunos? Todas serão enviadas para o número de teste (${config.testPhone}).`
            : `Deseja enviar mensagens de cobrança para ${overdueStudents.length} alunos via WhatsApp?`;

        if (!window.confirm(confirmMsg)) return;

        setSending(true);
        setBatchProgress(null);
        try {
            const batch = overdueStudents.map(student => {
                const pendingAmount = student.financialPendingAmount || 0;
                const valorFmt = pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const vencimento = student.paymentDay ? `Dia ${student.paymentDay}` : '—';
                
                const text = DEFAULT_TEMPLATE
                    .replace(/{responsavel}/g, student.responsavel?.nome || 'Responsável')
                    .replace(/{nome}/g, student.alunos[0]?.nome || 'Aluno')
                    .replace(/{valor}/g, valorFmt)
                    .replace(/{vencimento}/g, vencimento);

                const destPhone = (config.modoTeste || toTestNumber) 
                    ? config.testPhone 
                    : (student.responsavel?.telefonePrincipal || '');

                const isOverdue = ['atrasado', 'overdue'].includes(student.status || '');
                const imageUrl = isOverdue ? config.imageUrl : config.pendingImageUrl;

                return {
                    id: crypto.randomUUID(),
                    phone: destPhone,
                    text,
                    name: student.alunos[0]?.nome || student.responsavel?.nome || destPhone,
                    photoUrl: student.alunos[0]?.fotoUrl,
                    imageUrl: imageUrl,
                    studentPhotoUrl: student.alunos[0]?.fotoUrl
                };
            }).filter(m => m.phone);

            if (batch.length === 0) {
                alert("Nenhum aluno com telefone válido encontrado.");
                return;
            }

            const result = await sendWhatsAppBatch(batch, (progress) => {
                setBatchProgress({ ...progress });
            });
            setBatchProgress(prev => prev ? { ...prev, status: result.success ? 'success' : 'error' } : null);
        } catch (error) {
            console.error("Batch send error:", error);
            alert("Erro fatal ao processar envio em lote.");
        } finally {
            setSending(false);
        }
    };

    const [selectedForSingleCharge, setSelectedForSingleCharge] = useState<StudentData | null>(null);
    const [isSingleChargeModalOpen, setIsSingleChargeModalOpen] = useState(false);

    const handleSendSingleMessage = async (toTestNumber: boolean) => {
        if (!config) {
            console.error('WhatsApp send error: config not loaded');
            alert("Aguardando carregamento das configurações do WhatsApp. Tente novamente em instantes.");
            return;
        }
        if (!selectedForSingleCharge) {
            console.error('WhatsApp send error: no student selected');
            return;
        }

        setSending(true);
        try {
            const student = selectedForSingleCharge;
            const pendingAmount = student.financialPendingAmount || 0;
            const valorFmt = pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const vencimento = student.paymentDay ? `Dia ${student.paymentDay}` : '—';
            
            const text = DEFAULT_TEMPLATE
                .replace(/{responsavel}/g, student.responsavel?.nome || 'Responsável')
                .replace(/{nome}/g, student.alunos[0]?.nome || 'Aluno')
                .replace(/{valor}/g, valorFmt)
                .replace(/{vencimento}/g, vencimento);

            const phone = student.responsavel?.telefonePrincipal || '';
            const toTest = toTestNumber || config.modoTeste;

            if (!phone && !toTest) {
                console.error('WhatsApp send error: destination phone missing');
                alert("Número de destino não encontrado para este aluno.");
                setSending(false);
                return;
            }

            console.log(`Attempting to send ${toTest ? 'TEST' : 'REAL'} message to:`, toTest ? config.testPhone : phone);

            // Seleciona a imagem baseada no status: atrasado vs pendente
            const isOverdue = ['atrasado', 'overdue'].includes(student.status || '');
            const overrideImageUrl = isOverdue ? config.imageUrl : config.pendingImageUrl;

            const res = await sendWhatsApp(phone, text, config, toTestNumber, overrideImageUrl, student.alunos[0]?.fotoUrl);

            if (res.success) {
                alert(`Mensagem enviada com sucesso para ${toTestNumber ? 'o número de teste' : student.responsavel?.nome}!`);
                setIsSingleChargeModalOpen(false);
                setSelectedForSingleCharge(null);
            } else {
                alert(`Erro ao enviar mensagem: ${res.log}`);
            }
        } catch (error) {
            console.error("Single send error:", error);
            alert("Erro ao enviar mensagem.");
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff',
                width: '100%',
                maxWidth: '900px', // Increased slightly for the new column
                height: isMobile ? '100%' : 'auto',
                maxHeight: isMobile ? '100%' : '85vh',
                borderRadius: isMobile ? '0' : '24px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                position: 'relative'
            }}>
                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(15px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes fadeInRight {
                        from { opacity: 0; transform: translateX(-15px); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                    @keyframes spinner {
                        to { transform: rotate(360deg); }
                    }
                    .animate-item {
                        animation: fadeInUp 0.4s ease-out forwards;
                        opacity: 0;
                    }
                    .animate-avatar {
                        animation: fadeInRight 0.4s ease-out forwards;
                        opacity: 0;
                    }
                    .spinner {
                        animation: spinner 0.6s linear infinite;
                    }
                `}</style>
                {/* Header */}
                <div style={{
                    padding: '25px 30px',
                    borderBottom: '1px solid #eee',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f8fafc'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#00a63a', fontSize: '1.4rem', fontWeight: '800' }}>
                            EM ATRASO E PENDENTE
                        </h2>
                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                            {overdueStudents.length} registros com pendências financeiras.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => setIsBatchModalOpen(true)}
                            style={{
                                background: '#fff', border: '1px solid #00a63a', padding: '10px 15px',
                                borderRadius: '12px', cursor: 'pointer', color: '#00a63a',
                                fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <Settings size={18} /> Ações em Lote
                        </button>
                        <button onClick={onClose} style={{
                            background: '#fff', border: '1px solid #e2e8f0', padding: '10px',
                            borderRadius: '12px', cursor: 'pointer', color: '#64748b'
                        }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Batch Actions Sub-Modal */}
                {isBatchModalOpen && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                    }}>
                        <div style={{
                            background: '#fff', border: '1px solid #eee', borderRadius: '24px',
                            padding: '30px', maxWidth: '400px', width: '100%', textAlign: 'center',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ color: '#00a63a', marginBottom: '15px' }}>
                                <Settings size={48} />
                            </div>
                            <h3 style={{ margin: '0 0 10px', fontWeight: '800' }}>Ações em Lote</h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '15px' }}>
                                Executar ações para todos os <strong>{overdueStudents.length}</strong> alunos nesta lista.
                            </p>
                            
                            {/* Progress Bar ao vivo (aparece durante o envio) */}
                            {batchProgress ? (
                                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                                    {/* Barra de progresso */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', color: '#64748b' }}>
                                        <span>📨 {batchProgress.currentName}</span>
                                        <span style={{ fontWeight: 700 }}>{batchProgress.current}/{batchProgress.total}</span>
                                    </div>
                                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(batchProgress.results.length / batchProgress.total) * 100}%`,
                                            background: 'linear-gradient(90deg, #00a63a, #e05555)',
                                            borderRadius: '99px',
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>

                                    {/* Lista de resultados ao vivo */}
                                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {batchProgress.results.map((r, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: r.success ? '#f0fdf4' : '#eef8ff',
                                                border: `1px solid ${r.success ? '#bbf7d0' : '#fecaca'}`
                                            }}>
                                                {/* Avatar do aluno */}
                                                {r.photoUrl ? (
                                                    <img src={r.photoUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={12} color="#94a3b8" />
                                                    </div>
                                                )}
                                                <span style={{ flex: 1, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                                <span style={{ color: r.success ? '#16a34a' : '#dc2626', fontSize: '0.72rem', flexShrink: 0 }}>{r.success ? '✅ Enviado' : '❌ Erro'}</span>
                                            </div>
                                        ))}
                                        {batchProgress.status === 'processing' && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: '#fefce8', border: '1px solid #fde68a', color: '#92400e'
                                            }}>
                                                {batchProgress.currentPhotoUrl ? (
                                                    <img src={batchProgress.currentPhotoUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={12} color="#92400e" />
                                                    </div>
                                                )}
                                                <RefreshCw size={12} className="spinner" />
                                                <span>Enviando para <strong>{batchProgress.currentName}</strong>...</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumo final */}
                                    {!sending && (
                                        <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.85rem', color: '#334155', fontWeight: 700 }}>
                                            ✅ {batchProgress.results.filter(r => r.success).length} enviados ·
                                            ❌ {batchProgress.results.filter(r => !r.success).length} com erro
                                        </div>
                                    )}
                                </div>
                            ) : (
                            <>{/* Avatars Preview */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                marginBottom: '20px', 
                                paddingLeft: '10px'
                            }}>
                                {overdueStudents.slice(0, 10).map((student, index) => (
                                    <div 
                                        key={student.id} 
                                        className="animate-avatar"
                                        style={{ 
                                            position: 'relative',
                                            marginLeft: index === 0 ? 0 : '-10px',
                                            zIndex: 10 - index,
                                            animationDelay: `${index * 0.04}s`
                                        }}
                                    >
                                        {student.alunos[0]?.fotoUrl ? (
                                            <img 
                                                src={student.alunos[0].fotoUrl} 
                                                alt="" 
                                                style={{ 
                                                    width: '36px', height: '36px', borderRadius: '50%', 
                                                    objectFit: 'cover', border: '2px solid #fff', 
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                                                }} 
                                            />
                                        ) : (
                                            <div style={{ 
                                                width: '36px', height: '36px', borderRadius: '50%', 
                                                background: '#f1f5f9', display: 'flex', alignItems: 'center', 
                                                justifyContent: 'center', color: '#94a3b8',
                                                border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                            }}>
                                                <User size={16} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {overdueStudents.length > 10 && (
                                    <div style={{ 
                                        width: '36px', height: '36px', borderRadius: '50%', 
                                        background: '#f1f5f9', display: 'flex', alignItems: 'center', 
                                        justifyContent: 'center', color: '#64748b',
                                        fontSize: '0.75rem', fontWeight: 'bold', border: '2px solid #fff',
                                        marginLeft: '-10px', zIndex: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }}>
                                        +{overdueStudents.length - 10}
                                    </div>
                                )}
                            </div></>
                            )}

                            <div style={{ background: '#fff9f9', border: '1px dashed #00a63a', borderRadius: '12px', padding: '15px', marginBottom: '25px', textAlign: 'left' }}>
                                <p style={{ fontSize: '0.8rem', color: '#00a63a', fontWeight: 'bold', margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <AlertCircle size={14} /> O que vai acontecer?
                                </p>
                                <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
                                    O sistema enviará uma mensagem de WhatsApp para o <strong>responsável</strong> de cada aluno, contendo o nome do aluno, o valor total em atraso e o dia de vencimento original. As mensagens serão processadas em fila para garantir a entrega segura.
                                </p>
                            </div>
                            
                            <button 
                                onClick={() => handleSendBatchMessages(false)}
                                disabled={sending}
                                style={{
                                    width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                                    background: sending ? '#ccc' : '#00a63a', color: '#fff', fontWeight: '800',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    cursor: sending ? 'not-allowed' : 'pointer', marginBottom: '10px'
                                }}
                            >
                                {sending ? <RefreshCw className="spinner" size={18} /> : <Send size={18} />}
                                Enviar Cobrança WhatsApp
                            </button>

                            <button 
                                onClick={() => handleSendBatchMessages(true)}
                                disabled={sending}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #00a63a',
                                    background: '#fff', color: '#00a63a', fontWeight: '700',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                <Settings size={18} /> Enviar para Número Teste
                            </button>

                            <button 
                                onClick={() => setIsBatchModalOpen(false)}
                                disabled={sending}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0',
                                    background: '#fff', color: '#64748b', fontWeight: '700', cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Single Charge Sub-Modal */}
                {isSingleChargeModalOpen && selectedForSingleCharge && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                    }}>
                        <div style={{
                            background: '#fff', border: '1px solid #eee', borderRadius: '24px',
                            padding: '30px', maxWidth: '450px', width: '100%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            maxHeight: '90vh', overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                {selectedForSingleCharge.alunos[0]?.fotoUrl ? (
                                    <img src={selectedForSingleCharge.alunos[0].fotoUrl} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                ) : (
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <User size={24} />
                                    </div>
                                )}
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: '800', color: '#334155' }}>Cobrar Aluno</h3>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{selectedForSingleCharge.alunos[0]?.nome}</p>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '15px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Prévia da Mensagem:</p>
                                <pre style={{ 
                                    whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#334155', 
                                    margin: 0, fontFamily: 'inherit', lineHeight: '1.5',
                                    padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #eee'
                                }}>
                                    {DEFAULT_TEMPLATE
                                        .replace(/{responsavel}/g, selectedForSingleCharge.responsavel?.nome || 'Responsável')
                                        .replace(/{nome}/g, selectedForSingleCharge.alunos[0]?.nome || 'Aluno')
                                        .replace(/{valor}/g, (selectedForSingleCharge.financialPendingAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
                                        .replace(/{vencimento}/g, selectedForSingleCharge.paymentDay ? `Dia ${selectedForSingleCharge.paymentDay}` : '—')}
                                </pre>
                            </div>

                            <div style={{ display: 'grid', gap: '10px' }}>
                                <button 
                                    onClick={() => handleSendSingleMessage(false)}
                                    disabled={sending}
                                    style={{
                                        padding: '15px', borderRadius: '12px', border: 'none',
                                        background: '#00a63a', color: '#fff', fontWeight: '800',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    {sending ? <RefreshCw className="spinner" size={18} /> : <Send size={18} />}
                                    Enviar para {selectedForSingleCharge.responsavel?.nome || 'Responsável'}
                                </button>

                                <button 
                                    onClick={() => handleSendSingleMessage(true)}
                                    disabled={sending}
                                    style={{
                                        padding: '12px', borderRadius: '12px', border: '1px solid #00a63a',
                                        background: '#fff', color: '#00a63a', fontWeight: '700',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    <Settings size={18} /> Enviar para Número Teste
                                </button>

                                <button 
                                    onClick={() => {
                                        setIsSingleChargeModalOpen(false);
                                        setSelectedForSingleCharge(null);
                                    }}
                                    disabled={sending}
                                    style={{
                                        padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                        background: '#fff', color: '#64748b', fontWeight: '700', cursor: 'pointer', marginTop: '5px'
                                    }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div style={{ padding: '20px 30px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nome do aluno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 15px 12px 45px', border: '1px solid #e2e8f0',
                                borderRadius: '12px', fontSize: '0.9rem', outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* List Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                            <p>Nenhum aluno encontrado com esse termo.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            {!isMobile && (
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Aluno</th>
                                        <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Modalidade</th>
                                        <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Valor Pendente</th>
                                        <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Fatura</th>
                                        <th style={{ padding: '15px 10px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Ação</th>
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {filtered.map((student, index) => (
                                    <tr 
                                        key={student.id} 
                                        className="animate-item"
                                        style={{ 
                                            borderBottom: '1px solid #f1f5f9',
                                            animationDelay: `${index * 0.03}s`
                                        }}
                                    >
                                        <td style={{ padding: '15px 10px' }}>
                                            <button 
                                                onClick={() => onSelectStudent(student)}
                                                style={{ 
                                                    background: 'none', border: 'none', padding: 0, 
                                                    color: '#00a63a', fontWeight: '800', cursor: 'pointer',
                                                    fontSize: '0.95rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px'
                                                }}
                                            >
                                                {student.alunos[0]?.fotoUrl ? (
                                                    <img 
                                                        src={student.alunos[0].fotoUrl} 
                                                        alt="" 
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f1f5f9' }} 
                                                    />
                                                ) : (
                                                    <div style={{ 
                                                        width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' 
                                                    }}>
                                                        <User size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <div>{student.alunos[0]?.nome || 'Sem Nome'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>
                                                        Resp: {student.responsavel?.nome}
                                                    </div>
                                                </div>
                                            </button>
                                        </td>
                                        { !isMobile && (
                                            <td style={{ padding: '15px 10px' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                                                    {student.modalidade}
                                                </span>
                                            </td>
                                        )}
                                        <td style={{ padding: '15px 10px' }}>
                                            <div style={{ fontWeight: '800', color: '#00a63a' }}>
                                                {fmt(student.financialPendingAmount || 0)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                            {student.financialInvoiceUrl ? (
                                                <a 
                                                    href={student.financialInvoiceUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    style={{ color: '#00a63a', display: 'inline-flex', alignItems: 'center' }}
                                                    title="Ver Fatura"
                                                >
                                                    <ExternalLink size={18} />
                                                </a>
                                            ) : (
                                                <span style={{ color: '#cbd5e1' }} title="Sem faturas pendentes detectadas">
                                                    <ExternalLink size={18} />
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => {
                                                    setSelectedForSingleCharge(student);
                                                    setIsSingleChargeModalOpen(true);
                                                }}
                                                style={{
                                                    background: '#00a63a', color: '#fff', border: 'none',
                                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px',
                                                    margin: '0 auto', boxShadow: '0 2px 4px rgba(0, 125, 47, 0.2)'
                                                }}
                                            >
                                                <Send size={14} /> Cobrar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 30px',
                    background: '#f8fafc',
                    borderTop: '1px solid #eee',
                    display: 'flex', justifyContent: 'flex-end'
                }}>
                    <button onClick={onClose} style={{
                        padding: '12px 25px', borderRadius: '12px', border: 'none',
                        background: '#334155', color: '#fff', fontWeight: '700', cursor: 'pointer'
                    }}>
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
};
