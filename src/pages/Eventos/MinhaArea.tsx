import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { LogOut, Users, Medal, ChevronRight, Trophy } from 'lucide-react';
import { auth } from '../../firebase';
import type { Evento, EquipeEvento, InscricaoIndividual } from '../../types/eventos';
import { listarEventos, listarMinhasEquipes, listarMinhasInscricoes } from '../../utils/eventos/eventosService';
import { formatarData } from '../../utils/eventos/eventosRules';
import { useEventoConta } from '../../hooks/useEventoConta';
import { EventosShell, Carregando, StatusBadge } from '../../components/eventos/EventosUI';

export default function MinhaArea() {
    const navigate = useNavigate();
    const { user, conta, loading } = useEventoConta();
    const [equipes, setEquipes] = useState<EquipeEvento[]>([]);
    const [inscricoes, setInscricoes] = useState<InscricaoIndividual[]>([]);
    const [eventos, setEventos] = useState<Record<string, Evento>>({});
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        if (loading) return;
        if (!user || !conta) { navigate('/eventos/entrar?volta=/eventos/minha-area', { replace: true }); return; }
        Promise.all([listarMinhasEquipes(user.uid), listarMinhasInscricoes(user.uid), listarEventos()])
            .then(([eq, ins, evs]) => {
                setEquipes(eq);
                setInscricoes(ins);
                setEventos(Object.fromEntries(evs.map(e => [e.id!, e])));
            })
            .catch(e => console.error(e))
            .finally(() => setCarregando(false));
    }, [loading, user, conta, navigate]);

    const sair = async () => {
        await signOut(auth);
        navigate('/eventos');
    };

    if (loading || carregando) return <EventosShell><Carregando /></EventosShell>;

    const nomeCategoria = (eventId: string, catId: string) => eventos[eventId]?.categorias.find(c => c.id === catId)?.nome || '-';

    return (
        <EventosShell voltar={{ to: '/eventos', label: 'Eventos' }} direita={<button className="ev-link-claro" onClick={sair}><LogOut size={15} /> Sair</button>}>
            <div className="ev-card">
                <h2>Olá, {conta?.nome.split(' ')[0]}!</h2>
                <p className="ev-muted">Aqui você acompanha suas equipes e inscrições, paga taxas, cadastra atletas e baixa comprovantes.</p>
            </div>

            <div className="ev-card">
                <h3><Users size={18} /> Minhas equipes</h3>
                {equipes.length === 0 ? (
                    <p className="ev-muted">Nenhuma equipe cadastrada. <Link to="/eventos">Ver eventos com inscrições abertas</Link>.</p>
                ) : (
                    <div className="ev-lista-atletas">
                        {equipes.map(e => (
                            <Link key={e.id} to={`/eventos/minha-area/equipe/${e.id}`} className="ev-atleta" style={{ textDecoration: 'none' }}>
                                <span className="camisa"><Trophy size={20} /></span>
                                <div>
                                    <div className="nome">{e.nome}</div>
                                    <div className="ev-muted ev-small">{eventos[e.eventId]?.nome || 'Evento'} · {nomeCategoria(e.eventId, e.categoriaId)} · {e.atletas.length} atleta(s)</div>
                                    <div style={{ marginTop: 4 }}><StatusBadge status={e.status} /></div>
                                </div>
                                <ChevronRight size={20} color="#63708a" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <div className="ev-card">
                <h3><Medal size={18} /> Minhas inscrições individuais</h3>
                {inscricoes.length === 0 ? (
                    <p className="ev-muted">Nenhuma inscrição individual.</p>
                ) : (
                    <div className="ev-lista-atletas">
                        {inscricoes.map(i => (
                            <Link key={i.id} to={`/eventos/minha-area/inscricao/${i.id}`} className="ev-atleta" style={{ textDecoration: 'none' }}>
                                <span className="camisa">{i.numeroPeito || <Medal size={20} />}</span>
                                <div>
                                    <div className="nome">{i.participante.nome}</div>
                                    <div className="ev-muted ev-small">{eventos[i.eventId]?.nome || 'Evento'} · {nomeCategoria(i.eventId, i.categoriaId)} · {formatarData(eventos[i.eventId]?.dataInicio)}</div>
                                    <div style={{ marginTop: 4 }}><StatusBadge status={i.status} /></div>
                                </div>
                                <ChevronRight size={20} color="#63708a" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </EventosShell>
    );
}
