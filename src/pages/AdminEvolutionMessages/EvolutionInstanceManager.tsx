import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LogOut, Plus, Power, QrCode, RefreshCw, RotateCw, Server, Trash2, X } from 'lucide-react';
import InstanceConnectionModal from './InstanceConnectionModal';
import {
  createEvolutionInstance,
  deleteEvolutionInstance,
  logoutEvolutionInstance,
  restartEvolutionInstance,
  toArenaInstanceName
} from './messagingApi';
import type { EvolutionConnection, EvolutionInstance } from './messagingApi';

interface EvolutionInstanceManagerProps {
  instances: EvolutionInstance[];
  selectedName: string;
  refreshing: boolean;
  onSelect: (name: string) => void;
  onReload: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}

const statusLabel: Record<string, string> = {
  open: 'Conectada',
  connecting: 'Conectando',
  close: 'Desconectada',
  created: 'Aguardando conexão'
};

export default function EvolutionInstanceManager({
  instances,
  selectedName,
  refreshing,
  onSelect,
  onReload,
  onMessage,
  onError
}: EvolutionInstanceManagerProps) {
  const [creating, setCreating] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [action, setAction] = useState('');
  const [connectionTarget, setConnectionTarget] = useState('');
  const [initialConnection, setInitialConnection] = useState<EvolutionConnection | null>(null);

  const selected = useMemo(() => instances.find((instance) => instance.name === selectedName), [instances, selectedName]);
  const normalizedName = instanceName.trim() ? toArenaInstanceName(instanceName) : '';

  const runAction = async (name: string, type: 'restart' | 'logout' | 'delete') => {
    if (type === 'delete' && !window.confirm(`Excluir definitivamente a instância ${name}?`)) return;
    if (type === 'logout' && !window.confirm(`Desconectar o WhatsApp da instância ${name}?`)) return;
    try {
      setAction(type);
      onError('');
      if (type === 'restart') await restartEvolutionInstance(name);
      if (type === 'logout') await logoutEvolutionInstance(name);
      if (type === 'delete') await deleteEvolutionInstance(name);
      await onReload();
      onMessage(type === 'restart' ? 'Instância reiniciada.' : type === 'logout' ? 'WhatsApp desconectado.' : 'Instância excluída.');
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : 'Não foi possível concluir a ação.');
    } finally {
      setAction('');
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (normalizedName.length < 3) return;
    try {
      setAction('create');
      onError('');
      const result = await createEvolutionInstance(instanceName);
      await onReload();
      onSelect(normalizedName);
      setCreating(false);
      setInstanceName('');
      setInitialConnection(result.connection);
      setConnectionTarget(normalizedName);
      onMessage('Instância criada. Escaneie o QR Code para conectar.');
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a instância.');
    } finally {
      setAction('');
    }
  };

  const connected = selected?.connectionStatus === 'open';

  return (
    <section className="message-config-section instance-manager-section">
      <div className="instance-manager-heading">
        <div className="message-section-title"><Server size={20} /><h3>Instâncias Evolution</h3></div>
        <div className="instance-manager-tools">
          <button type="button" onClick={() => void onReload()} disabled={refreshing} title="Atualizar instâncias"><RefreshCw className={refreshing ? 'spin' : ''} size={18} /></button>
          <button type="button" className="instance-add-button" onClick={() => setCreating(true)}><Plus size={18} /> Nova instância</button>
        </div>
      </div>

      {instances.length ? (
        <div className="instance-list" role="list">
          {instances.map((instance) => (
            <button
              type="button"
              role="listitem"
              key={instance.name}
              className={`instance-list-item ${instance.name === selectedName ? 'selected' : ''}`}
              onClick={() => onSelect(instance.name)}
            >
              <span className={`instance-list-status ${instance.connectionStatus === 'open' ? 'online' : instance.connectionStatus}`} />
              <span><strong>{instance.profileName || instance.name}</strong><small>{instance.name}</small></span>
              <em>{statusLabel[instance.connectionStatus] || instance.connectionStatus}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="instance-empty"><Server size={32} /><strong>Nenhuma instância da Arena criada</strong></div>
      )}

      {selected && (
        <div className="instance-selected-panel">
          <div className="instance-selected-info">
            <span className={`instance-avatar ${connected ? 'online' : ''}`}><Power size={22} /></span>
            <div><strong>{selected.profileName || selected.name}</strong><small>{selected.owner || 'Número ainda não conectado'}</small></div>
            <span className={`instance-status-badge ${connected ? 'online' : ''}`}>{statusLabel[selected.connectionStatus] || selected.connectionStatus}</span>
          </div>
          <div className="instance-action-buttons">
            {!connected && <button type="button" className="connect" onClick={() => setConnectionTarget(selected.name)}><QrCode size={17} /> Conectar</button>}
            <button type="button" onClick={() => void runAction(selected.name, 'restart')} disabled={Boolean(action)} title="Reiniciar"><RotateCw className={action === 'restart' ? 'spin' : ''} size={17} /></button>
            {connected && <button type="button" onClick={() => void runAction(selected.name, 'logout')} disabled={Boolean(action)} title="Desconectar"><LogOut size={17} /></button>}
            <button type="button" className="danger" onClick={() => void runAction(selected.name, 'delete')} disabled={Boolean(action)} title="Excluir"><Trash2 size={17} /></button>
          </div>
        </div>
      )}

      {creating && (
        <div className="instance-modal-backdrop" role="presentation" onClick={() => setCreating(false)}>
          <form className="instance-create-modal" onSubmit={create} onClick={(event) => event.stopPropagation()}>
            <div className="instance-modal-header"><h3>Nova instância</h3><button type="button" onClick={() => setCreating(false)} title="Fechar"><X size={20} /></button></div>
            <label>Nome da instância<input autoFocus value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder="ex: principal" /></label>
            {normalizedName && <small>Será criada como: <strong>{normalizedName}</strong></small>}
            <div className="instance-create-actions"><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button type="submit" className="message-primary-button" disabled={normalizedName.length < 3 || action === 'create'}>{action === 'create' ? 'Criando...' : 'Criar e conectar'}</button></div>
          </form>
        </div>
      )}

      {connectionTarget && (
        <InstanceConnectionModal
          instanceName={connectionTarget}
          initialConnection={initialConnection}
          onClose={() => setConnectionTarget('')}
          onConnected={async () => {
            await onReload();
            onMessage('WhatsApp conectado com sucesso.');
          }}
        />
      )}
    </section>
  );
}
