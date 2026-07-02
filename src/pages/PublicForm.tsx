import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, Clock } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { findOrCreateTurma } from '../utils/turmaService';
import { SCHEDULE_OPTIONS } from '../utils/turmasConstants';
import SignatureCanvas from '../components/SignatureCanvas';
import { notifyPendingApprovalRegistration } from './AdminEvolutionMessages/messagingApi';

type ModalityId = 'futebol' | 'natacao' | 'voleibol' | 'hidro';

interface PublicPlan {
  id: string;
  nome?: string;
  modalidade?: string;
  active?: boolean;
  valores?: {
    mensalidade?: {
      ateVencimento?: number;
      aposVencimento?: number;
    };
    matricula?: number;
  };
}

const PLAN_COLLECTION = 'arena_simonesia_2026_plans';
const MODALITY_LABELS: Record<ModalityId, string> = {
  futebol: 'Futebol',
  natacao: 'Natação',
  voleibol: 'Voleibol',
  hidro: 'Hidroginástica'
};

const normalizeModalityId = (value?: string): ModalityId | null => {
  const normalized = (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('fut')) return 'futebol';
  if (normalized.includes('nat')) return 'natacao';
  if (normalized.includes('vol') || normalized.includes('lei')) return 'voleibol';
  if (normalized.includes('hid')) return 'hidro';
  return null;
};

// Types
interface Student {
  nome: string;
  dataNascimento: string;
  sexo: string;
  cpf: string;
  // Moved from root
  fotoUrl: string;
  documentoUrl?: string; // New field for identity document
  saude: {
    temAlergia: boolean;
    alergiaDesc: string;
    tomaMedicamento: boolean;
    medicamentoDesc: string;
    condicaoSaude: string;
    autorizadoAtividades: boolean;
  };
  turmaId?: string; // Auto-assigned class
}

interface RegistrationData {
  tipoInscricao: 'nova' | 'renovacao';
  associadoUba: boolean | null;
  numeroCota: string;

  responsavel: {
    nome: string;
    cpf: string;
    dataNascimento: string;
    telefonePrincipal: string;
    telefoneSecundario: string;
    email: string;
    endereco: {
      rua: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  };

  alunoTitularCota: boolean | null;

  modalidade: 'futebol' | 'natacao' | 'voleibol' | 'hidro' | '';

  // Voleibol specific
  planoVoleibol: 'individual' | 'casal' | 'familia' | 'nao_associado' | '';

  // Futebol specific
  categoriaFutebol: string;

  alunos: Student[];

  // fotoUrl and saude removed from root

  autorizacoes: {
    participacao: boolean;
    usoImagem: boolean;
    primeirosSocorros: boolean;
  };

  confirmacao: {
    declaracaoVerdadeira: boolean;
    assinaturaDigital: string;
    dataAssinatura: string;
  };
}

const DEFAULT_SAUDE = {
  temAlergia: false, alergiaDesc: '',
  tomaMedicamento: false, medicamentoDesc: '',
  condicaoSaude: '',
  autorizadoAtividades: true
};

const INITIAL_DATA: RegistrationData = {
  tipoInscricao: 'nova',
  associadoUba: false,
  numeroCota: '',
  responsavel: {
    nome: '', cpf: '', dataNascimento: '',
    telefonePrincipal: '', telefoneSecundario: '', email: '',
    endereco: { rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' }
  },
  alunoTitularCota: null,
  modalidade: '',
  planoVoleibol: '',
  categoriaFutebol: '',
  alunos: [],
  autorizacoes: { participacao: false, usoImagem: false, primeirosSocorros: false },
  confirmacao: { declaracaoVerdadeira: false, assinaturaDigital: '', dataAssinatura: '' }
};

const DEFAULT_STUDENT: Student = {
  nome: '',
  dataNascimento: '',
  sexo: '',
  cpf: '',
  fotoUrl: '',
  saude: { ...DEFAULT_SAUDE }
};

export default function PublicForm() {
  const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
  const { showAlert } = useDialog();
  const [step, setStep] = useState(0); // Start at 0 for Landing Page
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successSummary, setSuccessSummary] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [checkingPlans, setCheckingPlans] = useState(true);
  const [activePlans, setActivePlans] = useState<PublicPlan[]>([]);
  const [planMappings, setPlanMappings] = useState<any>(null);

  // Payment State


  // Schedules
  const [selectedSchedule, setSelectedSchedule] = useState<{ days: string[], time: string } | null>(null);

  // Credit Card State
const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');


  const [couponCode, setCouponCode] = useState(''); // Cupom de desconto
  const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [couponMessage, setCouponMessage] = useState('');
  const [hasCoupon, setHasCoupon] = useState<boolean>(false); // Controls visibility of coupon input

  // Fee Calculation Logic

  const availableModalities = React.useMemo(() => {
    const ids = new Set<ModalityId>();
    activePlans.forEach(plan => {
      const id = normalizeModalityId(plan.modalidade);
      if (id) ids.add(id);
    });
    return Array.from(ids).map(id => ({ id, label: MODALITY_LABELS[id] }));
  }, [activePlans]);

  const hasOpenPlans = activePlans.length > 0;

  const getPlanForModality = (modalidade: RegistrationData['modalidade']) => {
    if (!modalidade) return null;
    return activePlans.find(plan => normalizeModalityId(plan.modalidade) === modalidade) || null;
  };

  const getSelectedPlan = (): PublicPlan | null => {
    if (!data.modalidade) return null;
    
    // Se for Voleibol, busca pelo plano específico de voleibol selecionado
    if (data.modalidade === 'voleibol') {
      if (!data.planoVoleibol || !planMappings) {
        return activePlans.find(plan => normalizeModalityId(plan.modalidade) === 'voleibol') || null;
      }
      const mapping = planMappings['voleibol'] || {};
      const planId = mapping[data.planoVoleibol] || mapping.nonAssociate || mapping.associate || '';
      
      return activePlans.find(p => p.id === planId) || activePlans.find(plan => normalizeModalityId(plan.modalidade) === 'voleibol') || null;
    } 
    
    // Para as outras modalidades (Futebol, Natação, Hidro)
    if (planMappings) {
      const mapping = planMappings[data.modalidade] || {};
      let planId = '';
      if (typeof mapping === 'string') {
        planId = mapping;
      } else {
        planId = mapping.nonAssociate || mapping.associate || '';
      }
      const plan = activePlans.find(p => p.id === planId);
      if (plan) return plan;
    }
    
    // Fallback: pega o plano ativo geral da modalidade
    return activePlans.find(plan => normalizeModalityId(plan.modalidade) === data.modalidade) || null;
  };

  const selectedPlan = getSelectedPlan();
  const registrationFee = selectedPlan?.valores?.matricula || 0;
  const hasRegistrationFee = registrationFee > 0;

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setCheckingPlans(true);
      try {
        const plansQuery = query(collection(db, PLAN_COLLECTION), where('active', '==', true));
        const snap = await getDocs(plansQuery);
        const plans = snap.docs
          .map(planDoc => ({ id: planDoc.id, ...planDoc.data() } as PublicPlan))
          .filter(plan => normalizeModalityId(plan.modalidade) !== null);
        if (mounted) setActivePlans(plans);

        const settingsSnap = await getDoc(doc(db, 'system_settings', 'plan_auto_allocation'));
        if (settingsSnap.exists() && mounted) {
          setPlanMappings(settingsSnap.data().mappings || {});
        }
      } catch (error) {
        console.error('Erro ao carregar planos ou mapeamentos públicos:', error);
        if (mounted) setActivePlans([]);
      } finally {
        if (mounted) setCheckingPlans(false);
      }
    };

