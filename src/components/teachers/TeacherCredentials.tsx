import { useState } from 'react';
import { Eye, EyeOff, Copy, Key, Edit2, X, Check, Loader } from 'lucide-react';

interface TeacherCredentialsProps {
    teacher: {
        id: string;
        email: string;
        senha?: string;
    };
    isVisible: boolean;
    onToggleVisibility: () => void;
    onCopy: (text: string, label: string) => void;
    onCredentialsUpdated?: (newEmail?: string, newPassword?: string) => void;
}

export default function TeacherCredentials({
    teacher,
    isVisible,
    onToggleVisibility,
    onCopy,
    onCredentialsUpdated
}: TeacherCredentialsProps) {
    const [editingEmail, setEditingEmail] = useState(false);
    const [editingPassword, setEditingPassword] = useState(false);
    const [emailValue, setEmailValue] = useState(teacher.email);
    const [passwordValue, setPasswordValue] = useState(teacher.senha || 'rumo2026');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const workerUrl = import.meta.env.VITE_WORKER_URL;

    const handleSave = async (type: 'email' | 'password') => {
        setLoading(true);
        setError(null);

        try {
            const payload: any = { teacherId: teacher.id };

            if (type === 'email') {
                if (!emailValue.includes('@')) {
                    setError('Email inválido');
                    setLoading(false);
                    return;
                }
                payload.newEmail = emailValue;
                payload.oldEmail = teacher.email;
            } else {
                if (passwordValue.length < 6) {
                    setError('Senha deve ter no mínimo 6 caracteres');
                    setLoading(false);
                    return;
                }
                payload.newPassword = passwordValue;
            }

            const response = await fetch(`${workerUrl}/update-teacher-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erro ao atualizar credenciais');
            }

            // Sucesso - fechar edição
            if (type === 'email') {
                setEditingEmail(false);
                onCredentialsUpdated?.(emailValue, undefined);
            } else {
                setEditingPassword(false);
                onCredentialsUpdated?.(undefined, passwordValue);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEmail = () => {
        setEmailValue(teacher.email);
        setEditingEmail(false);
        setError(null);
    };

    const handleCancelPassword = () => {
        setPasswordValue(teacher.senha || 'rumo2026');
        setEditingPassword(false);
        setError(null);
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
        color: '#00a63a'
    };

    return (
        <div style={{ marginTop: '8px', padding: '10px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #eee' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Key size={12} /> Credenciais de Acesso
            </div>

            {error && (
                <div style={{ marginBottom: '8px', padding: '6px 10px', background: '#ffebee', color: '#00a63a', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Email/Login */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: editingEmail ? '2px solid #1976d2' : '1px solid #eee', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold' }}>LOGIN (E-MAIL)</span>
                        {editingEmail ? (
                            <input
                                type="email"
                                value={emailValue}
                                onChange={(e) => setEmailValue(e.target.value)}
                                style={{
                                    fontSize: '0.8rem',
                                    color: '#333',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    padding: '2px 0',
                                    width: '100%'
                                }}
                                autoFocus
                                disabled={loading}
                            />
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.email}</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {editingEmail ? (
                            <>
                                <button
                                    onClick={handleCancelEmail}
                                    style={cancelButtonStyle}
                                    title="Cancelar"
                                    disabled={loading}
                                >
                                    <X size={14} />
                                </button>
                                <button
                                    onClick={() => handleSave('email')}
                                    style={confirmButtonStyle}
                                    title="Confirmar"
                                    disabled={loading}
                                >
                                    {loading ? <Loader size={14} className="spin" /> : <Check size={14} />}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditingEmail(true)}
                                    style={buttonStyle}
                                    title="Editar E-mail"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => onCopy(teacher.email, 'E-mail')}
                                    style={buttonStyle}
                                    title="Copiar E-mail"
                                >
                                    <Copy size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Senha */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: editingPassword ? '2px solid #1976d2' : '1px solid #eee', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold' }}>SENHA (ACESSO)</span>
                        {editingPassword ? (
                            <input
                                type="text"
                                value={passwordValue}
                                onChange={(e) => setPasswordValue(e.target.value)}
                                style={{
                                    fontSize: '0.8rem',
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
                            />
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#333', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {isVisible ? (teacher.senha || 'rumo2026') : '••••••••'}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {editingPassword ? (
                            <>
                                <button
                                    onClick={handleCancelPassword}
                                    style={cancelButtonStyle}
                                    title="Cancelar"
                                    disabled={loading}
                                >
                                    <X size={14} />
                                </button>
                                <button
                                    onClick={() => handleSave('password')}
                                    style={confirmButtonStyle}
                                    title="Confirmar"
                                    disabled={loading}
                                >
                                    {loading ? <Loader size={14} className="spin" /> : <Check size={14} />}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditingPassword(true)}
                                    style={buttonStyle}
                                    title="Editar Senha"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={onToggleVisibility}
                                    style={buttonStyle}
                                    title={isVisible ? "Ocultar Senha" : "Mostrar Senha"}
                                >
                                    {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                    onClick={() => onCopy(teacher.senha || 'rumo2026', 'Senha')}
                                    style={buttonStyle}
                                    title="Copiar Senha"
                                >
                                    <Copy size={14} />
                                </button>
                            </>
                        )}
                    </div>
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
