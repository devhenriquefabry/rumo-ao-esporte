import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Trophy, User } from 'lucide-react';
import type { Evento } from '../../types/eventos';
import { listarEventos } from '../../utils/eventos/eventosService';
import { formatarData, modalidadeLabel, situacaoInscricoes, inscricoesAbertas } from '../../utils/eventos/eventosRules';
import { EventosShell, Carregando } from '../../components/eventos/EventosUI';

export default function EventosLista() {
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    useEffect(() => {
        listarEventos()
            .then(lista => setEventos(lista.filter(e => e.status !== 'rascunho')))
            .catch(() => setErro('Não foi possível carregar os eventos agora.'))
            .finally(() => setCarregando(false));
    }, []);

    const abertos = eventos.filter(e => e.status === 'publicado');
    const encerrados = eventos.filter(e => e.status === 'encerrado');

    const cartao = (e: Evento) => (
        <Link key={e.id} to={`/eventos/${e.id}`} className="ev-evento-card">
            <div className="capa" style={e.bannerUrl ? { backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(6,26,64,.75)), url(${e.bannerUrl})` } : undefined}>
                <span className="ev-chip">{modalidadeLabel(e.modalidade)}</span>
            </div>
            <div className="corpo">
                <h3>{e.nome}</h3>
                <span className="ev-muted"><Calendar size={13} /> {formatarData(e.dataInicio)}{e.dataFim && e.dataFim !== e.dataInicio ? ` a ${formatarData(e.dataFim)}` : ''}</span>
                {e.local && <span className="ev-muted"><MapPin size={13} /> {e.local}</span>}
                <span className={`ev-chip ${inscricoesAbertas(e) ? 'verde' : 'claro'}`} style={{ alignSelf: 'flex-start', marginTop: 6 }}>{situacaoInscricoes(e)}</span>
            </div>
        </Link>
    );

    return (
        <EventosShell direita={<Link to="/eventos/minha-area"><User size={15} /> Minha área</Link>}>
            <div className="ev-hero">
                <div className="ev-hero-body">
                    <h1><Trophy size={26} style={{ verticalAlign: '-4px' }} /> Campeonatos, torneios e corridas</h1>
                    <p style={{ opacity: .85 }}>Inscreva sua equipe ou faça sua inscrição individual nos eventos da Associação Rumo ao Esporte e ao Lazer – REAL.</p>
                </div>
            </div>

            {carregando && <Carregando texto="Carregando eventos..." />}
            {erro && <div className="ev-card"><p className="ev-muted">{erro}</p></div>}

            {!carregando && !erro && abertos.length === 0 && encerrados.length === 0 && (
                <div className="ev-card ev-vazio"><Trophy size={40} /><p>Nenhum evento disponível no momento.</p></div>
            )}

            {abertos.length > 0 && <div className="ev-grid auto" style={{ marginBottom: 24 }}>{abertos.map(cartao)}</div>}

            {encerrados.length > 0 && (
                <>
                    <h2 style={{ color: '#fff', fontWeight: 900, textTransform: 'uppercase', fontSize: '1rem', margin: '10px 0 12px' }}>Eventos encerrados · resultados</h2>
                    <div className="ev-grid auto">{encerrados.map(cartao)}</div>
                </>
            )}
        </EventosShell>
    );
}