    loadPlans();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!checkingPlans && !hasOpenPlans && step !== 0) setStep(0);
  }, [checkingPlans, hasOpenPlans, step]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val / 100);
  };

  React.useEffect(() => {
    // Scroll to top when step changes
    window.scrollTo(0, 0);
  }, [step]);

  // Auto-calculate Futebol Category
  React.useEffect(() => {
    if (data.modalidade === 'futebol') {
      const birthDate = data.alunos[0]?.dataNascimento;
      if (birthDate) {
        const year = new Date(birthDate).getFullYear();
        if (!isNaN(year)) {
          const age = 2026 - year;
          let cat = '';
          if (age >= 3 && age <= 5) cat = 'INICIAÇÃO - 3, 4 e 5 anos';
          else if (age >= 6 && age <= 15) cat = `SUB ${age}`;
          else cat = 'Fora de Faixa';

          if (data.categoriaFutebol !== cat) {
            setData(prev => ({ ...prev, categoriaFutebol: cat }));
          }
        }
      }
    }
  }, [data.modalidade, data.alunos]);

  // Handlers



  // Debounce effect for coupon verification
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (couponCode.length > 3) {
        verifyCoupon();
      } else {
        setCouponStatus('idle');
        setCouponMessage('');
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [couponCode]);

  const verifyCoupon = async () => {
    if (!couponCode) return;
    setCouponStatus('loading');
    setCouponMessage('');
    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      const res = await fetch(`${workerUrl}/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode })
      });
      const data = await res.json();
      if (data.valid) {
        setCouponStatus('valid');
        setCouponMessage(data.message);
        showAlert(data.message, 'success'); // Show popup
      } else {
        setCouponStatus('invalid');
        setCouponMessage(data.message);
      }
    } catch (err) {
      console.error(err);
      setCouponStatus('invalid');
      setCouponMessage('Erro ao validar cupom.');
    }
  };

  const renderCoupleModal = () => {
    if (!showCoupleModal || data.alunos.length < 2) return null;

    return (
      <div className="modal-overlay" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)'
      }}>
        <div className="modal-content" style={{
          backgroundColor: '#fff', padding: '30px', borderRadius: '16px',
          width: '90%', maxWidth: '500px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
        }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#007d2f', fontFamily: 'sans-serif' }}>Identificação do Casal</h3>
          <p style={{ color: '#666', marginBottom: '25px' }}>Informe os nomes dos integrantes do casal para prosseguir.</p>

          <div className="form-group">
            <label style={{ color: '#333', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nome do 1º Integrante</label>
            <input
              type="text"
              value={data.alunos[0].nome}
              onChange={(e) => handleAlunoChange(0, 'nome', e.target.value)}
              placeholder="Nome completo"
              style={{ width: '100%', padding: '12px', background: '#fff', border: '2px solid #dee2e6', color: '#333', borderRadius: '8px' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label style={{ color: '#333', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nome do 2º Integrante</label>
            <input
              type="text"
              value={data.alunos[1].nome}
              onChange={(e) => handleAlunoChange(1, 'nome', e.target.value)}
              placeholder="Nome completo"
              style={{ width: '100%', padding: '12px', background: '#fff', border: '2px solid #dee2e6', color: '#333', borderRadius: '8px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCoupleModal(false)}
            style={{
              marginTop: '30px', width: '100%', padding: '15px',
              backgroundColor: '#007d2f', color: '#fff', border: 'none',
              borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(195, 34, 40, 0.2)'
            }}
          >
            Confirmar e Continuar
          </button>
        </div>
      </div>
    );
  };

  // Render Helpers
  const renderStep0 = () => (
    <div className="landing-page">
      <div className="landing-content">
        <img src="/arena-logo-transparent.png" alt={'Arena Simon\u00e9sia Logo'} className="landing-logo" />
        <h1 className="landing-title">{'CADASTRO ARENA SIMON\u00c9SIA'}</h1>
        <p className="landing-subtitle">
          {checkingPlans
            ? 'Verificando inscri\u00e7\u00f5es...'
            : hasOpenPlans
              ? 'Bem-vindo ao sistema de cadastro online da Arena Simon\u00e9sia.'
              : 'No momento, a Arena Simon\u00e9sia n\u00e3o est\u00e1 com inscri\u00e7\u00f5es abertas.'}
        </p>
        {hasOpenPlans && (
          <button className="btn-start" onClick={() => setStep(2)}>
            INICIAR INSCRIÇÃO
          </button>
        )}
        <button
          className="btn-student-access"
          onClick={() => window.location.href = '/aluno/login'}
          style={{
            marginTop: '15px',
            padding: '12px 25px',
            background: 'transparent',
            border: '2px solid #fff',
            color: '#fff',
            borderRadius: '50px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            transition: 'all 0.3s',
            backdropFilter: 'blur(5px)'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#007d2f';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#fff';
          }}
        >
          Acesso do Aluno / Responsável
        </button>
      </div>
    </div>
  );

  const maskDate = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 10);
  };

  const handleResponsavelChange = (field: string, value: string) => {
    // Magic Autocomplete
    if (field === 'nome' && value.toLowerCase() === 'autocompletar') {
      const firstAvailableModality = availableModalities.length > 0 ? availableModalities[0].id : 'futebol';
      const dummyData: RegistrationData = {
        tipoInscricao: 'nova',
        associadoUba: false,
        numeroCota: '',
        responsavel: {
          nome: 'Auto Completar Silva',
          cpf: '151.333.006-38',
          dataNascimento: '01/01/1980',
          telefonePrincipal: '(32) 99999-9999',
          telefoneSecundario: '',
          email: 'teste.auto@exemplo.com',
          endereco: {
            cep: '36830-000',
            rua: 'Rua Automática',
            numero: '100',
            bairro: 'Centro',
            cidade: 'Simonésia',
            uf: 'MG'
          }
        },
        alunoTitularCota: false,
        modalidade: firstAvailableModality as RegistrationData['modalidade'],
        planoVoleibol: firstAvailableModality === 'voleibol' ? 'individual' : '',
        categoriaFutebol: firstAvailableModality === 'futebol' ? 'SUB 10' : '',
        alunos: [
          {
            ...DEFAULT_STUDENT,
            nome: 'Aluno Teste da Silva',
            dataNascimento: '15/03/2016',
            sexo: 'M',
            cpf: '000.000.000-00',
            fotoUrl: 'https://placehold.co/400x400/png'
          }
        ],

        autorizacoes: {
          participacao: true,
          usoImagem: true,
          primeirosSocorros: true
        },
        confirmacao: {
          declaracaoVerdadeira: true,
          assinaturaDigital: 'Auto Completar Silva',
          dataAssinatura: new Date().toISOString()
        }
      };

      setData(dummyData);
      setStep(5);
      return;
    }

    let finalValue = value;
    if (field === 'email') finalValue = value.toLowerCase().trim();

    setData(prev => ({
      ...prev,
      responsavel: { ...prev.responsavel, [field]: finalValue }
    }));
  };

  const handleEnderecoChange = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      responsavel: {
        ...prev.responsavel,
        endereco: { ...prev.responsavel.endereco, [field]: value }
      }
    }));
  };


  const handleAlunoChange = (index: number, field: keyof Student, value: string) => {
    const newAlunos = [...data.alunos];
    newAlunos[index] = { ...newAlunos[index], [field]: value };
    setData(prev => ({ ...prev, alunos: newAlunos }));
  };

  const handleSaudeChange = (index: number, field: keyof Student['saude'], value: any) => {
    const newAlunos = [...data.alunos];
    newAlunos[index] = {
      ...newAlunos[index],
      saude: { ...newAlunos[index].saude, [field]: value }
    };
    setData(prev => ({ ...prev, alunos: newAlunos }));
  };

  const handleModalityChange = (modalidade: RegistrationData['modalidade']) => {
    if (!getPlanForModality(modalidade)) {
      showAlert('Esta modalidade ainda não possui plano ativo para inscrição.', 'warning');
      return;
    }

    setData(prev => {
      const newAlunos: Student[] = [{ ...DEFAULT_STUDENT }];

      return {
        ...prev,
        modalidade,
        planoVoleibol: '',
        alunos: newAlunos
      };
    });
    setSelectedSchedule(null);
  };

  const handlePlanVoleibolChange = (planoVoleibol: RegistrationData['planoVoleibol']) => {
    setData(prev => {
      let studentCount = 1;
      if (planoVoleibol === 'casal') studentCount = 2;
      if (planoVoleibol === 'familia') studentCount = 3;

      const newAlunos: Student[] = [];
      for (let i = 0; i < studentCount; i++) {
        newAlunos.push({ ...DEFAULT_STUDENT });
      }

      return {
        ...prev,
        planoVoleibol,
        alunos: newAlunos
      };
    });
  };







  /* Logic moved to inline handlers in renderStep3 mostly, but keeping addStudent here */

  const addStudent = () => {
    setData(prev => ({
      ...prev,
      alunos: [...prev.alunos, {
        nome: '', dataNascimento: '', sexo: '', cpf: '',
        fotoUrl: '', saude: { ...DEFAULT_SAUDE }
      }]
    }));
  };

  // Image Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("Nenhum arquivo selecionado cancelado pelo usuario.");
      return;
    }

    console.log("Iniciando upload...", file.name, file.type, file.size);

    setUploading(true);
    let compressedBlob: Blob;

    try {
      console.log("Comprimindo imagem...");
      compressedBlob = await compressImage(file);
      console.log("Imagem comprimida:", compressedBlob.size);
    } catch (compressError: any) {
      console.error("Erro na compressão:", compressError);
      showAlert(`Erro ao processar imagem: ${compressError.message}. Tente outra imagem.`, 'error');
      setUploading(false);
      e.target.value = ''; // Clear
      return;
    }

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) throw new Error('URL do Worker não configurada (VITE_WORKER_URL).');

      const formData = new FormData();
      formData.append('file', compressedBlob, file.name);
      formData.append('folder', 'arena_simonesia_2026_photos');

      console.log("Enviando para:", `${workerUrl}/images/upload`);
      const response = await fetch(`${workerUrl}/images/upload`, {
        method: 'POST',
        body: formData
      });

      console.log("Resposta status:", response.status);
      const uploadResult = await response.json();

      if (!response.ok) throw new Error(uploadResult.error || 'Falha no upload (Erro do servidor)');

      const uploadedUrl = uploadResult.data?.url || uploadResult.url;

      if (uploadedUrl) {
        console.log("Upload sucesso, URL:", uploadedUrl);
        setData(prev => {
          const newAlunos = [...prev.alunos];
          newAlunos[index] = { ...newAlunos[index], fotoUrl: uploadedUrl };
          return { ...prev, alunos: newAlunos };
        });
      }
    } catch (error: any) {
      console.error("Erro no upload da foto:", error);
      showAlert(`Erro ao enviar foto: ${error.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setUploading(false);
      // Clear input
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setData(prev => {
      const newAlunos = [...prev.alunos];
      newAlunos[index] = { ...newAlunos[index], fotoUrl: '' };
      return { ...prev, alunos: newAlunos };
    });
    // Resetting ref is tricky for multiple inputs. We can rely on unique IDs.
  };

  // Submit
  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlan = getSelectedPlan();
    if (!hasOpenPlans || !selectedPlan) {
      showAlert('As inscrições não estão abertas para esta modalidade no momento.', 'warning');
      setStep(0);
      return;
    }
    if (!data.confirmacao.declaracaoVerdadeira) {
      showAlert('Você deve declarar que as informações são verdadeiras.', 'warning');
      return;
    }
    if (!data.confirmacao.assinaturaDigital) {
      showAlert('Assinatura digital é obrigatória.', 'warning');
      return;
    }

    // Validation removed for Credit Card as payment is disabled

    setLoading(true);
    try {
      const netAmount = selectedPlan.valores?.matricula || 0;

      // No credit card calculation needed
      const finalAmount = netAmount;

      // Plan Auto-Assignment
      let autoPlanId = '';
      try {
        const settingsSnap = await getDoc(doc(db, 'system_settings', 'plan_auto_allocation'));
        if (settingsSnap.exists()) {
          const mappings = settingsSnap.data().mappings || {};
          const modalityMapping = mappings[data.modalidade] || {};

          if (data.modalidade === 'voleibol') {
            if (data.planoVoleibol) {
              autoPlanId = modalityMapping[data.planoVoleibol] || modalityMapping.general || modalityMapping.nonAssociate || '';
            }
          } else {
            if (typeof modalityMapping === 'string') {
              autoPlanId = modalityMapping;
            } else {
              autoPlanId = modalityMapping.general || modalityMapping.nonAssociate || modalityMapping.associate || '';
            }
          }
        }
      } catch (e) {
        console.error("Error fetching plan auto-allocation settings:", e);
      }

      // Auto-assign students to classes before saving
      const updatedAlunos = await Promise.all(data.alunos.map(async (aluno) => {
        try {
          let turmaId = '';
          if (data.modalidade === 'natacao' || data.modalidade === 'hidro' || data.modalidade === 'voleibol') {
            turmaId = await findOrCreateTurma(data.modalidade, aluno.dataNascimento, selectedSchedule?.days, selectedSchedule?.time);
          } else {
            turmaId = await findOrCreateTurma(data.modalidade, aluno.dataNascimento); // Respects auto-allocation config for Futebol
          }
          return { ...aluno, turmaId };
        } catch (e) {
          console.error("Error auto-assigning student to turma:", e);
          return aluno; // Fail gracefully
        }
      }));

      // Create registration in Firestore
      const normalizedData = {
        ...data,
        responsavel: {
          ...data.responsavel,
          email: data.responsavel.email.toLowerCase().trim()
        }
      };

      const registrationPayload = {
        ...normalizedData,
        planId: autoPlanId || selectedPlan.id,
        alunos: updatedAlunos, // Use updated students with turmaId
        status: 'confirmado', // Always confirmed, no payment wait
        paymentMethod: paymentMethod, // Save method preferences if selected
        billingType: paymentMethod,
        amount: finalAmount,
        contractStatus: 'pendente',
        horario: selectedSchedule?.time || '', // Explicitly save selected time
        dias: selectedSchedule?.days || [],    // Explicitly save selected days
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        debug_v2: true // Debug flag to identify registrations from this version
      };

      const registrationRef = await addDoc(collection(db, 'arena_simonesia_2026_registrations'), registrationPayload);

      const successPayload = {
        ...registrationPayload,
        createdAt: new Date().toISOString()
      };

      try {
        await notifyPendingApprovalRegistration(registrationRef.id, successPayload);
      } catch (error: any) {
        console.error('Erro ao disparar gatilho de cadastro para aprovação:', error);
        showAlert(`Cadastro salvo, mas a mensagem administrativa não foi enviada: ${error.message || 'erro desconhecido'}`, 'error');
        return;
      }

      // NO PAYMENT GENERATION - ASAAS DISABLED
      // Directly go to success
      setSuccessSummary({ id: registrationRef.id, ...successPayload });
      setSuccess(true);
      window.scrollTo(0, 0);

    } catch (error: any) {
      console.error('Error saving document:', error);
      showAlert(`Erro ao realizar inscrição: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };




  // Masks
  const maskCPF = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 11);
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  // CEP Search
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    const maskedCep = maskCEP(cep);

    // Update state first
    handleEnderecoChange('cep', maskedCep);

    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setData(prev => ({
            ...prev,
            responsavel: {
              ...prev.responsavel,
              endereco: {
                ...prev.responsavel.endereco,
                rua: data.logradouro,
                bairro: data.bairro,
                cidade: data.localidade,
                uf: data.uf,
                cep: maskedCep
              }
            }
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  // Render Helpers





  const renderStep2 = () => (
    <div className="form-section">
      <h2 className="section-title">Identificação e Responsável</h2>





      <h3 style={{ textTransform: 'uppercase', textAlign: 'center', margin: '20px 0', color: '#000' }}>Dados do Responsável</h3>
      <div className="form-group">
        <label>Nome Completo:</label>
        <input type="text" value={data.responsavel.nome}
          onChange={(e) => handleResponsavelChange('nome', e.target.value)} required />
      </div>
      <div className="form-row">
        <div className="form-col">
          <label>CPF:</label>
          <input type="text" value={data.responsavel.cpf}
            maxLength={14}
            onChange={(e) => handleResponsavelChange('cpf', maskCPF(e.target.value))} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-col">
          <label>Data Nasc.:</label>
          <input type="text" value={data.responsavel.dataNascimento}
            maxLength={10}
            placeholder="DD/MM/AAAA"
            onChange={(e) => handleResponsavelChange('dataNascimento', maskDate(e.target.value))} required />
        </div>
        <div className="form-col">
          <label>Celular (WhatsApp):</label>
          <input type="tel" value={data.responsavel.telefonePrincipal}
            maxLength={15}
            onChange={(e) => handleResponsavelChange('telefonePrincipal', maskPhone(e.target.value))} required />
        </div>
      </div>
      <div className="form-group">
        <label>Email:</label>
        <input type="email" value={data.responsavel.email}
          onChange={(e) => handleResponsavelChange('email', e.target.value)} required />
      </div>

      <h3>Endereço</h3>
      <div className="form-row">
        <div className="form-col">
          <label>CEP:</label>
          <input type="text" value={data.responsavel.endereco.cep}
            maxLength={9}
            onChange={handleCepChange} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-col" style={{ flex: 2 }}>
          <label>Rua/Av:</label>
          <input type="text" value={data.responsavel.endereco.rua}
            onChange={(e) => handleEnderecoChange('rua', e.target.value)} required />
        </div>
        <div className="form-col">
          <label>Número:</label>
          <input type="text" value={data.responsavel.endereco.numero}
            onChange={(e) => handleEnderecoChange('numero', e.target.value)} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-col">
          <label>Bairro:</label>
          <input type="text" value={data.responsavel.endereco.bairro}
            onChange={(e) => handleEnderecoChange('bairro', e.target.value)} required />
        </div>
        <div className="form-col">
          <label>Cidade:</label>
          <input type="text" value={data.responsavel.endereco.cidade}
            onChange={(e) => handleEnderecoChange('cidade', e.target.value)} required />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="form-section">
      <h2 className="section-title" style={{ justifyContent: 'center', textTransform: 'uppercase', color: '#000' }}>Modalidade e Plano</h2>

      <div className="animate-fade-in">
        <div className="form-group">
          <label>Escolha a Modalidade:</label>
              <div className="modality-grid">
                {availableModalities.map(m => (
                  <div key={m.id}
                    className={`modality-card ${data.modalidade === m.id ? 'selected' : ''}`}
                    onClick={() => handleModalityChange(m.id as any)}>
                    <span className="modality-icon"></span>
                    <strong>{m.label}</strong>
                  </div>
                ))}
              </div>
              {availableModalities.length === 0 && (
                <div style={{ marginTop: '12px', color: '#dc2626', fontWeight: 800 }}>
                  Nenhuma modalidade com plano ativo no momento.
                </div>
              )}

              {/* SCHEDULE SELECTION FOR NATACAO/HIDRO/VOLEIBOL */}
              {(data.modalidade === 'natacao' || data.modalidade === 'hidro' || data.modalidade === 'voleibol') && (
                <div style={{ marginBottom: '30px', background: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <h3 style={{ color: '#0369a1', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} /> Escolha seu Horário
                  </h3>
                  <p style={{ color: '#0c4a6e', marginBottom: '15px' }}>Selecione o dia e horário de preferência:</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {(Object.values(SCHEDULE_OPTIONS[data.modalidade as 'natacao' | 'hidro'] || {}) as any[]).map((opt: any, idx: number) => (
                      <div key={idx} className="schedule-group">
                        <p style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#007d2f', marginBottom: '8px' }}>
                          {opt.days.join(' & ')}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {opt.times.map((t: string) => {
                            const isSelected = selectedSchedule?.time === t && selectedSchedule?.days.join(',') === opt.days.join(',');
                            return (
                              <button
                                key={t}
                                type="button"
                                className={`schedule-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => setSelectedSchedule({ days: opt.days, time: t })}
                                style={{
                                  padding: '8px 16px',
                                  border: isSelected ? '2px solid #007d2f' : '1px solid #ccc',
                                  background: isSelected ? '#e9f8ef' : '#fff',
                                  color: isSelected ? '#007d2f' : '#333',
                                  borderRadius: '20px',
                                  cursor: 'pointer',
                                  fontWeight: isSelected ? 'bold' : 'normal',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!selectedSchedule && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#dc2626', fontWeight: 'bold' }}>
                      * Seleção de horário obrigatória
                    </div>
                  )}
                </div>
              )}

              {/* Input Cupom */}
              {(data.modalidade === 'natacao' || data.modalidade === 'hidro') && (
                <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>
                    Você possui um cupom de desconto? <span style={{ fontWeight: 'normal', color: '#666', fontSize: '0.9rem' }}>(Opcional)</span>
                  </label>

                  <div style={{ display: 'flex', gap: '15px', marginBottom: hasCoupon ? '15px' : '0' }}>
                    <button type="button"
                      onClick={() => { setHasCoupon(true); }}
                      style={{
                        padding: '10px 20px', borderRadius: '20px', border: hasCoupon === true ? '2px solid #007d2f' : '1px solid #ddd',
                        background: hasCoupon === true ? '#e9f8ef' : '#fff', color: hasCoupon === true ? '#007d2f' : '#666',
                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                      SIM
                    </button>
                    <button type="button"
                      onClick={() => {
                        setHasCoupon(false);
                        setCouponCode('');
                      }}
                      style={{
                        padding: '10px 20px', borderRadius: '20px', border: hasCoupon === false ? '2px solid #007d2f' : '1px solid #ddd',
                        background: hasCoupon === false ? '#e9f8ef' : '#fff', color: hasCoupon === false ? '#007d2f' : '#666',
                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                      NÃO
                    </button>
                  </div>

                  {hasCoupon && (
                    <div className="animate-fade-in">
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#666' }}>
                        Digite seu código abaixo:
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          style={{
                            flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none',
                            borderColor: couponStatus === 'valid' ? '#2e7d32' : (couponStatus === 'invalid' ? '#d32f2f' : '#ddd'),
                            background: couponStatus === 'valid' ? '#f0fdf4' : (couponStatus === 'invalid' ? '#fef2f2' : '#fff')
                          }}
                        />
                      </div>
                      {couponStatus === 'loading' && <span style={{ fontSize: '0.8rem', color: '#666' }}>Verificando...</span>}
                      {couponStatus === 'valid' && (
                        <div style={{ display: 'flex', alignItems: 'center', color: '#2e7d32', gap: '5px', fontWeight: 'bold', marginTop: '5px' }}>
                          <CheckCircle size={20} />
                          <span>{couponMessage}</span>
                        </div>
                      )}
                      {couponStatus === 'invalid' && (
                        <div style={{ display: 'flex', alignItems: 'center', color: '#d32f2f', gap: '5px', fontWeight: 'bold', marginTop: '5px' }}>
                          <span style={{ fontSize: '1.2rem' }}>x</span>
                          <span>{couponMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SELEÇÃO DE PLANO VOLEIBOL */}
              {data.modalidade === 'voleibol' && (
                <div style={{ marginBottom: '30px', background: '#fff1f0', padding: '20px', borderRadius: '12px', border: '1px solid #ffccc7' }}>
                  <h3 style={{ color: '#007d2f', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Escolha seu Plano de Voleibol
                  </h3>
                  <p style={{ color: '#007d2f', marginBottom: '15px' }}>Selecione o plano desejado para continuar:</p>

                  <div className="modality-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    {[
                      { id: 'individual', label: 'Individual', price: 'R$ 60' },
                      { id: 'casal', label: 'Casal', price: 'R$ 90' },
                      { id: 'familia', label: 'Família', price: 'R$ 120' }
                    ].map(p => (
                      <div key={p.id}
                        className={`modality-card ${data.planoVoleibol === p.id ? 'selected' : ''}`}
                        onClick={() => handlePlanVoleibolChange(p.id as any)}
                        style={{ height: 'auto', padding: '15px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>PLANO</div>
                        <strong>{p.label}</strong>
                        <div style={{ color: '#007d2f', fontWeight: 'bold', marginTop: '8px' }}>{p.price}</div>
                      </div>
                    ))}
                  </div>

                  {!data.planoVoleibol && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#dc2626', fontWeight: 'bold' }}>
                      * Seleção de plano obrigatória
                    </div>
                  )}
                </div>
              )}

              {/* Price Info Display - Dynamic from plan */}
              {data.modalidade && selectedPlan && (
                <div className="animate-fade-in" style={{ marginTop: '20px' }}>
                  <div className="price-info-card" style={{ background: '#ecfdf5', padding: '15px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <h4 style={{ color: '#047857', margin: '0 0 10px 0' }}>VALORES – {MODALITY_LABELS[data.modalidade as ModalityId]?.toUpperCase() || data.modalidade.toUpperCase()}</h4>
                    <div>
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '8px', color: '#333' }}>
                        {selectedPlan.valores?.mensalidade?.ateVencimento != null && (
                          <li>• Mensalidade (até vencimento): <strong>{formatCurrency(selectedPlan.valores.mensalidade.ateVencimento)}</strong></li>
                        )}
                        {selectedPlan.valores?.mensalidade?.aposVencimento != null && (
                          <li>• Mensalidade (após vencimento): <strong>{formatCurrency(selectedPlan.valores.mensalidade.aposVencimento)}</strong></li>
                        )}
                        {selectedPlan.valores?.matricula != null && selectedPlan.valores.matricula > 0 && (
                          <li>• Taxa de Inscrição: <strong>{formatCurrency(selectedPlan.valores.matricula)}</strong></li>
                        )}
                        {!selectedPlan.valores?.mensalidade?.ateVencimento && !selectedPlan.valores?.mensalidade?.aposVencimento && !selectedPlan.valores?.matricula && (
                          <li style={{ color: '#666', fontStyle: 'italic' }}>Valores não configurados para este plano.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

        {data.modalidade && (
          <div className="animate-fade-in" style={{ marginTop: '30px', borderTop: '2px solid #eee', paddingTop: '20px' }}>
            <h3 style={{ color: '#007d2f', marginBottom: '15px' }}>Dados do(s) Aluno(s)</h3>
            {data.alunos.map((aluno, index) => (
              <div key={index} className="student-block" style={{ marginBottom: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '10px', color: '#666' }}>Aluno {index + 1}</h4>
                <div className="form-group">
                  <label>Nome Completo:</label>
                  <input type="text" value={aluno.nome}
                    onChange={(e) => handleAlunoChange(index, 'nome', e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-col">
                    <label>Data Nascimento:</label>
                    <input type="text" value={aluno.dataNascimento}
                      maxLength={10}
                      placeholder="DD/MM/AAAA"
                      onChange={(e) => handleAlunoChange(index, 'dataNascimento', maskDate(e.target.value))} required />
                  </div>
                  <div className="form-col">
                    <label>Sexo:</label>
                    <select value={aluno.sexo} onChange={(e) => handleAlunoChange(index, 'sexo', e.target.value)} required>
                      <option value="">Selecione...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>CPF do Aluno:</label>
                  <input
                    type="text"
                    value={aluno.cpf}
                    maxLength={14}
                    onChange={(e) => handleAlunoChange(index, 'cpf', maskCPF(e.target.value))}
                    required
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addStudent}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                marginTop: '20px',
                backgroundColor: 'transparent',
                border: '2px dashed #007d2f',
                color: '#007d2f',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e9f8ef'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              + CADASTRAR MAIS UM ALUNO
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="form-section">
      <h2 className="section-title">Foto e Saúde</h2>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
        Por favor, envie uma foto recente (rosto) e preencha as informações de saúde para <strong>cada associado</strong> listado abaixo.
      </p>

      {data.alunos.map((aluno, index) => (
        <div key={index} className="student-health-block animate-fade-in" style={{ marginBottom: '40px', background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#007d2f', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
            {index + 1}. {aluno.nome || `Aluno ${index + 1}`}
          </h3>

          {/* Photo */}
          <div className="form-group photo-group" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Rosto */}
            <div className="photo-section-card" style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '10px', background: '#fff' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', color: '#333', marginBottom: '15px' }}>
                <Camera size={24} color="#333" />
                Foto do Aluno (Rosto)
              </label>

              <div className="photo-upload-container">
                {aluno.fotoUrl ? (
                  <div className="photo-preview" style={{ width: '150px', height: '150px', margin: '0 auto', border: '4px solid #007d2f', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                    <img src={aluno.fotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" className="btn-remove-photo" onClick={() => removePhoto(index)}
                      style={{
                        position: 'absolute', bottom: '0', left: '0', right: '0',
                        background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px',
                        padding: '5px', cursor: 'pointer', fontSize: '0.8rem'
                      }}>
                      <Camera size={14} /> Trocar
                    </button>
                  </div>
                ) : (
                  <div className="photo-upload" style={{ textAlign: 'center' }}>
                    <input type="file" id={`foto-upload-${index}`}
                      accept="image/*"
                      onChange={(e) => {
                        console.log('File input changed', e.target.files);
                        handlePhotoUpload(e, index);
                      }}
                      style={{ display: 'none' }} />

                    <label htmlFor={`foto-upload-${index}`} className="upload-label" style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                      padding: '30px', border: '2px dashed #007d2f', borderRadius: '10px',
                      cursor: 'pointer', background: '#e9f8ef'
                    }}>
                      <Camera size={48} color="#007d2f" />
                      <span style={{ color: '#007d2f', fontWeight: 'bold' }}>{uploading ? 'Enviando...' : 'Clique aqui para tirar ou enviar foto'}</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Health Info */}
          <div className="health-section" style={{ marginTop: '30px' }}>
            <h4 style={{ color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Informações de Saúde
            </h4>
            <div className="form-group">
              <label>Possui Alguma Alergia?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input type="radio" checked={aluno.saude.temAlergia === true} onChange={() => handleSaudeChange(index, 'temAlergia', true)} />
                  <span className="radio-custom"></span> Sim
                </label>
                <label className="radio-option">
                  <input type="radio" checked={aluno.saude.temAlergia === false} onChange={() => handleSaudeChange(index, 'temAlergia', false)} />
                  <span className="radio-custom"></span> Não
                </label>
              </div>
              {aluno.saude.temAlergia && (
                <input type="text" placeholder="Qual?" value={aluno.saude.alergiaDesc}
                  onChange={(e) => handleSaudeChange(index, 'alergiaDesc', e.target.value)} required />
              )}
            </div>

            <div className="form-group">
              <label>Toma Medicamento Contínuo?</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input type="radio" checked={aluno.saude.tomaMedicamento === true} onChange={() => handleSaudeChange(index, 'tomaMedicamento', true)} />
                  <span className="radio-custom"></span> Sim
                </label>
                <label className="radio-option">
                  <input type="radio" checked={aluno.saude.tomaMedicamento === false} onChange={() => handleSaudeChange(index, 'tomaMedicamento', false)} />
                  <span className="radio-custom"></span> Não
                </label>
              </div>
              {aluno.saude.tomaMedicamento && (
                <input type="text" placeholder="Qual?" value={aluno.saude.medicamentoDesc}
                  onChange={(e) => handleSaudeChange(index, 'medicamentoDesc', e.target.value)} required />
              )}
            </div>

            <div className="form-group">
              <label>Alguma Condição Médica Relevante?</label>
              <textarea value={aluno.saude.condicaoSaude} placeholder="Opcional"
                onChange={(e) => handleSaudeChange(index, 'condicaoSaude', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep5 = () => (
    <div className="form-section">
      <h2 className="section-title">Autorizações e Confirmação</h2>

      <div className="form-group checkbox-group">
        <label className="checkbox-option">
          <input type="checkbox" checked={data.autorizacoes.participacao}
            onChange={(e) => setData(p => ({ ...p, autorizacoes: { ...p.autorizacoes, participacao: e.target.checked } }))} />
          <span className="checkbox-custom"></span>
          <span className="option-text">Autorizo a participação nas atividades esportivas.</span>
        </label>
        <label className="checkbox-option">
          <input type="checkbox" checked={data.autorizacoes.usoImagem}
            onChange={(e) => setData(p => ({ ...p, autorizacoes: { ...p.autorizacoes, usoImagem: e.target.checked } }))} />
          <span className="checkbox-custom"></span>
          <span className="option-text">Autorizo o uso de imagem para fins de divulgação do clube.</span>
        </label>
        <label className="checkbox-option">
          <input type="checkbox" checked={data.autorizacoes.primeirosSocorros}
            onChange={(e) => setData(p => ({ ...p, autorizacoes: { ...p.autorizacoes, primeirosSocorros: e.target.checked } }))} />
          <span className="checkbox-custom"></span>
          <span className="option-text">Autorizo a prestação de primeiros socorros se necessário.</span>
        </label>
      </div>



      <hr />

      <div className="form-group">
        <label className="checkbox-option">
          <input type="checkbox" checked={data.confirmacao.declaracaoVerdadeira}
            onChange={(e) => setData(p => ({ ...p, confirmacao: { ...p.confirmacao, declaracaoVerdadeira: e.target.checked } }))} required />
          <span className="checkbox-custom"></span>
          <span className="option-text">Declaro que as informações acima são verdadeiras.</span>
        </label>
      </div>

      <div className="form-group">
        <label>Assinatura Digital:</label>
        <SignatureCanvas
          showConfirmButton={false}
          autoConfirm={true}
          onConfirm={(signatureDataUrl) => setData(p => ({
            ...p,
            confirmacao: {
              ...p.confirmacao,
              assinaturaDigital: signatureDataUrl,
              dataAssinatura: new Date().toISOString()
            }
          }))}
          onClear={() => setData(p => ({
            ...p,
            confirmacao: {
              ...p.confirmacao,
              assinaturaDigital: '',
              dataAssinatura: ''
            }
          }))}
        />
        {data.confirmacao.assinaturaDigital && (
          <div style={{ marginTop: '10px', color: '#007d2f', fontWeight: 'bold', fontSize: '0.9rem' }}>
            Assinatura salva.
          </div>
        )}
      </div>

      <div className="form-navigation">
        <button type="button" className="btn-nav btn-prev" onClick={() => setStep(step - 1)} disabled={loading}>
          ← Voltar
        </button>
        {registrationFee > 0 ? (
          <button type="button" className="btn-nav btn-next" onClick={() => handleNextStep(6)} disabled={loading}>
            Ir para Pagamento <span className="arrow">→</span>
          </button>
        ) : (
          <button type="submit" className="btn-nav btn-submit" disabled={loading}>
            {loading ? 'Processando...' : 'Confirma Inscrição'}
          </button>
        )}
      </div>
    </div>
  );

  const renderStep6 = () => {
    const selectedPlan = getSelectedPlan();
    const registrationFee = selectedPlan?.valores?.matricula || 0;
    const planLabel = selectedPlan?.nome || (data.planoVoleibol ? (data.planoVoleibol.charAt(0).toUpperCase() + data.planoVoleibol.slice(1)) : '') || MODALITY_LABELS[data.modalidade as ModalityId] || '';

    return (
      <div className="form-section">
        <h2 className="section-title">Pagamento</h2>
        {registrationFee > 0 && (
          <div style={{ marginTop: '20px' }}>

            <div style={{
              background: '#f8f9fa',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e9ecef',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#444', marginBottom: '5px', fontSize: '1.1rem' }}>Resumo do Pedido</h3>
              <p style={{ fontSize: '1.1rem', color: '#666' }}>Plano: <strong>{planLabel}</strong></p>
              <p style={{ fontSize: '1.15rem', color: '#666', marginTop: '5px' }}>Taxa de Inscrição</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#006d77', marginTop: '5px' }}>
                {formatCurrency(registrationFee)}
              </p>
            </div>

            <h3 style={{ color: '#007d2f', marginBottom: '20px' }}>
              Forma de Pagamento
            </h3>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="button" onClick={() => setPaymentMethod('PIX')}
                  style={{
                    flex: 1,
                    padding: '15px',
                    border: paymentMethod === 'PIX' ? '2px solid #007d2f' : '1px solid #ddd',
                    borderRadius: '8px',
                    background: paymentMethod === 'PIX' ? '#e9f8ef' : '#fff',
                    fontWeight: 'bold',
                    color: paymentMethod === 'PIX' ? '#007d2f' : '#666',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}>
                  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor">
                    <title>Pix</title>
                    <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
                  </svg>
                  <span>PIX (A vista)</span>
                </button>


              </div>
            </div>


          </div>
        )
        }

        <div className="form-navigation">
          <button type="button" className="btn-nav btn-prev" onClick={() => setStep(5)} disabled={loading}>
            ← Voltar
          </button>
          <button type="submit" className="btn-nav btn-submit" disabled={loading}>
            {loading ? 'Processando...' : 'Finalizar Inscrição'}
          </button>
        </div>

      </div >
    );
  };



  if (step === 0) {
    return renderStep0();
  }

  if (success) {
    const summary = successSummary || data;
    const summaryResponsavel = summary.responsavel || data.responsavel;
    const summaryAlunos = Array.isArray(summary.alunos) ? summary.alunos : data.alunos;
    const summaryDias = Array.isArray(summary.dias) ? summary.dias.join(', ') : (summary.dias || selectedSchedule?.days?.join(', ') || 'Não informado');

    return (
      <div className="uba-registration-container">
        <div className="uba-container success-container success-container-with-summary">
          <div className="success-icon-container">
            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
          <h2 className="success-title">Inscrição Realizada com Sucesso!</h2>
          <p className="success-message">Seus dados foram enviados para a secretaria da Arena Simonésia. Em breve entraremos em contato.</p>

          <div className="success-summary-card">
            <div className="success-summary-header">
              <span>Resumo da ficha</span>
              {summary.id && <small>Protocolo: {summary.id}</small>}
            </div>
            <div className="success-summary-grid">
              <div><strong>Responsável</strong><span>{summaryResponsavel.nome || 'Não informado'}</span></div>
              <div><strong>Telefone</strong><span>{summaryResponsavel.telefonePrincipal || 'Não informado'}</span></div>
              <div><strong>Modalidade</strong><span>{summary.modalidade ? String(summary.modalidade).toUpperCase() : 'FUTEBOL'}</span></div>
              <div><strong>Horário</strong><span>{summary.horario || selectedSchedule?.time || 'Não informado'}</span></div>
              <div><strong>Dias</strong><span>{summaryDias}</span></div>
              <div><strong>Status</strong><span>Aguardando aprovação</span></div>
            </div>
            <div className="success-athletes-list">
              {summaryAlunos.map((aluno: any, index: number) => (
                <div className="success-athlete-item" key={`${aluno.nome || 'atleta'}-${index}`}>
                  {aluno.fotoUrl ? <img src={aluno.fotoUrl} alt={aluno.nome || 'Atleta'} /> : <div className="success-athlete-photo-fallback">{index + 1}</div>}
                  <div>
                    <strong>{aluno.nome || `Atleta ${index + 1}`}</strong>
                    <span>Nascimento: {aluno.dataNascimento || 'Não informado'}</span>
                    <span>CPF: {aluno.cpf || 'Não informado'}</span>
                    <span>Saúde: {aluno.saude?.condicaoSaude || aluno.saude?.alergiaDesc || aluno.saude?.medicamentoDesc || 'Sem observações informadas'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-nav btn-next" onClick={() => window.location.reload()}>Nova Inscrição</button>
        </div>
      </div>
    )
  }


  const validateCurrentStep = (currentStep: number) => {
    if (currentStep === 2) {
      if (!data.responsavel.nome || !data.responsavel.cpf || !data.responsavel.dataNascimento || !data.responsavel.telefonePrincipal || !data.responsavel.email) {
        showAlert('Por favor, preencha todos os dados pessoais do responsável.', 'warning');
        return;
      }
      if (!data.responsavel.endereco.cep || !data.responsavel.endereco.rua || !data.responsavel.endereco.numero || !data.responsavel.endereco.bairro || !data.responsavel.endereco.cidade) {
        showAlert('Por favor, preencha o endereço completo.', 'warning');
        return;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!data.modalidade) {
        showAlert('Selecione uma modalidade.', 'warning');
        return;
      }
      if (data.modalidade === 'voleibol' && !data.planoVoleibol) {
        showAlert('Selecione um plano de Voleibol.', 'warning');
        return;
      }

      // Check for Coupon requirement
      if ((data.modalidade === 'natacao' || data.modalidade === 'hidro') && hasCoupon && !couponCode) {
        showAlert('Por favor, informe o código do cupom ou selecione "NÃO".', 'warning');
        return;
      }

      // Validate Students
      if (data.alunos.length === 0) {
        showAlert('É necessário cadastrar pelo menos um aluno.', 'warning');
        return;
      }
      for (let i = 0; i < data.alunos.length; i++) {
        const a = data.alunos[i];
        if (!a.nome || !a.dataNascimento || !a.sexo || (!a.cpf && data.modalidade !== 'natacao')) {
          showAlert(`Por favor, preencha todos os dados do Aluno ${i + 1}.`, 'warning');
          return;
        }
      }
      return true;
    }
    if (currentStep === 4) {
      for (let i = 0; i < data.alunos.length; i++) {
        if (!data.alunos[i].fotoUrl) {
          showAlert(`É obrigatório enviar a foto do aluno ${i + 1} (${data.alunos[i].nome || 'Nome não informado'}).`, 'warning');
          return;
        }
      }
      return true;
    }
    return true;
  };

  const handleNextStep = (nextStep: number) => {
    if (validateCurrentStep(step)) {
      setStep(nextStep);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="container">
      {loading && (
        <div className="public-form-loading-overlay" role="status" aria-live="polite" aria-label="Processando inscrição">
          <div className="public-form-loading-card">
            <span className="public-form-loading-spinner" aria-hidden="true" />
            <strong>Processando...</strong>
            <span>Aguarde enquanto finalizamos sua inscrição.</span>
          </div>
        </div>
      )}

      <header className="header">
        <img src="/arena-logo-transparent.png" alt={'Arena Simon\u00e9sia Logo'} className="header-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
        <h1 className="header-title">{'CADASTRO ARENA SIMON\u00c9SIA'}</h1>
      </header>

      {!success && (
        <div className="progress-container">
          <div className="progress-steps">
            {(hasRegistrationFee ? [2, 3, 4, 5, 6] : [2, 3, 4, 5]).map((s, idx) => (
              <div key={s} className={`step ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''} ${s === 6 && step === 6 ? 'final-step' : ''}`} onClick={() => s < step && setStep(s)}>
                <div className="step-number">{idx + 1}</div>
                <span className="step-label">
                  {s === 2 ? 'Responsável' : s === 3 ? 'Mod. e Alunos' : s === 4 ? 'Foto/Saúde' : s === 5 ? 'Consentimento' : 'Pagamento'}
                </span>
              </div>
            ))}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((step - 2) / ((hasRegistrationFee ? 6 : 5) - 2)) * 100}%` }}></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="contract-form public-registration-form">

        {step === 2 && (
          <>
            {renderStep2()}
            <div className="form-navigation">
              <button type="button" className="btn-nav btn-prev" onClick={() => setStep(0)}>
                <span className="arrow">←</span> VOLTAR
              </button>
              <button type="button" className="btn-nav btn-next" onClick={() => handleNextStep(3)}>
                Próximo <span className="arrow">→</span>
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            {renderStep3()}
            <div className="form-navigation">
              <button type="button" className="btn-nav btn-prev" onClick={() => setStep(2)}>
                <span className="arrow">←</span> VOLTAR
              </button>
              <button type="button" className="btn-nav btn-next"
                onClick={() => handleNextStep(4)}>
                Próximo <span className="arrow">→</span>
              </button>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            {renderStep4()}
            <div className="form-navigation">
              <button type="button" className="btn-nav btn-prev" onClick={() => setStep(3)}>
                <span className="arrow">←</span> VOLTAR
              </button>
              <button type="button" className="btn-nav btn-next" onClick={() => handleNextStep(5)}>
                Próximo <span className="arrow">→</span>
              </button>
            </div>
          </>
        )}
        {step === 5 && !success && renderStep5()}
        {step === 6 && !success && renderStep6()}

      </form>
      {renderCoupleModal()}
    </div>
  );
}
