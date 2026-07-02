

import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteOverlayProps {
    show: boolean;
    // status: 'confirming' | 'fetching' | 'deleting' | 'success' | 'error';
    status: string;
    progress: { current: number; total: number };
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteOverlay({
    show, status, progress, onCancel, onConfirm
}: DeleteOverlayProps) {
    if (!show) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', color: '#fff'
        }}>

            {status === 'confirming' && (
                <div className="animate-scale-in" style={{
                    background: '#fff', borderRadius: '16px', padding: '30px',
                    width: '90%', maxWidth: '400px', textAlign: 'center', color: '#333'
                }}>
                    <div style={{
                        width: '60px', height: '60px', background: '#ffebee', borderRadius: '50%',
                        color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px auto'
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#c62828' }}>Excluir Cadastro?</h3>
                    <p style={{ color: '#666', marginBottom: '25px', lineHeight: '1.5' }}>
                        Isso removerá <strong>permanentemente</strong> o cadastro, os dados do aluno e todos os arquivos associados (fotos, comprovantes).
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onCancel} className="native-button native-button-secondary" style={{ flex: 1 }}>
                            Cancelar
                        </button>
                        <button onClick={onConfirm} className="native-button" style={{ flex: 1, background: '#c62828', color: '#fff', border: 'none' }}>
                            Excluir Tudo
                        </button>
                    </div>
                </div>
            )}

            {(status === 'fetching' || status === 'deleting') && (
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner-border" style={{ width: '50px', height: '50px', borderWidth: '4px', marginBottom: '20px' }}></div>
                    <h3 style={{ margin: 0 }}>{status === 'fetching' ? 'Analisando arquivos...' : 'Excluindo dados...'}</h3>
                    {progress.total > 0 && (
                        <p style={{ marginTop: '10px', opacity: 0.8 }}>
                            Arquivo {progress.current} de {progress.total}
                        </p>
                    )}
                </div>
            )}

            {status === 'success' && (
                <div className="animate-scale-in" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', background: '#4caf50', borderRadius: '50%',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px auto'
                    }}>
                        <Trash2 size={40} />
                    </div>
                    <h3 style={{ margin: 0 }}>Excluído!</h3>
                    <p style={{ marginTop: '10px', opacity: 0.8 }}>Redirecionando...</p>
                </div>
            )}

            {status === 'error' && (
                <>
                    <div style={{
                        width: '80px', height: '80px', background: '#c62828', borderRadius: '50%',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px auto'
                    }}>
                        <AlertTriangle size={40} />
                    </div>
                    <h3 style={{ color: '#c62828', margin: 0 }}>Erro ao Excluir</h3>
                    <p style={{ color: '#ccc', marginTop: '10px' }}>Tente novamente.</p>
                    <button onClick={onCancel} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                        Fechar
                    </button>
                </>
            )}
        </div>
    );
}
