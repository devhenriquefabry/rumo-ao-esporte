import { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { Lock, Save } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';

export default function StudentSettings() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { showAlert } = useDialog();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newPassword || !confirmPassword) {
            showAlert("Preencha todos os campos.", "warning");
            return;
        }

        if (newPassword !== confirmPassword) {
            showAlert("As senhas não coincidem.", "warning");
            return;
        }

        if (newPassword.length < 6) {
            showAlert("A senha deve ter pelo menos 6 caracteres.", "warning");
            return;
        }

        setLoading(true);
        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                showAlert("Senha atualizada com sucesso!", "success");
                setNewPassword('');
                setConfirmPassword('');
            } else {
                showAlert("Você precisa estar logado para alterar a senha.", "error");
            }
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                showAlert("Para sua segurança, esta operação exige um login recente. Por favor, saia e entre novamente no sistema.", "error");
            } else {
                showAlert("Erro ao atualizar senha: " + error.message, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer>
            <PageTitle
                title="CONFIGURAÇÕES"
                subtitle="Gerencie sua conta e segurança"
            />

            <div className="native-card animate-scale-in" style={{ padding: '0', overflow: 'hidden', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ padding: '20px 25px', background: '#f5f7fa', borderBottom: '1px solid #eee' }}>
                    <h3 style={{ margin: 0, color: '#17428f', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Lock size={20} />
                        Alterar Senha
                    </h3>
                </div>

                <div style={{ padding: '30px' }}>
                    <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>Nova Senha</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Digite a nova senha"
                                className="native-input"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>Confirmar Senha</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirme a nova senha"
                                className="native-input"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ paddingTop: '10px' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                className="native-button native-button-primary touch-feedback"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '12px'
                                }}
                            >
                                {loading ? 'Salvando...' : (
                                    <>
                                        <Save size={18} /> ATUALIZAR SENHA
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </PageContainer>
    );
}
