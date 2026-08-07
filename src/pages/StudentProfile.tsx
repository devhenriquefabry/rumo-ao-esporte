import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { fetchResponsavelRegistrations, getSessionStudentEmail } from '../utils/responsavelIdentity';
import { useDialog } from '../context/CustomDialogContext';
import {
    User, Mail, Phone, MapPin,
    Users, Edit2, Save, X, Loader
} from 'lucide-react';
import PageContainer from '../components/PageContainer';

const workerUrl = import.meta.env.VITE_WORKER_URL;

const SYNTHETIC_EMAIL_DOMAIN = '@responsaveis.rumoaoesporte.local';

// Masks (mesmo padrão do formulário de cadastro)
const maskPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
const maskCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
const maskDate = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 10);

interface Endereco {
    rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string;
}
interface ResponsavelForm {
    dataNascimento: string;
    telefonePrincipal: string;
    endereco: Endereco;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #cfe3ff',
    color: '#333',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box'
};

// Componentes definidos no nível do módulo (fora do render) para não remontar
// os inputs a cada tecla — o que causaria perda de foco durante a digitação.
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

const EditField = ({ label, value, onChange, icon: Icon, placeholder, maxLength }: {
    label: string, value: string, onChange: (v: string) => void, icon?: any, placeholder?: string, maxLength?: number
}) => (
    <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>
            {Icon && <Icon size={14} />}
            {label}
        </label>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            style={inputStyle}
        />
    </div>
);

// Campo travado (identidade/login) — sempre somente leitura, com dica visual
const LockedField = ({ label, value, icon: Icon, note }: { label: string, value: string, icon?: any, note?: string }) => (
    <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>
            {Icon && <Icon size={14} />}
            {label}
        </label>
        <div style={{
            padding: '10px 12px',
            background: '#f3f4f6',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            color: '#777',
            fontSize: '0.95rem'
        }}>
            {value || '-'}
        </div>
        {note && <span style={{ display: 'block', marginTop: '4px', fontSize: '0.72rem', color: '#aaa' }}>{note}</span>}
    </div>
);

