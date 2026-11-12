import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { Plus, Trophy, Calendar, MapPin, ExternalLink, Users, CreditCard, FileWarning, Lock } from 'lucide-react';
import { auth, db } from '../../firebase';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import OperadoresEventos from '../../components/eventos/OperadoresEventos';
import PageContainer from '../../components/PageContainer';
import PageTitle from '../../components/PageTitle';
import { useLoading } from '../../components/LoadingService';
import { useDialog } from '../../context/CustomDialogContext';
import type { Evento, EquipeEvento, InscricaoIndividual } from '../../types/eventos';
import { COL_EQUIPES, COL_INSCRICOES, listarEventos } from '../../utils/eventos/eventosService';
import { formatarData, modalidadeLabel, situacaoInscricoes } from '../../utils/eventos/eventosRules';
import '../../styles/eventos.css';

interface Contagem { inscritos: number; pagPendentes: number; docsPendentes: number; finalizadas: number }

export default function AdminEventos() {
    const navigate = useNavigate();
    const { setLoading } = useLoading();
    const { showAlert } = useDialog();
    const { user } = useAdminPermissions();
    const souAdminPrincipal = (auth.currentUser?.email || '').toLowerCase() === (((import.meta.env.VITE_MAIN_ADMIN_EMAIL as string) || 'rumoaoesporte@admin.com').trim().toLowerCase());
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [equipes, setEquipes] = useState<EquipeEvento[]>([]);
    const [inscricoes, setInscricoes] = useState<InscricaoIndividual[]>([]);

    useEffect(() => {
        (async () => {
            setLoading(true, 'Carregando eventos...');
            try {
                const [evs, eqSnap, inSnap] = await Promise.all([
                    listarEventos(),
                    getDocs(collection(db, COL_EQUIPES)),
                    getDocs(collection(db, COL_INSCRICOES)),
                ]);
                setEventos(evs);
                setEquipes(eqSnap.docs.map(d => ({ id: d.id, ...d.data() } as EquipeEvento)));
                setInscricoes(inSnap.docs.map(d => ({ id: d.id, ...d.data() } as InscricaoIndividual)));
            } catch (e) {
                console.error(e);
                const negado = (e as { code?: string })?.code === 'permission-denied';
                showAlert(negado
                    ? 'Seu acesso a Eventos ainda não foi liberado. Peça ao administrador principal para cadastrar o seu e-mail em "Equipe de operação de eventos".'
                    : 'Erro ao carregar os eventos.', negado ? 'warning' : 'error');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const contagens = useMemo(() => {
        const mapa: Record<string, Contagem> = {};
        const base = (id: string) => (mapa[id] ||= { inscritos: 0, pagPendentes: 0, docsPendentes: 0, finalizadas: 0 });
        equipes.filter(e => e.status !== 'cancelada').forEach(e => {
            const c = base(e.eventId);
            c.inscritos++;
            if (e.pagamento?.status === 'pendente' || e.pagamento?.status === 'em_analise') c.pagPendentes++;
            c.docsPendentes += (e.atletas || []).filter(a => a.documentoUrl && a.documentoStatus === 'pendente').length;
            if (e.status === 'finalizada') c.finalizadas++;
        });
        inscricoes.filter(i => i.status !== 'cancelada').forEach(i => {
            const c = base(i.eventId);
            c.inscritos++;
            if (i.pagamento?.status === 'pendente' || i.pagamento?.status === 'em_analise') c.pagPendentes++;
            if (i.documentoUrl && i.documentoStatus === 'pendente') c.docsPendentes++;
            if (i.status === 'finalizada') c.finalizadas++;
        });
        return mapa;
    }, [equipes, inscricoes]);

    const totais = useMemo(() => Object.values(contagens).reduce((acc, c) => ({
        inscritos: acc.inscritos + c.inscritos, pagPendentes: acc.pagPendentes + c.pagPendentes,
        docsPendentes: acc.docsPendentes + c.docsPendentes, finalizadas: acc.finalizadas + c.finalizadas,
    }), { inscritos: 0, pagPendentes: 0, docsPendentes: 0, finalizadas: 0 }), [contagens]);

    const corStatus = (s: Evento['status']) => s === 'publicado' ? { cor: '#047857', fundo: '#d1fae5', label: 'Publicado' }
        : s === 'encerrado' ? { cor: '#475569', fundo: '#e2e8f0', label: 'Encerrado' } : { cor: '#b45309', fundo: '#fef3c7', label: 'Rascunho' };

    return (
        <PageContainer>
            <PageTitle title="Eventos" subtitle="Campeonatos, torneios e corridas: inscrições, regulamentos, listas oficiais e súmulas" count={eventos.length}>
                <a className="ev-btn secundario" href="/eventos" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Página pública</a>
                <button className="ev-btn primario" onClick={() => navigate('/admin/eventos/novo')}><Plus size={16} /> Novo evento</button>
            </PageTitle>

            <div className="ev-grid c4" style={{ marginBottom: 20 }}>
                <div className="ev-stat"><div className="valor">{totais.inscritos}</div><div className="rotulo"><Users size={12} /> Equipes e participantes</div></div>
                <div className="ev-stat ouro"><div className="valor">{totais.pagPendentes}</div><div className="rotulo"><CreditCard size={12} /> Pagamentos pendentes</div></div>
                <div className="ev-stat vermelho"><div className="valor">{totais.docsPendentes}</div><div className="rotulo"><FileWarning size={12} /> Documentos a analisar</div></div>
                <div className="ev-stat verde"><div className="valor">{totais.finalizadas}</div><div className="rotulo"><Lock size={12} /> Inscrições finalizadas</div></div>
            </div>

            {eventos.length === 0 ? (
                <div className="ev-card ev-vazio">
                    <Trophy size={44} />
                    <p>Nenhum evento criado ainda.</p>
                    <button className="ev-btn primario" style={{ marginTop: 12 }} onClick={() => navigate('/admin/eventos/novo')}><Plus size={16} /> Criar o primeiro evento</button>
                </div>
            ) : (
                <div className="ev-grid auto">
                    {eventos.map(e => {
                        const c = contagens[e.id!] || { inscritos: 0, pagPendentes: 0, docsPendentes: 0, finalizadas: 0 };
                        const st = corStatus(e.status);
                        return (
                            <Link key={e.id} to={`/admin/eventos/${e.id}`} className="ev-evento-card">
                                <div className="capa" style={e.bannerUrl ? { backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(6,26,64,.75)), url(${e.bannerUrl})` } : undefined}>
                                    <span className="ev-badge" style={{ color: st.cor, background: st.fundo }}>{st.label}</span>
                                </div>
                                <div className="corpo">
                                    <h3>{e.nome || 'Sem nome'}</h3>
                                    <span className="ev-muted ev-small">{modalidadeLabel(e.modalidade)} · {e.tipo === 'equipes' ? 'Equipes' : 'Inscrição individual'} · {e.categorias.length} categoria(s)</span>
                                    <span className="ev-muted ev-small"><Calendar size={12} /> {formatarData(e.dataInicio)} {e.local && <><MapPin size={12} /> {e.local}</>}</span>
                                    <span className="ev-muted ev-small">{situacaoInscricoes(e)} · Regulamento {e.regulamento ? `v${e.regulamento.versao}` : 'não anexado'}</span>
                                    <div className="ev-chips">
                                        <span className="ev-chip claro">{c.inscritos} inscrito(s)</span>
                                        {c.pagPendentes > 0 && <span className="ev-chip ouro">{c.pagPendentes} pag. pendente(s)</span>}
                                        {c.docsPendentes > 0 && <span className="ev-chip ouro">{c.docsPendentes} doc(s)</span>}
                                        {e.tipo === 'equipes' && <span className="ev-chip verde">{c.finalizadas} finalizada(s)</span>}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {souAdminPrincipal && <div style={{ marginTop: 24 }}><OperadoresEventos adminNome={user?.nome || 'Administrador'} /></div>}
        </PageContainer>
    );
}
