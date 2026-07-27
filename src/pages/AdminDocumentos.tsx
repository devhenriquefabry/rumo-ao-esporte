import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { Upload, Search, X, Folder, FolderOpen, FolderPlus, FileText, Image as ImageIcon, File, Trash2, ExternalLink, Home, ChevronRight } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

interface Pasta {
    id: string;
    nome: string;
    parentId: string | null;
    createdAt: number;
}

type DocTipo = 'pdf' | 'word' | 'imagem';

interface Documento {
    id: string;
    nome: string;
    pastaId: string | null;
    url: string;
    fileName: string;
    tipo: DocTipo;
    createdAt: number;
}

const PASTAS_COLLECTION = 'rumo_ao_esporte_2026_documento_pastas';
const DOCUMENTOS_COLLECTION = 'rumo_ao_esporte_2026_documentos';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const WORD_EXTENSIONS = ['doc', 'docx'];

function getFileTipo(fileName: string): DocTipo | null {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (WORD_EXTENSIONS.includes(ext)) return 'word';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'imagem';
    return null;
}

const TIPO_CONFIG: Record<DocTipo, { label: string; color: string; bg: string; icon: any }> = {
    pdf: { label: 'PDF', color: '#c62828', bg: '#ffebee', icon: FileText },
    word: { label: 'Word', color: '#1565c0', bg: '#e3f2fd', icon: File },
    imagem: { label: 'Imagem', color: '#00a63a', bg: '#e8f5e9', icon: ImageIcon }
};

