import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { LazyImageGrid } from './LazyImageGrid';
import type { Midia } from '../types/midia';
import { compressImage } from '../utils/imageUtils';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface StudentGalleryTabProps {
    alunoId: string;
}

export default function StudentGalleryTab({ alunoId }: StudentGalleryTabProps) {
    const [midias, setMidias] = useState<Midia[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isUploadConvocacao, setIsUploadConvocacao] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const { showAlert } = useDialog();

    useEffect(() => {
        if (alunoId) fetchMidias();
    }, [alunoId]);

    const fetchMidias = async () => {
        try {
            setLoading(true);
            const q = query(
                collection(db, 'arena_simonesia_2026_midias'),
                where('alunoId', '==', alunoId)
            );
            const snap = await getDocs(q);
            // Firebase doesn't allow ordering by createdAt if there's a where on another field without a composite index.
            // We'll sort in memory:
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Midia));
            data.sort((a, b) => b.createdAt - a.createdAt);
            setMidias(data);
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar mídias.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta mídia do banco?")) return;
        try {
            await deleteDoc(doc(db, 'arena_simonesia_2026_midias', id));
            setMidias(prev => prev.filter(m => m.id !== id));
            showAlert('Mídia excluída.', 'success');
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
            showAlert(currentStatus ? 'Removida de Convocação' : 'Marcada como Convocação!', 'success');
        } catch (error) {
            console.error(error);
            showAlert('Erro ao atualizar status.', 'error');
        }
    };

    const handleConfirmUpload = async () => {
        if (!fileToUpload || !alunoId) return;

        setUploading(true);
        try {
            const compressed = await compressImage(fileToUpload);
            const formData = new FormData();
            formData.append('file', compressed, fileToUpload.name);
            formData.append('folder', `arena_simonesia_2026_midias/${alunoId}`);

            const workerUrl = import.meta.env.VITE_WORKER_URL;
            const res = await fetch(`${workerUrl}/images/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Falha no upload R2');
            const responseData = await res.json();
            const url = responseData.data?.url || responseData.url;

            if (url) {
                const docRef = await addDoc(collection(db, 'arena_simonesia_2026_midias'), {
                    url,
                    alunoId,
                    isConvocacao: isUploadConvocacao,
                    createdAt: Date.now()
                });

                setMidias(prev => [{
                    id: docRef.id,
                    url,
                    alunoId,
                    isConvocacao: isUploadConvocacao,
                    createdAt: Date.now()
                }, ...prev]);

                showAlert('Upload concluído com sucesso!', 'success');
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

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Carregando galeria...</div>;
    }

    return (
        <div className="student-gallery-tab" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
                    <ImageIcon size={20} color="#007d2f" />
                    Galeria do Aluno
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    {/* Switch para Convocação */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: uploading ? 'not-allowed' : 'pointer', background: '#fff9c4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fff59d' }}>
                        <span style={{ fontSize: '0.8rem', color: '#f57f17', fontWeight: 'bold' }}>Foto Convocação?</span>
                        <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                            <input
                                type="checkbox"
                                checked={isUploadConvocacao}
                                onChange={(e) => setIsUploadConvocacao(e.target.checked)}
                                disabled={uploading}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ position: 'absolute', cursor: 'inherit', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isUploadConvocacao ? '#f57f17' : '#ccc', transition: '.4s', borderRadius: '34px' }}></span>
                            <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: isUploadConvocacao ? '19px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                        </div>
                    </label>

                    {fileToUpload ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileToUpload.name}</span>
                            <button
                                onClick={handleConfirmUpload}
                                disabled={uploading}
                                style={{
                                    background: '#007d2f', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Upload size={16} /> {uploading ? 'Enviando...' : 'Confirmar'}
                            </button>
                            <button onClick={() => setFileToUpload(null)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                        </div>
                    ) : (
                        <label style={{
                            background: '#fff', border: '1px solid #ddd', color: '#666', padding: '8px 16px', borderRadius: '8px',
                            fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'all 0.2s', fontSize: '0.9rem'
                        }}>
                            <Upload size={16} />
                            Selecionar Foto
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                if (e.target.files?.[0]) setFileToUpload(e.target.files[0]);
                                e.target.value = '';
                            }} disabled={uploading} />
                        </label>
                    )}
                </div>
            </div>

            <LazyImageGrid
                midias={midias}
                onDelete={handleDelete}
                onToggleConvocacao={handleToggleConvocacao}
                showAlunoName={false}
            />
        </div>
    );
}
