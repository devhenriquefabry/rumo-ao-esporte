import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { useDialog } from '../../context/CustomDialogContext';
import { adicionarOperador, listarOperadores, removerOperador, type OperadorEvento } from '../../utils/eventos/eventosService';
import { formatarDataHora, mensagemErro } from '../../utils/eventos/eventosRules';
import { Alerta } from './EventosUI';

/**
 * Equipe de operação de eventos. Só o administrador principal vê e altera.
 * Quem estiver aqui (e tiver a rota "Eventos" liberada no perfil) consegue
 * operar inscrições, pagamentos, jogos e a súmula digital.
 */
export default function OperadoresEventos({ adminNome }: { adminNome: string }) {
    const { showAlert, showConfirm } = useDialog();
    const [lista, setLista] = useState<OperadorEvento[]>([]);
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [salvando, setSalvando] = useState(false);

    const carregar = useCallback(async () => {
        try { setLista(await listarOperadores()); }
        catch (e) { console.error(e); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    const adicionar = async () => {
        const e = email.trim().toLowerCase();
        if (!e.includes('@') || e.length < 5) { showAlert('Informe o e-mail da pessoa (o mesmo que ela usa para entrar no painel).', 'warning'); return; }
        setSalvando(true);
        try {
            await adicionarOperador(e, nome, adminNome);
            setEmail(''); setNome('');
            await carregar();
            showAlert('Pessoa liberada para operar eventos. Ela precisa também ter a rota "Eventos" liberada no cadastro de funcionários.', 'success');
        } catch (err) {
            showAlert(mensagemErro(err, 'Não foi possível salvar.'), 'error');
        } finally {
            setSalvando(false);
        }
    };

    const remover = (o: OperadorEvento) => showConfirm(`Remover o acesso de ${o.nome || o.email} aos eventos?`, async () => {
        try { await removerOperador(o.email); await carregar(); }
        catch { showAlert('Não foi possível remover.', 'error'); }
    }, 'warning', 'Remover acesso');

    return (
        <div className="ev-card">
            <h3><ShieldCheck size={18} /> Equipe de operação de eventos</h3>
            <Alerta tipo="info">
                Por segurança, só o <strong>administrador principal</strong> opera eventos por padrão. Cadastre aqui os funcionários que também
                podem operar (inscrições, pagamentos, documentos, jogos e súmula digital). Eles também precisam ter a rota
                <strong> Eventos</strong> liberada no cadastro de funcionários.
            </Alerta>
            <div className="ev-grid c3" style={{ alignItems: 'end' }}>
                <div className="ev-field"><label>E-mail de acesso</label><input className="ev-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="funcionario@email.com" /></div>
                <div className="ev-field"><label>Nome (opcional)</label><input className="ev-input" value={nome} onChange={e => setNome(e.target.value)} /></div>
                <button className="ev-btn primario" onClick={adicionar} disabled={salvando}><UserPlus size={16} /> Liberar acesso</button>
            </div>
            {lista.length > 0 && (
                <div className="ev-table-wrap" style={{ marginTop: 12 }}>
                    <table className="ev-table">
                        <thead><tr><th>E-mail</th><th>Nome</th><th>Liberado em</th><th></th></tr></thead>
                        <tbody>
                            {lista.map(o => (
                                <tr key={o.email}>
                                    <td style={{ fontWeight: 700 }}>{o.email}</td><td>{o.nome || '-'}</td><td>{formatarDataHora(o.adicionadoEm)}</td>
                                    <td><button className="ev-btn mini perigo" onClick={() => remover(o)}><Trash2 size={12} /> Remover</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
