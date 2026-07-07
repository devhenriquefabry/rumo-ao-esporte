import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Building2, CheckCircle, ClipboardList, Send, Settings, Trash2, Upload, User } from 'lucide-react';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { compressImage } from '../utils/imageUtils';

type BooleanMap = Record<string, boolean>;

type SchoolSystemRequest = {
  escola: {
    logoUrl: string;
    palette: {
      primary: string;
      secondary: string;
      accent: string;
    };
    nome: string;
    estado: string;
    tipoOperacao: string;
    quantidadeAlunos: string;
  };
  operacao: {
    modalidades: BooleanMap;
    quantidadeTurmas: string;
    usuariosInternos: BooleanMap;
    ferramentaAtual: string;
  };
  modulos: BooleanMap;
  requisitos: {
    maiorDor: string;
    prazoDesejado: string;
    prioridadeImplantacao: string;
  };
  contato: {
    nome: string;
    telefone: string;
    email: string;
  };
};

const MODALIDADES = [
  ['futebol', 'Futebol'],
  ['natacao', 'Natação'],
  ['voleibol', 'Voleibol'],
  ['hidro', 'Hidroginástica'],
  ['academia', 'Academia'],
  ['danca', 'Dança'],
  ['lutas', 'Lutas'],
  ['outros', 'Outros']
];

const USUARIOS_INTERNOS = [
  ['secretaria', 'Secretaria'],
  ['financeiro', 'Financeiro'],
  ['professores', 'Professores'],
  ['portaria', 'Portaria'],
  ['diretoria', 'Diretoria/gestão']
];

const MODULOS = [
  ['cadastroAlunos', 'Cadastro de alunos/responsáveis'],
  ['turmasHorarios', 'Turmas e horários'],
  ['chamada', 'Chamada por turma'],
  ['financeiro', 'Financeiro/cobranças'],
  ['contratos', 'Contratos digitais'],
  ['portalResponsavel', 'Portal do aluno/responsável'],
  ['carteirinhas', 'Carteirinhas/identificação'],
  ['mensagensWhatsapp', 'Mensagens/WhatsApp']
];

const makeBooleanMap = (items: string[][], enabled: string[] = []) => (
  items.reduce<BooleanMap>((acc, [key]) => {
    acc[key] = enabled.includes(key);
    return acc;
  }, {})
);

const INITIAL_DATA: SchoolSystemRequest = {
  escola: {
    logoUrl: '',
    palette: {
      primary: '#00a63a',
      secondary: '#06376d',
      accent: '#f8f9fa'
    },
    nome: '',
    estado: '',
    tipoOperacao: '',
    quantidadeAlunos: ''
  },
  operacao: {
    modalidades: makeBooleanMap(MODALIDADES),
    quantidadeTurmas: '',
    usuariosInternos: makeBooleanMap(USUARIOS_INTERNOS),
    ferramentaAtual: ''
  },
  modulos: makeBooleanMap(MODULOS, ['cadastroAlunos', 'turmasHorarios']),
  requisitos: {
    maiorDor: '',
    prazoDesejado: '',
    prioridadeImplantacao: ''
  },
  contato: {
    nome: '',
    telefone: '',
    email: ''
  }
};

const TOTAL_STEPS = 4;
const STEP_LABELS = ['Escola', 'Operação', 'Módulos', 'Contato'];

