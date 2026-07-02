import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Store, SwitchCamera } from 'lucide-react';
import { useDialog } from '../../../context/CustomDialogContext';

export default function StoreConfiguration() {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const { showAlert, showConfirm } = useDialog();

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const docRef = doc(db, 'system_settings', 'store');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().enabled) {
                    setEnabled(true);
                }
            } catch (error) {
                console.error("Erro ao buscar status da loja:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, []);

    const handleToggle = async () => {
        const action = enabled ? 'desativar' : 'ativar';
        showConfirm(
            `Tem certeza que deseja ${action} a loja no aplicativo dos alunos?`,
            async () => {
                try {
                    setLoading(true);
                    await setDoc(doc(db, 'system_settings', 'store'), {
                        enabled: !enabled,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                    setEnabled(!enabled);
                    showAlert(`Loja ${enabled ? 'desativada' : 'ativada'} com sucesso!`, 'success');
                } catch (error) {
                    console.error("Erro ao atualizar loja:", error);
                    showAlert('Erro ao atualizar status da loja.', 'error');
                } finally {
                    setLoading(false);
                }
            },
            'warning',
            `${enabled ? 'Desativar' : 'Ativar'} Loja do Clube`
        );
    };

    if (loading) {
        return <div style={{ padding: '20px' }}>Carregando configurações...</div>;
    }

    return (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{ background: enabled ? '#e8f5e9' : '#ffebee', padding: '12px', borderRadius: '12px', color: enabled ? '#2e7d32' : '#c62828' }}>
                    <Store size={24} />
                </div>
                <div>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem' }}>Status da Loja no App do Aluno</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                        {enabled ? 'A loja está visível e alunos podem comprar produtos.' : 'A loja está oculta do aplicativo dos alunos.'}
                    </p>
                </div>
            </div>

            <div style={{ padding: '20px', background: '#f5f7fa', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <strong style={{ display: 'block', color: '#333', marginBottom: '5px' }}>Comércio Eletrônico</strong>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>Pausa ou ativa as vendas instantaneamente no sistema todo.</span>
                </div>

                <button
                    onClick={handleToggle}
                    style={{
                        padding: '10px 20px',
                        background: enabled ? '#c62828' : '#2e7d32',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <SwitchCamera size={18} />
                    {enabled ? 'DESATIVAR LOJA' : 'ATIVAR LOJA'}
                </button>
            </div>
        </div>
    );
}
