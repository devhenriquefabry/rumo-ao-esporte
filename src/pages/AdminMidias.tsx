import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { LazyImageGrid } from '../components/LazyImageGrid';
import type { Midia } from '../types/midia';
import { useDashboardData } from './AdminDashboard/hooks/useDashboardData';
import { Upload, Search, X, Users, Image as ImageIcon, Trophy } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

export default function AdminMidias() {
    const [midias, setMidias] = useState<Midia[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { setLoading } = useLoading();
    const { showAlert } = useDialog();
    const { allStudents } = useDashboardData();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAluno, setSelectedAluno] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [isUploadConvocacao, setIsUploadConvocacao] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);

    // Global gallery states
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');

    useEffect(() => {
        fetchMidias();
    }, []);

    const fetchMidias = async () => {
        try {
            setLoading(true, 'Carregando mídias...');
            const q = query(collection(db, 'arena_simonesia_2026_midias'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Midia));
            setMidias(data);
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar mídias.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta mídia? (A exclusão é apenas no banco de dados, o arquivo no R2 continuará existindo).")) return;

        try {
            await deleteDoc(doc(db, 'arena_simonesia_2026_midias', id));
            setMidias(prev => prev.filter(m => m.id !== id));
            showAlert('Mídia excluída do sistema.', 'success');
        } catch (error) {
            console.error(error);
            showAlert('Erro ao excluir mídia.', 'error');
        }
    };

    const handleToggleConvocacao = async (id: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'arena_simonesia_2026_midias', id), {
                isConvocacao: !currentStatus
            });
            setMidias(prev => prev.map(m => m.id === id ? { ...m, isConvocacao: !currentStatus } : m));
            showAlert(currentStatus ? 'Removida de Imagens de Convocação' : 'Marcada como Imagem de Convocação!', 'success');
        } catch (error) {
            console.error(error);
            showAlert('Erro ao atualizar status.', 'error');
        }
    };

    const filteredStudents = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const termUrl = searchTerm.toLowerCase();
        return allStudents.filter(s =>
            s.aluno?.nome?.toLowerCase().includes(termUrl) ||
            s.responsavel?.nome?.toLowerCase().includes(termUrl)
        ).slice(0, 10);
    }, [searchTerm, allStudents]);

    const handleConfirmUpload = async () => {
        if (!fileToUpload || !selectedAluno) return;

        setUploading(true);
        try {
            const compressed = await compressImage(fileToUpload);
            const formData = new FormData();
            formData.append('file', compressed, fileToUpload.name);
            formData.append('folder', `arena_simonesia_2026_midias/${selectedAluno.uniqueId}`);

            const workerUrl = import.meta.env.VITE_WORKER_URL;
            const res = await fetch(`${workerUrl}/images/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Falha no upload R2');
            const data = await res.json();
            const url = data.data?.url || data.url;

            if (url) {
                const docRef = await addDoc(collection(db, 'arena_simonesia_2026_midias'), {
                    url,
                    alunoId: selectedAluno.uniqueId,
                    isConvocacao: isUploadConvocacao,
                    createdAt: Date.now()
                });

                setMidias(prev => [{
                    id: docRef.id,
                    url,
                    alunoId: selectedAluno.uniqueId,
                    isConvocacao: isUploadConvocacao,
                    createdAt: Date.now()
                }, ...prev]);

                showAlert('Upload concluído com sucesso!', 'success');
                setIsUploadModalOpen(false);
                setSelectedAluno(null);
                setSearchTerm('');
                setIsUploadConvocacao(false);
                setFileToUpload(null);
            }
        } catch (error) {
            console.error(error);
            showAlert('Erro ao fazer upload.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const getAlunoName = (alunoId: string) => {
        const student = allStudents.find(s => s.uniqueId === alunoId);
        return student?.aluno?.nome || 'Desconhecido';
    };

    const filteredGlobalMidias = useMemo(() => {
        if (!globalSearchTerm.trim()) return midias;
        const term = globalSearchTerm.toLowerCase();
        return midias.filter(m => {
            const studentName = getAlunoName(m.alunoId).toLowerCase();
            return studentName.includes(term);
        });
    }, [midias, globalSearchTerm, allStudents]);

    const totalDestaques = midias.filter(m => m.isConvocacao).length;
    const totalAlunosComFoto = new Set(midias.map(m => m.alunoId)).size;

    return (
        <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, color: '#333', fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ImageIcon size={28} color="#007d2f" /> Mídias Globais
                </h1>
                <button
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{ background: '#007d2f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Upload size={18} /> UPLOAD DE MÍDIA
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#ffebee', padding: '15px', borderRadius: '12px' }}>
                        <ImageIcon size={24} color="#007d2f" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>Total de Fotos</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#007d2f' }}>{midias.length}</div>
                    </div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#fff9c4', padding: '15px', borderRadius: '12px' }}>
                        <Trophy size={24} color="#f57f17" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>Fotos de Destaque</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f57f17' }}>{totalDestaques}</div>
                    </div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '12px' }}>
                        <Users size={24} color="#1565c0" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>Alunos com Mídia</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1565c0' }}>{totalAlunosComFoto}</div>
                    </div>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333', fontWeight: '800' }}>Acervo de Imagens</h2>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '8px', padding: '0 15px', width: '300px', maxWidth: '100%', border: '1px solid #eee', transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#007d2f'} onBlur={e => e.currentTarget.style.borderColor = '#eee'}>
                        <Search size={18} color="#999" />
                        <input
                            type="text"
                            placeholder="Buscar por nome do aluno..."
                            value={globalSearchTerm}
                            onChange={e => setGlobalSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: '#333' }}
                        />
                    </div>
                </div>

                <LazyImageGrid
                    midias={filteredGlobalMidias}
                    onDelete={handleDelete}
                    onToggleConvocacao={handleToggleConvocacao}
                    showAlunoName={true}
                    getAlunoName={getAlunoName}
                />
            </div>

            {/* Modal de Upload */}
            {isUploadModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '20px' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '850px', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '25px 30px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Upload size={24} color="#007d2f" /> Adicionar Nova Mídia
                                </h2>
                                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>Vincule uma imagem ao perfil de um aluno.</p>
                            </div>
                            <button onClick={() => { setIsUploadModalOpen(false); setSelectedAluno(null); setSearchTerm(''); setFileToUpload(null); setIsUploadConvocacao(false); }} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#eee'} onMouseOut={e => e.currentTarget.style.background = '#f5f5f5'}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                                {/* Left Column: Search Student */}
                                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#333', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                                        <span style={{ background: '#007d2f', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
                                        Identifique o Aluno
                                    </h3>

                                    {!selectedAluno ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '12px', padding: '5px 15px', marginBottom: '15px', border: '1px solid #e0e0e0', transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = '#007d2f'} onBlur={e => e.currentTarget.style.borderColor = '#e0e0e0'}>
                                                <Search size={20} color="#999" />
                                                <input
                                                    type="text"
                                                    placeholder="Busque pelo nome..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                    style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: '#333' }}
                                                />
                                            </div>

                                            <div style={{ border: '1px solid #eee', borderRadius: '12px', flex: 1, maxHeight: '280px', overflowY: 'auto', background: '#fafafa' }}>
                                                {searchTerm.length < 2 && (
                                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                        <Users size={32} color="#ddd" />
                                                        <span>Digite pelo menos 2 letras para listar alunos...</span>
                                                    </div>
                                                )}
                                                {searchTerm.length >= 2 && filteredStudents.length === 0 && (
                                                    <div style={{ padding: '30px 20px', textAlign: 'center', color: '#999' }}>Nenhum aluno encontrado com "{searchTerm}".</div>
                                                )}
                                                {searchTerm.length >= 2 && filteredStudents.map(student => (
                                                    <div
                                                        key={student.uniqueId}
                                                        onClick={() => setSelectedAluno(student)}
                                                        style={{ padding: '15px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                                                        onMouseOver={e => e.currentTarget.style.background = '#fefcfc'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eee', overflow: 'hidden', flexShrink: 0, border: '1px solid #ddd' }}>
                                                            {student.aluno?.fotoUrl ? <img src={student.aluno.fotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#aaa" style={{ margin: '9px' }} />}
                                                        </div>
                                                        <div style={{ overflow: 'hidden' }}>
                                                            <div style={{ fontWeight: '800', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1rem' }}>{student.aluno?.nome}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Responsável: {student.responsavel?.nome}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ background: '#fcfcfc', border: '2px solid #52c41a', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1, justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#52c41a' }}></div>
                                                <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#eee', overflow: 'hidden', marginBottom: '20px', border: '4px solid #fff', boxShadow: '0 4px 15px rgba(82, 196, 26, 0.3)' }}>
                                                    {selectedAluno.aluno?.fotoUrl ? <img src={selectedAluno.aluno.fotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={40} color="#aaa" style={{ margin: '21px' }} />}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#52c41a', fontWeight: '900', marginBottom: '8px', letterSpacing: '1px' }}>ALUNO SELECIONADO</div>
                                                <div style={{ fontWeight: '900', color: '#333', fontSize: '1.3rem', marginBottom: '25px', lineHeight: '1.2' }}>{selectedAluno.aluno?.nome}</div>

                                                <button onClick={() => setSelectedAluno(null)} style={{ background: '#fff', border: '1px solid #ddd', color: '#666', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: '10px 25px', borderRadius: '25px', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                                                    TROCAR ALUNO
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Upload */}
                                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: selectedAluno ? '#333' : '#aaa', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.3s', fontWeight: '800' }}>
                                        <span style={{ background: selectedAluno ? '#333' : '#aaa', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', transition: 'background 0.3s' }}>2</span>
                                        Envio do Arquivo
                                    </h3>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        {!selectedAluno && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', backdropFilter: 'blur(1px)' }}>
                                                <div style={{ background: '#fff', padding: '12px 25px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', color: '#666', fontWeight: 'bold', fontSize: '0.95rem', border: '1px solid #eee' }}>
                                                    Selecione um aluno primeiro
                                                </div>
                                            </div>
                                        )}

                                        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '3px dashed', borderColor: selectedAluno ? '#e0e0e0' : '#eee', borderRadius: '16px', cursor: (uploading || !selectedAluno) ? 'not-allowed' : 'pointer', background: selectedAluno ? '#fafafa' : '#fff', transition: 'all 0.3s', minHeight: '300px' }}
                                            onMouseOver={e => { if (!uploading && selectedAluno) { e.currentTarget.style.borderColor = '#007d2f'; e.currentTarget.style.background = '#fffbfc'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
                                            onMouseOut={e => { if (!uploading && selectedAluno) { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                        >
                                            {uploading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                                    <div style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #007d2f', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px', boxShadow: '0 0 15px rgba(0, 125, 47, 0.2)' }}></div>
                                                    <span style={{ fontWeight: '900', color: '#007d2f', fontSize: '1.1rem' }}>Enviando ao Cloudflare...</span>
                                                    <span style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>Otimizando qualidade e armazenando.</span>
                                                </div>
                                            ) : fileToUpload ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                                    <div style={{ background: '#e6f7ff', padding: '15px', borderRadius: '50%', color: '#0050b3' }}>
                                                        <ImageIcon size={40} />
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: '#333', textAlign: 'center' }}>Arquivo Selecionado:</span>
                                                    <span style={{ fontSize: '0.9rem', color: '#666', background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileToUpload.name}</span>

                                                    <button
                                                        onClick={(e) => { e.preventDefault(); setFileToUpload(null); }}
                                                        style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.85rem', marginTop: '5px', textDecoration: 'underline' }}
                                                    >
                                                        Escolher outro arquivo
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ background: selectedAluno ? '#fff' : 'transparent', padding: '20px', borderRadius: '50%', boxShadow: selectedAluno ? '0 10px 30px rgba(0,0,0,0.05)' : 'none', marginBottom: '20px' }}>
                                                        <Upload size={54} color={selectedAluno ? "#007d2f" : "#ddd"} style={{ transition: 'color 0.3s' }} />
                                                    </div>
                                                    <span style={{ fontWeight: '900', color: selectedAluno ? '#333' : '#bbb', fontSize: '1.2rem', textAlign: 'center', marginBottom: '8px' }}>Tocar para buscar foto</span>
                                                    <span style={{ fontSize: '0.9rem', color: '#999', textAlign: 'center', maxWidth: '80%' }}>Extensões suportadas: JPG, PNG, WEBP</span>
                                                    <span style={{ fontSize: '0.75rem', color: selectedAluno ? '#007d2f' : '#aaa', marginTop: '20px', background: selectedAluno ? '#fff2f2' : '#f5f5f5', padding: '6px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
                                                        A resolução será comprimida dinamicamente
                                                    </span>
                                                </>
                                            )}

                                            {!fileToUpload && (
                                                <input
                                                    type="file"
                                                    accept="image/jpeg, image/png, image/webp"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) setFileToUpload(e.target.files[0]);
                                                        e.target.value = '';
                                                    }}
                                                    disabled={uploading || !selectedAluno}
                                                />
                                            )}
                                        </label>

                                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selectedAluno ? '#fcfcfc' : '#f9f9f9', padding: '15px 20px', borderRadius: '12px', border: '1px solid #eee', opacity: selectedAluno ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Trophy size={18} color={isUploadConvocacao ? "#f57f17" : "#aaa"} />
                                                    Foto de Convocação?
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>Esta foto constará nos layouts de escalação individuais.</div>
                                            </div>

                                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: (uploading || !selectedAluno) ? 'not-allowed' : 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isUploadConvocacao}
                                                    onChange={(e) => setIsUploadConvocacao(e.target.checked)}
                                                    disabled={uploading || !selectedAluno}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span style={{
                                                    position: 'absolute', cursor: 'inherit', top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: isUploadConvocacao ? '#f57f17' : '#ccc', transition: '.4s', borderRadius: '34px'
                                                }}></span>
                                                <span style={{
                                                    position: 'absolute', content: '""', height: '18px', width: '18px', left: isUploadConvocacao ? '28px' : '4px', bottom: '4px',
                                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                                }}></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '20px 25px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '15px', background: '#fdfdfd' }}>
                            <button
                                onClick={() => { setIsUploadModalOpen(false); setSelectedAluno(null); setSearchTerm(''); setFileToUpload(null); setIsUploadConvocacao(false); }}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                disabled={!selectedAluno || !fileToUpload || uploading}
                                style={{
                                    padding: '10px 25px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: (!selectedAluno || !fileToUpload || uploading) ? '#ccc' : '#007d2f',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: (!selectedAluno || !fileToUpload || uploading) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: (!selectedAluno || !fileToUpload || uploading) ? 'none' : '0 4px 10px rgba(195,34,40,0.2)'
                                }}
                            >
                                <Upload size={18} />
                                {uploading ? 'ENVIANDO...' : 'ENVIAR MÍDIA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