export default function SchoolSystemRequestForm() {
  const [data, setData] = useState<SchoolSystemRequest>(INITIAL_DATA);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState(false);
  const { showAlert } = useDialog();

  const maskPhone = (value: string) => value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);

  const updateEscola = (field: keyof SchoolSystemRequest['escola'], value: string) => {
    setData(prev => ({ ...prev, escola: { ...prev.escola, [field]: value } }));
  };

  const updatePalette = (palette: SchoolSystemRequest['escola']['palette']) => {
    setData(prev => ({ ...prev, escola: { ...prev.escola, palette } }));
  };

  const updateOperacao = (field: 'quantidadeTurmas' | 'ferramentaAtual', value: string) => {
    setData(prev => ({ ...prev, operacao: { ...prev.operacao, [field]: value } }));
  };

  const updateRequisitos = (field: keyof SchoolSystemRequest['requisitos'], value: string) => {
    setData(prev => ({ ...prev, requisitos: { ...prev.requisitos, [field]: value } }));
  };

  const updateContato = (field: keyof SchoolSystemRequest['contato'], value: string) => {
    const finalValue = field === 'email' ? value.toLowerCase().trim() : value;
    setData(prev => ({ ...prev, contato: { ...prev.contato, [field]: finalValue } }));
  };

  const toggleNested = (section: 'modalidades' | 'usuariosInternos', field: string, checked: boolean) => {
    setData(prev => ({
      ...prev,
      operacao: {
        ...prev.operacao,
        [section]: {
          ...prev.operacao[section],
          [field]: checked
        }
      }
    }));
  };

  const toggleModulo = (field: string, checked: boolean) => {
    setData(prev => ({ ...prev, modulos: { ...prev.modulos, [field]: checked } }));
  };

  const extractPaletteFromLogo = (file: File): Promise<SchoolSystemRequest['escola']['palette']> => (
    new Promise(resolve => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          resolve(INITIAL_DATA.escola.palette);
          return;
        }

        canvas.width = 80;
        canvas.height = 80;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

        for (let index = 0; index < pixels.length; index += 16) {
          const alpha = pixels[index + 3];
          if (alpha < 180) continue;

          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          if (r > 238 && g > 238 && b > 238) continue;
          if (r < 18 && g < 18 && b < 18) continue;

          const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
          const current = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          current.count += 1;
          current.r += r;
          current.g += g;
          current.b += b;
          buckets.set(key, current);
        }

        const colors = Array.from(buckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(color => ({
            r: Math.round(color.r / color.count),
            g: Math.round(color.g / color.count),
            b: Math.round(color.b / color.count)
          }));

        const toHex = ({ r, g, b }: { r: number; g: number; b: number }) => (
          `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`
        );

        URL.revokeObjectURL(objectUrl);
        resolve({
          primary: colors[0] ? toHex(colors[0]) : INITIAL_DATA.escola.palette.primary,
          secondary: colors[1] ? toHex(colors[1]) : colors[0] ? toHex(colors[0]) : INITIAL_DATA.escola.palette.secondary,
          accent: colors[2] ? toHex(colors[2]) : '#f8f9fa'
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(INITIAL_DATA.escola.palette);
      };

      image.src = objectUrl;
    })
  );

  const nextStep = () => {
    if (step === 1 && !data.escola.logoUrl) {
      showAlert('Envie a imagem da logo da escola para continuar.', 'warning');
      return;
    }

    setStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!data.escola.logoUrl) {
      showAlert('A imagem da logo da escola é obrigatória.', 'warning');
      setStep(1);
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'school_system_requests'), {
        ...data,
        status: 'novo',
        origem: 'formulario_sistema_escola_minimo_operacional_escolhas',
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent
      });
      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (error: any) {
      showAlert(`Erro ao enviar solicitação: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) throw new Error('URL do Worker não configurada.');

      const palette = await extractPaletteFromLogo(file);
      const compressedLogo = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressedLogo, file.name);
      formData.append('folder', 'school_system_logos');

      const response = await fetch(`${workerUrl}/images/upload`, {
        method: 'POST',
        body: formData
      });
      const uploadResult = await response.json();
      if (!response.ok) throw new Error(uploadResult.error || 'Falha ao enviar logo.');

      const uploadedUrl = uploadResult.data?.url || uploadResult.url;
      if (!uploadedUrl) throw new Error('Upload sem URL de retorno.');

      updateEscola('logoUrl', uploadedUrl);
      updatePalette(palette);
    } catch (error: any) {
      showAlert(`Erro ao enviar logo: ${error.message}`, 'error');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const renderCheckboxes = (
    items: string[][],
    values: BooleanMap,
    onChange: (field: string, checked: boolean) => void
  ) => (
    <div className="form-group checkbox-group">
      {items.map(([field, label]) => (
        <label className="checkbox-option" key={field}>
          <input type="checkbox" checked={Boolean(values[field])} onChange={event => onChange(field, event.target.checked)} />
          <span className="checkbox-custom"></span>
          <span className="option-text">{label}</span>
        </label>
      ))}
    </div>
  );

  const renderLanding = () => (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="landing-title">SOLICITAR SISTEMA PARA ESCOLA</h1>
        <p className="landing-subtitle">
          Formulário rápido, quase todo por seleção, para mapear o mínimo operacional.
        </p>
        <button className="btn-start" type="button" onClick={() => setStep(1)}>
          INICIAR
        </button>
      </div>
    </div>
  );

  const renderSchoolStep = () => (
    <div className="form-section">
      <h2 className="section-title"><Building2 size={20} /> Escola</h2>
      <div className="form-group">
        <label>Logo da escola</label>
        {data.escola.logoUrl ? (
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <img src={data.escola.logoUrl} alt="Logo da escola" style={{ width: '96px', height: '96px', objectFit: 'contain', background: '#fff', border: '1px solid #dee2e6' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '220px' }}>
              <span style={{ color: '#006d77', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} /> Logo enviada
              </span>
              <button type="button" className="btn-nav btn-prev" onClick={() => updateEscola('logoUrl', '')} style={{ alignSelf: 'flex-start', padding: '10px 14px' }}>
                <Trash2 size={16} /> Trocar logo
              </button>
            </div>
          </div>
        ) : (
          <label className="checkbox-option" style={{ justifyContent: 'center', minHeight: '110px', borderStyle: 'dashed', cursor: uploadingLogo ? 'wait' : 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
            <Upload size={26} />
            <span className="option-text">{uploadingLogo ? 'Enviando logo...' : 'Clique para enviar a imagem da logo'}</span>
          </label>
        )}
      </div>
      <div className="form-group">
        <label>Nome da escola</label>
        <input type="text" value={data.escola.nome} onChange={event => updateEscola('nome', event.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Estado</label>
          <select value={data.escola.estado} onChange={event => updateEscola('estado', event.target.value)}>
            <option value="">Selecione</option>
            {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
              <option value={uf} key={uf}>{uf}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Tipo de operacao</label>
          <select value={data.escola.tipoOperacao} onChange={event => updateEscola('tipoOperacao', event.target.value)}>
            <option value="">Selecione</option>
            <option value="escola_esportes">Escola de esportes</option>
            <option value="clube">Clube</option>
            <option value="academia">Academia</option>
            <option value="escola_regular">Escola regular</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Quantidade aproximada de alunos</label>
        <select value={data.escola.quantidadeAlunos} onChange={event => updateEscola('quantidadeAlunos', event.target.value)}>
          <option value="">Selecione</option>
          <option value="ate_100">Até 100</option>
          <option value="101_300">101 a 300</option>
          <option value="301_700">301 a 700</option>
          <option value="mais_700">Mais de 700</option>
        </select>
      </div>
    </div>
  );

  const renderOperationStep = () => (
    <div className="form-section">
      <h2 className="section-title"><Settings size={20} /> Operação Atual</h2>
      <div className="form-group">
        <label>Modalidades / serviços</label>
        {renderCheckboxes(MODALIDADES, data.operacao.modalidades, (field, checked) => toggleNested('modalidades', field, checked))}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Quantidade aproximada de turmas</label>
          <select value={data.operacao.quantidadeTurmas} onChange={event => updateOperacao('quantidadeTurmas', event.target.value)}>
            <option value="">Selecione</option>
            <option value="ate_10">Até 10</option>
            <option value="11_30">11 a 30</option>
            <option value="31_60">31 a 60</option>
            <option value="mais_60">Mais de 60</option>
          </select>
        </div>
        <div className="form-group">
          <label>Como controla hoje?</label>
          <select value={data.operacao.ferramentaAtual} onChange={event => updateOperacao('ferramentaAtual', event.target.value)}>
            <option value="">Selecione</option>
            <option value="papel">Papel/caderno</option>
            <option value="planilhas">Planilhas</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sistema_antigo">Sistema antigo</option>
            <option value="misto">Misturado</option>
            <option value="nao_sabe">Não sabe</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Quem vai usar o sistema?</label>
        {renderCheckboxes(USUARIOS_INTERNOS, data.operacao.usuariosInternos, (field, checked) => toggleNested('usuariosInternos', field, checked))}
      </div>
    </div>
  );

  const renderModulesStep = () => (
    <div className="form-section">
      <h2 className="section-title"><ClipboardList size={20} /> Mínimo Operacional</h2>
      <div className="form-group">
        <label>Módulos desejados</label>
        {renderCheckboxes(MODULOS, data.modulos, toggleModulo)}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Maior dor hoje</label>
          <select value={data.requisitos.maiorDor} onChange={event => updateRequisitos('maiorDor', event.target.value)}>
            <option value="">Selecione</option>
            <option value="cadastro_desorganizado">Cadastro desorganizado</option>
            <option value="turmas_horarios">Turmas/horários confusos</option>
            <option value="chamada_frequencia">Chamada/frequência</option>
            <option value="financeiro_cobranca">Financeiro/cobrança</option>
            <option value="contratos_documentos">Contratos/documentos</option>
            <option value="comunicacao">Comunicação com responsáveis</option>
            <option value="relatorios">Relatórios/gestão</option>
          </select>
        </div>
        <div className="form-group">
          <label>Prazo desejado</label>
          <select value={data.requisitos.prazoDesejado} onChange={event => updateRequisitos('prazoDesejado', event.target.value)}>
            <option value="">Selecione</option>
            <option value="urgente">Urgente</option>
            <option value="30_dias">Até 30 dias</option>
            <option value="60_90_dias">60 a 90 dias</option>
            <option value="sem_prazo">Sem prazo definido</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Prioridade de implantação</label>
        <select value={data.requisitos.prioridadeImplantacao} onChange={event => updateRequisitos('prioridadeImplantacao', event.target.value)}>
          <option value="">Selecione</option>
          <option value="cadastro_turmas">Primeiro cadastro e turmas</option>
          <option value="financeiro">Primeiro financeiro</option>
          <option value="chamada">Primeiro chamada/frequência</option>
          <option value="portal">Primeiro portal do responsável</option>
          <option value="completo">Quero o pacote completo</option>
          <option value="nao_sabe">Não sabe ainda</option>
        </select>
      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="form-section">
      <h2 className="section-title"><User size={20} /> Contato</h2>
      <div className="form-group">
        <label>Nome do contato</label>
        <input type="text" value={data.contato.nome} onChange={event => updateContato('nome', event.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="tel" value={data.contato.telefone} onChange={event => updateContato('telefone', maskPhone(event.target.value))} />
        </div>
        <div className="form-group">
          <label>E-mail</label>
          <input type="email" value={data.contato.email} onChange={event => updateContato('email', event.target.value)} />
        </div>
      </div>
      <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', color: '#343a40', padding: '16px', marginTop: '8px' }}>
        O formulário pode ser enviado com campos em branco.
      </div>
    </div>
  );

  if (step === 0) return renderLanding();

  if (success) {
    return (
      <div className="uba-registration-container">
        <div className="uba-container success-container">
          <div className="success-icon-container">
            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
          <h2 className="success-title">Solicitação Enviada com Sucesso!</h2>
          <p className="success-message">Recebemos as informações operacionais da escola. Em breve entraremos em contato.</p>
          <button className="btn-nav btn-next" type="button" onClick={() => window.location.reload()}>Nova Solicitação</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container school-request-container">
      <header className="header">
        <h1 className="header-title">SOLICITAR SISTEMA PARA ESCOLA</h1>
      </header>

      <div className="progress-container">
        <div className="progress-steps">
          {STEP_LABELS.map((label, index) => {
            const currentStep = index + 1;
            return (
              <div
                key={label}
                className={`step ${step === currentStep ? 'active' : ''} ${step > currentStep ? 'completed' : ''}`}
                onClick={() => currentStep < step && setStep(currentStep)}
              >
                <div className="step-number">{currentStep}</div>
                <span className="step-label">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}></div>
        </div>
      </div>

      <form onSubmit={event => event.preventDefault()} className="contract-form school-request-form">
        {step === 1 && renderSchoolStep()}
        {step === 2 && renderOperationStep()}
        {step === 3 && renderModulesStep()}
        {step === 4 && renderContactStep()}

        <div className="form-navigation school-request-navigation">
          <button type="button" className="btn-nav btn-prev" onClick={() => (step === 1 ? setStep(0) : setStep(prev => prev - 1))}>
            <span className="arrow">&larr;</span> VOLTAR
          </button>
          {step < TOTAL_STEPS ? (
            <button type="button" className="btn-nav btn-next" onClick={nextStep}>
              Próximo <span className="arrow">&rarr;</span>
            </button>
          ) : (
            <button type="button" className="btn-nav btn-submit" disabled={loading} onClick={handleSubmit}>
              <Send size={18} /> {loading ? 'Enviando...' : 'Enviar'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
