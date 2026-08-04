import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, Users, Search, X, Trophy, Calendar, ChevronRight, Image as ImageIcon, FileSignature } from 'lucide-react';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { useDashboardData } from './AdminDashboard/hooks/useDashboardData';
import type { Convocacao, ConvocacaoJogador } from '../types/convocacao';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { ConvocacaoToggle, CONV_UI } from '../components/convocacao/ConvocacaoToggle';

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
    const [categoria, setCategoria] = useState('');
    const [tecnicoName, setTecnicoName] = useState('');
    const [rivalNome, setRivalNome] = useState('');
    const [rivalLogo, setRivalLogo] = useState('');
    const [casaNome, setCasaNome] = useState('Rumo ao Esporte');
    const [casaLogo, setCasaLogo] = useState('');
    const [showNumbers, setShowNumbers] = useState(true);

    // Switches para campos opcionais
    const [useDataJogo, setUseDataJogo] = useState(false);
    const [useCategoria, setUseCategoria] = useState(false);
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

    const isMobile = windowWidth < 1024; // Cobre tablets e evita scroll horizontal

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
            const q = query(collection(db, 'rumo_ao_esporte_2026_convocacoes'), orderBy('dataUnix', 'desc'));
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
        setCategoria('');
        setTecnicoName('');
        setRivalNome('');
        setRivalLogo('');
        setCasaNome('Rumo ao Esporte');
        setCasaLogo('');
        setShowNumbers(true);
        setUseDataJogo(false);
        setUseCategoria(false);
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

    const handleAddJogador = (studentRaw: any, categoriaJogador: 'titular' | 'reserva') => {
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
            categoria: categoriaJogador,
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
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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
                const ctx = canvas.getContext('2d');
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
                categoria: useCategoria ? categoria.trim() : '',
                tecnico: useTecnico ? tecnicoName.trim() : '',
                rivalNome: useRivalInfo ? rivalNome.trim() : '',
                rivalLogo: useRivalInfo ? (rivalLogo || '') : '',
                casaNome: useCasaInfo ? casaNome.trim() : 'Rumo ao Esporte',
                casaLogo: useCasaInfo ? (casaLogo || '') : '',
                showNumbers,
                showDataJogo: useDataJogo,
                dataUnix: useDataJogo && dataJogo ? new Date(dataJogo).getTime() : Date.now(),
                jogadores: selectedJogadores
            };

            await addDoc(collection(db, 'rumo_ao_esporte_2026_convocacoes'), novaConvocacao);

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

    const renderPlayerPanel = (
        titulo: string,
        lista: ConvocacaoJogador[],
        cor: string,
        fundo: string
    ) => (
        <div style={{ background: '#fff', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: CONV_UI.navy, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                {titulo} <span style={{ background: fundo, color: cor, padding: '2px 10px', borderRadius: '10px', fontSize: '0.8rem' }}>{lista.length}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {lista.length === 0 && <span style={{ color: '#8ea3c0', fontSize: '0.9rem', fontStyle: 'italic' }}>Nenhum atleta selecionado</span>}
                {lista.map(j => (
                    <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: CONV_UI.surfaceSoft, padding: '10px', borderRadius: '8px', border: `1px solid ${CONV_UI.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: cor, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.nome}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#63708a' }}>{j.turma}</span>
                                    {!j.numero && (
                                        <Link
                                            to={`/admin/details/${j.regId}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                color: CONV_UI.blue,
                                                fontWeight: 'bold',
                                                background: CONV_UI.blueSoft,
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                border: `1px solid ${CONV_UI.border}`,
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
                            {j.numero ? (
                                <div style={{
                                    width: '45px',
                                    padding: '6px 4px',
                                    textAlign: 'center',
                                    border: `2px solid ${cor}`,
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    background: '#fff',
                                    color: CONV_UI.navy
                                }}>
                                    {j.numero}
                                </div>
                            ) : (
                                <div style={{ width: '45px' }} />
                            )}
                            <button onClick={() => handleRemoveJogador(j.id)} style={{ background: 'none', border: 'none', color: CONV_UI.danger, cursor: 'pointer', padding: '5px' }}><X size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <PageContainer>
            <PageTitle
                title="Convocações"
                subtitle="Monte as escalações e gere a arte oficial da partida"
                count={convocacoes.length}
            >
                <button
                    onClick={handleOpenModal}
                    style={{
                        background: CONV_UI.green, color: '#fff', border: 'none', padding: '12px 24px',
                        borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,166,58,0.25)'
                    }}
                >
                    <Plus size={20} /> NOVA CONVOCAÇÃO
                </button>
            </PageTitle>

            {/* List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
                {convocacoes.map(conv => (
                    <div
                        key={conv.id}
                        onClick={() => navigate(`${pathPrefix}/jogos/convocacao/${conv.id}`)}
                        style={{
                            background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '12px', padding: '20px',
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: CONV_UI.shadow,
                            display: 'flex', flexDirection: 'column', gap: '10px'
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = CONV_UI.green; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = CONV_UI.border; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <h3 style={{ margin: 0, color: CONV_UI.navy, fontSize: '1.15rem', fontWeight: 800 }}>{conv.jogo}</h3>
                            {conv.categoria && (
                                <span style={{ background: CONV_UI.blueSoft, color: CONV_UI.blue, padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {conv.categoria}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '15px', color: '#63708a', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Calendar size={16} /> {conv.showDataJogo === false ? 'Data a confirmar' : new Date(conv.dataUnix).toLocaleDateString('pt-BR')}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Users size={16} /> {(conv.jogadores || []).length} Atletas
                            </span>
                            {conv.autorizacao?.ativa && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: CONV_UI.green, fontWeight: 700 }}>
                                    <FileSignature size={16} /> Autorização enviada
                                </span>
                            )}
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: `1px solid ${CONV_UI.border}`, display: 'flex', justifyContent: 'space-between', color: CONV_UI.green, fontWeight: 'bold', alignItems: 'center', gap: '5px' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedConvocacaoForImage(conv);
                                    setIsImageModalOpen(true);
                                }}
                                style={{ background: CONV_UI.blueSoft, border: 'none', color: CONV_UI.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem' }}
                                title="Gerar arte da convocação"
                            >
                                <ImageIcon size={16} /> ARTE
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>Ver Escalação <ChevronRight size={18} /></span>
                        </div>
                    </div>
                ))}

                {convocacoes.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center', color: '#8ea3c0', background: '#fff', borderRadius: '12px', border: `1px dashed ${CONV_UI.border}` }}>
                        <Trophy size={40} color="#c3d3e8" style={{ marginBottom: '10px' }} />
                        <div style={{ fontWeight: 700 }}>Nenhuma convocação registrada.</div>
                        <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>Clique em "Nova Convocação" para montar a primeira escalação.</div>
                    </div>
                )}
            </div>

            {/* Nova Convocação Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,26,64,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? '10px' : '40px 20px', backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '820px', maxHeight: '90vh', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,36,92,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {/* Modal Header (Fixo) */}
                        <div style={{ padding: '18px 25px', borderBottom: `1px solid ${CONV_UI.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: isMobile ? '1.05rem' : '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Trophy size={20} color={CONV_UI.gold} /> Nova Convocação
                            </h2>
                            <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body (Rolagem) */}
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '18px', background: CONV_UI.surfaceSoft }}>
                                {/* Nome do Jogo */}
                                <div>
                                    <label style={CONV_UI.label}>NOME DO JOGO / EVENTO</label>
                                    <input
                                        type="text"
                                        value={jogoName}
                                        onChange={e => setJogoName(e.target.value)}
                                        placeholder="Ex: Copa Regional de Futsal"
                                        style={CONV_UI.input}
                                    />
                                </div>

                                {/* Categoria */}
                                <ConvocacaoToggle
                                    label="CATEGORIA (Opcional)"
                                    hint="Aparece no selo azul da arte. Ex.: SUB-9"
                                    checked={useCategoria}
                                    onChange={(v) => {
                                        setUseCategoria(v);
                                        if (!v) setCategoria('');
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={categoria}
                                        onChange={e => setCategoria(e.target.value)}
                                        placeholder="Ex: SUB-9"
                                        style={CONV_UI.input}
                                        autoFocus
                                    />
                                </ConvocacaoToggle>

                                {/* Data e Hora */}
                                <ConvocacaoToggle
                                    label="DATA E HORA DO JOGO (Opcional)"
                                    hint="Desligado, a arte mostra “DATA A CONFIRMAR”"
                                    checked={useDataJogo}
                                    onChange={(v) => {
                                        setUseDataJogo(v);
                                        if (!v) setDataJogo(new Date().toISOString().slice(0, 16));
                                    }}
                                >
                                    <input
                                        type="datetime-local"
                                        value={dataJogo}
                                        onChange={e => setDataJogo(e.target.value)}
                                        style={CONV_UI.input}
                                    />
                                </ConvocacaoToggle>

                                {/* Técnico */}
                                <ConvocacaoToggle
                                    label="TÉCNICO (Opcional)"
                                    checked={useTecnico}
                                    onChange={(v) => {
                                        setUseTecnico(v);
                                        if (!v) setTecnicoName('');
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={tecnicoName}
                                        onChange={e => setTecnicoName(e.target.value)}
                                        placeholder="Ex: Prof. Plinio"
                                        style={CONV_UI.input}
                                        autoFocus
                                    />
                                </ConvocacaoToggle>

                                <ConvocacaoToggle
                                    label="MOSTRAR NÚMEROS DAS CAMISAS NA ARTE"
                                    checked={showNumbers}
                                    onChange={setShowNumbers}
                                />

                                {/* Time da casa */}
                                <ConvocacaoToggle
                                    label="INFORMAÇÕES DO TIME DA CASA (Opcional)"
                                    checked={useCasaInfo}
                                    onChange={(v) => {
                                        setUseCasaInfo(v);
                                        if (!v) {
                                            setCasaNome('Rumo ao Esporte');
                                            setCasaLogo('');
                                        }
                                    }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px' }}>
                                        <div>
                                            <label style={CONV_UI.label}>NOME DO TIME</label>
                                            <input
                                                type="text"
                                                value={casaNome}
                                                onChange={e => setCasaNome(e.target.value)}
                                                placeholder="Ex: Rumo ao Esporte"
                                                style={CONV_UI.input}
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label style={CONV_UI.label}>LOGO (substitui o escudo na arte)</label>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <input type="file" accept="image/*" onChange={handleCasaLogoUpload} style={{ flex: 1, fontSize: '0.8rem' }} />
                                                {casaLogo && (
                                                    <div style={{ position: 'relative' }}>
                                                        <img src={casaLogo} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: `1px solid ${CONV_UI.border}` }} />
                                                        <button
                                                            onClick={() => setCasaLogo('')}
                                                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: CONV_UI.danger, color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </ConvocacaoToggle>

                                {/* Time rival */}
                                <ConvocacaoToggle
                                    label="INFORMAÇÕES DO TIME RIVAL (Opcional)"
                                    checked={useRivalInfo}
                                    onChange={(v) => {
                                        setUseRivalInfo(v);
                                        if (!v) {
                                            setRivalNome('');
                                            setRivalLogo('');
                                        }
                                    }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px' }}>
                                        <div>
                                            <label style={CONV_UI.label}>NOME DO TIME</label>
                                            <input
                                                type="text"
                                                value={rivalNome}
                                                onChange={e => setRivalNome(e.target.value)}
                                                placeholder="Ex: Aliança FC"
                                                style={CONV_UI.input}
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label style={CONV_UI.label}>LOGO</label>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ flex: 1, fontSize: '0.8rem' }} />
                                                {rivalLogo && (
                                                    <div style={{ position: 'relative' }}>
                                                        <img src={rivalLogo} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: `1px solid ${CONV_UI.border}` }} />
                                                        <button
                                                            onClick={() => setRivalLogo('')}
                                                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: CONV_UI.danger, color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </ConvocacaoToggle>

                                {/* Search Block */}
                                <div>
                                    <label style={CONV_UI.label}>PESQUISAR E ADICIONAR ALUNOS</label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '8px', padding: '0 15px', gap: '10px' }}>
                                                <Search size={20} color="#8ea3c0" />
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
                                                style={{ width: isMobile ? '120px' : '180px', padding: '12px 10px', borderRadius: '8px', border: `1px solid ${CONV_UI.border}`, fontSize: '0.85rem', outline: 'none', background: '#fff', fontWeight: 'bold', cursor: 'pointer', color: CONV_UI.navy }}
                                            >
                                                {activeModalidades.map(m => (
                                                    <option key={m.id} value={m.id}>{m.icon} {m.label.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Search Results Dropdown */}
                                        {searchTerm.length >= 2 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '8px', boxShadow: '0 18px 50px rgba(9,36,92,0.16)', marginTop: '5px', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
                                                {studentsLoading && <div style={{ padding: '15px', textAlign: 'center', color: '#8ea3c0' }}>Carregando base de alunos...</div>}
                                                {!studentsLoading && filteredStudents.length === 0 && <div style={{ padding: '15px', textAlign: 'center', color: '#8ea3c0' }}>Nenhum aluno encontrado.</div>}
                                                {filteredStudents.map(student => (
                                                    <div key={student.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: `1px solid ${CONV_UI.surfaceSoft}` }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: CONV_UI.blueSoft, overflow: 'hidden' }}>
                                                                {student.aluno?.fotoUrl ? <img src={student.aluno.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={16} color="#8ea3c0" style={{ margin: '7px' }} />}
                                                            </div>
                                                            <span style={{ fontWeight: 600, color: CONV_UI.navy }}>{student.aluno?.nome}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button onClick={() => handleAddJogador(student, 'titular')} style={CONV_UI.addTitular}>+ TITULAR</button>
                                                            <button onClick={() => handleAddJogador(student, 'reserva')} style={CONV_UI.addReserva}>+ RESERVA</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Players Panels */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1px', background: CONV_UI.border, borderTop: `1px solid ${CONV_UI.border}` }}>
                                {renderPlayerPanel('TITULARES', titulares, CONV_UI.blue, CONV_UI.blueSoft)}
                                {renderPlayerPanel('RESERVAS', reservas, CONV_UI.green, CONV_UI.greenSoft)}
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: '20px', background: CONV_UI.surfaceSoft, borderTop: `1px solid ${CONV_UI.border}`, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'flex-end', gap: '10px' }}>
                                <button onClick={closeModal} style={{ width: isMobile ? '100%' : 'auto', padding: '12px 20px', borderRadius: '8px', border: `1px solid ${CONV_UI.border}`, background: '#fff', fontWeight: 'bold', color: '#63708a', cursor: 'pointer' }}>
                                    CANCELAR
                                </button>
                                <button onClick={handleSaveConvocacao} style={{ width: isMobile ? '100%' : 'auto', padding: '12px 24px', borderRadius: '8px', border: 'none', background: CONV_UI.green, fontWeight: 'bold', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 8px 24px rgba(0,166,58,0.25)' }}>
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
        </PageContainer>
    );
}
