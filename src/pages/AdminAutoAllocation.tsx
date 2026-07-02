import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { AGES_TO_MAP, SCHEDULE_OPTIONS, normalizeModality } from '../utils/turmasConstants';
import { useLoading } from '../components/LoadingService';
import { ArrowLeft, Save, RefreshCw, AlertTriangle, CheckCircle2, User } from 'lucide-react';
import PageContainer from '../components/PageContainer';

interface Turma {
    id: string;
    nome: string;
    horario: string;
    dias: string[];
    modalidade: string;
}

export default function AdminAutoAllocation() {
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { setLoading: setShowLoading } = useLoading();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Turmas
                const q = query(collection(db, 'turmas'), where('ativo', '!=', false));
                const snap = await getDocs(q);
                const turmasList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Turma));
                setTurmas(turmasList);

                // 2. Fetch Settings
                const settingsRef = doc(db, 'system_settings', 'auto_allocation');
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
            await setDoc(doc(db, 'system_settings', 'auto_allocation'), {
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

    const handleMappingChange = (key: string, turmaId: string) => {
        setMappings(prev => ({ ...prev, [key]: turmaId }));
    };

    const handleAutoDistribute = async (modality: 'natacao' | 'hidro' | 'futebol') => {
        const normalizedBase = modality === 'natacao' ? 'natacao' : modality === 'hidro' ? 'hidro' : 'futebol';
        // For query, we need to match how it's stored in db. Usually lowercase.

        setShowLoading(true, `Buscando alunos de ${modality}...`, 0);

        try {
            // 1. Fetch all registrations for this modality
            const q = query(collection(db, 'arena_simonesia_2026_registrations'), where('modalidade', '==', normalizedBase));
            const snap = await getDocs(q);
            const totalDocs = snap.size;

            if (totalDocs === 0) {
                setShowLoading(false);
                showAlert(`Nenhum aluno encontrado para ${modality}.`, 'info');
                return;
            }

            let processed = 0;
            let updatedCount = 0;

            // Process in chunks to update UI
            const docs = snap.docs;

            for (const docSnap of docs) {
                const data = docSnap.data();
                const alunos = Array.isArray(data.alunos) ? data.alunos : [];
                if (alunos.length === 0) {
                    processed++;
                    continue;
                }
                let hasChanges = false;
                const newAlunos = [...alunos];

                // Logic based on modality
                if (modality === 'futebol') {
                    newAlunos.forEach((aluno: any, index: number) => {
                        if (aluno.dataNascimento) {
                            const year = new Date(aluno.dataNascimento.split('/').reverse().join('-')).getFullYear();
                            if (!isNaN(year)) {
                                const age = 2026 - year; // Helper logic matches PublicForm
                                const key = `futebol_age_${age}`;
                                const targetTurmaId = mappings[key];

                                if (targetTurmaId && targetTurmaId !== aluno.turmaId) {
                                    newAlunos[index] = { ...aluno, turmaId: targetTurmaId };
                                    hasChanges = true;
                                }
                            }
                        }
                    });
                } else {
                    // Natacao / Hidro - based on Schedule (Dias/Horario)
                    // Data stored in root: dias: string[], horario: string
                    if (data.dias && data.horario) {
                        try {
                            const diasStr = Array.isArray(data.dias) ? data.dias.join('_') : data.dias;
                            const key = `${modality}_${diasStr}_${data.horario}`;
                            const targetTurmaId = mappings[key];

                            if (targetTurmaId) {
                                newAlunos.forEach((aluno: any, index: number) => {
                                    if (aluno.turmaId !== targetTurmaId) {
                                        newAlunos[index] = { ...aluno, turmaId: targetTurmaId };
                                        hasChanges = true;
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn("Error processing schedule key for doc", docSnap.id, e);
                        }
                    }
                }

                if (hasChanges) {
                    await updateDoc(doc(db, 'arena_simonesia_2026_registrations', docSnap.id), {
                        alunos: newAlunos
                    });
                    updatedCount++;
                }

                processed++;
                const progress = (processed / totalDocs) * 100;
                setShowLoading(true, `Processando ${processed}/${totalDocs} alunos...`, progress);
            }

            setShowLoading(false);
            showAlert(`Processo concluído! ${updatedCount} cadastros atualizados.`, 'success');

        } catch (error) {
            console.error("Error auto-distributing:", error);
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

    const renderModalitySection = (modKey: 'natacao' | 'hidro', label: string) => {
        const options = SCHEDULE_OPTIONS[modKey];
        const normalized = normalizeModality(modKey === 'natacao' ? 'Natação' : 'Hidroginástica');
        const relevantTurmas = turmas.filter(t => normalizeModality(t.modalidade) === normalized);

        return (
            <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#007d2f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderBottom: '2px solid #f5f5f5', paddingBottom: '10px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{label}</div>
                    <button
                        onClick={() => handleAutoDistribute(modKey)}
                        style={{
                            fontSize: '0.85rem', padding: '8px 16px', borderRadius: '6px', border: '1px solid #007d2f',
                            background: '#fff', color: '#007d2f', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} /> Auto-Distribuir
                    </button>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {options.map((opt: { days: string[]; times: string[] }) => {
                        const daysStr = opt.days.join(', ');
                        return opt.times.map((time: string) => {
                            const key = `${modKey}_${opt.days.join('_')}_${time}`;
                            const currentTurmaId = mappings[key] || '';

                            return (
                                <div key={key} style={{
                                    background: '#fff',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    border: '1px solid #eee',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '15px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>{daysStr}</div>
                                        <div style={{ color: '#666', fontSize: '0.9rem' }}>Horário: <strong>{time}</strong></div>
                                    </div>

                                    <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ color: '#888', flexShrink: 0 }}><RefreshCw size={16} /></div>
                                        <select
                                            value={currentTurmaId}
                                            onChange={(e) => handleMappingChange(key, e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid #ddd',
                                                background: currentTurmaId ? '#f0fff4' : '#fff',
                                                borderColor: currentTurmaId ? '#4caf50' : '#ddd',
                                                fontWeight: currentTurmaId ? 'bold' : 'normal',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="">-- Selecione uma turma --</option>
                                            {relevantTurmas.map(t => (
                                                <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {currentTurmaId && (
                                        <div style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <CheckCircle2 size={18} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>MAPREADO</span>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })}
                </div>
            </div>
        );
    };

    const renderSoccerSection = () => {
        const normalized = normalizeModality('futebol');
        const relevantTurmas = turmas.filter(t => normalizeModality(t.modalidade) === normalized);

        return (
            <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#007d2f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderBottom: '2px solid #f5f5f5', paddingBottom: '10px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><User size={20} /> Futebol (Por Idade)</div>
                    <button
                        onClick={() => handleAutoDistribute('futebol')}
                        style={{
                            fontSize: '0.85rem', padding: '8px 16px', borderRadius: '6px', border: '1px solid #007d2f',
                            background: '#fff', color: '#007d2f', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} /> Auto-Distribuir
                    </button>
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                    {AGES_TO_MAP.map(age => {
                        const key = `futebol_age_${age}`;
                        const currentTurmaId = mappings[key] || '';

                        return (
                            <div key={key} style={{
                                background: '#fff',
                                borderRadius: '12px',
                                padding: '15px',
                                border: '1px solid #eee',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                opacity: currentTurmaId ? 1 : 0.8
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>{age} Anos</div>
                                    {currentTurmaId && (
                                        <div style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <CheckCircle2 size={16} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>MAPREADO</span>
                                        </div>
                                    )}
                                </div>

                                <select
                                    value={currentTurmaId}
                                    onChange={(e) => handleMappingChange(key, e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        background: currentTurmaId ? '#f0fff4' : '#fff',
                                        borderColor: currentTurmaId ? '#4caf50' : '#ddd',
                                        fontWeight: currentTurmaId ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <option value="">-- Selecione uma turma --</option>
                                    {relevantTurmas.map(t => (
                                        <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    void renderModalitySection;

    return (
        <PageContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#f5f5f5', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#555' }}
                >
                    <ArrowLeft size={18} /> Voltar
                </button>
                <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#007d2f', fontWeight: '900' }}>ALOCAÇÃO AUTOMÁTICA</h1>
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

            <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '12px', padding: '20px', marginBottom: '30px', display: 'flex', gap: '15px', color: '#856404' }}>
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.9rem' }}>
                    <strong>Instruções:</strong> Configure abaixo em qual turma real o aluno deve ser matriculado automaticamente ao escolher um horário no formulário público. Se um horário não tiver uma turma configurada, o sistema tentará encontrar ou criar uma automaticamente com as configurações padrão.
                </div>
            </div>

            {renderSoccerSection()}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </PageContainer>
    );
}
