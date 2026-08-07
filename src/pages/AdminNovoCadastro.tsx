import React, { useState } from 'react';
import { useLoading } from '../components/LoadingService';
import { Camera, FileText, Trash2, Save, Users, CreditCard, Heart, MapPin, Check } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { findOrCreateTurma } from '../utils/turmaService';
import { SCHEDULE_OPTIONS } from '../utils/turmasConstants';
import { normalizeNameKey } from '../utils/nameUtils';
import { resolveSafeResponsavelEmail } from '../utils/responsavelIdentity';

// Types
interface Student {
    nome: string;
    dataNascimento: string;
    sexo: string;
    cpf: string;
    fotoUrl: string;
    documentoUrl?: string;
    saude: {
        temAlergia: boolean;
        alergiaDesc: string;
        tomaMedicamento: boolean;
        medicamentoDesc: string;
        condicaoSaude: string;
    };
    turmaId?: string;
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
    planoVoleibol: 'individual' | 'casal' | 'familia' | '';
    categoriaFutebol: string;
    alunos: Student[];
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
    condicaoSaude: ''
};

const DEFAULT_STUDENT: Student = {
    nome: '',
    dataNascimento: '',
    sexo: '',
    cpf: '',
    fotoUrl: '',
    saude: { ...DEFAULT_SAUDE }
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
    alunos: [{ ...DEFAULT_STUDENT }],
    autorizacoes: { participacao: true, usoImagem: true, primeirosSocorros: true },
    confirmacao: { declaracaoVerdadeira: true, assinaturaDigital: 'ADMINISTRATIVO', dataAssinatura: '' }
};

