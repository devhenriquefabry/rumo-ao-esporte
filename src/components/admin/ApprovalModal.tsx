
import { useState } from 'react';
import { Check, RefreshCw, X, Maximize2 } from 'lucide-react';
import { normalizeModality, calculateClass } from '../../utils/turmasConstants';

interface ApprovalModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isProcessing: boolean;
    approvalConfig: {
        turmaId: string;
        planId: string;
        paymentDay: number;
        generateContract: boolean;
        prorate?: boolean;
    };
    setApprovalConfig: (config: any) => void;
    turmas: any[];
    plans: any[];
    data: any;
}

export default function ApprovalModal({
    show, onClose, onConfirm, isProcessing,
    approvalConfig, setApprovalConfig, turmas, plans, data
}: ApprovalModalProps) {
    const [zoomPhoto, setZoomPhoto] = useState(false);

    if (!show) return null;

    // Helper para exibir data nascimento/idade se necessário
    const aluno = data.alunos && data.alunos[0];

    return (
        <>
            <div className="bottom-sheet-overlay" onClick={onClose} />
            <div className="bottom-sheet" style={{
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden'
            }}>
                {/* Fixed Top Handle Area */}
                <div style={{ padding: '15px 0 5px 0', flexShrink: 0 }}>
                    <div className="bottom-sheet-handle" style={{ margin: '0 auto' }} />
                </div>

                {/* Scrollable Body Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 20px 20px 20px',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {/* Header with Photo and Name */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginBottom: '25px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '4px solid #e8f5e9',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            marginBottom: '10px',
                            background: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: aluno?.fotoUrl ? 'zoom-in' : 'default',
                            position: 'relative'
                        }}
                            onClick={() => aluno?.fotoUrl && setZoomPhoto(true)}
                        >
                            {aluno?.fotoUrl ? (
                                <>
                                    <img
                                        src={aluno.fotoUrl}
                                        alt={aluno.nome}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        right: '4px',
                                        background: 'rgba(0,0,0,0.5)',
                                        color: '#fff',
                                        borderRadius: '50%',
                                        padding: '4px',
                                        display: 'flex'
                                    }}>
                                        <Maximize2 size={12} />
                                    </div>
                                </>
                            ) : (
                                <div style={{ fontSize: '2rem', color: '#ccc', fontWeight: 'bold' }}>
                                    {aluno?.nome?.charAt(0) || '?'}
                                </div>
                            )}
                        </div>
                        <h2 style={{
                            margin: 0,
                            fontSize: '1.4rem',
                            color: '#333',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                        }}>
                            {aluno?.nome || 'Novo Aluno'}
                        </h2>
                        {aluno?.dataNascimento && (
                            <div style={{ fontSize: '0.90rem', color: '#666', marginTop: '2px' }}>
                                {aluno.dataNascimento} ({(function () {
                                    const dob = aluno.dataNascimento;
                                    let birthDate;
                                    if (dob.includes('/')) {
                                        const [d, m, y] = dob.split('/');
                                        birthDate = new Date(Number(y), Number(m) - 1, Number(d));
                                    } else {
                                        birthDate = new Date(dob);
                                    }
                                    if (isNaN(birthDate.getTime())) return '?';
                                    const today = new Date();
                                    let age = today.getFullYear() - birthDate.getFullYear();
                                    const mDiff = today.getMonth() - birthDate.getMonth();
                                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
                                        age--;
                                    }
                                    return `${age} anos`;
                                })()})
                            </div>
                        )}
                        {data?.numeroCota ? (
                            <div style={{ fontSize: '0.90rem', color: '#1a237e', marginTop: '2px', fontWeight: 'bold' }}>
                                COTA: {data.numeroCota}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.90rem', color: '#d32f2f', marginTop: '2px', fontWeight: 'bold' }}>
                                NÃO ASSOCIADO
                            </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: '#198754', marginTop: '4px', fontWeight: '500' }}>
                            Aprovar Cadastro
                        </div>
                    </div>

                    {/* 1. Turma Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>TURMA / HORÁRIO</label>
                        <select
                            value={approvalConfig.turmaId}
                            onChange={(e) => setApprovalConfig({ ...approvalConfig, turmaId: e.target.value })}
                            className="native-input"
                            style={{ width: '100%', padding: '12px' }}
                        >
                            <option value="auto">Automática (Sistema)</option>
                            {turmas
                                .filter(t => normalizeModality(t.modalidade) === normalizeModality(data.modalidade))
                                .map(t => (
                                    <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                                ))}
                        </select>

                        {/* Auto Helper Text */}
                        {approvalConfig.turmaId === 'auto' && (
                            <div style={{ background: '#e8f5e9', padding: '10px', borderRadius: '6px', marginTop: '8px', fontSize: '0.85rem', color: '#2e7d32', border: '1px solid #c8e6c9' }}>
                                {(normalizeModality(data.modalidade) === 'Natação' || normalizeModality(data.modalidade) === 'Hidroginástica') ? (
                                    <>
                                        <strong>Aluno escolheu o horário.</strong><br />
                                        Horário indicado no cadastro será mantido.
                                    </>
                                ) : (
                                    <>
                                        <strong>Alocação Automática.</strong><br />
                                        O sistema irá selecionar a turma baseada na idade ({aluno ? calculateClass(data.modalidade, aluno.dataNascimento).label : '?'}).
                                        {(function () {
                                            if (!aluno) return null;
                                            const calc = calculateClass(data.modalidade, aluno.dataNascimento);
                                            const match = turmas.find(t => t.modalidade === data.modalidade && t.nome.toLowerCase().includes(calc.id.replace('sub-', '')));
                                            if (match) return <div style={{ marginTop: '4px', fontWeight: 'bold' }}>→ {match.nome} ({match.horario})</div>
                                        })()}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Plan Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>PLANO DE PAGAMENTO <span style={{ color: 'red' }}>*</span></label>
                        <select
                            value={approvalConfig.planId}
                            onChange={(e) => {
                                const selectedPlan = plans.find(p => p.id === e.target.value);
                                setApprovalConfig({
                                    ...approvalConfig,
                                    planId: e.target.value,
                                    // Preenche com o dia de vencimento padrão do plano; o admin ainda pode ajustar abaixo.
                                    paymentDay: selectedPlan?.paymentDay || approvalConfig.paymentDay
                                });
                            }}
                            className="native-input"
                            style={{ width: '100%', padding: '12px' }}
                        >
                            <option value="">Selecione um plano...</option>
                            {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((p.valores?.mensalidade?.ateVencimento || 0) / 100)}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Due Day */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>DIA DE VENCIMENTO</label>
                        <input
                            type="number"
                            min="1" max="31"
                            value={approvalConfig.paymentDay}
                            onChange={(e) => setApprovalConfig({ ...approvalConfig, paymentDay: parseInt(e.target.value) })}
                            className="native-input"
                            style={{ width: '100%', padding: '12px' }}
                        />
                    </div>

                    {/* 4. Prorate Toggle */}
                    <div style={{ marginBottom: '10px', background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            onClick={() => setApprovalConfig({ ...approvalConfig, prorate: !approvalConfig.prorate })}>
                            <div>
                                <label style={{ fontSize: '0.9rem', color: '#0369a1', cursor: 'pointer', fontWeight: 'bold', marginBottom: '2px', display: 'block' }}>
                                    Prorratear primeiro mês?
                                </label>
                                <span style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>
                                    Cobra apenas os dias restantes deste mês.
                                </span>
                            </div>
                            <div style={{
                                width: '44px',
                                height: '24px',
                                background: approvalConfig.prorate ? '#0ea5e9' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                transition: 'background 0.3s ease',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: approvalConfig.prorate ? '22px' : '2px',
                                    transition: 'left 0.3s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                        </div>

                        {/* Calculated prorated value display */}
                        {approvalConfig.prorate && approvalConfig.planId && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px',
                                background: '#fff',
                                borderRadius: '6px',
                                border: '1px dashed #0ea5e9',
                                textAlign: 'center'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>VALOR DA 1ª FATURA CALCULADO:</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0369a1' }}>
                                    {(function () {
                                        const selectedPlan = plans.find(p => p.id === approvalConfig.planId);
                                        if (!selectedPlan) return '...';

                                        const fullMonthlyCentavos = selectedPlan.valores?.mensalidade?.ateVencimento || 0;
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);

                                        // Determine next due date
                                        let nextDue = new Date(today.getFullYear(), today.getMonth(), approvalConfig.paymentDay);
                                        if (nextDue <= today) {
                                            nextDue.setMonth(nextDue.getMonth() + 1);
                                        }

                                        // Calculate difference in days
                                        const diffTime = nextDue.getTime() - today.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                        // Ensure we don't exceed a full month price for simple proration
                                        const effectiveDays = Math.min(diffDays, 30);
                                        const proratedCentavos = Math.round((fullMonthlyCentavos / 30) * effectiveDays);

                                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proratedCentavos / 100);
                                    })()}
                                </span>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {(function () {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        let nextDue = new Date(today.getFullYear(), today.getMonth(), approvalConfig.paymentDay);
                                        if (nextDue <= today) {
                                            nextDue.setMonth(nextDue.getMonth() + 1);
                                        }
                                        const diffTime = nextDue.getTime() - today.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        return `Baseado em ${diffDays} dias até o próximo vencimento`;
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. Generate Contract Toggle */}
                    <div style={{ marginBottom: '10px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            onClick={() => setApprovalConfig({ ...approvalConfig, generateContract: !approvalConfig.generateContract })}>
                            <label style={{ fontSize: '0.9rem', color: '#333', cursor: 'pointer', fontWeight: '500', marginBottom: 0 }}>
                                Gerar contrato PDF automaticamente
                            </label>
                            <div style={{
                                width: '44px',
                                height: '24px',
                                background: approvalConfig.generateContract ? '#2e7d32' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                transition: 'background 0.3s ease',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: approvalConfig.generateContract ? '22px' : '2px',
                                    transition: 'left 0.3s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fixed Footer with Confirmation Button */}
                <div style={{
                    padding: '15px 20px',
                    borderTop: '1px solid #eee',
                    background: '#fff',
                    flexShrink: 0,
                    paddingBottom: 'calc(15px + env(safe-area-inset-bottom, 0))',
                    boxShadow: '0 -4px 10px rgba(0,0,0,0.03)'
                }}>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="touch-feedback"
                        style={{
                            width: '100%',
                            background: '#198754',
                            color: '#fff',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            opacity: isProcessing ? 0.7 : 1,
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        {isProcessing ? <RefreshCw size={20} className="spin" /> : <Check size={20} />}
                        {isProcessing ? 'Processando...' : 'CONFIRMAR APROVAÇÃO'}
                    </button>
                </div>
            </div>

            {/* Photo Zoom Overlay */}
            {zoomPhoto && aluno?.fotoUrl && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 11000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setZoomPhoto(false)}>
                    <button style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer'
                    }}>
                        <X size={28} />
                    </button>
                    <img
                        src={aluno.fotoUrl}
                        alt={aluno.nome}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '80vh',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            objectFit: 'contain'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '40px',
                        color: '#fff',
                        textAlign: 'center',
                        width: '100%'
                    }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', textTransform: 'uppercase' }}>{aluno.nome}</div>
                        <div style={{ fontSize: '1rem', opacity: 0.8 }}>{aluno.dataNascimento}</div>
                    </div>
                </div>
            )}
        </>
    );
}
