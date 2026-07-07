import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import EvolutionInstanceManager from './EvolutionInstanceManager';
import {
  getEvolutionInstances,
  getMessagingSettings,
  saveMessagingSettings,
  testEvolutionMessage
} from './messagingApi';
import type { EvolutionInstance, MessagingSettings } from './messagingApi';
import './styles.css';

const emptySettings: MessagingSettings = {
  adminEnabled: false,
  responsibleEnabled: false,
  triggerPendingApprovalEnabled: false,
  adminPhone: '',
  instanceName: ''
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 13).replace(/^55/, '');
  return numbers
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export default function AdminEvolutionMessages() {
  const [activeTab, setActiveTab] = useState<'instances' | 'triggers'>('instances');
  const [settings, setSettings] = useState<MessagingSettings>(emptySettings);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.name === settings.instanceName),
    [instances, settings.instanceName]
  );

  const refreshInstances = useCallback(async () => {
    try {
      setRefreshing(true);
      const availableInstances = await getEvolutionInstances();
      setInstances(availableInstances);
      setSettings((current) => ({
        ...current,
        instanceName: availableInstances.some((instance) => instance.name === current.instanceName)
          ? current.instanceName
          : availableInstances[0]?.name || ''
      }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [savedSettings, availableInstances] = await Promise.all([
        getMessagingSettings(),
        getEvolutionInstances()
      ]);
      setInstances(availableInstances);
      setSettings({
        ...savedSettings,
        adminPhone: formatPhone(savedSettings.adminPhone),
        instanceName: availableInstances.some((instance) => instance.name === savedSettings.instanceName)
          ? savedSettings.instanceName
          : availableInstances[0]?.name || ''
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void refreshInstances().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [load, refreshInstances]);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await saveMessagingSettings(settings);
      setMessage('Configurações salvas para o sistema da Rumo ao Esporte.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      setTesting(true);
      setError('');
      setMessage('');
      await testEvolutionMessage(settings.instanceName, settings.adminPhone);
      setMessage('Mensagem de teste enviada para o número do administrador.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao enviar mensagem de teste.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="admin-page page-enter evolution-message-page">
      <header className="evolution-message-header">
        <div>
          <h1>Mensagens Evolution</h1>
          <p>Controle de instâncias e gatilhos de WhatsApp da Rumo ao Esporte.</p>
        </div>
        <button type="button" className="message-refresh-button" onClick={() => void refreshInstances()} disabled={refreshing} title="Atualizar instâncias">
          <RefreshCw className={refreshing ? 'spin' : ''} size={19} />
        </button>
      </header>

      <main className="message-control-page">
        {loading ? (
          <div className="message-loading"><LoaderCircle className="spin" size={30} /> Carregando configurações...</div>
        ) : (
          <div className="message-control-form">
            <div className="message-tabs" role="tablist" aria-label="Configurações de mensagens">
              <button type="button" className={activeTab === 'instances' ? 'active' : ''} onClick={() => setActiveTab('instances')}>
                Instâncias
              </button>
              <button type="button" className={activeTab === 'triggers' ? 'active' : ''} onClick={() => setActiveTab('triggers')}>
                Gatilhos
              </button>
            </div>

            {activeTab === 'instances' && (
              <>
                <EvolutionInstanceManager
                  instances={instances}
                  selectedName={settings.instanceName}
                  refreshing={refreshing}
                  onSelect={(instanceName) => setSettings((current) => ({ ...current, instanceName }))}
                  onReload={refreshInstances}
                  onMessage={setMessage}
                  onError={setError}
                />

                <section className="message-config-section">
                  <div className="message-section-title"><MessageCircle size={20} /><h3>Destino administrativo</h3></div>
                  <label className="message-field compact">WhatsApp do administrador<input inputMode="tel" value={settings.adminPhone} onChange={(event) => setSettings({ ...settings, adminPhone: formatPhone(event.target.value) })} placeholder="(33) 99999-9999" /></label>
                </section>
              </>
            )}

            {activeTab === 'triggers' && (
              <section className="message-config-section">
                <div className="message-section-title"><MessageCircle size={20} /><h3>Gatilhos automáticos</h3></div>

                <div className="message-trigger-row">
                  <div>
                    <strong>Cadastro enviado para aprovação</strong>
                    <small>Envia ao administrador uma mensagem técnica com todos os dados do cadastro e a foto do aluno.</small>
                  </div>
                  <label className="message-switch">
                    <input
                      type="checkbox"
                      checked={settings.triggerPendingApprovalEnabled}
                      onChange={(event) => setSettings({ ...settings, triggerPendingApprovalEnabled: event.target.checked })}
                    />
                    <span />
                  </label>
                </div>
              </section>
            )}

            {error && <div className="message-alert error">{error}</div>}
            {message && <div className="message-alert success"><CheckCircle2 size={18} />{message}</div>}

            <div className="message-control-actions">
              <button type="button" className="message-secondary-button" onClick={test} disabled={testing || selectedInstance?.connectionStatus !== 'open' || !settings.adminPhone}>
                {testing ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} Enviar teste
              </button>
              <button type="button" className="message-primary-button" onClick={save} disabled={saving || !settings.instanceName}>
                {saving && <LoaderCircle className="spin" size={18} />} Salvar configurações
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
