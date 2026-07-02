import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { ArrowLeft, Save, Plus, Users, Search, X, Trophy, GripVertical, ArrowRightLeft, Trash2, Image as ImageIcon } from 'lucide-react';
import { useDashboardData } from './AdminDashboard/hooks/useDashboardData';
import type { Convocacao, ConvocacaoJogador } from '../types/convocacao';

import { ConvocacaoImageModal } from '../components/ConvocacaoImageModal';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableJogadorItemProps {
    id: string;
    jogador: ConvocacaoJogador;
    showNumbers: boolean;
    onRemove: (id: string) => void;
    onSwap: (id: string) => void;
}

function SortableJogadorItem({ id, jogador, showNumbers, onRemove, onSwap }: SortableJogadorItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '12px 15px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#ccc', marginRight: '15px' }}>
                <GripVertical size={20} />
            </div>

            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f5f5', overflow: 'hidden', marginRight: '15px', flexShrink: 0 }}>
                {jogador.photo ? <img src={jogador.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#ccc" style={{ margin: '10px' }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                    to={window.location.pathname.startsWith('/professor')
                        ? `/professor/aluno/${jogador.regId || jogador.id.split('_')[0]}/${jogador.id.includes('_') ? jogador.id.split('_')[1] : '0'}`
                        : `/admin/details/${jogador.regId || jogador.id.split('_')[0]}`
                    }
                    style={{ fontWeight: '800', color: '#007d2f', textDecoration: 'underline', textTransform: 'uppercase', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                >
                    {jogador.nome}
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{jogador.turma || 'Sem Turma'}</div>
                    {!jogador.numero && showNumbers && (
                        <Link
                            to={window.location.pathname.startsWith('/professor')
                                ? `/professor/aluno/${jogador.regId || jogador.id.split('_')[0]}/${jogador.id.includes('_') ? jogador.id.split('_')[1] : '0'}`
                                : `/admin/details/${jogador.regId || jogador.id.split('_')[0]}`
                            }
                            style={{
                                fontSize: '0.65rem',
                                color: '#007d2f',
                                fontWeight: 'bold',
                                background: '#fff1f0',
                                padding: '1px 5px',
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

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                {showNumbers && (
                    jogador.numero ? (
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
                            {jogador.numero}
                        </div>
                    ) : (
                        <div style={{ width: '45px' }} />
                    )
                )}
                <button onClick={(e) => { e.stopPropagation(); onSwap(id); }} title="Mover Categoria" style={{ background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '6px', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRightLeft size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemove(id); }} title="Remover" style={{ background: '#fff1f0', border: 'none', padding: '8px', borderRadius: '6px', color: '#cf1322', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}




export default function AdminConvocacaoDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setLoading } = useLoading();
    const { showAlert, showConfirm } = useDialog();
    const location = useLocation();
    const isTeacherPortal = location.pathname.startsWith('/professor');
    const pathPrefix = isTeacherPortal ? '/professor' : '/admin';

    const [convocacao, setConvocacao] = useState<Convocacao | null>(null);
    const [jogadores, setJogadores] = useState<ConvocacaoJogador[]>([]);
    const [jogoNome, setJogoNome] = useState('');
    const [tecnico, setTecnico] = useState('');
    const [rivalNome, setRivalNome] = useState('');
    const [rivalLogo, setRivalLogo] = useState('');
    const [casaNome, setCasaNome] = useState('');
    const [casaLogo, setCasaLogo] = useState('');
    const [showNumbers, setShowNumbers] = useState(true);
    const [dataJogo, setDataJogo] = useState('');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Switches para campos opcionais
    const [useDataJogo, setUseDataJogo] = useState(false);
    const [useTecnico, setUseTecnico] = useState(false);
    const [useCasaInfo, setUseCasaInfo] = useState(false);
    const [useRivalInfo, setUseRivalInfo] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const isMobile = windowWidth < 1024; // Aumentado para cobrir tablets e evitar scroll horizontal

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchModalidade, setSearchModalidade] = useState('futebol');
    const { allStudents, turmas, loading: studentsLoading } = useDashboardData();

    // Auto-sync missing player numbers from student database
    useEffect(() => {
        if (jogadores.length > 0 && allStudents.length > 0) {
            let changed = false;
            const updatedJogadores = jogadores.map(j => {
                // If player has no number in convocation, look for it in allStudents
                if (!j.numero) {
                    const student = allStudents.find(s => s.uniqueId === j.id);
                    if ((student?.aluno as any)?.camisa) {
                        changed = true;
                        return { ...j, numero: (student!.aluno as any).camisa };
                    }
                }
                return j;
            });

            if (changed) {
                console.log("Auto-syced jersey numbers from student database");
                setJogadores(updatedJogadores);
            }
        }
    }, [allStudents, jogadores.length]);


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
        // Se futebol não estiver na lista mas existir futebol no sistema, garantir que o ID bata
        return list.length > 0 ? list : [{ id: 'futebol', label: 'Futebol', icon: '⚽' }];
    }, [allStudents]);

    useEffect(() => {
        if (activeModalidades.length > 0 && !activeModalidades.find(m => m.id === searchModalidade)) {
            // Se o atual não existe, e existe futebol, mantém futebol ou pega o primeiro
            const hasFutebol = activeModalidades.find(m => m.id === 'futebol');
            if (hasFutebol) setSearchModalidade('futebol');
            else setSearchModalidade(activeModalidades[0].id);
        }
    }, [activeModalidades, searchModalidade]);

    // Raffle and Image modal states
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (id) fetchConvocacao();
    }, [id]);

    const fetchConvocacao = async () => {
        try {
            setLoading(true, 'Carregando detalhes...');
            const docRef = doc(db, 'arena_simonesia_2026_convocacoes', id as string);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() } as Convocacao;
                setConvocacao(data);
                setJogadores(data.jogadores || []);
                setJogoNome(data.jogo || '');
                setTecnico(data.tecnico || '');
                setUseTecnico(!!data.tecnico);
                setRivalNome(data.rivalNome || '');
                setRivalLogo(data.rivalLogo || '');
                setUseRivalInfo(!!data.rivalNome || !!data.rivalLogo);
                setCasaNome(data.casaNome || '');
                setCasaLogo(data.casaLogo || '');
                setUseCasaInfo(!!data.casaLogo || (!!data.casaNome && data.casaNome !== 'Arena Simonésia'));
                setShowNumbers(data.showNumbers !== false); // Default to true

                // Converte Unix para formato de input datetime-local
                if (data.dataUnix) {
                    const date = new Date(data.dataUnix);
                    const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setDataJogo(localISO);
                }
                setUseDataJogo(data.showDataJogo !== false);
            } else {
                showAlert('Convocação não encontrada.', 'error');
                navigate('/admin/jogos/convocacao');
            }
        } catch (error) {
            console.error('Error fetching details:', error);
            showAlert('Erro ao buscar detalhes.', 'error');
        } finally {
            setLoading(false);
        }
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

    const handleSave = async () => {
        if (!convocacao) return;
        try {
            setLoading(true, 'Salvando alterações...');
            const docRef = doc(db, 'arena_simonesia_2026_convocacoes', convocacao.id as string);
            const updatedData = {
                ...convocacao,
                jogo: jogoNome,
                jogadores,
                tecnico: useTecnico ? tecnico.trim() : '',
                rivalNome: useRivalInfo ? rivalNome.trim() : '',
                rivalLogo: useRivalInfo ? (rivalLogo || '') : '',
                casaNome: useCasaInfo ? casaNome.trim() : 'Arena Simonésia',
                casaLogo: useCasaInfo ? (casaLogo || '') : '',
                showNumbers,
                showDataJogo: useDataJogo,
                dataUnix: useDataJogo && dataJogo ? new Date(dataJogo).getTime() : Date.now()
            };

            await updateDoc(docRef, updatedData);
            setConvocacao(updatedData as Convocacao);

            showAlert('Convocação atualizada com sucesso!', 'success');
        } catch (error) {
            console.error('Error updating:', error);
            showAlert('Erro ao atualizar convocação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (!id) return;

        showConfirm(
            'Tem certeza que deseja excluir esta convocação permanentemente?',
            async () => {
                try {
                    setLoading(true, 'Excluindo...');
                    const docRef = doc(db, 'arena_simonesia_2026_convocacoes', id);
                    await deleteDoc(docRef);
                    showAlert('Convocação excluída com sucesso!', 'success');
                    navigate('/admin/jogos/convocacao');
                } catch (error) {
                    console.error('Error deleting:', error);
                    showAlert('Erro ao excluir convocação.', 'error');
                } finally {
                    setLoading(false);
                }
            },
            'warning',
            'Confirmar Exclusão'
        );
    };



    const handleDragEnd = (event: DragEndEvent, categoria: 'titular' | 'reserva') => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setJogadores((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);

                // Only act if both are in the same category (they should be, given we filter)
                if (items[oldIndex]?.categoria === categoria && items[newIndex]?.categoria === categoria) {
                    return arrayMove(items, oldIndex, newIndex);
                }
                return items;
            });
        }
    };

    const handleRemovePlayer = (playerId: string) => {
        setJogadores(prev => prev.filter(j => j.id !== playerId));
    };

    const handleSwapCategory = (playerId: string) => {
        setJogadores(prev => prev.map(j => {
            if (j.id === playerId) {
                return { ...j, categoria: j.categoria === 'titular' ? 'reserva' : 'titular' };
            }
            return j;
        }));
    };

    const handleAddPlayer = (studentRaw: any, categoria: 'titular' | 'reserva') => {
        if (!studentRaw.aluno) return;

        if (jogadores.some(j => j.id === studentRaw.uniqueId)) {
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

        setJogadores(prev => [...prev, jogador]);
        showAlert(`${jogador.nome} adicionado!`, 'success');
    };



    const titulares = jogadores.filter(j => j.categoria === 'titular');
    const reservas = jogadores.filter(j => j.categoria === 'reserva');

    const filteredStudents = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const lowerSearch = searchTerm.toLowerCase();

        // Detectar se a busca contém anos (4 dígitos)
        const yearMatches = searchTerm.match(/\b(20\d{2})\b/g);

        if (yearMatches && yearMatches.length > 0) {
            // Se houver anos na busca, filtrar por eles
            return allStudents.filter(s =>
                s.aluno &&
                s.aluno.dataNascimento &&
                s.modalidade === searchModalidade &&
                yearMatches.includes(s.aluno.dataNascimento.includes('/') ? (s.aluno.dataNascimento.split('/').pop() || '') : s.aluno.dataNascimento.split('-')[0]) &&
                s.contractStatus !== 'desativado' &&
                !jogadores.some(j => j.id === s.uniqueId)
            ).sort((a, b) => {
                // Ordenação por nascimento (do mais velho para o mais novo)
                const dateA = a.aluno?.dataNascimento || '9999-99-99';
                const dateB = b.aluno?.dataNascimento || '9999-99-99';
                return dateA.localeCompare(dateB);
            }).slice(0, 20); // Aumentado limite para buscas por ano
        }

        // Caso contrário, busca por nome normal
        return allStudents.filter(s =>
            s.aluno &&
            s.modalidade === searchModalidade &&
            s.aluno.nome.toLowerCase().includes(lowerSearch) &&
            s.contractStatus !== 'desativado' &&
            !jogadores.some(j => j.id === s.uniqueId)
        ).slice(0, 8);
    }, [searchTerm, allStudents, jogadores, searchModalidade]);


    if (!convocacao) return null;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                marginBottom: '30px',
                background: '#fff',
                padding: '15px 25px',
                borderRadius: '12px',
                border: '1px solid #eee',
                gap: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(`${pathPrefix}/jogos/convocacao`)} style={{ background: '#f5f5f5', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                        <ArrowLeft size={20} color="#666" />
                    </button>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Trophy size={isMobile ? 20 : 24} color="#007d2f" />
                            <input
                                type="text"
                                value={jogoNome}
                                onChange={e => setJogoNome(e.target.value)}
                                placeholder="Nome do Jogo"
                                style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', border: 'none', borderBottom: '2px solid #eee', color: '#007d2f', fontWeight: '800', outline: 'none', padding: '0 5px 2px 5px', width: '100%', maxWidth: '400px', background: 'transparent' }}
                            />
                        </div>
                        <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ position: 'relative', display: 'inline-block', width: '30px', height: '16px', cursor: 'pointer', flexShrink: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={useDataJogo}
                                    onChange={e => {
                                        setUseDataJogo(e.target.checked);
                                        if (!e.target.checked) setDataJogo(new Date().toISOString().slice(0, 16));
                                    }}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: useDataJogo ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s' }}></span>
                                <span style={{ position: 'absolute', height: '12px', width: '12px', left: useDataJogo ? '15px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }}></span>
                            </label>
                            {useDataJogo ? (
                                <input
                                    type="datetime-local"
                                    value={dataJogo}
                                    onChange={e => setDataJogo(e.target.value)}
                                    style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', color: '#666', width: isMobile ? '100%' : 'auto' }}
                                />
                            ) : (
                                <span style={{ fontSize: '0.85rem', color: '#999', fontWeight: 'bold' }}>DATA OCULTA</span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setIsImageModalOpen(true)}
                            style={{ flex: 1, background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: isMobile ? '0.85rem' : '1rem' }}
                        >
                            <ImageIcon size={18} /> IMAGEM
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleSave}
                            style={{ flex: 1, background: '#007d2f', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(195,34,40,0.3)', fontSize: isMobile ? '0.85rem' : '1rem' }}
                        >
                            <Save size={18} /> SALVAR
                        </button>
                    </div>
                </div>
            </header>

            {/* OPÇÕES DE EXIBIÇÃO - BEM VISÍVEL */}
            <div style={{
                background: showNumbers ? '#fff9f9' : '#f5f5f5',
                padding: '20px',
                borderRadius: '12px',
                border: showNumbers ? '2px solid #ffdada' : '2px solid #ddd',
                marginBottom: '25px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: showNumbers ? '0 4px 12px rgba(195,34,40,0.08)' : 'none',
                transition: 'all 0.3s ease',
                gap: '15px'
            }}>
                <span style={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: '800', color: showNumbers ? '#007d2f' : '#666', textAlign: 'center' }}>
                    {showNumbers ? (isMobile ? 'NÚMEROS ATIVOS' : 'NÚMEROS DAS CAMISAS ATIVOS NA ARTE') : (isMobile ? 'NÚMEROS OCULTOS' : 'NÚMEROS DAS CAMISAS OCULTOS NA ARTE')}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer', flexShrink: 0 }}>
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

            {/* Info Cards - Técnico */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: useTecnico ? '#fff' : '#f5f5f5', padding: '20px', borderRadius: '12px', border: useTecnico ? '1px solid #eee' : '1px solid #ddd', boxShadow: useTecnico ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useTecnico ? '15px' : '0' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#666' }}>TÉCNICO (Opcional)</label>
                        <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={useTecnico}
                                onChange={e => {
                                    setUseTecnico(e.target.checked);
                                    if (!e.target.checked) setTecnico('');
                                }}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: useTecnico ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s' }}></span>
                            <span style={{ position: 'absolute', height: '14px', width: '14px', left: useTecnico ? '23px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }}></span>
                        </label>
                    </div>
                    {useTecnico && (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={tecnico}
                                onChange={e => setTecnico(e.target.value)}
                                placeholder="Nome do Técnico"
                                style={{ width: '100%', padding: '10px', paddingRight: '35px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none' }}
                            />
                            {tecnico && (
                                <button
                                    onClick={() => setTecnico('')}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Casa Options */}
            <div style={{ background: useCasaInfo ? '#fff1f0' : '#f5f5f5', padding: '20px', borderRadius: '12px', border: useCasaInfo ? '1px solid #ffccc7' : '1px solid #ddd', marginBottom: '20px', boxShadow: useCasaInfo ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useCasaInfo ? '15px' : '0' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: useCasaInfo ? '#007d2f' : '#666' }}>INFORMAÇÕES DO TIME DA CASA (Opcional)</label>
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
                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: useCasaInfo ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s' }}></span>
                        <span style={{ position: 'absolute', height: '14px', width: '14px', left: useCasaInfo ? '23px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }}></span>
                    </label>
                </div>

                {useCasaInfo && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#007d2f', marginBottom: '8px' }}>NOME DO TIME DA CASA</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={casaNome}
                                    onChange={e => setCasaNome(e.target.value)}
                                    placeholder="Ex: Arena Simonésia"
                                    style={{ width: '100%', padding: '10px', paddingRight: '35px', border: '1px solid #ffccc7', borderRadius: '8px', outline: 'none' }}
                                />
                                {casaNome && (
                                    <button
                                        onClick={() => setCasaNome('')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff7875', cursor: 'pointer', display: 'flex' }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#007d2f', marginBottom: '8px' }}>LOGO DA CASA</label>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCasaLogoUpload}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                />
                                {casaLogo && (
                                    <div style={{ position: 'relative' }}>
                                        <img src={casaLogo} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #eee' }} />
                                        <button
                                            onClick={() => setCasaLogo('')}
                                            style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Rival Options */}
            <div style={{ background: useRivalInfo ? '#fff' : '#f5f5f5', padding: '20px', borderRadius: '12px', border: useRivalInfo ? '1px solid #eee' : '1px solid #ddd', marginBottom: '30px', boxShadow: useRivalInfo ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useRivalInfo ? '15px' : '0' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#666' }}>INFORMAÇÕES DO TIME RIVAL (Opcional)</label>
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
                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: useRivalInfo ? '#007d2f' : '#ccc', borderRadius: '34px', transition: '.4s' }}></span>
                        <span style={{ position: 'absolute', height: '14px', width: '14px', left: useRivalInfo ? '23px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }}></span>
                    </label>
                </div>

                {useRivalInfo && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#666', marginBottom: '8px' }}>NOME DO TIME RIVAL</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={rivalNome}
                                    onChange={e => setRivalNome(e.target.value)}
                                    placeholder="Ex: Aliança FC"
                                    style={{ width: '100%', padding: '10px', paddingRight: '35px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none' }}
                                />
                                {rivalNome && (
                                    <button
                                        onClick={() => setRivalNome('')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#666', marginBottom: '8px' }}>LOGO DO RIVAL</label>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                />
                                {rivalLogo && (
                                    <div style={{ position: 'relative' }}>
                                        <img src={rivalLogo} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #eee' }} />
                                        <button
                                            onClick={() => setRivalLogo('')}
                                            style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Ações Auxiliares - Add Jogador Full Width */}
            <div style={{ marginBottom: '25px' }}>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        width: '100%',
                        background: '#fff',
                        color: '#007d2f',
                        border: '2px solid #007d2f',
                        padding: '15px',
                        borderRadius: '12px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontSize: '1.1rem',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(195,34,40,0.1)'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <Plus size={22} strokeWidth={3} /> ADICIONAR JOGADOR À CONVOCAÇÃO
                </button>
            </div>

            {/* Content */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '25px', alignItems: 'start' }}>

                {/* Titulares */}
                <div style={{ background: '#fdfdfd', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#333', fontWeight: '800', margin: '0 0 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        TITULARES <span style={{ background: '#e6f7ff', color: '#0050b3', padding: '4px 12px', borderRadius: '12px', fontSize: '0.9rem' }}>{titulares.length}</span>
                    </h2>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'titular')}>
                        <SortableContext items={titulares.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {titulares.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#999', background: '#fff', borderRadius: '8px', border: '1px dashed #ddd' }}>Nenhum titular.</div>}
                                {titulares.map(t => (
                                    <SortableJogadorItem key={t.id} id={t.id} jogador={t} showNumbers={showNumbers} onRemove={handleRemovePlayer} onSwap={handleSwapCategory} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {/* Reservas */}
                <div style={{ background: '#fdfdfd', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#333', fontWeight: '800', margin: '0 0 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        RESERVAS <span style={{ background: '#f6ffed', color: '#389e0d', padding: '4px 12px', borderRadius: '12px', fontSize: '0.9rem' }}>{reservas.length}</span>
                    </h2>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'reserva')}>
                        <SortableContext items={reservas.map(r => r.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {reservas.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#999', background: '#fff', borderRadius: '8px', border: '1px dashed #ddd' }}>Nenhum reserva.</div>}
                                {reservas.map(r => (
                                    <SortableJogadorItem key={r.id} id={r.id} jogador={r} showNumbers={showNumbers} onRemove={handleRemovePlayer} onSwap={handleSwapCategory} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            {/* Add Player Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                        <div style={{ padding: isMobile ? '15px 20px' : '20px 25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd' }}>
                            <h2 style={{ margin: 0, color: '#333', fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: '800' }}>Adicionar Jogador</h2>
                            <button onClick={() => { setIsModalOpen(false); setSearchTerm(''); setSearchModalidade('futebol'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                                <X size={isMobile ? 20 : 24} />
                            </button>
                        </div>

                        <div style={{ padding: isMobile ? '15px' : '25px', background: '#fcfcfc' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '0 15px', gap: '10px' }}>
                                    <Search size={20} color="#999" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Nome ou Ano (ex: 2017, 2018)..."
                                        style={{ width: '100%', padding: '12px 0', border: 'none', fontSize: '1rem', outline: 'none', background: 'transparent' }}
                                        autoFocus
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

                            <div style={{ marginTop: '15px', maxHeight: '350px', overflowY: 'auto' }}>
                                {studentsLoading && <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>Carregando base de alunos...</div>}
                                {!studentsLoading && searchTerm.length >= 2 && filteredStudents.length === 0 && <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>Nenhum aluno encontrado (ou todos já foram adicionados).</div>}

                                {filteredStudents.map(student => (
                                    <div key={student.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #eee', background: '#fff', borderRadius: '8px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f5f5', overflow: 'hidden' }}>
                                                {student.aluno?.fotoUrl ? <img src={student.aluno.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#aaa" style={{ margin: '10px' }} />}
                                            </div>
                                            <div>
                                                <Link
                                                    to={`/admin/details/${student.regId}`}
                                                    style={{ fontWeight: '800', color: '#007d2f', textDecoration: 'underline', textTransform: 'uppercase', fontSize: '0.95rem', display: 'block' }}
                                                >
                                                    {student.aluno?.nome}
                                                </Link>
                                                <div style={{ fontSize: '0.8rem', color: '#888' }}>{turmas.find(t => t.id === student.aluno?.turmaId)?.nome || 'Sem Turma'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'flex-end', width: '110px' }}>
                                            <button
                                                onClick={() => handleAddPlayer(student, 'titular')}
                                                style={{ width: '100%', background: '#e6f7ff', color: '#0050b3', border: '1px solid #91d5ff', padding: '6px 5px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                            >+ TITULAR</button>
                                            <button
                                                onClick={() => handleAddPlayer(student, 'reserva')}
                                                style={{ width: '100%', background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f', padding: '6px 5px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                            >+ RESERVA</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Botão de Excluir no Final */}
            <div style={{ marginTop: '50px', paddingTop: '30px', borderTop: '2px dashed #eee', display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={handleDelete}
                    style={{
                        background: '#fff',
                        color: '#ff4d4f',
                        border: '2px solid #ff4d4f',
                        padding: '12px 25px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#fff1f0'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    <Trash2 size={20} /> EXCLUIR ESTA CONVOCAÇÃO
                </button>
            </div>

            <ConvocacaoImageModal
                isOpen={isImageModalOpen}
                convocacao={convocacao}
                onClose={() => setIsImageModalOpen(false)}
            />
        </div>
    );
}
