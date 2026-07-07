import { Clock } from 'lucide-react';
import PageContainer from '../components/PageContainer';

export default function StudentHorarios() {
    return (
        <PageContainer>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <Clock size={28} color="#00a63a" />
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Horários de Atividades</h1>
            </div>

            <div className="native-card" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ color: '#555', marginBottom: '20px', fontSize: '1rem' }}>
                    Confira abaixo os <strong>horários de Futebol</strong> disponíveis para os alunos.
                </p>

                <div style={{
                    background: '#f1f8e9',
                    border: '1px solid #dcedc8',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                    <span style={{ fontSize: '0.85rem', color: '#558b2f', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horário Geral</span>
                    <span style={{ fontSize: '1.25rem', color: '#33691e', fontWeight: 'bold' }}>Segunda a sexta, das 17h às 21h</span>
                </div>
            </div>
        </PageContainer>
    );
}