const AdminNovoCadastro: React.FC = () => {
    const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
    const { showAlert } = useDialog();
    const { setLoading: setGlobalLoading } = useLoading();
    const [selectedSchedule, setSelectedSchedule] = useState<{ days: string[], time: string } | null>(null);

    // Masks
    const maskCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');
    const maskPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
    const maskCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
    const maskDate = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 10);

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const cep = e.target.value.replace(/\D/g, '');
        const maskedCep = maskCEP(cep);
        setData(prev => ({ ...prev, responsavel: { ...prev.responsavel, endereco: { ...prev.responsavel.endereco, cep: maskedCep } } }));

        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const result = await response.json();
                if (!result.erro) {
                    setData(prev => ({
                        ...prev,
                        responsavel: {
                            ...prev.responsavel,
                            endereco: {
                                ...prev.responsavel.endereco,
                                rua: result.logradouro,
                                bairro: result.bairro,
                                cidade: result.localidade,
                                uf: result.uf,
                                cep: maskedCep
                            }
                        }
                    }));
                }
            } catch (error) { console.error('Erro ao buscar CEP:', error); }
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number, isDoc = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            let fileToSend: Blob = file;
            if (file.type.startsWith('image/')) {
                fileToSend = await compressImage(file);
            }

            const formData = new FormData();
            formData.append('file', fileToSend, file.name);
            formData.append('folder', isDoc ? 'rumo_ao_esporte_2026_docs' : 'rumo_ao_esporte_2026_photos');

            const workerUrl = import.meta.env.VITE_WORKER_URL;
            const res = await fetch(`${workerUrl}/images/upload`, { method: 'POST', body: formData });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Falha no upload');

            const uploadedUrl = result.data?.url || result.url;
            if (uploadedUrl) {
                setData(prev => {
                    const newAlunos = [...prev.alunos];
                    if (isDoc) newAlunos[index] = { ...newAlunos[index], documentoUrl: uploadedUrl };
                    else newAlunos[index] = { ...newAlunos[index], fotoUrl: uploadedUrl };
                    return { ...prev, alunos: newAlunos };
                });
            }
        } catch (error) {
            const err = error as Error;
            showAlert(`Erro no upload: ${err.message}`, 'error');
        } finally {
            e.target.value = '';
        }
    };

    const addStudent = () => setData(prev => ({ ...prev, alunos: [...prev.alunos, { ...DEFAULT_STUDENT }] }));
    const removeStudent = (idx: number) => {
        if (data.alunos.length === 1) return;
        setData(prev => ({ ...prev, alunos: prev.alunos.filter((_, i) => i !== idx) }));
    };

    const handlePlanChange = (plan: RegistrationData['planoVoleibol']) => {
        let count = 0;
        switch (plan) {
            case 'individual': count = 1; break;
            case 'casal': count = 2; break;
            case 'familia': count = 3; break;
        }

        setData(prev => {
            let newAlunos = [...prev.alunos];
            if (count > 0) {
                if (newAlunos.length < count) {
                    const toAdd = count - newAlunos.length;
                    for (let i = 0; i < toAdd; i++) {
                        newAlunos.push({ ...DEFAULT_STUDENT });
                    }
                } else if (newAlunos.length > count) {
                    newAlunos = newAlunos.slice(0, count);
                }
            }
            return { ...prev, planoVoleibol: plan, alunos: newAlunos };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.modalidade) return showAlert('Selecione a modalidade.', 'warning');

        setGlobalLoading(true, 'ENVIANDO CADASTRO...', 0);

        // Progress simulation
        const startTime = Date.now();
        const minDuration = 4000;
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min((elapsed / minDuration) * 100, 95); // Reach max 95% until finished
            setGlobalLoading(true, 'ENVIANDO CADASTRO...', p);
        }, 50);

        try {
            const updatedAlunos = await Promise.all(data.alunos.map(async (aluno) => {
                let turmaId = '';
                if (data.modalidade === 'natacao' || data.modalidade === 'hidro') {
                    turmaId = await findOrCreateTurma(data.modalidade, aluno.dataNascimento, selectedSchedule?.days, selectedSchedule?.time);
                } else {
                    turmaId = await findOrCreateTurma(data.modalidade, aluno.dataNascimento); // Respects auto-allocation config for Futebol
                }
                return { ...aluno, turmaId };
            }));

            await addDoc(collection(db, 'rumo_ao_esporte_2026_registrations'), {
                ...data,
                responsavel: {
                    ...data.responsavel,
                    email: await resolveSafeResponsavelEmail(data.responsavel),
                    nomeBusca: normalizeNameKey(data.responsavel.nome)
                },
                alunos: updatedAlunos,
                status: 'confirmado',
                createdAt: serverTimestamp(),
                horario: selectedSchedule?.time || '',
                dias: selectedSchedule?.days || [],
                isAdmin: true
            });

            // Ensure at least minDuration
            const elapsed = Date.now() - startTime;
            if (elapsed < minDuration) {
                await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
            }

            setGlobalLoading(true, 'CADASTRO REALIZADO!', 100);
            setTimeout(() => {
                showAlert('Cadastro administrativo realizado com sucesso!', 'success');
                setData(INITIAL_DATA);
                setSelectedSchedule(null);
                setGlobalLoading(false);
            }, 500);

        } catch (error) {
            const err = error as Error;
            showAlert(`Erro ao salvar: ${err.message}`, 'error');
            setGlobalLoading(false);
        } finally {
            clearInterval(interval);
        }
    };

    const renderCategory = (birthDate: string) => {
        if (!birthDate || birthDate.length !== 10) return null;
        const yearStr = birthDate.split('/')[2];
        const year = parseInt(yearStr);
        if (isNaN(year)) return null;
        const refYear = 2026;
        const ageRef = refYear - year;
        const cat = (ageRef >= 3 && ageRef <= 5) ? 'INICIAÇÃO' : (ageRef >= 6 && ageRef <= 15) ? `SUB ${ageRef}` : 'FORA DE FAIXA';
        return <span style={{ fontSize: '0.8rem', color: '#00a63a', fontWeight: 'bold', marginLeft: '10px' }}>({cat})</span>;
    };

    const handleResponsavelChange = (field: string, value: string) => {
        let formattedValue = value;
        if (field === 'cpf') formattedValue = maskCPF(value);
        if (field === 'dataNascimento') formattedValue = maskDate(value);
        if (field === 'telefonePrincipal') formattedValue = maskPhone(value);
        if (field === 'email') formattedValue = value.toLowerCase().trim();

        setData(prev => ({
            ...prev,
            responsavel: { ...prev.responsavel, [field]: formattedValue }
        }));
    };

    return (
        <div className="admin-page page-enter" style={{ maxWidth: '100vw', padding: '20px', boxSizing: 'border-box', overflowX: 'hidden', paddingBottom: '100px' }}>
            <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#00a63a', fontWeight: '800', margin: 0 }}>NOVO CADASTRO</h1>
                    <p style={{ color: '#666' }}>Entrada rápida de dados para administração.</p>
                </div>
                <button type="submit" form="admin-form" className="btn-save-admin" style={{
                    background: '#00a63a', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '8px',
                    fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(0, 166, 58, 0.28)'
                }}>
                    <Save size={20} /> FINALIZAR CADASTRO
                </button>
            </header>

            <form id="admin-form" onSubmit={handleSubmit} className="admin-grid-form">

                {/* COLUMN 1: RESPONSAVEL & MODALITY */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    {/* SECTION: RESPONSAVEL */}
                    <div className="admin-card">
                        <div className="admin-card-header"><Users size={18} /> DADOS DO RESPONSÁVEL</div>
                        <div className="admin-card-body">
                            <div className="admin-form-group">
                                <label>NOME COMPLETO</label>
                                <input type="text" value={data.responsavel.nome} onChange={(e) => handleResponsavelChange('nome', e.target.value)} required />
                            </div>
                            <div className="admin-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="admin-form-group">
                                    <label>CPF</label>
                                    <input type="text" value={data.responsavel.cpf} maxLength={14} onChange={(e) => handleResponsavelChange('cpf', e.target.value)} required />
                                </div>
                                <div className="admin-form-group">
                                    <label>DATA NASCIMENTO</label>
                                    <input type="text" value={data.responsavel.dataNascimento} placeholder="DD/MM/AAAA" onChange={(e) => handleResponsavelChange('dataNascimento', e.target.value)} required />
                                </div>
                            </div>
                            <div className="admin-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="admin-form-group">
                                    <label>CELULAR (WHATSAPP)</label>
                                    <input type="tel" value={data.responsavel.telefonePrincipal} onChange={(e) => handleResponsavelChange('telefonePrincipal', e.target.value)} required />
                                </div>
                                <div className="admin-form-group">
                                    <label>EMAIL</label>
                                    <input type="email" value={data.responsavel.email} onChange={(e) => setData(p => ({ ...p, responsavel: { ...p.responsavel, email: e.target.value } }))} required />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION: ADDRESS */}
                    <div className="admin-card">
                        <div className="admin-card-header"><MapPin size={18} /> ENDEREÇO</div>
                        <div className="admin-card-body">
                            <div className="admin-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                                <div className="admin-form-group">
                                    <label>CEP</label>
                                    <input type="text" value={data.responsavel.endereco.cep} onChange={handleCepChange} required />
                                </div>
                                <div className="admin-form-group">
                                    <label>RUA/AV</label>
                                    <input type="text" value={data.responsavel.endereco.rua} onChange={(e) => setData(p => ({ ...p, responsavel: { ...p.responsavel, endereco: { ...p.responsavel.endereco, rua: e.target.value } } }))} required />
                                </div>
                            </div>
                            <div className="admin-form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                <div className="admin-form-group">
                                    <label>NÚMERO</label>
                                    <input type="text" value={data.responsavel.endereco.numero} onChange={(e) => setData(p => ({ ...p, responsavel: { ...p.responsavel, endereco: { ...p.responsavel.endereco, numero: e.target.value } } }))} required />
                                </div>
                                <div className="admin-form-group">
                                    <label>BAIRRO</label>
                                    <input type="text" value={data.responsavel.endereco.bairro} onChange={(e) => setData(p => ({ ...p, responsavel: { ...p.responsavel, endereco: { ...p.responsavel.endereco, bairro: e.target.value } } }))} required />
                                </div>
                                <div className="admin-form-group">
                                    <label>CIDADE</label>
                                    <input type="text" value={data.responsavel.endereco.cidade} onChange={(e) => setData(p => ({ ...p, responsavel: { ...p.responsavel, endereco: { ...p.responsavel.endereco, cidade: e.target.value } } }))} required />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION: MODALITY */}
                    <div className="admin-card">
                        <div className="admin-card-header"><CreditCard size={18} /> CONFIGURAÇÃO DO PLANO</div>
                        <div className="admin-card-body">
                            <div className="admin-form-group">
                                <label>MODALIDADE</label>
                                <select value={data.modalidade} onChange={(e) => {
                                    const mod = e.target.value as any;
                                    setData(p => ({
                                        ...p,
                                        modalidade: mod,
                                        planoVoleibol: '',
                                        alunos: mod === 'voleibol' ? [] : (p.alunos.length > 0 ? p.alunos : [{ ...DEFAULT_STUDENT }])
                                    }));
                                }} required>
                                    <option value="">Selecione...</option>
                                    <option value="futebol">Futebol</option>
                                </select>
                            </div>

                            {data.modalidade === 'voleibol' && (
                                <div className="admin-form-group animate-slide-down">
                                    <label>PLANO VOLEIBOL</label>
                                    <select value={data.planoVoleibol} onChange={(e) => handlePlanChange(e.target.value as any)} required>
                                        <option value="">Selecione...</option>
                                        <option value="individual">Individual</option>
                                        <option value="casal">Casal</option>
                                        <option value="familia">Família</option>
                                    </select>
                                </div>
                            )}

                            {(data.modalidade === 'natacao' || data.modalidade === 'hidro') && (
                                <div className="admin-schedule-picker animate-slide-down">
                                    <label>HORÁRIO PREFERENCIAL</label>
                                    {Object.values(SCHEDULE_OPTIONS[data.modalidade as 'natacao' | 'hidro'] || {}).map((opt, i) => (
                                        <div key={i} style={{ marginBottom: '10px' }}>
                                            <p style={{ fontSize: '0.8rem', color: '#00a63a', fontWeight: 'bold', margin: '5px 0' }}>{opt.days.join(' & ')}</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {opt.times.map((t: string) => (
                                                    <button key={t} type="button"
                                                        onClick={() => setSelectedSchedule({ days: opt.days, time: t })}
                                                        className={`mini-schedule-btn ${selectedSchedule?.time === t ? 'active' : ''}`}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: STUDENTS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} /> ALUNOS ({data.alunos.length})</div>
                            <button type="button" onClick={addStudent} style={{ background: '#fff', color: '#00a63a', border: '1px solid #00a63a', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>+ ADICIONAR</button>
                        </div>
                        <div className="admin-card-body" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                            {data.alunos.map((aluno, index) => (
                                <div key={index} className="admin-student-item animate-fade-in" style={{
                                    border: '1px solid #eee', borderRadius: '10px', padding: '15px', marginBottom: '20px', background: '#fdfdfd'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#00a63a' }}>ALUNO {index + 1} {renderCategory(aluno.dataNascimento)}</span>
                                        {data.alunos.length > 1 && <button type="button" onClick={() => removeStudent(index)} style={{ color: '#ff4d4f', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>}
                                    </div>

                                    <div className="admin-form-group">
                                        <label>NOME COMPLETO</label>
                                        <input type="text" value={aluno.nome} onChange={(e) => { const n = [...data.alunos]; n[index].nome = e.target.value; setData({ ...data, alunos: n }); }} required />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px' }}>
                                        <div className="admin-form-group">
                                            <label>DATA NASCIMENTO</label>
                                            <input type="text" value={aluno.dataNascimento} placeholder="DD/MM/AAAA" onChange={(e) => { const n = [...data.alunos]; n[index].dataNascimento = maskDate(e.target.value); setData({ ...data, alunos: n }); }} required />
                                        </div>
                                        <div className="admin-form-group">
                                            <label>SEXO</label>
                                            <select value={aluno.sexo} onChange={(e) => { const n = [...data.alunos]; n[index].sexo = e.target.value; setData({ ...data, alunos: n }); }} required>
                                                <option value="">Selecione...</option>
                                                <option value="M">Masculino</option>
                                                <option value="F">Feminino</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="admin-form-group">
                                        <label>CPF {data.modalidade === 'natacao' && '(OPCIONAL)'}</label>
                                        <input type="text" value={aluno.cpf} maxLength={14} onChange={(e) => { const n = [...data.alunos]; n[index].cpf = maskCPF(e.target.value); setData({ ...data, alunos: n }); }} required={data.modalidade !== 'natacao' && data.modalidade !== 'hidro'} />
                                    </div>

                                    {/* PHOTO & DOCS */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>FOTO ROSTO</label>
                                            <div style={{ position: 'relative', width: '60px', height: '60px', border: '2px dashed #ddd', borderRadius: '8px', overflow: 'hidden', background: '#f5f5f5' }}>
                                                {aluno.fotoUrl ? <img src={aluno.fotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Camera size={20} color="#999" /></div>}
                                                <input type="file" onChange={(e) => handlePhotoUpload(e, index)} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} accept="image/*" />
                                            </div>
                                        </div>
                                        {data.modalidade === 'futebol' && (
                                            <div>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>DOCUMENTO</label>
                                                <div style={{ position: 'relative', width: '60px', height: '60px', border: '2px dashed #006d77', borderRadius: '8px', overflow: 'hidden', background: '#f0fbfc' }}>
                                                    {aluno.documentoUrl ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#006d77' }}><Check size={24} /></div> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><FileText size={20} color="#006d77" /></div>}
                                                    <input type="file" onChange={(e) => handlePhotoUpload(e, index, true)} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} accept="image/*,application/pdf" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* HEALTH INFO (COMPACT) */}
                                    <div style={{ marginTop: '15px', padding: '10px', background: '#fff9f9', borderRadius: '8px', border: '1px solid #ffebeb' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold', color: '#00a63a', marginBottom: '8px' }}><Heart size={14} /> SAÚDE</div>
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}><input type="checkbox" checked={aluno.saude.temAlergia} onChange={(e) => { const n = [...data.alunos]; n[index].saude.temAlergia = e.target.checked; setData({ ...data, alunos: n }); }} /> Alergia</label>
                                            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}><input type="checkbox" checked={aluno.saude.tomaMedicamento} onChange={(e) => { const n = [...data.alunos]; n[index].saude.tomaMedicamento = e.target.checked; setData({ ...data, alunos: n }); }} /> Med. Contínuo</label>
                                        </div>
                                        {(aluno.saude.temAlergia || aluno.saude.tomaMedicamento) && (
                                            <textarea
                                                style={{ width: '100%', marginTop: '8px', padding: '8px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                                placeholder="Detalhes (Opcional)"
                                                value={aluno.saude.condicaoSaude}
                                                onChange={(e) => { const n = [...data.alunos]; n[index].saude.condicaoSaude = e.target.value; setData({ ...data, alunos: n }); }}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </form>

            <style>{`
                .admin-grid-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; width: 100%; box-sizing: border-box; }
                .admin-card { background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; width: 100%; box-sizing: border-box; }
                .admin-card-header { background: #fdfdfd; padding: 12px 20px; border-bottom: 1px solid #eee; font-weight: 800; color: #444; font-size: 0.9rem; display: flex; alignItems: center; gap: 10px; }
                .admin-card-body { padding: 20px; }
                .admin-form-group { margin-bottom: 15px; }
                .admin-form-group label { display: block; font-size: 0.75rem; font-weight: 800; color: #999; margin-bottom: 6px; letter-spacing: 0.5px; }
                .admin-form-group input, .admin-form-group select, .admin-form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.95rem; outline: none; transition: all 0.2s; box-sizing: border-box; }
                .admin-form-group input:focus { border-color: #00a63a; box-shadow: 0 0 0 3px rgba(23, 66, 143, 0.14); }
                .admin-toggle-btn { flex: 1; padding: 10px; border: 1px solid #ddd; background: #fff; color: #666; font-weight: bold; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .admin-toggle-btn.active { border-color: #00a63a; background: #fff0f0; color: #00a63a; }
                .mini-schedule-btn { padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 15px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
                .mini-schedule-btn.active { background: #00a63a; color: #fff; border-color: #00a63a; }
                .animate-slide-down { animation: slideDown 0.3s ease-out; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }

                @media (max-width: 600px) {
                    .admin-grid-form { grid-template-columns: 1fr; }
                    .admin-card-body { padding: 15px; }
                    header { flex-direction: column; align-items: flex-start; gap: 15px; margin-bottom: 20px !important; }
                    .btn-save-admin { 
                        position: fixed; 
                        bottom: 0; 
                        left: 0; 
                        right: 0; 
                        width: 100%; 
                        border-radius: 0; 
                        padding: 18px; 
                        z-index: 1000; 
                        justify-content: center; 
                        box-shadow: 0 -4px 15px rgba(0,0,0,0.1) !important; 
                    }
                    .admin-form-row-mobile { display: flex !important; flex-direction: column !important; gap: 0 !important; }
                    .admin-form-row-mobile > div { width: 100% !important; margin-bottom: 15px; }
                    .admin-form-grid-2 { grid-template-columns: 1fr !important; }
                    .admin-form-grid-3 { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
};

export default AdminNovoCadastro;
