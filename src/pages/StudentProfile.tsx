import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDialog } from '../context/CustomDialogContext';
import {
    User, Mail, Phone, MapPin,
    Users
} from 'lucide-react';
import PageContainer from '../components/PageContainer';

const workerUrl = import.meta.env.VITE_WORKER_URL;

export default function StudentProfile() {
    const { showAlert } = useDialog();
    const [loading, setLoading] = useState(true);

    // Data states
    const [registrations, setRegistrations] = useState<any[]>([]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            const impersonatedEmail = localStorage.getItem('rae_impersonated_student_email');
            if (impersonatedEmail || user) {
                fetchData(impersonatedEmail || user!.email!);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async (email: string) => {
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const q = query(collection(db, "rumo_ao_esporte_2026_registrations"), where("responsavel.email", "==", normalizedEmail));
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setRegistrations(docs);

            // TRIGGER SYNC (Parallel) - Update registration status if paid
            docs.forEach((reg: any) => {
                if (reg.status !== 'confirmado' && reg.responsavel?.cpf) {
                    fetch(`${workerUrl}/sync-student-payments?registrationId=${reg.id}&cpf=${reg.responsavel.cpf.replace(/\D/g, '')}`)
                        .then(r => r.json())
                        .then(res => {
                            if (res.updated) {
                                // If updated, we might want to refresh the local state to show 'confirmado'
                                // but the UI here primarily shows profile data, not status badges usually.
                                // However, keeping Firestore in sync is the priority.
                                setRegistrations(prev => prev.map(p => p.id === reg.id ? { ...p, status: 'confirmado' } : p));
                            }
                        })
                        .catch(e => console.error(`[SYNC ERROR] ${reg.id}:`, e));
                }
            });
        } catch (error) {
            console.error("Error fetching registrations:", error);
            showAlert("Erro ao carregar seus dados.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-container">Carregando seus dados...</div>;

    const firstReg = registrations[0];
    if (!firstReg) return <PageContainer><div className="error-container">Nenhum cadastro encontrado.</div></PageContainer>;

    const DisplayField = ({ label, value, icon: Icon }: { label: string, value: string, icon?: any }) => (
        <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>
                {Icon && <Icon size={14} />}
                {label}
            </label>
            <div style={{
                padding: '10px 12px',
                background: '#f9f9f9',
                borderRadius: '8px',
                border: '1px solid #eee',
                color: '#333',
                fontSize: '0.95rem'
            }}>
                {value || '-'}
            </div>
        </div>
    );

    return (
        <PageContainer>
            {/* Header */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: '#fff',
                margin: '-20px -20px 20px -20px',
                padding: '15px 20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#17428f' }}>Meus Dados</h2>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                        Visualize seus dados cadastrais
                    </p>
                </div>

            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '100px' }}>

                {/* SECTION: RESPONSÁVEL */}
                <div className="native-card animate-scale-in" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '15px 20px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={20} color="#00a63a" />
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>Dados do Responsável</h3>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <DisplayField label="Nome Completo" value={firstReg.responsavel.nome} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <DisplayField label="CPF" value={firstReg.responsavel.cpf} />
                            <DisplayField label="Data de Nascimento" value={firstReg.responsavel.dataNascimento} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <DisplayField label="Telefone" icon={Phone} value={firstReg.responsavel.telefonePrincipal} />
                            <DisplayField label="E-mail" icon={Mail} value={firstReg.responsavel.email} />
                        </div>

                        <hr style={{ margin: '10px 0 20px 0', border: 0, borderTop: '1px solid #eee' }} />

                        <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={16} /> Endereço Residencial
                        </h4>

                        <DisplayField label="Logradouro (Rua/Avenida)" value={firstReg.responsavel.endereco?.rua} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                            <DisplayField label="Número" value={firstReg.responsavel.endereco?.numero} />
                            <DisplayField label="Bairro" value={firstReg.responsavel.endereco?.bairro} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
                            <DisplayField label="Cidade" value={firstReg.responsavel.endereco?.cidade} />
                            <DisplayField label="UF" value={firstReg.responsavel.endereco?.uf} />
                            <DisplayField label="CEP" value={firstReg.responsavel.endereco?.cep} />
                        </div>
                    </div>
                </div>

                {/* SECTION: DEPENDENTES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 5px' }}>
                        <Users size={20} color="#00a63a" />
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>Dependentes / Alunos</h3>
                    </div>

                    {registrations.map((reg) => (
                        reg.alunos.map((aluno: any, idx: number) => (
                            <div key={`${reg.id}-${idx}`} className="native-card animate-scale-in" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{
                                    padding: '12px 20px',
                                    background: '#f8f9fa',
                                    borderBottom: '1px solid #eee',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%', background: '#00a63a',
                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.8rem', fontWeight: 'bold'
                                        }}>
                                            {aluno.nome?.charAt(0) || 'A'}
                                        </div>
                                        <span style={{ fontWeight: 'bold', color: '#333' }}>{aluno.nome}</span>
                                    </div>
                                    <div className="native-badge" style={{ background: '#e3f2fd', color: '#1565c0', fontSize: '0.7rem' }}>
                                        {reg.modalidade?.toUpperCase()}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr',
                                    gap: '20px',
                                    padding: '20px'
                                }} className="student-edit-grid">

                                    {/* Photo Column */}
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            width: '120px',
                                            height: '150px',
                                            background: '#f0f0f0',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '1px solid #ddd'
                                        }}>
                                            {aluno.fotoUrl ? (
                                                <img src={aluno.fotoUrl} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                                    <User size={48} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Data Column */}
                                    <div>
                                        <DisplayField label="Nome do Aluno" value={aluno.nome} />

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <DisplayField label="CPF" value={aluno.cpf} />
                                            <DisplayField label="Data de Nascimento" value={aluno.dataNascimento} />
                                        </div>

                                        <DisplayField label="Sexo" value={aluno.sexo === 'M' ? 'Masculino' : 'Feminino'} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ))}
                </div>
            </div>

            <style>{`
                .loading-container { display: flex; align-items: center; justifyContent: center; height: 100vh; font-weight: bold; color: #17428f; }
                .error-container { text-align: center; padding: 50px; color: #00a63a; }
                
                @media (max-width: 600px) {
                    .student-edit-grid { grid-template-columns: 1fr !important; }
                    .student-edit-grid > div:first-child { margin: 0 auto; }
                }
            `}</style>
        </PageContainer>
    );
}
