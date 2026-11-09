import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { LogIn, UserPlus } from 'lucide-react';
import { auth } from '../../firebase';
import { useDialog } from '../../context/CustomDialogContext';
import { useEventoConta, salvarContaEvento } from '../../hooks/useEventoConta';
import { EventosShell, Carregando, Alerta } from '../../components/eventos/EventosUI';

const soDigitos = (s: string) => s.replace(/\D/g, '');

export default function EventoEntrar() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const destino = params.get('volta') || '/eventos/minha-area';
    const { showAlert } = useDialog();
    const { user, conta, loading, recarregar } = useEventoConta();

    const [modo, setModo] = useState<'entrar' | 'criar'>(params.get('modo') === 'criar' ? 'criar' : 'entrar');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [cpf, setCpf] = useState('');
    const [enviando, setEnviando] = useState(false);

    // Logado e com perfil completo: segue para o destino
    useEffect(() => {
        if (!loading && user && conta) navigate(destino, { replace: true });
        if (!loading && user && !conta) {
            setEmail(user.email || '');
            setModo('criar');
        }
    }, [loading, user, conta, destino, navigate]);

    const validarPerfil = () => {
        if (nome.trim().split(' ').length < 2) return 'Informe o nome completo.';
        if (soDigitos(telefone).length < 10) return 'Informe um telefone com DDD.';
        if (soDigitos(cpf).length !== 11) return 'Informe um CPF válido (11 números). Ele é usado na cobrança PIX.';
        return '';
    };

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        const emailLimpo = email.trim().toLowerCase();
        setEnviando(true);
        try {
            if (modo === 'entrar') {
                await signInWithEmailAndPassword(auth, emailLimpo, senha);
                await recarregar();
                return;
            }

            const erro = validarPerfil();
            if (erro) { showAlert(erro, 'warning'); return; }

            let uid = auth.currentUser?.uid;
            if (!uid) {
                if (senha.length < 6) { showAlert('A senha precisa ter pelo menos 6 caracteres.', 'warning'); return; }
                try {
                    const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
                    uid = cred.user.uid;
                } catch (err) {
                    if ((err as { code?: string })?.code === 'auth/email-already-in-use') {
                        // Conta já existe (ex.: responsável do portal do aluno): entra com a senha informada
                        const cred = await signInWithEmailAndPassword(auth, emailLimpo, senha);
                        uid = cred.user.uid;
                    } else throw err;
                }
            }
            await salvarContaEvento(uid!, { nome: nome.trim(), email: emailLimpo || auth.currentUser?.email || '', telefone: telefone.trim(), cpf: soDigitos(cpf) });
            await recarregar();
        } catch (err) {
            const code = (err as { code?: string })?.code || '';
            const msg = code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
                ? 'E-mail ou senha incorretos.'
                : code.includes('invalid-email') ? 'E-mail inválido.'
                    : code.includes('too-many-requests') ? 'Muitas tentativas. Aguarde alguns minutos.'
                        : 'Não foi possível concluir agora. Tente novamente.';
            showAlert(msg, 'error');
        } finally {
            setEnviando(false);
        }
    };

    const esqueciSenha = async () => {
        if (!email.includes('@')) { showAlert('Digite seu e-mail no campo acima para receber o link de nova senha.', 'info'); return; }
        try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            showAlert('Enviamos um link para redefinir a senha no seu e-mail.', 'success');
        } catch {
            showAlert('Não foi possível enviar o e-mail de redefinição.', 'error');
        }
    };

    if (loading) return <EventosShell><Carregando /></EventosShell>;

    const completandoPerfil = !!user && !conta;

    return (
        <EventosShell voltar={{ to: '/eventos', label: 'Eventos' }}>
            <div className="ev-card" style={{ maxWidth: 520, margin: '0 auto' }}>
                {!completandoPerfil && (
                    <div className="ev-tabs">
                        <button className={`ev-tab ${modo === 'entrar' ? 'ativa' : ''}`} onClick={() => setModo('entrar')}><LogIn size={14} /> Já tenho conta</button>
                        <button className={`ev-tab ${modo === 'criar' ? 'ativa' : ''}`} onClick={() => setModo('criar')}><UserPlus size={14} /> Criar conta</button>
                    </div>
                )}
                <h2>{completandoPerfil ? 'Complete seu cadastro' : modo === 'entrar' ? 'Entrar' : 'Criar conta de responsável'}</h2>
                <p className="ev-muted" style={{ marginBottom: 16 }}>
                    {modo === 'entrar'
                        ? 'Acesse para acompanhar sua equipe, pagamentos, atletas e comprovantes.'
                        : 'Com esta conta você inscreve equipes ou se inscreve em corridas, envia documentos e acompanha tudo pelo celular.'}
                </p>
                {completandoPerfil && <Alerta tipo="info">Você entrou como <strong>{user?.email}</strong>. Precisamos de alguns dados para as inscrições.</Alerta>}

                <form onSubmit={enviar} className="ev-grid">
                    {!completandoPerfil && (
                        <>
                            <div className="ev-field">
                                <label>E-mail</label>
                                <input className="ev-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="ev-field">
                                <label>Senha</label>
                                <input className="ev-input" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} />
                                {modo === 'criar' && <span className="ev-hint">Mínimo de 6 caracteres. Se você já usa o portal do aluno da REAL, use o mesmo e-mail e senha.</span>}
                            </div>
                        </>
                    )}
                    {modo === 'criar' && (
                        <>
                            <div className="ev-field">
                                <label>Nome completo</label>
                                <input className="ev-input" value={nome} onChange={e => setNome(e.target.value)} required />
                            </div>
                            <div className="ev-grid c2">
                                <div className="ev-field">
                                    <label>Telefone / WhatsApp</label>
                                    <input className="ev-input" inputMode="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(33) 99999-9999" required />
                                </div>
                                <div className="ev-field">
                                    <label>CPF</label>
                                    <input className="ev-input" inputMode="numeric" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" required />
                                </div>
                            </div>
                        </>
                    )}
                    <button className="ev-btn primario grande bloco" type="submit" disabled={enviando}>
                        {enviando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : completandoPerfil ? 'Salvar e continuar' : 'Criar conta'}
                    </button>
                    {modo === 'entrar' && <button type="button" className="ev-btn neutro bloco" onClick={esqueciSenha}>Esqueci minha senha</button>}
                </form>
            </div>
        </EventosShell>
    );
}
