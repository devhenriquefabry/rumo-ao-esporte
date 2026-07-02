
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { ArrowLeft, User, Calendar, Phone, Shield } from 'lucide-react';
import PageContainer from '../components/PageContainer';

export default function TeacherStudentDetails() {
    const { id, studentIndex } = useParams(); // ID is registrationId
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const sIndex = parseInt(studentIndex || '0');

    useEffect(() => {
        const fetchDoc = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'arena_simonesia_2026_registrations', id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setData(snap.data());
                } else {
                    showAlert('Cadastro não encontrado', 'error');
                    navigate(-1);
                }
            } catch (error) {
                console.error('Error fetching details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDoc();
    }, [id, navigate]);

    if (loading) return <div className="loading-container">Carregando...</div>;
    if (!data || !data.alunos || !data.alunos[sIndex]) return <div className="error-container">Aluno não encontrado.</div>;

    const aluno = data.alunos[sIndex];

    return (
        <PageContainer>
            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#555', fontWeight: 'bold' }}
                >
                    <ArrowLeft size={20} /> Voltar
                </button>
            </div>

            <div className="native-card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '30px' }}>
                {/* Photo */}
                <div style={{ width: '120px', height: '120px', margin: '0 auto 20px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #fff', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                    {aluno.fotoUrl ? (
                        <img src={aluno.fotoUrl} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={50} color="#999" />
                        </div>
                    )}
                </div>

                <h1 style={{ color: '#007d2f', margin: '0 0 10px 0', fontSize: '1.8rem', textTransform: 'uppercase' }}>{aluno.nome}</h1>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#f5f5f5', padding: '8px 15px', borderRadius: '20px' }}>
                    <Calendar size={16} color="#666" />
                    <span>{aluno.dataNascimento}</span>
                </div>

                <div style={{ marginTop: '30px', textAlign: 'left' }}>
                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#00237f', marginBottom: '20px' }}>Dados do Aluno</h3>

                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div className="info-row">
                            <strong>CPF:</strong> <span>{aluno.cpf || '-'}</span>
                        </div>
                        <div className="info-row">
                            <strong>RG:</strong> <span>{aluno.rg || '-'}</span>
                        </div>
                        <div className="info-row">
                            <strong>Nº Camisa:</strong> <span style={{ fontWeight: 'bold', color: '#007d2f' }}>{aluno.camisa || '-'}</span>
                        </div>
                        {aluno.medicamentos && (
                            <div className="info-row warning-box">
                                <strong>Medicamentos:</strong> <span>{aluno.medicamentos}</span>
                            </div>
                        )}
                        {aluno.alergias && (
                            <div className="info-row warning-box">
                                <strong>Alergias:</strong> <span>{aluno.alergias}</span>
                            </div>
                        )}
                    </div>

                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#00237f', margin: '30px 0 20px' }}>Responsáveis</h3>
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div className="info-row">
                            <Shield size={16} /> <strong>{data.responsavel.nome}</strong> (Financeiro)
                        </div>
                        <div className="info-row">
                            <Phone size={16} /> <span>{data.responsavel.telefonePrincipal}</span>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .info-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: #fcfcfc;
                    border-radius: 8px;
                    border: 1px solid #f0f0f0;
                }
                .warning-box {
                    background: #fff3e0;
                    border-color: #ffe0b2;
                    color: #e65100;
                }
            `}</style>
        </PageContainer>
    );
}
