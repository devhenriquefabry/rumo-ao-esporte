import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, Users, Search, X, Trophy, Calendar, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { useDashboardData } from './AdminDashboard/hooks/useDashboardData';
import type { Convocacao, ConvocacaoJogador } from '../types/convocacao';

import { ConvocacaoImageModal } from '../components/ConvocacaoImageModal';

export default function AdminConvocacaoList() {
    const [convocacoes, setConvocacoes] = useState<Convocacao[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedConvocacaoForImage, setSelectedConvocacaoForImage] = useState<Convocacao | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const { setLoading } = useLoading();
    const { showAlert } = useDialog();
    const navigate = useNavigate();
    const location = useLocation();
    const isTeacherPortal = location.pathname.startsWith('/professor');
    const pathPrefix = isTeacherPortal ? '/professor' : '/admin';

    // Form states
    const [jogoName, setJogoName] = useState('');
    const [tecnicoName, setTecnicoName] = useState('');
    const [rivalNome, setRivalNome] = useState('');
    const [rivalLogo, setRivalLogo] = useState('');
    const [casaNome, setCasaNome] = useState('Arena Simonésia');
    const [casaLogo, setCasaLogo] = useState('');
    const [showNumbers, setShowNumbers] = useState(true);

    // Switches para campos opcionais
    const [useDataJogo, setUseDataJogo] = useState(false);
    const [useTecnico, setUseTecnico] = useState(false);
    const [useCasaInfo, setUseCasaInfo] = useState(false);
    const [useRivalInfo, setUseRivalInfo] = useState(false);
    const [selectedJogadores, setSelectedJogadores] = useState<ConvocacaoJogador[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchModalidade, setSearchModalidade] = useState('futebol');
    const [dataJogo, setDataJogo] = useState(new Date().toISOString().slice(0, 16));
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 1024; // Aumentado para cobrir tablets e evitar scroll horizontal

    const { allStudents, turmas, loading: studentsLoading } = useDashboardData();

    const activeModalidades = useMemo(() => {
        const mods = new Set(allStudents.map(s => s.modalidade).filter(Boolean));
        const list = Array.from(mods).map(m => {
            const label = m?.charAt(0).toUpperCase() + (m?.slice(1) || '');
            let icon = '🎯';
            if (m?.includes('futebol')) icon = '⚽';
            if (m?.includes('volei')) icon = '🏐';
            if (m?.includes('natacao')) icon = '🏊';
            if (m?.includes('hidro')) icon = '🌊';
            if (m?.includes('danca')) icon = '💃';
            if (m?.includes('artes')) icon = '🥋';
            return { id: m as string, label, icon };
        });
        return list.length > 0 ? list : [{ id: 'futebol', label: 'Futebol', icon: '⚽' }];
    }, [allStudents]);

    useEffect(() => {
        if (activeModalidades.length > 0 && !activeModalidades.find(m => m.id === searchModalidade)) {
            const hasFutebol = activeModalidades.find(m => m.id === 'futebol');
            if (hasFutebol) setSearchModalidade('futebol');
            else if (activeModalidades.length > 0) setSearchModalidade(activeModalidades[0].id);
        }
    }, [activeModalidades, searchModalidade]);



    useEffect(() => {
        fetchConvocacoes();
    }, []);

    const fetchConvocacoes = async () => {
        try {
            setLoading(true, 'Carregando Convocações...');
            const q = query(collection(db, 'arena_simonesia_2026_convocacoes'), orderBy('dataUnix', 'desc'));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Convocacao));
            setConvocacoes(data);
        } catch (error) {
            console.error('Error fetching convocacoes:', error);
            showAlert('Erro ao carregar convocações.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        setJogoName('');
        setTecnicoName('');
        setRivalNome('');
        setRivalLogo('');
        setCasaNome('Arena Simonésia');
        setCasaLogo('');
        setShowNumbers(true);
        setUseDataJogo(false);
        setUseTecnico(false);
        setUseCasaInfo(false);
        setUseRivalInfo(false);
        setSelectedJogadores([]);
        setSearchTerm('');
        setSearchModalidade('futebol');
        setDataJogo(new Date().toISOString().slice(0, 16));
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleAddJogador = (studentRaw: any, categoria: 'titular' | 'reserva') => {
        if (!studentRaw.aluno) return;

        // Prevent adding same student twice
        if (selectedJogadores.some(j => j.id === studentRaw.uniqueId)) {
            showAlert('Este aluno já está na convocação.', 'warning');
            return;
        }

        const turmaName = turmas.find(t => t.id === studentRaw.aluno.turmaId)?.nome || 'Sem Turma';

        const jogador: ConvocacaoJogador = {
            id: studentRaw.uniqueId,
            regId: studentRaw.regId,
            nome: studentRaw.aluno.nome,
            photo: studentRaw.aluno.fotoUrl || '',
            turma: turmaName,
            categoria,
            numero: studentRaw.aluno.camisa || '', // Auto-fill with jersey number
            responsavel: studentRaw.responsavel?.nome || ''
        };

        setSelectedJogadores(prev => [...prev, jogador]);
    };

    const handleRemoveJogador = (id: string) => {
        setSelectedJogadores(prev => prev.filter(j => j.id !== id));
    };



    const resizeImage = (base64Str: string, maxWidth = 400, maxHeight = 400): Promise<string> => {
        return new Promise((resolve) => {
            let img = new Image();
            img.src = base64Str;
            img.onload = () => {
                let canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                let ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        });
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const compressed = await resizeImage(base64);
            setRivalLogo(compressed);
        };
        reader.readAsDataURL(file);
    };

    const handleCasaLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const compressed = await resizeImage(base64);
            setCasaLogo(compressed);
        };
        reader.readAsDataURL(file);
    };



    const handleSaveConvocacao = async () => {
        if (!jogoName.trim()) {
            showAlert('Informe o nome do jogo.', 'warning');
            return;
        }

        try {
            setLoading(true, 'Salvando...');
            const novaConvocacao: Omit<Convocacao, 'id'> = {
                jogo: jogoName,
                tecnico: useTecnico ? tecnicoName.trim() : '',
                rivalNome: useRivalInfo ? rivalNome.trim() : '',
                rivalLogo: useRivalInfo ? (rivalLogo || '') : '',
                casaNome: useCasaInfo ? casaNome.trim() : 'Arena Simonésia',
                casaLogo: useCasaInfo ? (casaLogo || '') : '',
                showNumbers,
                showDataJogo: useDataJogo,
                dataUnix: useDataJogo && dataJogo ? new Date(dataJogo).getTime() : Date.now(),
                jogadores: selectedJogadores
            };

            await addDoc(collection(db, 'arena_simonesia_2026_convocacoes'), novaConvocacao);

            showAlert('Convocação criada com sucesso!', 'success');
            closeModal();
            fetchConvocacoes(); // Reload list
        } catch (error) {
            console.error('Error saving:', error);
            showAlert('Erro ao salvar convocação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Derived states for modal rendering
    const titulares = selectedJogadores.filter(j => j.categoria === 'titular');
    const reservas = selectedJogadores.filter(j => j.categoria === 'reserva');

    const filteredStudents = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const lowerSearch = searchTerm.toLowerCase();

        const yearMatches = searchTerm.match(/\b(20\d{2})\b/g);
        if (yearMatches && yearMatches.length > 0) {
            return allStudents.filter(s =>
                s.aluno &&
                s.aluno.dataNascimento &&
                s.modalidade === searchModalidade &&
                yearMatches.includes(s.aluno.dataNascimento.includes('/') ? (s.aluno.dataNascimento.split('/').pop() || '') : s.aluno.dataNascimento.split('-')[0]) &&
                s.contractStatus !== 'desativado'
            ).sort((a, b) => {
                const dateA = a.aluno?.dataNascimento || '9999-99-99';
                const dateB = b.aluno?.dataNascimento || '9999-99-99';
                return dateA.localeCompare(dateB);
            }).slice(0, 20);
        }

        return allStudents.filter(s =>
            s.aluno &&
            s.modalidade === searchModalidade &&
            s.aluno.nome.toLowerCase().includes(lowerSearch) &&
            s.contractStatus !== 'desativado'
        ).slice(0, 10);
    }, [searchTerm, allStudents, searchModalidade]);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '30px',
                gap: '20px'
            }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.8rem', color: '#007d2f', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Trophy size={isMobile ? 24 : 28} /> CONVOCAÇÕES
                    </h1>
                    <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: isMobile ? '0.85rem' : '1rem' }}>Gerencie escalações para as partidas</p>
                </div>
                <button
                    onClick={handleOpenModal}
                    style={{
                        width: isMobile ? '100%' : 'auto',
                        background: '#007d2f', color: '#fff', border: 'none', padding: '12px 24px',
                        borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(195,34,40,0.3)'
                    }}
                >
                    <Plus size={20} /> NOVA CONVOCAÇÃO
                </button>
            </header>

            {/* List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(350px, 100%), 1fr))', gap: '20px' }}>
                {convocacoes.map(conv => (
                    <div
                        key={conv.id}
                        onClick={() => navigate(`${pathPrefix}/jogos/convocacao/${conv.id}`)}
                        style={{
                            background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px',
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            display: 'flex', flexDirection: 'column', gap: '10px'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = '#007d2f'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#eee'}
                    >
                        <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontWeight: '800' }}>{conv.jogo}</h3>
                        <div style={{ display: 'flex', gap: '15px', color: '#666', fontSize: '0.9rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Calendar size={16} /> {new Date(conv.dataUnix).toLocaleDateString('pt-BR')}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Users size={16} /> {conv.jogadores.length} Atletas
                            </span>
                        </div>
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', color: '#007d2f', fontWeight: 'bold', alignItems: 'center', gap: '5px' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedConvocacaoForImage(conv);
                                    setIsImageModalOpen(true);
                                }}
                                style={{ background: 'none', border: 'none', color: '#007d2f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px' }}
                                title="Baixar Imagem"
                            >
                                <ImageIcon size={18} />
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>Ver Escalação <ChevronRight size={18} /></span>
                        </div>
                    </div>
                ))}

                {convocacoes.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#999', background: '#fff', borderRadius: '12px', border: '1px dashed #ccc' }}>
                        Nenhuma convocação registrada.
                    </div>
                )}
            </div>

            {/* Nova Convocação Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? '10px' : '40px 20px', backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {/* Modal Header (Fixo) */}
                        <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd', zIndex: 10 }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '15px' }}>
                                <h2 style={{ margin: 0, color: '#333', fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: '800' }}>Nova Convocação</h2>
                            </div>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '5px' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body (Rolagem) */}
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fcfcfc' }}>
                                {/* Nome do Jogo */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: '#666', marginBottom: '8px' }}>NOME DO JOGO / EVENTO</label>
                                    <input
                                        type="text"
                                        value={jogoName}
                                        onChange={e => setJogoName(e.target.value)}
                                        placeholder="Ex: Amistoso vs Time A"
                                        style={{ width: '100%', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Data e Hora */}
                                <div style={{ background: useDataJogo ? '#fff' : '#f5f5f5', padding: '15px', borderRadius: '12px', border: useDataJogo ? '1px solid #ddd' : '1px solid #eee', transition: 'all 0.3s' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useDataJogo ? '15px' : '0' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#666' }}>DATA E HORA DO JOGO (Opcional)</label>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={useDataJogo}
                                                onChange={e => {
                                                    setUseDataJogo(e.target.checked);
                                                    if (!e.target.checked) setDataJogo(new Date().toISOString().slice(0, 16));
                                                }}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: useDataJogo ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s'
                                            }}></span>
                                            <span style={{
                                                position: 'absolute', height: '14px', width: '14px', left: useDataJogo ? '23px' : '3px', bottom: '3px',
                                                backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                            }}></span>
                                        </label>
                                    </div>
                                    {useDataJogo && (
                                        <input
                                            type="datetime-local"
                                            value={dataJogo}
                                            onChange={e => setDataJogo(e.target.value)}
                                            style={{ width: '100%', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                    {/* Técnico Opcional */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#666' }}>TÉCNICO</label>
                                            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={useTecnico}
                                                    onChange={e => {
                                                        setUseTecnico(e.target.checked);
                                                        if (!e.target.checked) setTecnicoName('');
                                                    }}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: useTecnico ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s'
                                                }}></span>
                                                <span style={{
                                                    position: 'absolute', height: '14px', width: '14px', left: useTecnico ? '23px' : '3px', bottom: '3px',
                                                    backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                                }}></span>
                                            </label>
                                        </div>
                                        {useTecnico && (
                                            <div style={{ position: 'relative', marginTop: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={tecnicoName}
                                                    onChange={e => setTecnicoName(e.target.value)}
                                                    placeholder="Ex: Prof. Plinio"
                                                    style={{ width: '100%', padding: '12px 15px', paddingRight: '40px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                                    autoFocus
                                                />
                                                {tecnicoName && (
                                                    <button
                                                        onClick={() => setTecnicoName('')}
                                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#666' }}>MOSTRAR NÚMEROS DAS CAMISAS NA ARTE</label>
                                    <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={showNumbers}
                                            onChange={e => setShowNumbers(e.target.checked)}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundColor: showNumbers ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s'
                                        }}></span>
                                        <span style={{
                                            position: 'absolute', height: '14px', width: '14px', left: showNumbers ? '23px' : '3px', bottom: '3px',
                                            backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                        }}></span>
                                    </label>
                                </div>

                                <div style={{ background: useCasaInfo ? '#fff1f0' : '#f5f5f5', padding: '15px', borderRadius: '12px', border: useCasaInfo ? '1px solid #ffccc7' : '1px solid #eee', transition: 'all 0.3s' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useCasaInfo ? '15px' : '0' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: '800', color: useCasaInfo ? '#007d2f' : '#666' }}>INFORMAÇÕES DO TIME DA CASA</label>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={useCasaInfo}
                                                onChange={e => {
                                                    setUseCasaInfo(e.target.checked);
                                                    if (!e.target.checked) {
                                                        setCasaNome('Arena Simonésia');
                                                        setCasaLogo('');
                                                    }
                                                }}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: useCasaInfo ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s'
                                            }}></span>
                                            <span style={{
                                                position: 'absolute', height: '14px', width: '14px', left: useCasaInfo ? '23px' : '3px', bottom: '3px',
                                                backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                            }}></span>
                                        </label>
                                    </div>
                                    {useCasaInfo && (
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: '700', color: '#007d2f', marginBottom: '8px' }}>NOME DO TIME</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="text"
                                                        value={casaNome}
                                                        onChange={e => setCasaNome(e.target.value)}
                                                        placeholder="Ex: Arena Simonésia"
                                                        style={{ width: '100%', padding: '12px', paddingRight: '40px', border: '2px solid #ffccc7', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                                        autoFocus
                                                    />
                                                    {casaNome && (
                                                        <button
                                                            onClick={() => setCasaNome('')}
                                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff7875', cursor: 'pointer', display: 'flex' }}
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: '700', color: '#007d2f', marginBottom: '8px' }}>LOGO</label>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleCasaLogoUpload}
                                                        style={{ flex: 1, fontSize: '0.8rem' }}
                                                    />
                                                    {casaLogo && (
                                                        <div style={{ position: 'relative' }}>
                                                            <img src={casaLogo} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd' }} />
                                                            <button
                                                                onClick={() => setCasaLogo('')}
                                                                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ background: useRivalInfo ? '#fff' : '#f5f5f5', padding: '15px', borderRadius: '12px', border: useRivalInfo ? '1px solid #ddd' : '1px solid #eee', transition: 'all 0.3s' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useRivalInfo ? '15px' : '0' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#666' }}>INFORMAÇÕES DO TIME RIVAL</label>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={useRivalInfo}
                                                onChange={e => {
                                                    setUseRivalInfo(e.target.checked);
                                                    if (!e.target.checked) {
                                                        setRivalNome('');
                                                        setRivalLogo('');
                                                    }
                                                }}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: useRivalInfo ? '#52c41a' : '#ccc', borderRadius: '34px', transition: '.4s'
                                            }}></span>
                                            <span style={{
                                                position: 'absolute', height: '14px', width: '14px', left: useRivalInfo ? '23px' : '3px', bottom: '3px',
                                                backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                            }}></span>
                                        </label>
                                    </div>
                                    {useRivalInfo && (
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: '700', color: '#666', marginBottom: '8px' }}>NOME DO TIME</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="text"
                                                        value={rivalNome}
                                                        onChange={e => setRivalNome(e.target.value)}
                                                        placeholder="Ex: Aliança FC"
                                                        style={{ width: '100%', padding: '12px', paddingRight: '40px', border: '2px solid #eee', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                                        autoFocus
                                                    />
                                                    {rivalNome && (
                                                        <button
                                                            onClick={() => setRivalNome('')}
                                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: '700', color: '#666', marginBottom: '8px' }}>LOGO</label>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleLogoUpload}
                                                        style={{ flex: 1, fontSize: '0.8rem' }}
                                                    />
                                                    {rivalLogo && (
                                                        <div style={{ position: 'relative' }}>
                                                            <img src={rivalLogo} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd' }} />
                                                            <button
                                                                onClick={() => setRivalLogo('')}
                                                                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Search Block */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: '#666', marginBottom: '8px' }}>PESQUISAR E ADICIONAR ALUNOS</label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '0 15px', gap: '10px' }}>
                                                <Search size={20} color="#999" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                    placeholder="Nome ou Ano (ex: 2017, 2018)..."
                                                    style={{ width: '100%', padding: '12px 0', border: 'none', fontSize: '1rem', outline: 'none', background: 'transparent' }}
                                                />
                                            </div>
                                            <select
                                                value={searchModalidade}
                                                onChange={e => setSearchModalidade(e.target.value)}
                                                style={{ width: isMobile ? '120px' : '180px', padding: '12px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.85rem', outline: 'none', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                {activeModalidades.map(m => (
                                                    <option key={m.id} value={m.id}>{m.icon} {m.label.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Search Results Dropdown */}
                                        {searchTerm.length >= 2 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '5px', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
                                                {studentsLoading && <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>Carregando base de alunos...</div>}
                                                {!studentsLoading && filteredStudents.length === 0 && <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>Nenhum aluno encontrado.</div>}
                                                {filteredStudents.map(student => (
                                                    <div key={student.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid #f5f5f5' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                                                                {student.aluno?.fotoUrl ? <img src={student.aluno.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={16} color="#aaa" style={{ margin: '7px' }} />}
                                                            </div>
                                                            <span style={{ fontWeight: '600', color: '#444' }}>{student.aluno?.nome}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button
                                                                onClick={() => handleAddJogador(student, 'titular')}
                                                                style={{ background: '#e6f7ff', color: '#0050b3', border: '1px solid #91d5ff', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                            >+ TITULAR</button>
                                                            <button
                                                                onClick={() => handleAddJogador(student, 'reserva')}
                                                                style={{ background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                            >+ RESERVA</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Players Panels */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1px', background: '#eee', borderTop: '1px solid #eee' }}>
                                {/* Titulares Panel */}
                                <div style={{ background: '#fff', padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#333', display: 'flex', justifyContent: 'space-between' }}>
                                        TITULARES <span style={{ background: '#e6f7ff', color: '#0050b3', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>{titulares.length}</span>
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                                        {titulares.length === 0 && <span style={{ color: '#999', fontSize: '0.9rem', fontStyle: 'italic' }}>Nenhum titular selecionado</span>}
                                        {titulares.map(t => (
                                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#007d2f', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nome}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.75rem', color: '#888' }}>{t.turma}</span>
                                                            {!t.numero && (
                                                                <Link
                                                                    to={`/admin/details/${t.regId}`}
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        color: '#007d2f',
                                                                        fontWeight: 'bold',
                                                                        background: '#fff1f0',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #ffa39e',
                                                                        textDecoration: 'none'
                                                                    }}
                                                                >
                                                                    Sem número +Adicionar
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                    {t.numero ? (
                                                        <div style={{
                                                            width: '45px',
                                                            padding: '6px 4px',
                                                            textAlign: 'center',
                                                            border: '2px solid #007d2f',
                                                            borderRadius: '6px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 'bold',
                                                            background: '#fff',
                                                            color: '#333'
                                                        }}>
                                                            {t.numero}
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: '45px' }} />
                                                    )}
                                                    <button onClick={() => handleRemoveJogador(t.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '5px' }}><X size={18} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Reservas Panel */}
                                <div style={{ background: '#fff', padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#333', display: 'flex', justifyContent: 'space-between' }}>
                                        RESERVAS <span style={{ background: '#f6ffed', color: '#389e0d', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>{reservas.length}</span>
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                                        {reservas.length === 0 && <span style={{ color: '#999', fontSize: '0.9rem', fontStyle: 'italic' }}>Nenhum reserva selecionado</span>}
                                        {reservas.map(r => (
                                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#389e0d', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.75rem', color: '#888' }}>{r.turma}</span>
                                                            {!r.numero && (
                                                                <Link
                                                                    to={`/admin/details/${r.regId}`}
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        color: '#389e0d',
                                                                        fontWeight: 'bold',
                                                                        background: '#f6ffed',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #b7eb8f',
                                                                        textDecoration: 'none'
                                                                    }}
                                                                >
                                                                    Sem número +Adicionar
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                    {r.numero ? (
                                                        <div style={{
                                                            width: '45px',
                                                            padding: '6px 4px',
                                                            textAlign: 'center',
                                                            border: '2px solid #389e0d',
                                                            borderRadius: '6px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 'bold',
                                                            background: '#fff',
                                                            color: '#333'
                                                        }}>
                                                            {r.numero}
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: '45px' }} />
                                                    )}
                                                    <button onClick={() => handleRemoveJogador(r.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '5px' }}><X size={18} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer (Fixo) */}
                            <div style={{ padding: '20px', background: '#fcfcfc', borderTop: '1px solid #eee', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'flex-end', gap: '10px', zIndex: 10 }}>
                                <button onClick={closeModal} style={{ width: isMobile ? '100%' : 'auto', padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', fontWeight: 'bold', color: '#666', cursor: 'pointer' }}>
                                    CANCELAR
                                </button>
                                <button onClick={handleSaveConvocacao} style={{ width: isMobile ? '100%' : 'auto', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#007d2f', fontWeight: 'bold', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                    SALVAR CONVOCAÇÃO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Unificado de Geração de Imagem */}
            <ConvocacaoImageModal
                isOpen={isImageModalOpen}
                convocacao={selectedConvocacaoForImage}
                onClose={() => {
                    setIsImageModalOpen(false);
                    setSelectedConvocacaoForImage(null);
                }}
            />
        </div>
    );
}
