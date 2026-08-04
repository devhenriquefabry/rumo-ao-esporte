import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { ArrowLeft, Save, Plus, Users, Search, X, Trophy, GripVertical, ArrowRightLeft, Trash2, Image as ImageIcon } from 'lucide-react';
import { useDashboardData } from './AdminDashboard/hooks/useDashboardData';
import type { AutorizacaoConfig, Convocacao, ConvocacaoJogador } from '../types/convocacao';
import PageContainer from '../components/PageContainer';
import { ConvocacaoToggle, Switch, CONV_UI } from '../components/convocacao/ConvocacaoToggle';
import AutorizacaoSection from '../components/convocacao/AutorizacaoSection';

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
    accent: string;
    onRemove: (id: string) => void;
    onSwap: (id: string) => void;
}

function SortableJogadorItem({ id, jogador, showNumbers, accent, onRemove, onSwap }: SortableJogadorItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const isTeacherPortal = window.location.pathname.startsWith('/professor');
    const alunoLink = isTeacherPortal
        ? `/professor/aluno/${jogador.regId || jogador.id.split('_')[0]}/${jogador.id.includes('_') ? jogador.id.split('_')[1] : '0'}`
        : `/admin/details/${jogador.regId || jogador.id.split('_')[0]}`;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '10px', padding: '12px 15px', marginBottom: '10px', boxShadow: CONV_UI.shadow }}>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#c3d3e8', marginRight: '15px' }}>
                <GripVertical size={20} />
            </div>

            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: CONV_UI.blueSoft, overflow: 'hidden', marginRight: '15px', flexShrink: 0 }}>
                {jogador.photo ? <img src={jogador.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#8ea3c0" style={{ margin: '10px' }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                    to={alunoLink}
                    style={{ fontWeight: 800, color: accent, textDecoration: 'none', textTransform: 'uppercase', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                >
                    {jogador.nome}
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#63708a' }}>{jogador.turma || 'Sem Turma'}</div>
                    {!jogador.numero && showNumbers && (
                        <Link
                            to={alunoLink}
                            style={{
                                fontSize: '0.65rem',
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

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                {showNumbers && (
                    jogador.numero ? (
                        <div style={{
                            width: '45px',
                            padding: '6px 4px',
                            textAlign: 'center',
                            border: `2px solid ${accent}`,
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            background: '#fff',
                            color: CONV_UI.navy
                        }}>
                            {jogador.numero}
                        </div>
                    ) : (
                        <div style={{ width: '45px' }} />
                    )
                )}
                <button onClick={(e) => { e.stopPropagation(); onSwap(id); }} title="Mover Categoria" style={{ background: CONV_UI.surfaceSoft, border: `1px solid ${CONV_UI.border}`, padding: '8px', borderRadius: '6px', color: '#63708a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRightLeft size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemove(id); }} title="Remover" style={{ background: '#fdeeec', border: '1px solid #f8cfc9', padding: '8px', borderRadius: '6px', color: CONV_UI.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    const [categoria, setCategoria] = useState('');
    const [tecnico, setTecnico] = useState('');
    const [rivalNome, setRivalNome] = useState('');
    const [rivalLogo, setRivalLogo] = useState('');
    const [casaNome, setCasaNome] = useState('');
    const [casaLogo, setCasaLogo] = useState('');
    const [showNumbers, setShowNumbers] = useState(true);
    const [dataJogo, setDataJogo] = useState('');
    const [autorizacao, setAutorizacao] = useState<AutorizacaoConfig>({ ativa: false });
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Switches para campos opcionais
    const [useDataJogo, setUseDataJogo] = useState(false);
    const [useCategoria, setUseCategoria] = useState(false);
    const [useTecnico, setUseTecnico] = useState(false);
    const [useCasaInfo, setUseCasaInfo] = useState(false);
    const [useRivalInfo, setUseRivalInfo] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 1024;

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
        return list.length > 0 ? list : [{ id: 'futebol', label: 'Futebol', icon: '⚽' }];
    }, [allStudents]);

    useEffect(() => {
        if (activeModalidades.length > 0 && !activeModalidades.find(m => m.id === searchModalidade)) {
            const hasFutebol = activeModalidades.find(m => m.id === 'futebol');
            if (hasFutebol) setSearchModalidade('futebol');
            else setSearchModalidade(activeModalidades[0].id);
        }
    }, [activeModalidades, searchModalidade]);

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
            const docRef = doc(db, 'rumo_ao_esporte_2026_convocacoes', id as string);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() } as Convocacao;
                setConvocacao(data);
                setJogadores(data.jogadores || []);
                setJogoNome(data.jogo || '');
                setCategoria(data.categoria || '');
                setUseCategoria(!!data.categoria);
                setTecnico(data.tecnico || '');
                setUseTecnico(!!data.tecnico);
                setRivalNome(data.rivalNome || '');
                setRivalLogo(data.rivalLogo || '');
                setUseRivalInfo(!!data.rivalNome || !!data.rivalLogo);
                setCasaNome(data.casaNome || '');
                setCasaLogo(data.casaLogo || '');
                setUseCasaInfo(!!data.casaLogo || (!!data.casaNome && data.casaNome !== 'Rumo ao Esporte'));
                setShowNumbers(data.showNumbers !== false); // Default to true
                setAutorizacao(data.autorizacao || { ativa: false });

                // Converte Unix para formato de input datetime-local
                if (data.dataUnix) {
                    const date = new Date(data.dataUnix);
                    const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setDataJogo(localISO);
                }
                setUseDataJogo(data.showDataJogo !== false);
            } else {
                showAlert('Convocação não encontrada.', 'error');
                navigate(`${pathPrefix}/jogos/convocacao`);
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

    const handleSave = async () => {
        if (!convocacao) return;
        try {
            setLoading(true, 'Salvando alterações...');
            const docRef = doc(db, 'rumo_ao_esporte_2026_convocacoes', convocacao.id as string);

            // Firestore recusa `undefined`, e os campos do termo são opcionais.
            const autorizacaoLimpa = Object.fromEntries(
                Object.entries({ ...autorizacao, atualizadoEm: Date.now() }).filter(([, v]) => v !== undefined)
            ) as unknown as AutorizacaoConfig;

            const updatedData = {
                ...convocacao,
                autorizacao: autorizacaoLimpa,
                jogo: jogoNome,
                jogadores,
                categoria: useCategoria ? categoria.trim() : '',
                tecnico: useTecnico ? tecnico.trim() : '',
                rivalNome: useRivalInfo ? rivalNome.trim() : '',
                rivalLogo: useRivalInfo ? (rivalLogo || '') : '',
                casaNome: useCasaInfo ? casaNome.trim() : 'Rumo ao Esporte',
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
                    const docRef = doc(db, 'rumo_ao_esporte_2026_convocacoes', id);
                    await deleteDoc(docRef);
                    showAlert('Convocação excluída com sucesso!', 'success');
                    navigate(`${pathPrefix}/jogos/convocacao`);
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

    const handleDragEnd = (event: DragEndEvent, categoriaLista: 'titular' | 'reserva') => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setJogadores((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);

                // Only act if both are in the same category (they should be, given we filter)
                if (items[oldIndex]?.categoria === categoriaLista && items[newIndex]?.categoria === categoriaLista) {
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

    const handleAddPlayer = (studentRaw: any, categoriaJogador: 'titular' | 'reserva') => {
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
            categoria: categoriaJogador,
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
            }).slice(0, 20);
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

    const renderLista = (
        titulo: string,
        lista: ConvocacaoJogador[],
        accent: string,
        accentSoft: string,
        categoriaLista: 'titular' | 'reserva'
    ) => (
        <div style={{ background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '12px', padding: '20px', boxShadow: CONV_UI.shadow }}>
            <h2 style={{ fontSize: '1.1rem', color: CONV_UI.navy, fontWeight: 800, margin: '0 0 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {titulo} <span style={{ background: accentSoft, color: accent, padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem' }}>{lista.length}</span>
            </h2>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, categoriaLista)}>
                <SortableContext items={lista.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {lista.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#8ea3c0', background: CONV_UI.surfaceSoft, borderRadius: '8px', border: `1px dashed ${CONV_UI.border}` }}>
                                Nenhum atleta nesta lista.
                            </div>
                        )}
                        {lista.map(t => (
                            <SortableJogadorItem
                                key={t.id}
                                id={t.id}
                                jogador={t}
                                accent={accent}
                                showNumbers={showNumbers}
                                onRemove={handleRemovePlayer}
                                onSwap={handleSwapCategory}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );

    return (
        <PageContainer>
            {/* Header */}
            <header style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                marginBottom: '25px',
                background: '#fff',
                padding: '18px 22px',
                borderRadius: '12px',
                border: `1px solid ${CONV_UI.border}`,
                boxShadow: CONV_UI.shadow,
                gap: '18px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0 }}>
                    <button onClick={() => navigate(`${pathPrefix}/jogos/convocacao`)} style={{ background: CONV_UI.blueSoft, border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                        <ArrowLeft size={20} color={CONV_UI.blue} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Trophy size={isMobile ? 20 : 24} color={CONV_UI.green} />
                            <input
                                type="text"
                                value={jogoNome}
                                onChange={e => setJogoNome(e.target.value)}
                                placeholder="Nome do Jogo"
                                style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', border: 'none', borderBottom: `2px solid ${CONV_UI.border}`, color: CONV_UI.navy, fontWeight: 800, outline: 'none', padding: '0 5px 2px 5px', width: '100%', maxWidth: '420px', background: 'transparent' }}
                            />
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <Switch
                                checked={useDataJogo}
                                onChange={(v) => {
                                    setUseDataJogo(v);
                                    if (!v) setDataJogo(new Date().toISOString().slice(0, 16));
                                }}
                            />
                            {useDataJogo ? (
                                <input
                                    type="datetime-local"
                                    value={dataJogo}
                                    onChange={e => setDataJogo(e.target.value)}
                                    style={{ padding: '6px 10px', border: `1px solid ${CONV_UI.border}`, borderRadius: '6px', fontSize: '0.85rem', outline: 'none', color: CONV_UI.navy }}
                                />
                            ) : (
                                <span style={{ fontSize: '0.82rem', color: '#8ea3c0', fontWeight: 'bold' }}>DATA A CONFIRMAR NA ARTE</span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <button
                        onClick={() => setIsImageModalOpen(true)}
                        style={{ flex: 1, background: CONV_UI.blueSoft, color: CONV_UI.blue, border: `1px solid ${CONV_UI.border}`, padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: isMobile ? '0.85rem' : '0.95rem' }}
                    >
                        <ImageIcon size={18} /> GERAR ARTE
                    </button>
                    <button
                        onClick={handleSave}
                        style={{ flex: 1, background: CONV_UI.green, color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,166,58,0.25)', fontSize: isMobile ? '0.85rem' : '0.95rem' }}
                    >
                        <Save size={18} /> SALVAR
                    </button>
                </div>
            </header>

            {/* Opções da arte */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                <ConvocacaoToggle
                    label="NÚMEROS DAS CAMISAS NA ARTE"
                    hint={showNumbers ? 'Os números aparecem antes de cada nome' : 'A arte mostra apenas os nomes'}
                    checked={showNumbers}
                    onChange={setShowNumbers}
                />
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
                    />
                </ConvocacaoToggle>
                <ConvocacaoToggle
                    label="TÉCNICO (Opcional)"
                    checked={useTecnico}
                    onChange={(v) => {
                        setUseTecnico(v);
                        if (!v) setTecnico('');
                    }}
                >
                    <input
                        type="text"
                        value={tecnico}
                        onChange={e => setTecnico(e.target.value)}
                        placeholder="Nome do Técnico"
                        style={CONV_UI.input}
                    />
                </ConvocacaoToggle>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '25px' }}>
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
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div>
                            <label style={CONV_UI.label}>NOME DO TIME DA CASA</label>
                            <input
                                type="text"
                                value={casaNome}
                                onChange={e => setCasaNome(e.target.value)}
                                placeholder="Ex: Rumo ao Esporte"
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>LOGO DA CASA (substitui o escudo na arte)</label>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <input type="file" accept="image/*" onChange={handleCasaLogoUpload} style={{ flex: 1, fontSize: '0.85rem' }} />
                                {casaLogo && (
                                    <div style={{ position: 'relative' }}>
                                        <img src={casaLogo} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${CONV_UI.border}` }} />
                                        <button
                                            onClick={() => setCasaLogo('')}
                                            style={{ position: 'absolute', top: '-8px', right: '-8px', background: CONV_UI.danger, color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ConvocacaoToggle>

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
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div>
                            <label style={CONV_UI.label}>NOME DO TIME RIVAL</label>
                            <input
                                type="text"
                                value={rivalNome}
                                onChange={e => setRivalNome(e.target.value)}
                                placeholder="Ex: Aliança FC"
                                style={CONV_UI.input}
                            />
                        </div>
                        <div>
                            <label style={CONV_UI.label}>LOGO DO RIVAL</label>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ flex: 1, fontSize: '0.85rem' }} />
                                {rivalLogo && (
                                    <div style={{ position: 'relative' }}>
                                        <img src={rivalLogo} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${CONV_UI.border}` }} />
                                        <button
                                            onClick={() => setRivalLogo('')}
                                            style={{ position: 'absolute', top: '-8px', right: '-8px', background: CONV_UI.danger, color: '#fff', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ConvocacaoToggle>
            </div>

            {/* Autorização para participação e deslocamento */}
            <AutorizacaoSection
                tituloEvento={jogoNome}
                config={autorizacao}
                onChange={setAutorizacao}
                jogadores={jogadores}
                convocacaoId={convocacao.id}
                isMobile={isMobile}
            />

            {/* Adicionar jogador */}
            <div style={{ marginBottom: '25px' }}>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        width: '100%',
                        background: '#fff',
                        color: CONV_UI.green,
                        border: `2px dashed ${CONV_UI.green}`,
                        padding: '16px',
                        borderRadius: '12px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = CONV_UI.greenSoft; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <Plus size={22} strokeWidth={3} /> ADICIONAR ATLETA À CONVOCAÇÃO
                </button>
            </div>

            {/* Listas */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
                {renderLista('TITULARES', titulares, CONV_UI.blue, CONV_UI.blueSoft, 'titular')}
                {renderLista('RESERVAS', reservas, CONV_UI.green, CONV_UI.greenSoft, 'reserva')}
            </div>

            {/* Add Player Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,26,64,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '640px', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,36,92,0.28)', overflow: 'hidden' }}>
                        <div style={{ padding: isMobile ? '15px 20px' : '18px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800 }}>Adicionar Atleta</h2>
                            <button onClick={() => { setIsModalOpen(false); setSearchTerm(''); }} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                <X size={isMobile ? 20 : 22} />
                            </button>
                        </div>

                        <div style={{ padding: isMobile ? '15px' : '25px', background: CONV_UI.surfaceSoft }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '8px', padding: '0 15px', gap: '10px' }}>
                                    <Search size={20} color="#8ea3c0" />
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
                                    style={{ width: isMobile ? '120px' : '180px', padding: '12px 10px', borderRadius: '8px', border: `1px solid ${CONV_UI.border}`, fontSize: '0.85rem', outline: 'none', background: '#fff', fontWeight: 'bold', cursor: 'pointer', color: CONV_UI.navy }}
                                >
                                    {activeModalidades.map(m => (
                                        <option key={m.id} value={m.id}>{m.icon} {m.label.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginTop: '15px', maxHeight: '350px', overflowY: 'auto' }}>
                                {studentsLoading && <div style={{ padding: '15px', textAlign: 'center', color: '#8ea3c0' }}>Carregando base de alunos...</div>}
                                {!studentsLoading && searchTerm.length >= 2 && filteredStudents.length === 0 && <div style={{ padding: '15px', textAlign: 'center', color: '#8ea3c0' }}>Nenhum aluno encontrado (ou todos já foram adicionados).</div>}

                                {filteredStudents.map(student => (
                                    <div key={student.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', border: `1px solid ${CONV_UI.border}`, borderRadius: '8px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0 }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: CONV_UI.blueSoft, overflow: 'hidden', flexShrink: 0 }}>
                                                {student.aluno?.fotoUrl ? <img src={student.aluno.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#8ea3c0" style={{ margin: '10px' }} />}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <Link
                                                    to={`/admin/details/${student.regId}`}
                                                    style={{ fontWeight: 800, color: CONV_UI.navy, textDecoration: 'none', textTransform: 'uppercase', fontSize: '0.92rem', display: 'block' }}
                                                >
                                                    {student.aluno?.nome}
                                                </Link>
                                                <div style={{ fontSize: '0.78rem', color: '#63708a' }}>{turmas.find(t => t.id === student.aluno?.turmaId)?.nome || 'Sem Turma'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'flex-end', width: '112px', flexShrink: 0 }}>
                                            <button onClick={() => handleAddPlayer(student, 'titular')} style={{ ...CONV_UI.addTitular, width: '100%' }}>+ TITULAR</button>
                                            <button onClick={() => handleAddPlayer(student, 'reserva')} style={{ ...CONV_UI.addReserva, width: '100%' }}>+ RESERVA</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Excluir */}
            <div style={{ marginTop: '45px', paddingTop: '25px', borderTop: `2px dashed ${CONV_UI.border}`, display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={handleDelete}
                    style={{
                        background: '#fff',
                        color: CONV_UI.danger,
                        border: `2px solid ${CONV_UI.danger}`,
                        padding: '12px 25px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#fdeeec'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}
                >
                    <Trash2 size={20} /> EXCLUIR ESTA CONVOCAÇÃO
                </button>
            </div>

            <ConvocacaoImageModal
                isOpen={isImageModalOpen}
                convocacao={convocacao}
                onClose={() => setIsImageModalOpen(false)}
            />
        </PageContainer>
    );
}
