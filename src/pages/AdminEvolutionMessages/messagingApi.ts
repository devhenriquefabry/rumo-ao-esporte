import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const messagingApiBaseUrl =
  (import.meta.env.VITE_MESSAGING_API_URL as string) ||
  (import.meta.env.VITE_PAYMENT_API_URL as string) ||
  (import.meta.env.VITE_WORKER_URL as string) ||
  'https://rumo-ao-esporte-whatsapp-proxy.rumoaoesporte.workers.dev';

const evolutionProxyUrl =
  (import.meta.env.VITE_WORKER_URL as string) ||
  'https://rumo-ao-esporte-whatsapp-proxy.rumoaoesporte.workers.dev';

export const RUMO_INSTANCE_PREFIX = 'rumo_ao_esporte_';

export interface MessagingSettings {
  adminEnabled: boolean;
  responsibleEnabled: boolean;
  triggerPendingApprovalEnabled: boolean;
  adminPhone: string;
  instanceName: string;
}

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string;
  owner: string;
  profileName: string;
  profilePictureUrl: string;
}

export interface EvolutionConnection {
  instanceName: string;
  status: string;
  qrCode: string;
  pairingCode: string;
  count: number;
}

const emptySettings: MessagingSettings = {
  adminEnabled: false,
  responsibleEnabled: false,
  triggerPendingApprovalEnabled: false,
  adminPhone: '',
  instanceName: ''
};

const settingsRef = doc(db, 'system_settings', 'rumo_evolution_messaging');

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${messagingApiBaseUrl.replace(/\/$/, '')}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Erro na configuração de mensagens.');
  }
  return data;
};

const normalizeInstanceName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const toRumoInstanceName = (value: string) => {
  const normalized = normalizeInstanceName(value.replace(new RegExp(`^${RUMO_INSTANCE_PREFIX}`), ''));
  return normalized.startsWith(RUMO_INSTANCE_PREFIX)
    ? normalized
    : `${RUMO_INSTANCE_PREFIX}${normalized}`;
};

const assertRumoInstance = (instanceName: string) => {
  if (!instanceName.startsWith(RUMO_INSTANCE_PREFIX)) {
    throw new Error('Esta instância não pertence ao sistema da Rumo ao Esporte.');
  }
};

export const getMessagingSettings = async (): Promise<MessagingSettings> => {
  const snapshot = await getDoc(settingsRef);
  const data = snapshot.exists() ? snapshot.data() : {};
  const instanceName = String(data.instanceName || '');
  return {
    ...emptySettings,
    ...data,
    instanceName: instanceName.startsWith(RUMO_INSTANCE_PREFIX) ? instanceName : ''
  };
};

export const saveMessagingSettings = async (settings: MessagingSettings) => {
  if (settings.instanceName) assertRumoInstance(settings.instanceName);
  await setDoc(settingsRef, {
    adminEnabled: Boolean(settings.adminEnabled),
    responsibleEnabled: Boolean(settings.responsibleEnabled),
    triggerPendingApprovalEnabled: Boolean(settings.triggerPendingApprovalEnabled),
    adminPhone: settings.adminPhone,
    instanceName: settings.instanceName,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const getEvolutionInstances = async () => {
  const data = await request<{ success: true; instances: EvolutionInstance[] }>('/messaging/instances');
  return data.instances.filter((instance) => instance.name.startsWith(RUMO_INSTANCE_PREFIX));
};

export const createEvolutionInstance = async (rawInstanceName: string) => {
  const instanceName = toRumoInstanceName(rawInstanceName);
  assertRumoInstance(instanceName);
  const data = await request<{ success: true; instance: EvolutionInstance; connection: EvolutionConnection }>('/messaging/instances', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ instanceName })
  });
  return data;
};

export const connectEvolutionInstance = async (instanceName: string) => {
  assertRumoInstance(instanceName);
  const data = await request<{ success: true; connection: EvolutionConnection }>(`/messaging/instances/${encodeURIComponent(instanceName)}/connect`);
  return data.connection;
};

export const getEvolutionInstanceStatus = async (instanceName: string) => {
  assertRumoInstance(instanceName);
  const data = await request<{ success: true; connection: EvolutionConnection }>(`/messaging/instances/${encodeURIComponent(instanceName)}/status`);
  return data.connection;
};

export const restartEvolutionInstance = async (instanceName: string) => {
  assertRumoInstance(instanceName);
  const data = await request<{ success: true; connection: EvolutionConnection }>(`/messaging/instances/${encodeURIComponent(instanceName)}/restart`, { method: 'PUT' });
  return data.connection;
};

export const logoutEvolutionInstance = async (instanceName: string) => {
  assertRumoInstance(instanceName);
  await request(`/messaging/instances/${encodeURIComponent(instanceName)}/logout`, { method: 'DELETE' });
};

export const deleteEvolutionInstance = async (instanceName: string) => {
  assertRumoInstance(instanceName);
  await request(`/messaging/instances/${encodeURIComponent(instanceName)}`, { method: 'DELETE' });
};

export const testEvolutionMessage = async (instanceName: string, phone: string) => {
  assertRumoInstance(instanceName);
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  await sendEvolutionText(instanceName, phone, [
    '*[TESTE TÉCNICO DE MENSAGERIA]*',
    '',
    '*Sistema:* Rumo ao Esporte',
    '*Módulo:* Admin > Mensagens Evolution',
    `*Instância:* ${instanceName}`,
    `*Destino configurado:* ${formatWhatsappPhone(phone)}`,
    `*Ambiente:* ${window.location.origin}`,
    `*Data/hora:* ${now}`,
    '',
    'Resultado esperado: se esta mensagem chegou, a instância do Rumo ao Esporte está conectada e apta para receber os gatilhos automáticos.'
  ].join('\n'));
};

