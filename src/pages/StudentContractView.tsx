import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import { fetchResponsavelRegistrations, getSessionStudentEmail } from '../utils/responsavelIdentity';
import ContractEditor from '../components/contracts/ContractEditor';

export default function StudentContractView() {
    const { id, studentIndex } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [studentName, setStudentName] = useState('');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user || !user.email) {
                navigate('/aluno/login');
                return;
            }

            try {
                const normalizedEmail = getSessionStudentEmail(user.email);
                const allDocs = await fetchResponsavelRegistrations(normalizedEmail);
                const targetDoc = allDocs.find(d => d.id === id);
                const data = targetDoc?.data();
                const idx = studentIndex ? parseInt(studentIndex) : 0;
                const student = data?.alunos?.[idx];

                if (student) {
                    setAuthorized(true);
                    setStudentName(student.nome || '');
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                console.error('Erro ao verificar contrato:', error);
                setAuthorized(false);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [id, studentIndex, navigate]);

    if (loading) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '15px', color: '#17428f'
            }}>
                <div className="spinner"></div>
                <div>Carregando contrato...</div>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '15px', padding: '20px', textAlign: 'center'
            }}>
                <AlertCircle size={40} color="#e65100" />
                <h3 style={{ color: '#333', margin: 0 }}>Contrato não encontrado</h3>
                <p style={{ color: '#666', maxWidth: '400px' }}>
                    Não foi possível localizar este contrato ou ele não pertence à sua conta.
                </p>
                <button
                    onClick={() => navigate('/aluno/dashboard')}
                    style={{
                        background: '#17428f', color: '#fff', border: 'none', padding: '10px 20px',
                        borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem'
                    }}
                >
                    Voltar ao Painel
                </button>
            </div>
        );
    }

    return (
        <div style={{ background: '#f5f7fa', minHeight: '100vh' }}>
            <div style={{
                background: '#17428f', color: '#fff', padding: '12px 20px',
                position: 'sticky', top: 0, zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                maxWidth: '210mm', margin: '0 auto'
            }}>
                <button
                    onClick={() => navigate('/aluno/dashboard')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none',
                        color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
                    }}
                >
                    <ArrowLeft size={18} /> Voltar
                </button>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                    Contrato Assinado: {studentName}
                </span>
                <button
                    onClick={() => window.print()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', background: '#00a63a', border: 'none',
                        color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
                        padding: '8px 14px', borderRadius: '6px'
                    }}
                >
                    <Printer size={16} /> Imprimir
                </button>
            </div>

            <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '10px 0' }}>
                <ContractEditor
                    mode="student"
                    registrationId={id}
                    studentIndex={studentIndex ? parseInt(studentIndex) : 0}
                    hideToolbar={true}
                />
            </div>
        </div>
    );
}