export default function StudentProfile() {
    const { showAlert } = useDialog();
    const [loading, setLoading] = useState(true);

    // Data states
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<ResponsavelForm>({
        dataNascimento: '', telefonePrincipal: '', endereco: {}
    });

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            const sessionEmail = getSessionStudentEmail(user?.email);
            if (sessionEmail) {
                fetchData(sessionEmail);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async (email: string) => {
        try {
            const registrationDocs = await fetchResponsavelRegistrations(email);
            const docs = registrationDocs.map(d => ({ id: d.id, ...d.data() } as any));
            setRegistrations(docs);

            // TRIGGER SYNC (Parallel) - Update registration status if paid
            docs.forEach((reg: any) => {
                if (reg.status !== 'confirmado' && reg.responsavel?.cpf) {
                    fetch(`${workerUrl}/sync-student-payments?registrationId=${reg.id}&cpf=${reg.responsavel.cpf.replace(/\D/g, '')}`)
                        .then(r => r.json())
                        .then(res => {
                            if (res.updated) {
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

    const startEditing = () => {
        const r = registrations[0]?.responsavel || {};
        setForm({
            dataNascimento: r.dataNascimento || '',
            telefonePrincipal: r.telefonePrincipal || '',
            endereco: {
                rua: r.endereco?.rua || '',
                numero: r.endereco?.numero || '',
                bairro: r.endereco?.bairro || '',
                cidade: r.endereco?.cidade || '',
                uf: r.endereco?.uf || '',
                cep: r.endereco?.cep || ''
            }
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
    };

    const setEnderecoField = (field: keyof Endereco, value: string) => {
        setForm(prev => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }));
    };

    const handleCepChange = async (value: string) => {
        const masked = maskCEP(value);
        setEnderecoField('cep', masked);
        const digits = value.replace(/\D/g, '');
        if (digits.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                const result = await response.json();
                if (!result.erro) {
                    setForm(prev => ({
                        ...prev,
                        endereco: {
                            ...prev.endereco,
                            cep: masked,
                            rua: result.logradouro || prev.endereco.rua,
                            bairro: result.bairro || prev.endereco.bairro,
                            cidade: result.localidade || prev.endereco.cidade,
                            uf: result.uf || prev.endereco.uf
                        }
                    }));
                }
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
            }
        }
    };

    const handleSave = async () => {
        if (registrations.length === 0) return;
        setSaving(true);
        try {
            // Atualiza os dados do responsável em TODOS os cadastros da família,
            // preservando os campos de identidade/login (nome, nomeBusca, cpf, email).
            await Promise.all(registrations.map(reg => {
                const merged = {
                    ...reg.responsavel,
                    dataNascimento: form.dataNascimento,
                    telefonePrincipal: form.telefonePrincipal,
                    endereco: {
                        ...(reg.responsavel?.endereco || {}),
                        ...form.endereco
                    }
                };
                return updateDoc(doc(db, 'rumo_ao_esporte_2026_registrations', reg.id), { responsavel: merged });
            }));

            // Atualiza estado local
            setRegistrations(prev => prev.map(reg => ({
                ...reg,
                responsavel: {
                    ...reg.responsavel,
                    dataNascimento: form.dataNascimento,
                    telefonePrincipal: form.telefonePrincipal,
                    endereco: { ...(reg.responsavel?.endereco || {}), ...form.endereco }
                }
            })));

            setIsEditing(false);
            showAlert('Dados atualizados com sucesso!', 'success');
        } catch (error: any) {
            console.error('Erro ao salvar dados:', error);
            showAlert('Erro ao salvar seus dados: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-container">Carregando seus dados...</div>;

    const firstReg = registrations[0];
    if (!firstReg) return <PageContainer><div className="error-container">Nenhum cadastro encontrado.</div></PageContainer>;

    const respEmail = firstReg.responsavel?.email || '';
    const emailIsSynthetic = respEmail.includes(SYNTHETIC_EMAIL_DOMAIN);

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
                        {isEditing ? 'Complete ou atualize seus dados' : 'Visualize e complete seus dados cadastrais'}
                    </p>
                </div>

                {!isEditing ? (
                    <button
                        onClick={startEditing}
                        className="touch-feedback"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '9px 16px', background: '#17428f', color: '#fff',
                            border: 'none', borderRadius: '8px', fontWeight: 'bold',
                            fontSize: '0.85rem', cursor: 'pointer'
                        }}
                    >
                        <Edit2 size={16} /> Editar
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={cancelEditing}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '9px 14px', background: '#fff', color: '#666',
                                border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold',
                                fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <X size={16} /> Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '9px 16px', background: saving ? '#9ca3af' : '#00a63a', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold',
                                fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '100px' }}>

                {/* SECTION: RESPONSÁVEL */}
                <div className="native-card animate-scale-in" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '15px 20px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={20} color="#00a63a" />
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>Dados do Responsável</h3>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <LockedField label="Nome Completo" value={firstReg.responsavel.nome} note={isEditing ? 'Usado para o seu login. Para alterar, fale com a secretaria.' : undefined} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <LockedField label="CPF" value={firstReg.responsavel.cpf} note={isEditing ? 'Sua senha padrão. Para alterar, fale com a secretaria.' : undefined} />
                            {isEditing ? (
                                <EditField label="Data de Nascimento" value={form.dataNascimento} placeholder="DD/MM/AAAA" onChange={(v) => setForm(prev => ({ ...prev, dataNascimento: maskDate(v) }))} />
                            ) : (
                                <DisplayField label="Data de Nascimento" value={firstReg.responsavel.dataNascimento} />
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {isEditing ? (
                                <EditField label="Telefone" icon={Phone} value={form.telefonePrincipal} placeholder="(00) 00000-0000" onChange={(v) => setForm(prev => ({ ...prev, telefonePrincipal: maskPhone(v) }))} />
                            ) : (
                                <DisplayField label="Telefone" icon={Phone} value={firstReg.responsavel.telefonePrincipal} />
                            )}
                            <LockedField label="E-mail" icon={Mail} value={emailIsSynthetic ? '' : respEmail} />
                        </div>

                        <hr style={{ margin: '10px 0 20px 0', border: 0, borderTop: '1px solid #eee' }} />

                        <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={16} /> Endereço Residencial
                        </h4>

                        {isEditing ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                                    <EditField label="CEP" value={form.endereco.cep || ''} placeholder="00000-000" onChange={handleCepChange} maxLength={9} />
                                    <EditField label="Logradouro (Rua/Avenida)" value={form.endereco.rua || ''} onChange={(v) => setEnderecoField('rua', v)} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                                    <EditField label="Número" value={form.endereco.numero || ''} onChange={(v) => setEnderecoField('numero', v)} />
                                    <EditField label="Bairro" value={form.endereco.bairro || ''} onChange={(v) => setEnderecoField('bairro', v)} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
                                    <EditField label="Cidade" value={form.endereco.cidade || ''} onChange={(v) => setEnderecoField('cidade', v)} />
                                    <EditField label="UF" value={form.endereco.uf || ''} maxLength={2} onChange={(v) => setEnderecoField('uf', v.toUpperCase())} />
                                    <div />
                                </div>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
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
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }

                @media (max-width: 600px) {
                    .student-edit-grid { grid-template-columns: 1fr !important; }
                    .student-edit-grid > div:first-child { margin: 0 auto; }
                }
            `}</style>
        </PageContainer>
    );
}
