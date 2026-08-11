import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { AlertCircle, CheckCircle, ChevronRight, LogOut, FileText } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { fetchResponsavelRegistrations, getSessionStudentEmail } from '../utils/responsavelIdentity';
import ContractEditor from '../components/contracts/ContractEditor';
import SignatureCanvas from '../components/SignatureCanvas';
import { signOut } from 'firebase/auth';

export default function MandatoryContractPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showFullContract, setShowFullContract] = useState(false);
    const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [estatutoLido, setEstatutoLido] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user || !user.email) {
                // Not logged in
                setLoading(false);
                navigate('/aluno/login');
                return;
            }

            try {
                const normalizedEmail = getSessionStudentEmail(user.email);
                const allDocs = await fetchResponsavelRegistrations(normalizedEmail);

                if (allDocs.length > 0) {
                    let firstPendingReg: any = null;
                    let firstPendingIdx = -1;
                    let firstRegId = "";
                    let totalPending = 0;

                    // Search for the first registration that has pending signatures
                    for (const d of allDocs) {
                        const data = d.data();
                        // Only count if contract is marked as generated (default to true for legacy)
                        const isGenerated = data.contractGenerated !== false;
                        if (!isGenerated) continue;

                        const pendingIndices = (data.alunos || [])
                            .map((a: any, i: number) => !a.signatureData ? i : -1)
                            .filter((i: number) => i !== -1);

                        totalPending += pendingIndices.length;

                        if (firstPendingIdx === -1 && pendingIndices.length > 0) {
                            firstPendingReg = data;
                            firstPendingIdx = pendingIndices[0];
                            firstRegId = d.id;
                        }
                    }

                    if (!firstPendingReg) {
                        // All students in all registrations are signed
                        navigate('/aluno/dashboard');
                    } else {
                        setRegistrationId(firstRegId);
                        setStudentData(firstPendingReg);
                        setCurrentIndex(firstPendingIdx);
                    }
                } else {
                    navigate('/aluno/login');
                }
            } catch (error) {
                console.error("Error checking contract:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('rae_student_auth');
        navigate('/aluno/login');
    };

    // ... rest of the logic

    const handleSaveSignature = async (signatureDataUrl: string) => {
        if (!registrationId || !studentData) return;
        if (!estatutoLido) {
            alert("Antes de assinar, é necessário confirmar que leu e concorda com o Estatuto Social da Associação.");
            return;
        }
        setSaving(true);

        try {
            const updatedAlunos = [...studentData.alunos];
            updatedAlunos[currentIndex] = {
                ...updatedAlunos[currentIndex],
                signatureData: signatureDataUrl,
                signedAt: new Date().toISOString(),
                estatutoAceito: true,
                estatutoAceitoAt: new Date().toISOString()
            };

            const docRef = doc(db, 'rumo_ao_esporte_2026_registrations', registrationId);
            await updateDoc(docRef, { alunos: updatedAlunos });

            const nextPendingIndex = updatedAlunos.findIndex((a: any) => !a.signatureData);

            if (nextPendingIndex !== -1) {
                setStudentData({ ...studentData, alunos: updatedAlunos });
                setCurrentIndex(nextPendingIndex);
                setCapturedSignature(null);
                setEstatutoLido(false);
                setShowFullContract(false);
                window.scrollTo(0, 0);
                alert("Assinatura salva! Temos mais um aluno pendente. Por favor, assine agora o contrato do próximo atleta.");
            } else {
                // Check if there are OTHER registrations before leaving
                // Actually, navigating to dashboard is safe as the layout will redirect back if needed,
                // but a friendly message helps.
                alert("Todas as assinaturas desta matrícula foram concluídas!");
                navigate('/aluno/dashboard');
            }
        } catch (error) {
            console.error("Erro ao salvar assinatura:", error);
            alert("Erro ao salvar. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '15px', color: '#17428f'
            }}>
                <div className="spinner"></div>
                <div>Verificando...</div>
            </div>
        );
    }

    const currentStudentName = studentData?.alunos?.[currentIndex]?.nome || 'Aluno';

    return (
        <div style={{ background: '#f5f7fa', minHeight: '100vh' }}>
            {/* Header Alert - Drastically Compact */}
            <div style={{
                background: '#00a63a', color: '#fff', padding: '8px',
                textAlign: 'center', position: 'sticky', top: 0, zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>ASSINATURA OBRIGATÓRIA: {currentStudentName.toUpperCase()}</span>
                </div>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '10px' }}>
                {!showFullContract ? (
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <img
                            src="/rumo-ao-esporte-logo.png"
                            alt="Rumo ao Esporte"
                            style={{ width: '200px', height: 'auto', margin: '0 auto 5px', display: 'block' }}
                        />
                        {/* INTRO CARD - Much more compact */}
                        <div style={{
                            background: '#fff', borderRadius: '12px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)', padding: '20px', textAlign: 'center'
                        }}>

                            <h2 style={{ fontSize: '1.2rem', color: '#111', marginBottom: '5px' }}>Assinatura de Contrato</h2>
                            <p style={{ color: '#666', lineHeight: '1.4', fontSize: '0.9rem', marginBottom: '15px' }}>
                                Assine o contrato do aluno(a) <strong>{currentStudentName}</strong> para liberar seu acesso ao portal.
                            </p>

                            {/* Mini Preview Box */}
                            <div style={{
                                background: '#f8f9fa', padding: '12px', borderRadius: '10px',
                                border: '1px solid #edf2f7', marginBottom: '15px', textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718096', textTransform: 'uppercase' }}>Documento</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#2d3748' }}>Termo de Adesão REAL</div>
                                    </div>
                                    <button
                                        onClick={() => setShowFullContract(true)}
                                        style={{
                                            background: '#fff', border: '1px solid #cbd5e0', padding: '6px 12px',
                                            borderRadius: '6px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.8rem',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                            transition: 'all 0.2s', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        VER CONTRATO <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Estatuto Social Box */}
                            <div style={{
                                background: '#f8f9fa', padding: '12px', borderRadius: '10px',
                                border: '1px solid #edf2f7', marginBottom: '15px', textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718096', textTransform: 'uppercase' }}>Documento</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#2d3748' }}>Estatuto Social da Associação</div>
                                    </div>
                                    <a
                                        href="/estatuto-social-real.pdf"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            background: '#fff', border: '1px solid #cbd5e0', padding: '6px 12px',
                                            borderRadius: '6px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.8rem',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                            transition: 'all 0.2s', whiteSpace: 'nowrap', textDecoration: 'none'
                                        }}
                                    >
                                        <FileText size={14} /> VER ESTATUTO
                                    </a>
                                </div>
                                <label style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer',
                                    fontSize: '0.85rem', color: '#4a5568', lineHeight: '1.4'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={estatutoLido}
                                        onChange={(e) => setEstatutoLido(e.target.checked)}
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '2px',
                                            width: '18px',
                                            height: '18px',
                                            flexShrink: 0,
                                            accentColor: '#2e7d32',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    Li e concordo com o Estatuto Social da Associação Rumo ao Esporte e ao Lazer - REAL.
                                </label>
                            </div>

                            {/* Signature Section */}
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                                <h3 style={{ fontSize: '0.95rem', marginBottom: '10px', color: '#333' }}>Sua Assinatura:</h3>
                                <SignatureCanvas
                                    onConfirm={(data) => setCapturedSignature(data)}
                                    onClear={() => setCapturedSignature(null)}
                                />

                                {capturedSignature && (
                                    <div style={{ marginTop: '15px' }}>
                                        <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <CheckCircle size={14} /> Assinatura capturada!
                                        </div>
                                        {!estatutoLido && (
                                            <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: '#e65100', textAlign: 'center' }}>
                                                Marque a opção "Li e concordo com o Estatuto Social" para finalizar.
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleSaveSignature(capturedSignature)}
                                            disabled={saving || !estatutoLido}
                                            style={{
                                                background: (saving || !estatutoLido) ? '#a5c9a8' : '#2e7d32', color: '#fff', border: 'none',
                                                padding: '12px 25px', borderRadius: '50px', fontSize: '1rem',
                                                fontWeight: 'bold', cursor: (saving || !estatutoLido) ? 'not-allowed' : 'pointer', width: '100%',
                                                boxShadow: '0 4px 10px rgba(46, 125, 50, 0.2)'
                                            }}
                                        >
                                            {saving ? 'SALVANDO...' : 'CONFIRMAR E FINALIZAR'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // FULL CONTRACT VIEW
                    <div>
                        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-start' }}>
                            <button
                                onClick={() => setShowFullContract(false)}
                                style={{
                                    background: '#fff', border: '1px solid #ddd', padding: '6px 12px',
                                    borderRadius: '6px', color: '#666', fontWeight: 'bold', cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                ← Voltar para Assinar
                            </button>
                        </div>
                        <div style={{
                            background: '#fff', borderRadius: '12px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden'
                        }}>
                            <ContractEditor
                                mode="student"
                                registrationId={registrationId || undefined}
                                studentIndex={currentIndex}
                                hideToolbar={true}
                                title={`Visualização: ${currentStudentName}`}
                            />
                        </div>
                        <div style={{ marginTop: '10px', textAlign: 'center' }}>
                            <button
                                onClick={() => { setShowFullContract(false); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100); }}
                                style={{
                                    background: '#17428f', color: '#fff', border: 'none', padding: '10px 20px',
                                    borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem'
                                }}
                            >
                                JÁ LI, QUERO ASSINAR
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Compact Logout Button */}
            <div style={{ textAlign: 'center', padding: '10px 0 30px' }}>
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem',
                        fontWeight: '600', opacity: 0.7
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                    <LogOut size={14} /> ENCERRAR SESSÃO / SAIR
                </button>
            </div>
        </div>
    );
}
