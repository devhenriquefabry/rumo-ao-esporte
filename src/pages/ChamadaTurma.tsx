import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { FAIXAS_ETARIAS, normalizeModality, calculateClass } from '../utils/turmasConstants';
import { CheckCircle, Users, Calendar, Save, AlertCircle, Lock } from 'lucide-react';

interface Student {
    id: string;
    nome: string;
    dataNascimento: string;
    fotoUrl?: string; // Optional photo for confirmation
}

export default function ChamadaTurma() {
    const { modalidadeId, turmaId, id } = useParams();
    const { showAlert } = useDialog();
    // Wait, the route plan was /chamada/:modalidade/:turmaId
    // where turmaId matches FAIXAS_ETARIAS ids.

    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [presentes, setPresentes] = useState<Set<string>>(new Set());
    const [info, setInfo] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Precisa de login (professor/funcionário): a chamada lê o cadastro
    // completo dos alunos da turma, então essa tela não pode mais ser aberta
    // só com o link, sem senha nenhuma.
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [signedIn, setSignedIn] = useState(false);

    // To handle "editing" or "already done today", we check existing call
    const queryParams = new URLSearchParams(window.location.search);
    const dateParam = queryParams.get('date');
    const today = dateParam || new Date().toLocaleDateString('en-CA');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setSignedIn(Boolean(user));
            setCheckingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (checkingAuth || !signedIn) return;
        if (id) {
            // New explicit system
            fetchExplicitTurma(id);
        } else if (modalidadeId && turmaId) {
            // Old automatic system
            const turmaInfo = FAIXAS_ETARIAS.find(f => f.id === turmaId);
            if (turmaInfo) {
                setInfo({ modalidade: modalidadeId, faixa: turmaInfo });
                fetchStudentsAndCall(modalidadeId, turmaInfo);
            } else {
                setLoading(false);
            }
        }
    }, [modalidadeId, turmaId, id, checkingAuth, signedIn]);

    const fetchExplicitTurma = async (explicitId: string) => {
        try {
            setLoading(true);
            const tDoc = await getDoc(doc(db, 'turmas', explicitId));
            if (!tDoc.exists()) {
                setLoading(false);
                return;
            }
            const tData = tDoc.data();
            setInfo({
                isExplicit: true,
                id: explicitId,
                nome: tData.nome,
                horario: tData.horario,
                modalidade: tData.modalidade
            });

            // Fetch students matching this exact turmaId
            const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const snapshot = await getDocs(q);
            const list: Student[] = [];

            snapshot.docs.forEach(dSnap => {
                const data = dSnap.data();
                const alunos = data.alunos && Array.isArray(data.alunos) ? data.alunos : [];
                alunos.forEach((aluno: any, idx: number) => {
                    if (aluno.turmaId === explicitId) {
                        list.push({
                            id: `${dSnap.id}-${idx}`,
                            nome: aluno.nome,
                            dataNascimento: aluno.dataNascimento,
                            fotoUrl: aluno.fotoUrl
                        });
                    }
                });
            });
            setStudents(list.sort((a, b) => a.nome.localeCompare(b.nome)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentsAndCall = async (modalidade: string, faixa: any) => {
        try {
            // 1. Fetch Students
            const q = query(collection(db, 'rumo_ao_esporte_2026_registrations'));
            const snapshot = await getDocs(q);

            const flattenedStudents: Student[] = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const alunosList = data.alunos && Array.isArray(data.alunos) ? data.alunos : [];

                // Get modality from root or assume it applies to all
                // data.modalidade is usually the main one. data.modalidades (plural) might exist.
                // Adapting logic to match PublicForm structure where modalidade is root property
                const regModalidade = data.modalidade || '';
                const normalizedReg = normalizeModality(regModalidade);

                // Compare with requested modalidadeId (which is the ID e.g. 'futebol')
                // We need to match ID to Label or vice versa.
                // Assuming modalidadeId from URL is 'futebol', and normalizedReg is 'Futebol'

                // Let's find the ID for the normalizedReg
                // Or simplified: normalize the URL param too if it was label, but it is ID.
                // Best way: Check if normalizedReg corresponds to the modalidadeId
                // Our MODALIDADES array maps id <-> label.

                // Quick fix: user normalized string comparison if possible, or simple includes.
                // Actually normalizeModality returns 'Futebol' (Label).
                // modalidadeId is 'futebol' (ID).

                const isMatch = normalizedReg.toLowerCase() === modalidade.toLowerCase() ||
                    normalizedReg.toLowerCase().includes(modalidade.toLowerCase());

                if (!isMatch) return;

                alunosList.forEach((aluno: any, index: number) => {
                    // Check Age Range using shared logic
                    if (!aluno.dataNascimento) return;

                    const classInfo = calculateClass(normalizedReg, aluno.dataNascimento);
                    const turmaCalculadaLabel = classInfo.label;

                    // Compare labels. 
                    // faixa.label is what we are looking for (e.g. "Sub-09 (Pré-Mirim)")
                    if (turmaCalculadaLabel === faixa.label) {
                        flattenedStudents.push({
                            id: `${doc.id}-${index}`, // Composite ID for uniqueness
                            nome: aluno.nome,
                            dataNascimento: aluno.dataNascimento,
                            fotoUrl: aluno.fotoUrl
                        });
                    }
                });
            }); // Closing brace for snapshot.docs.forEach

            setStudents(flattenedStudents.sort((a, b) => a.nome.localeCompare(b.nome)));

            // 2. Check Existing Call for Today
            // ID Construct: chamada_MOD_FAIXA_DATE
            const callDocId = `chamada_${modalidade}_${faixa.id}_${today}`;
            const callSnap = await getDoc(doc(db, 'rumo_ao_esporte_2026_chamadas', callDocId));

            if (callSnap.exists()) {
                const data = callSnap.data();
                setPresentes(new Set(data.presentes || []));
            }

        } catch (error) {
            console.error("Erro ao buscar dados", error);
        } finally {
            setLoading(false);
        }
    };



    const togglePresence = (id: string) => {
        const newSet = new Set(presentes);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setPresentes(newSet);
        setSaved(false); // Changes made
    };

    const handleSave = async () => {
        if (!info) return;
        setSaving(true);
        try {
            const callDocId = info.isExplicit
                ? `chamada_explicit_${info.id}_${today}`
                : `chamada_${info.modalidade}_${info.faixa.id}_${today}`;

            await setDoc(doc(db, 'rumo_ao_esporte_2026_chamadas', callDocId), {
                modalidade: info.modalidade,
                turmaId: info.isExplicit ? info.id : info.faixa.id,
                turmaLabel: info.isExplicit ? info.nome : info.faixa.label,
                isExplicit: !!info.isExplicit,
                data: today,
                dataIso: new Date(),
                presentes: Array.from(presentes),
                totalPresentes: presentes.size,
                totalAlunos: students.length
            });

            setSaved(true);
            showAlert("Chamada salva com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao salvar", error);
            showAlert("Erro ao salvar a chamada.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (checkingAuth) return <div style={{ padding: '20px', textAlign: 'center' }}>Verificando acesso...</div>;

    if (!signedIn) return (
        <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
            <Lock size={40} color="#17428f" style={{ marginBottom: '16px' }} />
            <h3 style={{ color: '#10213f', marginBottom: '8px' }}>Faça login para bater a chamada</h3>
            <p style={{ color: '#63708a', marginBottom: '20px' }}>
                Esta tela mostra dados dos alunos da turma, então agora só abre para professores e
                funcionários com login. Entre e volte a este mesmo link.
            </p>
            <a
                href="/admin/login"
                style={{
                    display: 'inline-block', padding: '12px 24px', background: '#17428f',
                    color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold'
                }}
            >
                Fazer login
            </a>
        </div>
    );

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando turma...</div>;
    if (!info) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>Turma não encontrada. Verifique o link.</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f5f7fa', minHeight: '100vh', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ background: '#00a63a', color: '#fff', padding: '20px', borderRadius: '0 0 20px 20px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <h2 style={{ margin: 0, textTransform: 'capitalize' }}>
                    {info.isExplicit ? info.nome : info.modalidade}
                </h2>
                <h4 style={{ margin: '5px 0 0', opacity: 0.9, fontWeight: 'normal' }}>
                    {info.isExplicit ? info.horario : info.faixa.label}
                </h4>
                <div style={{ marginTop: '15px', display: 'flex', gap: '15px', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={16} /> {new Date().toLocaleDateString('pt-BR')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={16} /> {students.length} Alunos</div>
                </div>
            </div>

            {/* List */}
            <div style={{ padding: '20px' }}>
                <h3 style={{ marginLeft: '5px', marginBottom: '15px', color: '#333', fontSize: '1.1rem' }}>Lista de Presença</h3>

                {students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        <AlertCircle size={40} style={{ marginBottom: '10px' }} />
                        <p>Nenhum aluno encontrado para os critérios desta turma.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {students.map(student => {
                            const isPresent = presentes.has(student.id);
                            return (
                                <div
                                    key={student.id}
                                    onClick={() => togglePresence(student.id)}
                                    style={{
                                        background: '#fff',
                                        padding: '15px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        border: isPresent ? '2px solid #2e7d32' : '2px solid transparent',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        {student.fotoUrl ? (
                                            <img src={student.fotoUrl} loading="lazy" alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#777' }}>
                                                {student.nome.charAt(0)}
                                            </div>
                                        )}
                                        <span style={{ fontWeight: '500', color: '#333' }}>{student.nome}</span>
                                    </div>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: isPresent ? 'none' : '2px solid #ddd',
                                        background: isPresent ? '#2e7d32' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff'
                                    }}>
                                        {isPresent && <CheckCircle size={16} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Action */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px 20px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <strong>{presentes.size}</strong> Presentes
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: saved ? '#2e7d32' : '#00a63a',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 25px',
                        borderRadius: '30px',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: saving ? 'wait' : 'pointer',
                        transition: 'background 0.3s'
                    }}
                >
                    <Save size={18} /> {saving ? 'Salvando...' : (saved ? 'Salvo' : 'Finalizar Chamada')}
                </button>
            </div>
        </div>
    );
}