const evolutionRequest = async (path: string, payload: Record<string, any>) => {
  const response = await fetch(`${evolutionProxyUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Evolution retornou ${response.status}.`);
  return data;
};

const formatWhatsappPhone = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

export const sendEvolutionText = async (instanceName: string, phone: string, text: string) => {
  assertRumoInstance(instanceName);
  const number = formatWhatsappPhone(phone);
  if (number.length < 12) throw new Error('Número de WhatsApp inválido.');
  return evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    number,
    text,
    delay: 1500,
    options: { delay: 1500, presence: 'composing', linkPreview: true }
  });
};

export const sendEvolutionImage = async (instanceName: string, phone: string, caption: string, imageUrl: string) => {
  assertRumoInstance(instanceName);
  const number = formatWhatsappPhone(phone);
  if (number.length < 12) throw new Error('Número de WhatsApp inválido.');
  return evolutionRequest(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    number,
    mediatype: 'image',
    mediaType: 'image',
    mimetype: 'image/jpeg',
    media: imageUrl,
    caption,
    delay: 1500,
    options: { delay: 1500, presence: 'composing' }
  });
};

const valueOrDash = (value: any) => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  const text = String(value ?? '').trim();
  return text || '-';
};

const buildPendingApprovalMessage = (registrationId: string, registration: any) => {
  const responsavel = registration.responsavel || {};
  const endereco = registration.endereco || responsavel.endereco || {};
  const confirmacao = registration.confirmacao || {};
  const createdAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const alunosText = (registration.alunos || []).map((item: any, index: number) => {
    const itemSaude = item.saude || {};
    return [
      `*Aluno ${index + 1}:* ${valueOrDash(item.nome)}`,
      `Nascimento: ${valueOrDash(item.dataNascimento)}`,
      `CPF: ${valueOrDash(item.cpf)}`,
      `Modalidade: ${valueOrDash(registration.modalidade || item.modalidade || 'Futebol')}`,
      `Turma ID: ${valueOrDash(item.turmaId)}`,
      `Foto: ${valueOrDash(item.fotoUrl)}`,
      `Alergia: ${itemSaude.temAlergia ? valueOrDash(itemSaude.alergiaDesc) : 'Não informado'}`,
      `Medicamento contínuo: ${itemSaude.tomaMedicamento ? valueOrDash(itemSaude.medicamentoDesc) : 'Não informado'}`,
      `Condição médica: ${valueOrDash(itemSaude.condicaoSaude)}`
    ].join('\n');
  }).join('\n\n');

  return [
    '*[GATILHO AUTOMÁTICO: CADASTRO ENVIADO PARA APROVAÇÃO]*',
    '',
    '*Sistema:* Rumo ao Esporte',
    '*Origem:* Formulário público de cadastro',
    `*ID do cadastro:* ${registrationId}`,
    `*Data/hora do evento:* ${createdAt}`,
    `*Status:* ${valueOrDash(registration.contractStatus || 'pendente')}`,
    '',
    '*DADOS DO RESPONSÁVEL*',
    `Nome: ${valueOrDash(responsavel.nome)}`,
    `CPF: ${valueOrDash(responsavel.cpf)}`,
    `RG: ${valueOrDash(responsavel.rg)}`,
    `E-mail: ${valueOrDash(responsavel.email)}`,
    `Telefone principal: ${valueOrDash(responsavel.telefonePrincipal)}`,
    `Telefone secundário: ${valueOrDash(responsavel.telefoneSecundario)}`,
    '',
    '*ENDEREÇO*',
    `CEP: ${valueOrDash(endereco.cep)}`,
    `Rua: ${valueOrDash(endereco.rua)}`,
    `Número: ${valueOrDash(endereco.numero)}`,
    `Complemento: ${valueOrDash(endereco.complemento)}`,
    `Bairro: ${valueOrDash(endereco.bairro)}`,
    `Cidade/UF: ${valueOrDash(endereco.cidade)} / ${valueOrDash(endereco.uf || endereco.estado)}`,
    '',
    '*DADOS DO CADASTRO*',
    `Modalidade: ${valueOrDash(registration.modalidade || 'Futebol')}`,
    `Plano ID: ${valueOrDash(registration.planId)}`,
    `Horário: ${valueOrDash(registration.horario)}`,
    `Dias: ${valueOrDash(registration.dias)}`,
    `Forma de cobrança: ${valueOrDash(registration.billingType || registration.paymentMethod)}`,
    `Valor base: ${valueOrDash(registration.amount)}`,
    `Assinatura capturada: ${confirmacao.assinaturaDigital ? 'Sim' : 'Não'}`,
    '',
    '*ALUNOS*',
    alunosText || '-',
    '',
    '*AÇÃO NECESSÁRIA*',
    'Revisar o cadastro no painel administrativo e aprovar ou ajustar antes de liberar o acesso total.'
  ].join('\n');
};

export const notifyPendingApprovalRegistration = async (registrationId: string, registration: any) => {
  const settings = await getMessagingSettings();
  if (!settings.triggerPendingApprovalEnabled || !settings.instanceName || !settings.adminPhone) {
    return { skipped: true };
  }

  const message = buildPendingApprovalMessage(registrationId, registration);
  const photoUrl = registration.alunos?.find((aluno: any) => aluno?.fotoUrl)?.fotoUrl;
  if (photoUrl) {
    await sendEvolutionImage(settings.instanceName, settings.adminPhone, message, photoUrl);
  } else {
    await sendEvolutionText(settings.instanceName, settings.adminPhone, message);
  }
  return { skipped: false };
};
