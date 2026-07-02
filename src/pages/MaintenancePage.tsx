interface MaintenancePageProps {
    title?: string;
}

export default function MaintenancePage({ title }: MaintenancePageProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            textAlign: 'center',
            padding: '20px',
            background: '#fff',
            position: 'fixed',
            inset: 0,
            zIndex: 9999
        }}>
            <img
                src="/manutencao.png"
                alt="Manutenção"
                style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: 'auto',
                    marginBottom: '20px'
                }}
            />
            <h1 style={{ color: '#00237f', margin: '0 0 10px 0', fontSize: '1.8rem', fontWeight: 'bold' }}>
                {title ? title.toUpperCase() : 'SISTEMA EM MANUTENÇÃO'}
            </h1>
            <p style={{ color: '#666', fontSize: '1.1rem', maxWidth: '400px', lineHeight: '1.5' }}>
                Pedimos desculpas pelo transtorno. Nossa equipe está realizando atualizações importantes para melhorar sua experiência.
            </p>
            <div style={{ marginTop: '30px', padding: '10px 20px', background: '#f5f5f5', borderRadius: '30px', color: '#888', fontSize: '0.8rem', fontWeight: 'bold' }}>
                ARENA SIMONÉSIA
            </div>
        </div>
    );
}
