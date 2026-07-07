import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, RefreshCw } from 'lucide-react';
import { auth, db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';

type RequestItem = {
  id: string;
  escola?: {
    logoUrl?: string;
    palette?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    nome?: string;
    estado?: string;
    tipoOperacao?: string;
    quantidadeAlunos?: string;
  };
  operacao?: {
    modalidades?: Record<string, boolean>;
    quantidadeTurmas?: string;
    usuariosInternos?: Record<string, boolean>;
    ferramentaAtual?: string;
  };
  modulos?: Record<string, boolean>;
  requisitos?: {
    maiorDor?: string;
    prazoDesejado?: string;
    prioridadeImplantacao?: string;
  };
  contato?: {
    nome?: string;
    telefone?: string;
    email?: string;
  };
  createdAt?: any;
};

const LABELS: Record<string, string> = {
  escola_esportes: 'Escola de esportes',
  clube: 'Clube',
  academia: 'Academia',
  escola_regular: 'Escola regular',
  outro: 'Outro',
  ate_100: 'Até 100',
  '101_300': '101 a 300',
  '301_700': '301 a 700',
  mais_700: 'Mais de 700',
  ate_10: 'Até 10',
  '11_30': '11 a 30',
  '31_60': '31 a 60',
  mais_60: 'Mais de 60',
  papel: 'Papel/caderno',
  planilhas: 'Planilhas',
  whatsapp: 'WhatsApp',
  sistema_antigo: 'Sistema antigo',
  misto: 'Misturado',
  nao_sabe: 'Não sabe',
  cadastro_desorganizado: 'Cadastro desorganizado',
  turmas_horarios: 'Turmas/horários confusos',
  chamada_frequencia: 'Chamada/frequência',
  financeiro_cobranca: 'Financeiro/cobrança',
  contratos_documentos: 'Contratos/documentos',
  comunicacao: 'Comunicação com responsáveis',
  relatorios: 'Relatórios/gestão',
  urgente: 'Urgente',
  '30_dias': 'Até 30 dias',
  '60_90_dias': '60 a 90 dias',
  sem_prazo: 'Sem prazo definido',
  cadastro_turmas: 'Primeiro cadastro e turmas',
  financeiro: 'Financeiro/cobranças',
  chamada: 'Chamada por turma',
  portal: 'Primeiro portal do responsável',
  completo: 'Pacote completo',
  cadastroAlunos: 'Cadastro de alunos/responsáveis',
  turmasHorarios: 'Turmas e horários',
  contratos: 'Contratos digitais',
  portalResponsavel: 'Portal do aluno/responsável',
  carteirinhas: 'Carteirinhas/identificação',
  mensagensWhatsapp: 'Mensagens/WhatsApp',
  futebol: 'Futebol',
  natacao: 'Natação',
  voleibol: 'Voleibol',
  hidro: 'Hidroginástica',
  danca: 'Dança',
  lutas: 'Lutas',
  outros: 'Outros',
  secretaria: 'Secretaria',
  professores: 'Professores',
  portaria: 'Portaria',
  diretoria: 'Diretoria/gestão'
};

const label = (value?: string) => value ? LABELS[value] || value : 'Não informado';

const selectedLabels = (values?: Record<string, boolean>) => {
  if (!values) return 'Nenhum selecionado';
  const selected = Object.entries(values)
    .filter(([, enabled]) => enabled)
    .map(([key]) => LABELS[key] || key);

  return selected.length ? selected.join(', ') : 'Nenhum selecionado';
};

const formatDate = (value: any) => {
  const date = value?.toDate?.();
  if (!date) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

export default function SchoolSystemRequestsView() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('rae_admin_auth')));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const { showAlert } = useDialog();

  const fetchRequests = async () => {
    if (!authenticated) return;
    setLoading(true);
    const snapshot = await getDocs(query(collection(db, 'school_system_requests'), orderBy('createdAt', 'desc')));
    setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestItem)));
    setLoading(false);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);

    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem('rae_admin_auth', 'true');
      } catch {
        const employeeQuery = query(
          collection(db, 'employees'),
          where('email', '==', email),
          where('senha', '==', password),
          where('active', '==', true)
        );
        const employeeSnapshot = await getDocs(employeeQuery);
        if (employeeSnapshot.empty) throw new Error('Credenciais inválidas ou acesso não autorizado.');

        const employeeDoc = employeeSnapshot.docs[0];
        localStorage.setItem('rae_admin_auth', JSON.stringify({ id: employeeDoc.id, ...employeeDoc.data() }));
      }

      setAuthenticated(true);
      setPassword('');
    } catch (error: any) {
      showAlert(error.message || 'Erro ao autenticar.', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) fetchRequests();
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="landing-page" style={{ padding: '20px' }}>
        <div className="landing-content" style={{ background: '#fff', color: '#343a40', width: '100%', maxWidth: '460px', padding: '34px' }}>
          <Lock size={44} color="#00a63a" />
          <h1 style={{ color: '#00a63a', fontSize: '1.6rem', marginTop: '14px', marginBottom: '8px' }}>Acesso às solicitações</h1>
          <p style={{ color: '#6c757d', marginBottom: '24px' }}>Entre com uma conta administrativa para visualizar os cadastros recebidos.</p>
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'grid', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>E-mail</label>
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Senha</label>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} required />
            </div>
            <button type="submit" className="btn-nav btn-submit" disabled={loginLoading} style={{ width: '100%', marginTop: '8px' }}>
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <img src="/rumo-ao-esporte-logo.png" alt="Logo" className="header-logo" onError={event => { event.currentTarget.style.display = 'none'; }} />
        <h1 className="header-title">SOLICITAÇÕES DE SISTEMA PARA ESCOLA</h1>
      </header>

      <div className="form-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Solicitações recebidas</h2>
          <button type="button" className="btn-nav btn-next" onClick={fetchRequests} disabled={loading} style={{ padding: '10px 14px' }}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#343a40' }}>Carregando...</p>
        ) : items.length === 0 ? (
          <p style={{ color: '#343a40' }}>Nenhuma solicitação encontrada.</p>
        ) : (
          <div style={{ display: 'grid', gap: '14px' }}>
            {items.map(item => (
              <RequestCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ item }: { item: RequestItem }) {
  const primary = item.escola?.palette?.primary || '#00a63a';
  const secondary = item.escola?.palette?.secondary || '#06376d';
  const accent = item.escola?.palette?.accent || '#f8f9fa';

  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    background: `${primary}18`,
    color: primary,
    border: `1px solid ${primary}33`,
    padding: '6px 9px',
    fontSize: '0.8rem',
    fontWeight: 700
  } as const;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e9ecef',
      boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
      overflow: 'hidden'
    }}>
      <div style={{
        height: '10px',
        background: `linear-gradient(90deg, ${primary}, ${secondary}, ${accent})`
      }} />
      <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '112px 1fr', gap: '18px' }}>
        <div style={{
          width: '112px',
          height: '112px',
          background: `linear-gradient(135deg, #fff, ${accent}55)`,
          border: `2px solid ${primary}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.65)'
        }}>
          {item.escola?.logoUrl ? (
            <img src={item.escola.logoUrl} alt="Logo da escola" style={{ maxWidth: '96px', maxHeight: '96px', objectFit: 'contain' }} />
          ) : (
            <span style={{ color: '#6c757d', fontSize: '12px', textAlign: 'center' }}>Sem logo</span>
          )}
        </div>
        <div style={{ color: '#343a40', display: 'grid', gap: '10px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: primary, fontSize: '1.25rem', display: 'block', lineHeight: 1.2 }}>{item.escola?.nome || 'Escola sem nome'}</strong>
              <span style={{ color: '#6c757d', fontSize: '0.88rem' }}>{formatDate(item.createdAt)}</span>
            </div>
            <span style={chipStyle}>{item.escola?.estado || 'UF não informado'}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={chipStyle}>{label(item.escola?.tipoOperacao)}</span>
            <span style={chipStyle}>Alunos: {label(item.escola?.quantidadeAlunos)}</span>
            <span style={chipStyle}>Turmas: {label(item.operacao?.quantidadeTurmas)}</span>
            <span style={chipStyle}>Controle: {label(item.operacao?.ferramentaAtual)}</span>
          </div>

          <div style={{ display: 'grid', gap: '6px', color: '#495057', lineHeight: 1.45 }}>
            <span><strong style={{ color: '#212529' }}>Modalidades:</strong> {selectedLabels(item.operacao?.modalidades)}</span>
            <span><strong style={{ color: '#212529' }}>Usuários:</strong> {selectedLabels(item.operacao?.usuariosInternos)}</span>
            <span><strong style={{ color: '#212529' }}>Módulos:</strong> {selectedLabels(item.modulos)}</span>
            <span><strong style={{ color: '#212529' }}>Dor:</strong> {label(item.requisitos?.maiorDor)} | <strong style={{ color: '#212529' }}>Prioridade:</strong> {label(item.requisitos?.prioridadeImplantacao)}</span>
            <span><strong style={{ color: '#212529' }}>Prazo:</strong> {label(item.requisitos?.prazoDesejado)}</span>
            <span><strong style={{ color: '#212529' }}>Contato:</strong> {item.contato?.nome || 'Não informado'} | {item.contato?.telefone || 'Sem telefone'} | {item.contato?.email || 'Sem e-mail'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
