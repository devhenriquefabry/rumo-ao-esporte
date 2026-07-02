import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAndCreateTurmas } from '../utils/turmasMigration';

export default function AdminMigrateTurmas() {
    const navigate = useNavigate();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleRun = async () => {
        if (!window.confirm('ATENÇÃO: Isso irá APAGAR todas as turmas atuais e criar novas. Os alunos serão realocados automaticamente. Deseja continuar?')) {
            return;
        }

        setRunning(true);
        setResult(null);

        try {
            const res = await clearAndCreateTurmas();
            setResult(res);
        } catch (error: any) {
            setResult({ success: false, message: error.message, stats: null });
        } finally {
            setRunning(false);
        }
    };

    return (
        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
            <button
                onClick={() => navigate('/admin/turmas')}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#666',
                    marginBottom: '20px'
                }}
            >
                ← Voltar
            </button>

            <h1 style={{ color: '#007d2f', marginBottom: '10px' }}>Migrar Turmas</h1>
            <p style={{ color: '#666', marginBottom: '30px' }}>
                Esta ação irá limpar todas as turmas atuais e criar as novas turmas de futebol conforme o cronograma atualizado.
                Os alunos serão automaticamente alocados nas turmas baseado na idade e modalidade.
            </p>

            <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
            }}>
                <strong>⚠️ Novas Turmas (Todas como FUTEBOL):</strong>
                <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '0.9rem' }}>
                    <li><strong>Terça:</strong> Sub-15 (18:00), Sub-9 (18:20), Sub-12/13/14 (19:20), Sub-10/11 (19:20)</li>
                    <li><strong>Quinta:</strong> Sub-15 (18:00), Sub-9 (18:20), Sub-12/13/14 (19:10), Sub-10/11 (19:20)</li>
                    <li><strong>Quarta:</strong> Iniciação Futsal (18:30) [Campo/Quadra], Sub-7/8 (18:30)</li>
                    <li><strong>Sexta:</strong> Iniciação Futsal (18:30) [Campo/Quadra], Sub-7/8 (18:30)</li>
                </ul>
            </div>

            <button
                onClick={handleRun}
                disabled={running}
                style={{
                    background: running ? '#ccc' : '#007d2f',
                    color: '#fff',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: running ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}
            >
                {running ? '⏳ Processando...' : '🔄 Executar Migração'}
            </button>

            {result && (
                <div style={{
                    marginTop: '30px',
                    padding: '20px',
                    borderRadius: '8px',
                    background: result.success ? '#d4edda' : '#f8d7da',
                    border: `1px solid ${result.success ? '#28a745' : '#dc3545'}`
                }}>
                    <h3 style={{ margin: '0 0 10px 0', color: result.success ? '#155724' : '#721c24' }}>
                        {result.success ? '✅ Sucesso!' : '❌ Erro'}
                    </h3>
                    <p style={{ margin: '0 0 10px 0' }}>{result.message}</p>

                    {result.stats && (
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            <li>Turmas deletadas: <strong>{result.stats.deletedTurmas}</strong></li>
                            <li>Turmas criadas: <strong>{result.stats.createdTurmas}</strong></li>
                            <li>Alunos alocados: <strong>{result.stats.allocatedStudents}</strong></li>
                            <li>Alunos não alocados: <strong>{result.stats.skippedStudents}</strong></li>
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
