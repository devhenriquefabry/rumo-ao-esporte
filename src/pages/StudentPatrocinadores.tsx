import PageContainer from '../components/PageContainer';
import { Handshake } from 'lucide-react';
import { sponsors } from '../data/sponsors';

export default function StudentPatrocinadores() {
    return (
        <PageContainer>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: '#eef8ff', color: '#00a63a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Handshake size={24} />
                </div>
                <div>
                    <h2 style={{ margin: 0, color: '#17428f' }}>Patrocinadores</h2>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Empresas que apoiam a Rumo ao Esporte
                    </p>
                </div>
            </div>

            {sponsors.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>
                    Nenhum patrocinador cadastrado no momento.
                </p>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '18px'
                }}>
                    {sponsors.map((sponsor) => (
                        <div
                            key={sponsor.name}
                            style={{
                                background: '#fff',
                                borderRadius: '16px',
                                border: '1px solid rgba(238, 242, 255, 0.8)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                                padding: '18px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                textAlign: 'center'
                            }}
                        >
                            <img
                                src={sponsor.logo}
                                alt={sponsor.name}
                                style={{
                                    width: '100%',
                                    maxWidth: '110px',
                                    height: '110px',
                                    objectFit: 'contain',
                                    borderRadius: '10px'
                                }}
                            />
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#334155' }}>
                                {sponsor.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </PageContainer>
    );
}