export default function AdminDocumentos() {
    const [pastas, setPastas] = useState<Pasta[]>([]);
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const { setLoading } = useLoading();
    const { showAlert, showConfirm } = useDialog();

    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // New folder modal
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [novaPastaNome, setNovaPastaNome] = useState('');
    const [savingPasta, setSavingPasta] = useState(false);

    // Upload modal
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadNome, setUploadNome] = useState('');
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true, 'Carregando documentos...');
            const [pastaSnap, docSnap] = await Promise.all([
                getDocs(query(collection(db, PASTAS_COLLECTION), orderBy('nome', 'asc'))),
                getDocs(query(collection(db, DOCUMENTOS_COLLECTION), orderBy('createdAt', 'desc')))
            ]);
            setPastas(pastaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Pasta)));
            setDocumentos(docSnap.docs.map(d => ({ id: d.id, ...d.data() } as Documento)));
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar documentos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Reset navigation if the current folder no longer exists
    useEffect(() => {
        if (currentFolderId && !pastas.some(p => p.id === currentFolderId)) {
            setCurrentFolderId(null);
        }
    }, [pastas, currentFolderId]);

    // ------- Pastas -------
    const breadcrumb = useMemo(() => {
        const chain: Pasta[] = [];
        let current = currentFolderId;
        while (current) {
            const p = pastas.find(x => x.id === current);
            if (!p) break;
            chain.unshift(p);
            current = p.parentId;
        }
        return chain;
    }, [currentFolderId, pastas]);

    const handleAddPasta = async () => {
        const nome = novaPastaNome.trim();
        if (!nome) return;
        const siblings = pastas.filter(p => p.parentId === currentFolderId);
        if (siblings.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
            showAlert('Já existe uma pasta com esse nome neste local.', 'warning');
            return;
        }

        setSavingPasta(true);
        try {
            const createdAt = Date.now();
            const novaPasta = { nome, parentId: currentFolderId, createdAt };
            const docRef = await addDoc(collection(db, PASTAS_COLLECTION), novaPasta);
            setPastas(prev => [...prev, { id: docRef.id, ...novaPasta }]);
            setNovaPastaNome('');
            setIsFolderModalOpen(false);
            showAlert('Pasta criada com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showAlert('Erro ao criar pasta.', 'error');
        } finally {
            setSavingPasta(false);
        }
    };

    const handleDeletePasta = (pasta: Pasta, e: React.MouseEvent) => {
        e.stopPropagation();
        const subpastas = pastas.filter(p => p.parentId === pasta.id).length;
        const docsNaPasta = documentos.filter(d => d.pastaId === pasta.id).length;
        if (subpastas > 0 || docsNaPasta > 0) {
            showAlert(`Não é possível excluir: esta pasta contém ${subpastas} subpasta(s) e ${docsNaPasta} documento(s). Esvazie a pasta primeiro.`, 'warning');
            return;
        }

        showConfirm(`Deseja excluir a pasta "${pasta.nome}"?`, async () => {
            try {
                await deleteDoc(doc(db, PASTAS_COLLECTION, pasta.id));
                setPastas(prev => prev.filter(p => p.id !== pasta.id));
                showAlert('Pasta excluída.', 'success');
            } catch (error) {
                console.error(error);
                showAlert('Erro ao excluir pasta.', 'error');
            }
        });
    };

    // ------- Documentos -------
    const handleSelectFile = (file: File) => {
        const tipo = getFileTipo(file.name);
        if (!tipo) {
            showAlert('Formato não suportado. Envie arquivos PDF, Word (.doc/.docx) ou imagens (JPG, PNG, WEBP).', 'warning');
            return;
        }
        setFileToUpload(file);
        if (!uploadNome.trim()) {
            setUploadNome(file.name.replace(/\.[^.]+$/, ''));
        }
    };

    const handleConfirmUpload = async () => {
        if (!fileToUpload) return;

        const tipo = getFileTipo(fileToUpload.name);
        if (!tipo) return;

        setUploading(true);
        try {
            const workerUrl = import.meta.env.VITE_WORKER_URL;
            const formData = new FormData();
            let endpoint = '/upload-document';

            if (tipo === 'imagem') {
                const compressed = await compressImage(fileToUpload);
                formData.append('file', compressed, fileToUpload.name);
                formData.append('folder', 'rumo_ao_esporte_2026_documentos');
                endpoint = '/images/upload';
            } else {
                formData.append('file', fileToUpload);
            }

            const res = await fetch(`${workerUrl}${endpoint}`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Falha no upload');
            const data = await res.json();
            const url = data.data?.url || data.url;
            if (!url) throw new Error('Upload não retornou URL');

            const novoDoc = {
                nome: uploadNome.trim() || fileToUpload.name,
                pastaId: currentFolderId,
                url,
                fileName: fileToUpload.name,
                tipo,
                createdAt: Date.now()
            };

            const docRef = await addDoc(collection(db, DOCUMENTOS_COLLECTION), novoDoc);
            setDocumentos(prev => [{ id: docRef.id, ...novoDoc }, ...prev]);

            showAlert('Documento enviado com sucesso!', 'success');
            closeUploadModal();
        } catch (error) {
            console.error(error);
            showAlert('Erro ao enviar documento.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocumento = (documento: Documento) => {
        showConfirm(`Deseja excluir o documento "${documento.nome}"?`, async () => {
            try {
                await deleteDoc(doc(db, DOCUMENTOS_COLLECTION, documento.id));
                setDocumentos(prev => prev.filter(d => d.id !== documento.id));
                showAlert('Documento excluído.', 'success');
            } catch (error) {
                console.error(error);
                showAlert('Erro ao excluir documento.', 'error');
            }
        });
    };

    const closeUploadModal = () => {
        setIsUploadModalOpen(false);
        setUploadNome('');
        setFileToUpload(null);
    };

    const closeFolderModal = () => {
        setIsFolderModalOpen(false);
        setNovaPastaNome('');
    };

    const childFolders = useMemo(() => {
        let list = pastas.filter(p => p.parentId === currentFolderId);
        const term = searchTerm.trim().toLowerCase();
        if (term) list = list.filter(p => p.nome.toLowerCase().includes(term));
        return list.sort((a, b) => a.nome.localeCompare(b.nome));
    }, [pastas, currentFolderId, searchTerm]);

    const childDocumentos = useMemo(() => {
        let list = documentos.filter(d => d.pastaId === currentFolderId);
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            list = list.filter(d =>
                d.nome.toLowerCase().includes(term) ||
                d.fileName.toLowerCase().includes(term)
            );
        }
        return list;
    }, [documentos, currentFolderId, searchTerm]);

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const breadcrumbLabel = breadcrumb.length > 0
        ? `Documentos / ${breadcrumb.map(p => p.nome).join(' / ')}`
        : 'Documentos';

    return (
        <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h1 style={{ margin: 0, color: '#333', fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FolderOpen size={28} color="#00a63a" /> Documentos
                </h1>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setIsFolderModalOpen(true)}
                        style={{ background: '#fff', color: '#00a63a', border: '2px solid #00a63a', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <FolderPlus size={18} /> NOVA PASTA
                    </button>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        style={{ background: '#00a63a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Upload size={18} /> ENVIAR DOCUMENTO
                    </button>
                </div>
            </div>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '25px', fontSize: '0.9rem' }}>
                <button
                    onClick={() => setCurrentFolderId(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: currentFolderId === null ? '#e8f5e9' : 'transparent', color: currentFolderId === null ? '#00a63a' : '#666', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    <Home size={15} /> Documentos
                </button>
                {breadcrumb.map((p, idx) => {
                    const isLast = idx === breadcrumb.length - 1;
                    return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ChevronRight size={15} color="#bbb" />
                            <button
                                onClick={() => setCurrentFolderId(p.id)}
                                style={{ background: isLast ? '#e8f5e9' : 'transparent', color: isLast ? '#00a63a' : '#666', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {p.nome}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '12px' }}>
                        <FileText size={24} color="#00a63a" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>Total de Documentos</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#00a63a' }}>{documentos.length}</div>
                    </div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '12px' }}>
                        <Folder size={24} color="#1565c0" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>Pastas</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1565c0' }}>{pastas.length}</div>
                    </div>
                </div>
            </div>

            {/* Listagem */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333', fontWeight: '800' }}>
                        {currentFolderId === null ? 'Raiz de Documentos' : breadcrumb[breadcrumb.length - 1]?.nome}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '8px', padding: '0 15px', width: '300px', maxWidth: '100%', border: '1px solid #eee' }}>
                        <Search size={18} color="#999" />
                        <input
                            type="text"
                            placeholder="Buscar nesta pasta..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: '#333' }}
                        />
                    </div>
                </div>

                {childFolders.length === 0 && childDocumentos.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <FolderOpen size={48} color="#ddd" />
                        <span style={{ fontWeight: 'bold' }}>Esta pasta está vazia.</span>
                        <span style={{ fontSize: '0.9rem' }}>Crie uma subpasta ou envie um documento.</span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                        {childFolders.map(pasta => {
                            const subCount = pastas.filter(p => p.parentId === pasta.id).length;
                            const docCount = documentos.filter(d => d.pastaId === pasta.id).length;
                            return (
                                <div
                                    key={pasta.id}
                                    onClick={() => setCurrentFolderId(pasta.id)}
                                    style={{ border: '1px solid #eee', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', gap: '12px', background: '#fdfdfd', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'}
                                    onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                                >
                                    <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '10px', flexShrink: 0 }}>
                                        <Folder size={24} color="#1565c0" />
                                    </div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{ fontWeight: '800', color: '#333', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pasta.nome}>
                                            {pasta.nome}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                            {subCount} subpasta{subCount !== 1 ? 's' : ''} · {docCount} doc{docCount !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeletePasta(pasta, e)}
                                        title="Excluir pasta"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', padding: '6px', borderRadius: '6px', display: 'flex', flexShrink: 0 }}
                                    >
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                            );
                        })}

                        {childDocumentos.map(documento => {
                            const config = TIPO_CONFIG[documento.tipo] || TIPO_CONFIG.pdf;
                            const TipoIcon = config.icon;
                            return (
                                <div key={documento.id} style={{ border: '1px solid #eee', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fdfdfd', transition: 'box-shadow 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'}
                                    onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{ background: config.bg, padding: '12px', borderRadius: '10px', flexShrink: 0 }}>
                                            <TipoIcon size={24} color={config.color} />
                                        </div>
                                        <div style={{ overflow: 'hidden', flex: 1 }}>
                                            <div style={{ fontWeight: '800', color: '#333', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={documento.nome}>
                                                {documento.nome}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={documento.fileName}>
                                                {documento.fileName}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: config.bg, color: config.color, padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{config.label}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: 'auto' }}>{formatDate(documento.createdAt)}</span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                        <a
                                            href={documento.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', background: '#e8f5e9', color: '#00a63a', fontWeight: 'bold', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <ExternalLink size={15} /> Abrir
                                        </a>
                                        <button
                                            onClick={() => handleDeleteDocumento(documento)}
                                            style={{ padding: '8px 14px', borderRadius: '8px', background: '#ffebee', color: '#c62828', border: 'none', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Nova Pasta */}
            {isFolderModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '20px' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '440px', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '25px 30px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#333', fontSize: '1.3rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FolderPlus size={22} color="#00a63a" /> Nova Pasta
                                </h2>
                                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.8rem' }} title={breadcrumbLabel}>
                                    Em: {breadcrumbLabel}
                                </p>
                            </div>
                            <button onClick={closeFolderModal} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '25px 30px' }}>
                            <input
                                type="text"
                                autoFocus
                                placeholder="Nome da pasta..."
                                value={novaPastaNome}
                                onChange={e => setNovaPastaNome(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddPasta(); }}
                                style={{ width: '100%', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '10px', outline: 'none', fontSize: '0.95rem', color: '#333', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ padding: '20px 25px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '15px', background: '#fdfdfd' }}>
                            <button
                                onClick={closeFolderModal}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleAddPasta}
                                disabled={!novaPastaNome.trim() || savingPasta}
                                style={{ padding: '10px 25px', borderRadius: '8px', border: 'none', background: (!novaPastaNome.trim() || savingPasta) ? '#ccc' : '#00a63a', color: '#fff', fontWeight: 'bold', cursor: (!novaPastaNome.trim() || savingPasta) ? 'not-allowed' : 'pointer' }}
                            >
                                {savingPasta ? 'CRIANDO...' : 'CRIAR PASTA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Upload */}
            {isUploadModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '20px' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '550px', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '25px 30px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#333', fontSize: '1.3rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Upload size={22} color="#00a63a" /> Enviar Documento
                                </h2>
                                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.8rem' }} title={breadcrumbLabel}>
                                    Em: {breadcrumbLabel}
                                </p>
                            </div>
                            <button onClick={closeUploadModal} disabled={uploading} style={{ background: '#f5f5f5', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: '#666', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '25px 30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '8px', fontSize: '0.9rem' }}>Nome do documento</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Regulamento Interno 2026"
                                    value={uploadNome}
                                    onChange={e => setUploadNome(e.target.value)}
                                    disabled={uploading}
                                    style={{ width: '100%', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '10px', outline: 'none', fontSize: '0.95rem', color: '#333', boxSizing: 'border-box' }}
                                />
                            </div>

                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', border: '3px dashed #e0e0e0', borderRadius: '16px', cursor: uploading ? 'not-allowed' : 'pointer', background: '#fafafa', transition: 'all 0.3s', textAlign: 'center' }}
                                onMouseOver={e => { if (!uploading) { e.currentTarget.style.borderColor = '#00a63a'; } }}
                                onMouseOut={e => { if (!uploading) { e.currentTarget.style.borderColor = '#e0e0e0'; } }}
                            >
                                {uploading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #00a63a', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '15px' }}></div>
                                        <span style={{ fontWeight: '900', color: '#00a63a' }}>Enviando arquivo...</span>
                                    </div>
                                ) : fileToUpload ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                        {(() => {
                                            const tipo = getFileTipo(fileToUpload.name);
                                            const config = tipo ? TIPO_CONFIG[tipo] : TIPO_CONFIG.pdf;
                                            const TipoIcon = config.icon;
                                            return (
                                                <div style={{ background: config.bg, padding: '14px', borderRadius: '50%' }}>
                                                    <TipoIcon size={30} color={config.color} />
                                                </div>
                                            );
                                        })()}
                                        <span style={{ fontSize: '0.9rem', color: '#666', background: '#f0f0f0', padding: '4px 10px', borderRadius: '6px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileToUpload.name}</span>
                                        <button
                                            onClick={(e) => { e.preventDefault(); setFileToUpload(null); }}
                                            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                                        >
                                            Escolher outro arquivo
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={40} color="#00a63a" style={{ marginBottom: '12px' }} />
                                        <span style={{ fontWeight: '900', color: '#333', fontSize: '1.05rem', marginBottom: '5px' }}>Tocar para escolher o arquivo</span>
                                        <span style={{ fontSize: '0.85rem', color: '#999' }}>PDF, DOC, DOCX, JPG, PNG, WEBP</span>
                                    </>
                                )}

                                {!fileToUpload && !uploading && (
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) handleSelectFile(e.target.files[0]);
                                            e.target.value = '';
                                        }}
                                    />
                                )}
                            </label>
                        </div>

                        <div style={{ padding: '20px 25px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '15px', background: '#fdfdfd' }}>
                            <button
                                onClick={closeUploadModal}
                                disabled={uploading}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer' }}
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                disabled={!fileToUpload || uploading}
                                style={{
                                    padding: '10px 25px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: (!fileToUpload || uploading) ? '#ccc' : '#00a63a',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: (!fileToUpload || uploading) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Upload size={18} />
                                {uploading ? 'ENVIANDO...' : 'ENVIAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
