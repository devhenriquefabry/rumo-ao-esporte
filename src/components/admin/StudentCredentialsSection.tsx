import { useState } from 'react';
import { Eye, EyeOff, Copy, Key, Edit2, X, Check, Loader, MessageCircle, Users } from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';

interface StudentCredentialsSectionProps {
    data: any;
    setData: (data: any) => void;
}

export default function StudentCredentialsSection({
    data,
    setData
}: StudentCredentialsSectionProps) {
    const { showAlert } = useDialog();
    const [isVisible, setIsVisible] = useState(false);
    const [editingEmail, setEditingEmail] = useState(false);
    const [editingPassword, setEditingPassword] = useState(false);
    const [emailValue, setEmailValue] = useState(data.responsavel?.email || '');
    const [passwordValue, setPasswordValue] = useState(data.senha || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const handleSave = async (type: 'email' | 'password') => {
        setLoading(true);
        setError(null);

        try {
            const payload: any = { registrationId: data.id };

            if (type === 'email') {
                const normalizedEmail = emailValue.toLowerCase().trim();
                if (!normalizedEmail.includes('@')) {
                    setError('Email inválido');
                    setLoading(false);
                    return;
                }
                payload.newEmail = normalizedEmail;
                setEmailValue(normalizedEmail); // Update local state with normalized value
            } else {
                if (passwordValue.length < 6) {
                    setError('Senha deve ter no mínimo 6 caracteres');
                    setLoading(false);
                    return;
                }
                payload.newPassword = passwordValue;
            }

            const response = await fetch(`${workerUrl}/update-student-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erro ao atualizar credenciais');
            }

            // Sucesso - atualizar estado local
            if (type === 'email') {
                const newData = { ...data, responsavel: { ...data.responsavel, email: emailValue } };
                setData(newData);
                setEditingEmail(false);
                showAlert('E-mail atualizado com sucesso!', 'success');
            } else {
                const newData = { ...data, senha: passwordValue };
                setData(newData);
                setEditingPassword(false);
                showAlert('Senha atualizada com sucesso!', 'success');
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEmail = () => {
        setEmailValue(data.responsavel?.email || '');
        setEditingEmail(false);
        setError(null);
    };

    const handleCancelPassword = () => {
        setPasswordValue(data.senha || '');
        setEditingPassword(false);
        setError(null);
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showAlert(`${label} copiado!`, 'success');
        }).catch(() => {
            showAlert('Erro ao copiar.', 'error');
        });
    };

    const handleShareWhatsApp = () => {
        const phone = data.responsavel?.telefonePrincipal?.replace(/\D/g, '');
        if (!phone) {
            showAlert('Telefone do responsável não encontrado.', 'error');
            return;
        }

        const name = data.responsavel?.nome?.split(' ')[0] || 'Responsável';
        const email = data.responsavel?.email || '';
        const password = currentPassword;
        const loginUrl = `${window.location.origin}/aluno/login`;

        const text = `Olá, *${name}*! 👋\n\nAqui estão suas credenciais de acesso ao *Portal do Aluno Arena Simonésia 2026*:\n\n📧 *Login:* ${email}\n🔑 *Senha:* ${password}\n\n🌐 *Portal:* ${loginUrl}\n\n_Guarde estas informações com segurança._`;
        const encodedText = encodeURIComponent(text);

        window.open(`https://wa.me/55${phone}?text=${encodedText}`, '_blank');
    };

    const buttonStyle = {
        background: '#f0f4f8',
        border: 'none',
        borderRadius: '6px',
        padding: '5px',
        cursor: 'pointer',
        color: '#455a64',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
    };

    const confirmButtonStyle = {
        ...buttonStyle,
        background: '#e8f5e9',
        color: '#2e7d32'
    };

    const cancelButtonStyle = {
        ...buttonStyle,
        background: '#ffebee',
        color: '#007d2f'
    };

    // Default password calculation (CPF numbers)
    const defaultPassword = (data.responsavel?.cpf || '').replace(/\D/g, '');
    const currentPassword = data.senha || defaultPassword;

    return (
        <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            border: '1px solid #f0f0f0',
            marginTop: '10px'
        }}>
            <div style={{
                fontSize: '0.65rem',
                fontWeight: '900',
                color: '#999',
                textTransform: 'uppercase',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
            }}>
                <Key size={12} /> Credenciais de Acesso ao Portal
            </div>

            {error && (
                <div style={{
                    marginBottom: '15px',
                    padding: '10px 15px',
                    background: '#ffebee',
                    color: '#007d2f',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    border: '1px solid #ffcdd2'
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                {/* Email/Login */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: editingEmail ? '2px solid #007d2f' : '1px solid #eee',
                    transition: 'all 0.2s'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold' }}>LOGIN (E-MAIL)</span>
                        {editingEmail ? (
                            <input
                                type="email"
                                value={emailValue}
                                onChange={(e) => setEmailValue(e.target.value)}
                                style={{
                                    fontSize: '0.9rem',
                                    color: '#333',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    padding: '2px 0',
                                    width: '100%',
                                    fontWeight: 'bold'
                                }}
                                autoFocus
                                disabled={loading}
                            />
                        ) : (
                            <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {data.responsavel?.email}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {editingEmail ? (
                            <>
                                <button onClick={handleCancelEmail} style={cancelButtonStyle} title="Cancelar" disabled={loading}>
                                    <X size={16} />
                                </button>
                                <button onClick={() => handleSave('email')} style={confirmButtonStyle} title="Confirmar" disabled={loading}>
                                    {loading ? <Loader size={16} className="spin" /> : <Check size={16} />}
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setEditingEmail(true)} style={buttonStyle} title="Editar E-mail">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => copyToClipboard(data.responsavel?.email, 'E-mail')} style={buttonStyle} title="Copiar E-mail">
                                    <Copy size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Senha */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: editingPassword ? '2px solid #007d2f' : '1px solid #eee',
                    transition: 'all 0.2s'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold' }}>SENHA DE ACESSO</span>
                        {editingPassword ? (
                            <input
                                type="text"
                                value={passwordValue}
                                onChange={(e) => setPasswordValue(e.target.value)}
                                style={{
                                    fontSize: '0.9rem',
                                    color: '#333',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    padding: '2px 0',
                                    width: '100%'
                                }}
                                autoFocus
                                disabled={loading}
                                placeholder="Nova senha"
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '0.9rem', color: '#333', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                    {isVisible ? currentPassword : '••••••••'}
                                </span>
                                {!data.senha && <span style={{ fontSize: '0.6rem', color: '#f57c00', background: '#fff3e0', padding: '1px 5px', borderRadius: '4px' }}>PADRÃO (CPF)</span>}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {editingPassword ? (
                            <>
                                <button onClick={handleCancelPassword} style={cancelButtonStyle} title="Cancelar" disabled={loading}>
                                    <X size={16} />
                                </button>
                                <button onClick={() => handleSave('password')} style={confirmButtonStyle} title="Confirmar" disabled={loading}>
                                    {loading ? <Loader size={16} className="spin" /> : <Check size={16} />}
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setEditingPassword(true)} style={buttonStyle} title="Editar Senha">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => setIsVisible(!isVisible)} style={buttonStyle} title={isVisible ? "Ocultar Senha" : "Mostrar Senha"}>
                                    {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button onClick={() => copyToClipboard(currentPassword, 'Senha')} style={buttonStyle} title="Copiar Senha">
                                    <Copy size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <button
                onClick={handleShareWhatsApp}
                style={{
                    width: '100%',
                    marginTop: '15px',
                    padding: '12px',
                    background: '#25D366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
                onMouseOut={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
            >
                <MessageCircle size={20} />
                ENVIAR CREDENCIAIS VIA WHATSAPP
            </button>

            <button
                onClick={() => {
                    const email = data.responsavel?.email;
                    if (!email) {
                        showAlert('E-mail do responsável não cadastrado.', 'error');
                        return;
                    }
                    localStorage.setItem('uba_impersonated_student_email', email);
                    localStorage.setItem('uba_impersonated_student_back_id', data.id);
                    localStorage.setItem('uba_student_auth', 'true');
                    window.location.href = '/aluno/dashboard';
                }}
                style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '12px',
                    background: '#00237f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(0, 35, 127, 0.2)',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
                onMouseOut={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
            >
                <Users size={20} />
                ACESSAR CONTA DO ATLETA
            </button>

            <div style={{ marginTop: '15px', padding: '10px', background: '#fff9e6', borderRadius: '8px', border: '1px solid #ffeeba', display: 'flex', gap: '10px', alignItems: 'start' }}>
                <div style={{ color: '#856404', paddingTop: '2px' }}><Key size={14} /></div>
                <div style={{ fontSize: '0.75rem', color: '#856404', lineHeight: '1.4' }}>
                    <strong>Dica:</strong> Por padrão, a senha do aluno é o CPF do responsável (somente números). Se você alterar a senha aqui, ela passará a ser a senha oficial de acesso ao portal.
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}
