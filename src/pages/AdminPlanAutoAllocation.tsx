import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import { ArrowLeft, Save, RefreshCw, AlertTriangle, UserCheck, UserX } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import { planService } from '../utils/planService';
import type { Plan } from '../utils/planService';

const MODALITIES = [
    { id: 'futebol', label: 'Futebol' }
];

interface PlanMapping {
    associate?: string;
    nonAssociate?: string;
    // Specific for Volleyball associates
    individual?: string;
    casal?: string;
    familia?: string;
}

export default function AdminPlanAutoAllocation() {
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { setLoading: setShowLoading } = useLoading();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [mappings, setMappings] = useState<Record<string, PlanMapping>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Plans
                const plansList = await planService.getPlans();
                setPlans(plansList);

                // 2. Fetch Settings
                const settingsRef = doc(db, 'system_settings', 'plan_auto_allocation');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    setMappings(settingsSnap.data().mappings || {});
                }
            } catch (error) {
                console.error("Error fetching auto-allocation data:", error);
                showAlert("Erro ao carregar dados.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'system_settings', 'plan_auto_allocation'), {
                mappings,
                updatedAt: new Date()
            }, { merge: true });
            showAlert("Configurações salvas com sucesso!", "success");
        } catch (error) {
            console.error("Error saving auto-allocation:", error);
            showAlert("Erro ao salvar configurações.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleMappingChange = (modalityId: string, type: keyof PlanMapping, planId: string) => {
        setMappings(prev => ({
            ...prev,
            [modalityId]: {
                ...(prev[modalityId] || {}),
                [type]: planId
            }
        }));
    };

    const handleAutoDistribute = async (modalityId: string, type: keyof PlanMapping) => {
        const targetPlanId = mappings[modalityId]?.[type];
        if (!targetPlanId) {
            showAlert("Selecione um plano antes de distribuir.", "warning");
            return;
        }

        const labels: Record<string, string> = {
            associate: 'Associados',
            nonAssociate: 'Não Associados',
            individual: 'Indiv. (Vôlei)',
            casal: 'Casal (Vôlei)',
            familia: 'Família (Vôlei)'
        };
        const label = labels[type] || type;
        setShowLoading(true, `Buscando alunos ${label} de ${modalityId}...`, 0);

        try {
            // Fetch all registrations for this modality
            const q = query(collection(db, 'arena_simonesia_2026_registrations'), where('modalidade', '==', modalityId));
            const snap = await getDocs(q);
            const totalDocs = snap.size;

            if (totalDocs === 0) {
                setShowLoading(false);
                showAlert(`Nenhum aluno encontrado para ${modalityId}.`, 'info');
                return;
            }

            let processed = 0;
            let updatedCount = 0;

            for (const docSnap of snap.docs) {
                const data = docSnap.data();

                // Criteria check
                const isAssociate = !!data.numeroCota;
                let matchesType = false;

                if (type === 'nonAssociate') {
                    matchesType = !isAssociate;
                } else if (modalityId === 'voleibol') {
                    // For Volleyball associates, we check the planoVoleibol field
                    matchesType = isAssociate && data.planoVoleibol === type;
                } else {
                    // For other modalities, we just check if associate
                    matchesType = isAssociate;
                }

                if (matchesType && data.planId !== targetPlanId) {
                    await updateDoc(doc(db, 'arena_simonesia_2026_registrations', docSnap.id), {
                        planId: targetPlanId
                    });
                    updatedCount++;
                }

                processed++;
                const progress = (processed / totalDocs) * 100;
                setShowLoading(true, `Processando ${processed}/${totalDocs} cadastros...`, progress);
            }

            setShowLoading(false);
            showAlert(`Processo concluído! ${updatedCount} cadastros atualizados.`, 'success');

        } catch (error) {
            console.error("Error auto-distributing plans:", error);
            setShowLoading(false);
            showAlert("Erro ao processar distribuição automática.", "error");
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '15px' }}>
                <RefreshCw size={40} className="spin" color="#007d2f" />
                <p style={{ color: '#666' }}>Carregando configurações...</p>
                <style>{`
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <PageContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#f5f5f5', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#555' }}
                >
                    <ArrowLeft size={18} /> Voltar
                </button>
                <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#007d2f', fontWeight: '900' }}>ALOCAÇÃO DE PLANOS (POR CATEGORIA)</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: '#007d2f', color: '#fff', border: 'none', padding: '10px 24px',
                        borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        fontWeight: 'bold', boxShadow: '0 4px 12px rgba(195,34,40,0.2)',
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '20px', marginBottom: '30px', display: 'flex', gap: '15px', color: '#0369a1' }}>
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.9rem' }}>
                    <strong>Instruções:</strong> Defina qual plano deve ser atribuído automaticamente para cada categoria (Associado ou Não Associado) ao se inscreverem em cada modalidade. Isso automatiza e oculta a escolha do plano no formulário público.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {MODALITIES.map(mod => {
                    const modalityPlans = plans.filter(p => {
                        const planMod = p.modalidade.toLowerCase();
                        const modId = mod.id.toLowerCase();
                        // Direct match
                        if (planMod === modId) return true;
                        // Alias or substring matches
                        if (modId === 'hidro' && (planMod.includes('hidro') || planMod.includes('hidroginástica') || planMod.includes('hidroginastica'))) return true;
                        if (modId === 'voleibol' && (planMod === 'vôlei' || planMod === 'volei')) return true;
                        if (modId === 'natacao' && (planMod === 'natação' || planMod === 'natacao')) return true;
                        return false;
                    });
                    const mapping = mappings[mod.id] || {};

                    return (
                        <div key={mod.id} style={{
                            background: '#fff',
                            borderRadius: '20px',
                            padding: '30px',
                            border: '1px solid #eee',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                        }}>
                            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', color: '#007d2f', fontWeight: '900', borderBottom: '2px solid #f9f9f9', paddingBottom: '10px', textTransform: 'uppercase' }}>
                                {mod.label}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Row Rendering Logic */}
                                {mod.id === 'voleibol' ? (
                                    <>
                                        {[
                                            { id: 'individual', label: 'ASSOCIADO (INDIVIDUAL)', sub: 'Plano p/ 1 pessoa' },
                                            { id: 'casal', label: 'ASSOCIADO (CASAL)', sub: 'Plano p/ 2 pessoas' },
                                            { id: 'familia', label: 'ASSOCIADO (FAMÍLIA)', sub: 'Plano p/ 3+ pessoas' }
                                        ].map(sub => (
                                            <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                                <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', color: '#16a34a' }}><UserCheck size={20} /></div>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#333' }}>{sub.label}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{sub.sub}</div>
                                                    </div>
                                                </div>
                                                <div style={{ flex: '2', minWidth: '250px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <select
                                                        value={mapping[sub.id as keyof PlanMapping] || ''}
                                                        onChange={(e) => handleMappingChange(mod.id, sub.id as any, e.target.value)}
                                                        style={{
                                                            width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd',
                                                            background: mapping[sub.id as keyof PlanMapping] ? '#f0fdf4' : '#fff',
                                                            borderColor: mapping[sub.id as keyof PlanMapping] ? '#4caf50' : '#ddd',
                                                            fontWeight: mapping[sub.id as keyof PlanMapping] ? 'bold' : 'normal', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="">-- Selecione o Plano --</option>
                                                        {modalityPlans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => handleAutoDistribute(mod.id, sub.id as any)}
                                                    style={{
                                                        padding: '10px 20px', borderRadius: '10px', border: '1px solid #007d2f', background: '#fff',
                                                        color: '#007d2f', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                                                    }}
                                                >
                                                    Auto-Distribuir
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    /* Normal Associate Row for Futebol/Natação/Hidro */
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', color: '#16a34a' }}><UserCheck size={20} /></div>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>ASSOCIADO</div>
                                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Alunos com Cota</div>
                                            </div>
                                        </div>

                                        <div style={{ flex: '2', minWidth: '250px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <select
                                                value={mapping.associate || ''}
                                                onChange={(e) => handleMappingChange(mod.id, 'associate', e.target.value)}
                                                style={{
                                                    width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd',
                                                    background: mapping.associate ? '#f0fdf4' : '#fff', borderColor: mapping.associate ? '#4caf50' : '#ddd',
                                                    fontWeight: mapping.associate ? 'bold' : 'normal', cursor: 'pointer'
                                                }}
                                            >
                                                <option value="">-- Selecione o Plano --</option>
                                                {modalityPlans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                            </select>
                                        </div>

                                        <button
                                            onClick={() => handleAutoDistribute(mod.id, 'associate')}
                                            style={{
                                                padding: '10px 20px', borderRadius: '10px', border: '1px solid #007d2f', background: '#fff',
                                                color: '#007d2f', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                                            }}
                                        >
                                            Auto-Distribuir
                                        </button>
                                    </div>
                                )}

                                {/* Non-Associate Row (Common for all) */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap', paddingTop: '15px', borderTop: '1px dashed #eee' }}>
                                    <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ background: '#fff1f0', padding: '8px', borderRadius: '8px', color: '#dc2626' }}><UserX size={20} /></div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#333' }}>NÃO ASSOCIADO</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>Alunos sem Cota</div>
                                        </div>
                                    </div>

                                    <div style={{ flex: '2', minWidth: '250px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <select
                                            value={mapping.nonAssociate || ''}
                                            onChange={(e) => handleMappingChange(mod.id, 'nonAssociate', e.target.value)}
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd',
                                                background: mapping.nonAssociate ? '#fdf2f2' : '#fff', borderColor: mapping.nonAssociate ? '#f87171' : '#ddd',
                                                fontWeight: mapping.nonAssociate ? 'bold' : 'normal', cursor: 'pointer'
                                            }}
                                        >
                                            <option value="">-- Selecione o Plano --</option>
                                            {modalityPlans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => handleAutoDistribute(mod.id, 'nonAssociate')}
                                        style={{
                                            padding: '10px 20px', borderRadius: '10px', border: '1px solid #dc2626', background: '#fff',
                                            color: '#dc2626', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                                        }}
                                    >
                                        Auto-Distribuir
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </PageContainer>
    );
}
