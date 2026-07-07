import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar, 
    AlertCircle, 
    Check, 
    X,
    ShieldAlert, 
    Clock, 
    Info, 
    ChevronLeft,
    Save
} from 'lucide-react';
import PageTitle from '../../components/PageTitle';
import PageContainer from '../../components/PageContainer';
import { useDialog } from '../../context/CustomDialogContext';
import type { WhatsAppFullConfig } from './whatsappUtils';
import { 
    loadWhatsAppConfig, 
    saveWhatsAppConfig,
    WHATSAPP_SERVICE_URL 
} from './whatsappUtils';

export default function AdminMensagensAutomacao() {
    const [config, setConfig] = useState<WhatsAppFullConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [overrideTestPhone, setOverrideTestPhone] = useState('');
    const { showAlert } = useDialog();
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const data = await loadWhatsAppConfig();
            if (data) {
                setConfig(data);
                setOverrideTestPhone(data.testPhone || '');
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        const success = await saveWhatsAppConfig(config);
        setSaving(false);
        if (success) {
            showAlert("Configurações de automação salvas!", "success");
        } else {
            showAlert("Erro ao salvar.", "error");
        }
    };

    const handleTriggerNow = async () => {
        const dateToUse = config?.finAutoTestDate || new Date().toISOString().split('T')[0];
        if (!overrideTestPhone) {
            showAlert("Insira o número de WhatsApp para teste.", "error");
            return;
        }

        setTriggering(true);
        try {
            const resp = await fetch(`${WHATSAPP_SERVICE_URL}/financial-automation-trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    testDate: dateToUse,
                    testPhone: overrideTestPhone 
                })
            });
            const data = await resp.json();
            if (data.success) {
                showAlert(data.message, "success");
                if (config) {
                    setConfig({
                        ...config, 
                        finAutoTestSentAt: dateToUse + "_manual_" + Date.now(), 
                        finAutoTestResult: data.message
                    });
                }
            } else {
                showAlert("Erro: " + (data.error || data.message), "error");
            }
        } catch (e) {
            showAlert("Erro na conexão com o Worker.", "error");
        } finally {
            setTriggering(false);
        }
    };

    const Toggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
        <div 
            onClick={onClick}
            style={{
                width: '45px',
                height: '24px',
                background: active ? '#27ae60' : '#ccc',
                borderRadius: '12px',
                padding: '2px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: active ? 'flex-end' : 'flex-start'
            }}
        >
            <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
        </div>
    );

    if (loading) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <div style={{ color: '#666', fontSize: '1.2rem' }}>Carregando configurações...</div>
                </div>
            </PageContainer>
        );
    }

    if (!config) return null;

    return (
        <PageContainer>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                <button 
                    onClick={() => navigate('/admin/whatsapp')}
                    style={{ 
                        background: '#f8f9fa', border: '1px solid #ddd', 
                        padding: '8px', borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', color: '#666'
                    }}
                >
                    <ChevronLeft size={20} />
                </button>
                <PageTitle
                    title="AUTOMAÇÃO DE MENSAGENS"
                    subtitle="Configure regras de envio automático antes e após o vencimento das mensalidades."
                />
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Info banner */}
                <div style={{ background: '#eaf4ff', border: '1px solid #b3d4f0', borderRadius: '12px', padding: '18px 24px', marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <Info size={24} color="#2980b9" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.95rem', color: '#1a578a', lineHeight: '1.6' }}>
                        <strong>Como funciona:</strong> O sistema verifica diariamente as faturas dos alunos. Caso identifique um vencimento que bata com suas regras abaixo, uma mensagem automática (Pix/Boleto) será enviada via WhatsApp para o responsável. 
                        <strong> Nota:</strong> O disparo ocorre automaticamente pelo servidor (Worker) todos os dias no horário configurado abaixo.
                    </div>
                </div>

                {/* Configuração de Horário */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: '#f0f3ff', color: '#3f51b5', padding: '12px', borderRadius: '12px' }}><Clock size={24} /></div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>Horário de Envio das Cobranças</div>
                            <div style={{ fontSize: '0.85rem', color: '#777' }}>Horário em que o robô iniciará os disparos diários</div>
                        </div>
                    </div>
                    <input 
                        type="time" 
                        value={config.finAutoSendTime} 
                        onChange={e => setConfig({...config, finAutoSendTime: e.target.value})}
                        style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Regra 1: Antes */}
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#eefcf5', color: '#27ae60', padding: '12px', borderRadius: '12px' }}><Clock size={24} /></div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>Lembrete antes do vencimento</div>
                                    <div style={{ fontSize: '0.85rem', color: '#777' }}>Avisa preventivamente antes da data de vencer</div>
                                </div>
                            </div>
                            <Toggle 
                                active={!!config.finAutoBeforeEnabled} 
                                onClick={() => setConfig({...config, finAutoBeforeEnabled: !config.finAutoBeforeEnabled})} 
                            />
                        </div>
                        {config.finAutoBeforeEnabled && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', paddingLeft: '54px' }}>
                                <span style={{ fontSize: '1rem', color: '#555' }}>Enviar a mensagem</span>
                                <input 
                                    type="number" 
                                    value={config.finAutoBeforeDays} 
                                    onChange={e => setConfig({...config, finAutoBeforeDays: parseInt(e.target.value) || 0})}
                                    style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                                />
                                <span style={{ fontSize: '1rem', color: '#555' }}>dias antes do vencimento.</span>
                            </div>
                        )}
                    </div>

                    {/* Regra 2: No Dia */}
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#fff9e6', color: '#f1c40f', padding: '12px', borderRadius: '12px' }}><Calendar size={24} /></div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>Aviso no dia do vencimento</div>
                                    <div style={{ fontSize: '0.85rem', color: '#777' }}>Envia um lembrete no exato dia da fatura</div>
                                </div>
                            </div>
                            <Toggle 
                                active={!!config.finAutoOnDayEnabled} 
                                onClick={() => setConfig({...config, finAutoOnDayEnabled: !config.finAutoOnDayEnabled})} 
                            />
                        </div>
                    </div>

                    {/* Regra 3: Depois */}
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#fff0f0', color: '#00a63a', padding: '12px', borderRadius: '12px' }}><AlertCircle size={24} /></div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>Cobrança após o vencimento</div>
                                    <div style={{ fontSize: '0.85rem', color: '#777' }}>Cobra quando a fatura consta como atrasada</div>
                                </div>
                            </div>
                            <Toggle 
                                active={!!config.finAutoAfterEnabled} 
                                onClick={() => setConfig({...config, finAutoAfterEnabled: !config.finAutoAfterEnabled})} 
                            />
                        </div>
                        {config.finAutoAfterEnabled && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', paddingLeft: '54px' }}>
                                <span style={{ fontSize: '1rem', color: '#555' }}>Enviar a cobrança</span>
                                <input 
                                    type="number" 
                                    value={config.finAutoAfterDays} 
                                    onChange={e => setConfig({...config, finAutoAfterDays: parseInt(e.target.value) || 0})}
                                    style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                                />
                                <span style={{ fontSize: '1rem', color: '#555' }}>dias após o atraso.</span>
                            </div>
                        )}
                    </div>

                    {/* Opção de Teste */}
                    <div style={{ 
                        background: '#f8f9fa', padding: '20px', borderRadius: '16px', border: '1px dashed #ced4da', 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' 
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#e9ecef', padding: '10px', borderRadius: '10px', color: '#495057' }}><ShieldAlert size={20} /></div>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#495057' }}>Modo de Teste de Automação</div>
                                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Redireciona disparos automáticos financeiros para o número teste</div>
                            </div>
                        </div>
                        <Toggle 
                            active={!!config.finAutoTestMode} 
                            onClick={() => setConfig({...config, finAutoTestMode: !config.finAutoTestMode})} 
                        />
                    </div>

                    {/* Agendamento e Disparo de Teste */}
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', border: '1px solid #e9ecef', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ background: '#eef2ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Calendar size={22} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#2d3748' }}>Agendar ou Disparar Teste</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>Simula o processamento de uma data específica.</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Simular faturas do dia:</label>
                                <input 
                                    type="date" 
                                    value={config.finAutoTestDate} 
                                    onChange={e => setConfig({...config, finAutoTestDate: e.target.value})}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Horário do teste agendado (Cron):</label>
                                <input 
                                    type="time" 
                                    value={config.finAutoTestTime} 
                                    onChange={e => setConfig({...config, finAutoTestTime: e.target.value})}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px', background: '#f5f3ff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#5b21b6', marginBottom: '8px' }}>
                                <Info size={14} /> Número para receber o teste agora:
                            </label>
                            <input 
                                type="text" 
                                placeholder="553399..."
                                value={overrideTestPhone} 
                                onChange={e => setOverrideTestPhone(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #c4b5fd', fontSize: '1.1rem', fontWeight: 'bold', color: '#4c1d95' }}
                            />
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#6d28d9' }}>Informe o número completo com DDD (ex: 5533998200546)</p>
                        </div>

                        <button 
                            onClick={handleTriggerNow}
                            disabled={triggering}
                            style={{ 
                                width: '100%', 
                                padding: '16px', 
                                background: triggering ? '#ccc' : '#4f46e5', 
                                color: '#fff', 
                                borderRadius: '12px', 
                                border: 'none', 
                                fontWeight: 'bold', 
                                fontSize: '1rem',
                                cursor: triggering ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)',
                                marginBottom: '20px'
                            }}
                        >
                            {triggering ? 'Disparando...' : <><Save size={20} /> DISPARAR TESTE AGORA</>}
                        </button>

                        {(config.finAutoTestDate || config.finAutoTestTime) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fff9e6', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                                <div style={{ fontSize: '0.85rem', color: '#856404' }}>
                                    <Clock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    Agendamento automático para <strong>{config.finAutoTestTime || '--:--'}</strong> do dia <strong>{config.finAutoTestDate ? config.finAutoTestDate.split('-').reverse().join('/') : 'hoje'}</strong>.
                                </div>
                                <button 
                                    onClick={() => setConfig({...config, finAutoTestDate: '', finAutoTestTime: ''})}
                                    style={{ background: 'none', border: 'none', color: '#00a63a', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                                >
                                    <X size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Limpar Agendamento
                                </button>
                            </div>
                        )}
                        
                        {config.finAutoTestSentAt && (
                            <div style={{ marginTop: '15px', padding: '15px', background: '#f0fff4', borderRadius: '8px', border: '1px solid #c6f6d5', fontSize: '0.9rem', color: '#27ae60' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Check size={18} /> 
                                    <strong>Último Processamento de Teste</strong>
                                </div>
                                <div style={{ marginLeft: '26px' }}>
                                    <p style={{ margin: '0 0 5px 0' }}>
                                        {config.finAutoTestSentAt.includes('_') 
                                            ? `O teste para o dia ${config.finAutoTestSentAt.split('_')[0].split('-').reverse().join('/')} foi executado.`
                                            : `Enviado em ${new Date(config.finAutoTestSentAt).toLocaleString()}`}
                                    </p>
                                    {config.finAutoTestResult && (
                                        <p style={{ margin: 0, fontWeight: '500', color: '#1e8449', fontSize: '0.85rem' }}>
                                            ℹ️ {config.finAutoTestResult}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                    <button
                        onClick={() => navigate('/admin/whatsapp')}
                        style={{
                            padding: '14px 28px',
                            background: '#fff',
                            color: '#666',
                            border: '1px solid #ddd',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '14px 35px',
                            background: '#00a63a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(0, 166, 58, 0.28)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        {saving ? 'Salvando...' : <><Save size={20} /> Salvar Configurações</>}
                    </button>
                </div>
            </div>
        </PageContainer>
    );
}
