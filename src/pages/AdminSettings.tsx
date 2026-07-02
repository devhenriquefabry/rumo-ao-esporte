import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';

export default function AdminSettings() {
    const [creditCardEnabled, setCreditCardEnabled] = useState(false);
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    const { showAlert } = useDialog();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch Payment Settings
                const payRef = doc(db, 'system_settings', 'payment');
                const paySnap = await getDoc(payRef);
                if (paySnap.exists()) {
                    setCreditCardEnabled(paySnap.data().credit_card_enabled);
                }

                // Fetch Maintenance Settings
                const maintRef = doc(db, 'system_settings', 'maintenance');
                const maintSnap = await getDoc(maintRef);
                if (maintSnap.exists()) {
                    setMaintenanceEnabled(maintSnap.data().enabled);
                }
            } catch (error) {
                console.error("Erro ao carregar configurações:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleToggle = async () => {
        setSaving(true);
        const newState = !creditCardEnabled;
        try {
            await setDoc(doc(db, 'system_settings', 'payment'), {
                credit_card_enabled: newState,
                updatedAt: new Date()
            }, { merge: true });

            setCreditCardEnabled(newState);
            showAlert(`Pagamento via cartão ${newState ? 'ativado' : 'desativado'} com sucesso!`, "success");
        } catch (error) {
            console.error("Erro ao salvar configuração:", error);
            showAlert("Erro ao salvar configuração.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleMaintenanceToggle = async () => {
        setSaving(true);
        const newState = !maintenanceEnabled;
        try {
            await setDoc(doc(db, 'system_settings', 'maintenance'), {
                enabled: newState,
                updatedAt: new Date()
            }, { merge: true });

            setMaintenanceEnabled(newState);
            showAlert(`Modo manutenção ${newState ? 'ativado' : 'desativado'} com sucesso!`, "success");
        } catch (error) {
            console.error("Erro ao salvar configuração de manutenção:", error);
            showAlert("Erro ao salvar configuração.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', color: '#666' }}>Carregando configurações...</div>;
    }

    return (
        <PageContainer style={{ maxWidth: '800px' }}>
            <PageTitle
                title="CONFIGURAÇÕES DO SISTEMA"
                subtitle="Gerencie as opções globais da plataforma."
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                    padding: '30px'
                }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Pagamentos</h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <strong style={{ display: 'block', fontSize: '1rem', color: '#333', marginBottom: '5px' }}>Pagamento via Cartão de Crédito</strong>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Habilitar ou desabilitar a opção de pagamento por cartão no formulário público.</span>
                        </div>

                        <button
                            onClick={handleToggle}
                            disabled={saving}
                            style={{
                                position: 'relative',
                                width: '56px',
                                height: '30px',
                                background: creditCardEnabled ? '#007d2f' : '#e0e0e0',
                                borderRadius: '30px',
                                border: 'none',
                                cursor: saving ? 'wait' : 'pointer',
                                transition: 'background 0.3s ease',
                                padding: 0
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: creditCardEnabled ? '29px' : '3px',
                                width: '24px',
                                height: '24px',
                                background: '#fff',
                                borderRadius: '50%',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                            }} />
                        </button>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px', fontSize: '0.85rem', color: '#666' }}>
                        Status atual: <strong style={{ color: creditCardEnabled ? '#1e7e34' : '#d93025' }}>{creditCardEnabled ? 'ATIVADO' : 'DESATIVADO'}</strong>
                    </div>
                </div>

                {/* Maintenance Mode Section */}
                <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                    padding: '30px',
                    borderLeft: maintenanceEnabled ? '5px solid #ffa000' : 'none'
                }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Manutenção do Sistema</h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <strong style={{ display: 'block', fontSize: '1rem', color: '#333', marginBottom: '5px' }}>Modo Manutenção</strong>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Ative para bloquear o acesso de Alunos e Professores durante atualizações.</span>
                        </div>

                        <button
                            onClick={handleMaintenanceToggle}
                            disabled={saving}
                            style={{
                                position: 'relative',
                                width: '56px',
                                height: '30px',
                                background: maintenanceEnabled ? '#ffa000' : '#e0e0e0',
                                borderRadius: '30px',
                                border: 'none',
                                cursor: saving ? 'wait' : 'pointer',
                                transition: 'background 0.3s ease',
                                padding: 0
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: maintenanceEnabled ? '29px' : '3px',
                                width: '24px',
                                height: '24px',
                                background: '#fff',
                                borderRadius: '50%',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                            }} />
                        </button>
                    </div>

                    {maintenanceEnabled && (
                        <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '6px', fontSize: '0.85rem', color: '#e65100', fontWeight: 'bold' }}>
                            Atenção: O sistema está atualmente em Manutenção. Pais e Professores estão bloqueados.
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
