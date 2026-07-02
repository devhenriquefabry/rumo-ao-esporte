import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MODALIDADES } from '../utils/turmasConstants';
import { Copy, ExternalLink, Check } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';

export default function AdminLinks() {
    const [copied, setCopied] = useState<string | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [turmas, setTurmas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const domain = window.location.origin;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch all registrations to count students
                const snapshot = await getDocs(collection(db, 'arena_simonesia_2026_registrations'));
                const newCounts: Record<string, number> = {};

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.turmaId) {
                        newCounts[data.turmaId] = (newCounts[data.turmaId] || 0) + 1;
                    }
                });
                setCounts(newCounts);

                // 2. Fetch all active turmas
                const turmasSnap = await getDocs(collection(db, 'turmas'));
                const turmasList = turmasSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter((t: any) => t.ativo !== false);
                setTurmas(turmasList);

            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    if (loading) return <div style={{ padding: '30px' }}>Calculando turmas...</div>;

    return (
        <PageContainer>
            <PageTitle
                title="LINKS DE CHAMADA"
                subtitle="Links ativos apenas para turmas com alunos matriculados."
            />

            {MODALIDADES.map(mod => {
                const modTurmas = turmas.filter(t => t.modalidade === mod.id);
                if (modTurmas.length === 0) return null;

                return (
                    <div key={mod.id} style={{ marginBottom: '40px' }}>
                        <h2 style={{
                            fontSize: '1.4rem',
                            color: '#007d2f',
                            borderBottom: '2px solid #eee',
                            paddingBottom: '10px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            {mod.label}
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {modTurmas.map(t => {
                                const link = `${domain}/chamada-v2/${t.id}`;
                                const count = counts[t.id] || 0;

                                return (
                                    <div key={t.id} style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <h3 style={{ fontSize: '1.1rem', color: '#444', margin: 0 }}>{t.nome}</h3>
                                            <span style={{ background: '#007d2f', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', height: 'fit-content' }}>
                                                {count} alunos
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '15px' }}>
                                            {t.horario} • {t.dias?.join(', ')}
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{
                                                flex: 1,
                                                background: '#f9f9f9',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                color: '#666',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                border: '1px solid #eee'
                                            }}>
                                                {link}
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(link, t.id)}
                                                title="Copiar Link"
                                                style={{
                                                    background: copied === t.id ? '#2e7d32' : '#007d2f',
                                                    color: '#fff',
                                                    border: 'none',
                                                    width: '40px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'background 0.2s'
                                                }}
                                            >
                                                {copied === t.id ? <Check size={18} /> : <Copy size={18} />}
                                            </button>
                                            <a
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="Abrir Link"
                                                style={{
                                                    background: '#333',
                                                    color: '#fff',
                                                    width: '40px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </PageContainer>
    );
}
