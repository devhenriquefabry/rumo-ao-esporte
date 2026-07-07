import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLoading } from '../components/LoadingService';
import { useDialog } from '../context/CustomDialogContext';
import { useConvocacaoImageGenerator } from '../hooks/useConvocacaoImageGenerator';
import type { Convocacao } from '../types/convocacao';
import type { Midia } from '../types/midia';
import { X, Image as ImageIcon, Save } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ConvocacaoImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    convocacao: Convocacao | null;
}

export function ConvocacaoImageModal({ isOpen, onClose, convocacao }: ConvocacaoImageModalProps) {
    const { setLoading } = useLoading();
    const { showAlert } = useDialog();
    const { generateImage, downloadImage } = useConvocacaoImageGenerator();

    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [previewGeral, setPreviewGeral] = useState<string | null>(null);
    const [previewIndividual, setPreviewIndividual] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [hasAnyPhoto, setHasAnyPhoto] = useState(false);

    // Individual states
    const [possibleHighlights, setPossibleHighlights] = useState<(Midia & { previewUrl?: string })[]>([]);
    const [selectedHighs, setSelectedHighs] = useState<string[]>([]);
    const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

    useEffect(() => {
        if (isOpen && convocacao) {
            handleOpenImageModal();
        }
    }, [isOpen, convocacao]);

    const handleOpenImageModal = async () => {
        if (!convocacao) return;
        setPreviewGeral(null);
        setPreviewIndividual(null);
        setIsLoadingPreview(true);
        setIsImageModalOpen(true);

        try {
            // Buscar rapidamente uma foto para o preview do layout individual
            const idsToSearch = convocacao.jogadores.flatMap(j => {
                const list = [j.id];
                const root = j.regId || j.id.split('_')[0];
                if (root && root !== j.id) list.push(root);
                if (root) list.push(`${root}_0`, `${root}_1`);
                return list;
            });
            const uniqueIds = Array.from(new Set(idsToSearch)).filter(Boolean);
            let thumbHigh: string | undefined;

            // Search in chunks of 30 for the preview too, to cover all players
            const chunks = [];
            for (let i = 0; i < uniqueIds.length; i += 30) {
                chunks.push(uniqueIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                if (thumbHigh) break;
                const q = query(
                    collection(db, 'rumo_ao_esporte_2026_midias'),
                    where('alunoId', 'in', chunk)
                );
                const snap = await getDocs(q);
                const found = snap.docs.find(d => {
                    const data = d.data();
                    return data.isConvocacao === true || data.isDestaque === true;
                });
                if (found) {
                    thumbHigh = found.data().url;
                }
            }

            const urlGeral = await generateImage(convocacao, 'geral');
            setPreviewGeral(urlGeral);

            setHasAnyPhoto(!!thumbHigh);
            if (thumbHigh) {
                const urlIndiv = await generateImage(convocacao, 'individual', thumbHigh);
                setPreviewIndividual(urlIndiv);
            }
        } catch (error) {
            console.error('Preview error:', error);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handlePrepareIndividualImage = async () => {
        if (!convocacao) return;
        setIsImageModalOpen(false);
        setLoading(true, "Buscando Fotos de Convocação...");

        try {
            const idsToSearch = convocacao.jogadores.flatMap(j => {
                const list = [j.id];
                const root = j.regId || j.id.split('_')[0];
                if (root && root !== j.id) list.push(root);
                // Busca também variações comuns (legado)
                if (root) list.push(`${root}_0`, `${root}_1`);
                return list;
            });
            const uniqueIds = Array.from(new Set(idsToSearch)).filter(Boolean);

            const chunks = [];
            for (let i = 0; i < uniqueIds.length; i += 10) {
                chunks.push(uniqueIds.slice(i, i + 10));
            }

            let highlights: Midia[] = [];
            for (const chunk of chunks) {
                const q = query(
                    collection(db, 'rumo_ao_esporte_2026_midias'),
                    where('alunoId', 'in', chunk)
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => {
                    const m = d.data() as any;
                    if (m.isConvocacao === true || m.isDestaque === true) {
                        highlights.push({ id: d.id, ...m } as Midia);
                    }
                });
            }

            if (highlights.length > 0) {
                setLoading(true, `Gerando ${highlights.length} artes...`);
                const extendedHighlights: (Midia & { previewUrl?: string })[] = [];
                for (const midia of highlights) {
                    try {
                        const previewUrl = await generateImage(convocacao, 'individual', midia.url);
                        extendedHighlights.push({ ...midia, previewUrl });
                    } catch (e) {
                        extendedHighlights.push(midia);
                    }
                }
                setPossibleHighlights(extendedHighlights);
                setSelectedHighs([]);
                setIsHighlightModalOpen(true);
            } else {
                setLoading(true, 'Gerando Arte Individual...');
                const success = await downloadImage(convocacao, 'individual');
                setLoading(false);
                if (success) showAlert('Imagem baixada com sucesso!', 'success');
                else showAlert('Erro ao gerar a imagem.', 'error');
                handleCloseAll();
            }
        } catch (error) {
            console.error('Highlight search error:', error);
            setLoading(true, 'Gerando Arte Individual...');
            const success = await downloadImage(convocacao, 'individual');
            setLoading(false);
            if (success) showAlert('Imagem baixada com sucesso!', 'success');
            handleCloseAll();
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDownload = async () => {
        if (!convocacao || selectedHighs.length === 0) return;

        try {
            setIsGeneratingBatch(true);
            setLoading(true, `Gerando ${selectedHighs.length} artes...`);

            if (selectedHighs.length === 1) {
                const midia = possibleHighlights.find(m => m.id === selectedHighs[0]);
                if (midia) {
                    await downloadImage(convocacao, 'individual', midia.url);
                }
            } else {
                const zip = new JSZip();
                for (const id of selectedHighs) {
                    const midia = possibleHighlights.find(m => m.id === id);
                    if (midia) {
                        const dataUrl = await generateImage(convocacao, 'individual', midia.url);
                        const base64Data = dataUrl.split(',')[1];
                        const player = convocacao.jogadores.find(j => (j.id === midia.alunoId) || (j.regId === midia.alunoId));
                        const name = player?.nome || midia.id;
                        zip.file(`${name.replace(/\s+/g, '_')}.png`, base64Data, { base64: true });
                    }
                }
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `Artes_Convocacao_${convocacao.jogo.replace(/\s+/g, '_')}.zip`);
            }
            handleCloseAll();
        } catch (error) {
            console.error('Batch error:', error);
            showAlert('Erro ao gerar artes em lote.', 'error');
        } finally {
            setIsGeneratingBatch(false);
            setLoading(false);
        }
    };

    const handleCloseAll = () => {
        setIsImageModalOpen(false);
        setIsHighlightModalOpen(false);
        onClose();
    };

    if (!isOpen || !convocacao) return null;

    return (
        <>
            {/* Modal de Escolha de Layout */}
            {isImageModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '25px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ImageIcon size={24} color="#00a63a" />
                            Gerar Imagem
                        </h3>
                        <p style={{ color: '#666', marginBottom: '25px', lineHeight: '1.5' }}>
                            Escolha o layout desejado para a arte da convocação:
                        </p>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <div
                                onClick={async () => {
                                    setLoading(true, 'Gerando imagem geral...');
                                    const success = await downloadImage(convocacao, 'geral');
                                    setLoading(false);
                                    if (success) showAlert('Arte geral baixada!', 'success');
                                    handleCloseAll();
                                }}
                                style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', opacity: isLoadingPreview ? 0.5 : 1 }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00a63a'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                <img src={previewGeral || "/convocacao.png"} alt="Layout Geral" style={{ width: '100%', display: 'block' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    {isLoadingPreview ? 'GERANDO...' : 'GERAL'}
                                </div>
                            </div>
                            {hasAnyPhoto && (
                                <div
                                    onClick={handlePrepareIndividualImage}
                                    style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', opacity: isLoadingPreview ? 0.5 : 1 }}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00a63a'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    <img src={previewIndividual || "/convocacao-individual.png"} alt="Layout Individual" style={{ width: '100%', display: 'block' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        {isLoadingPreview ? 'GERANDO...' : 'INDIVIDUAL'}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCloseAll}
                                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontWeight: 'bold', padding: '10px' }}
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Escolha de Foto para Layout Individual */}
            {isHighlightModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div className="animate-scale-in" style={{ background: '#fff', borderRadius: '16px', padding: '30px', width: '90%', maxWidth: '600px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#333', fontSize: '1.4rem', fontWeight: '800' }}>Escolher Foto de Convocação</h3>
                            <button onClick={handleCloseAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={24} /></button>
                        </div>
                        <p style={{ color: '#666', marginBottom: '20px', lineHeight: '1.5' }}>
                            Encontramos fotos de convocação ativas para os seguintes jogadores escalados. Qual deseja estampar na arte individual?
                        </p>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', marginBottom: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                {possibleHighlights.map(midia => {
                                    const player = convocacao.jogadores.find(j => (j.id === midia.alunoId) ||
                                        (j.regId === midia.alunoId) ||
                                        (j.id.split('_')[0] === midia.alunoId));
                                    const isSelected = selectedHighs.includes(midia.id);

                                    return (
                                        <div
                                            key={midia.id}
                                            onClick={() => {
                                                if (isSelected) setSelectedHighs(prev => prev.filter(id => id !== midia.id));
                                                else setSelectedHighs(prev => [...prev, midia.id]);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                border: isSelected ? '4px solid #00a63a' : '2px solid transparent',
                                                transition: 'all 0.2s',
                                                background: '#f5f5f5',
                                                position: 'relative'
                                            }}
                                        >
                                            {isSelected && (
                                                <div style={{ position: 'absolute', top: '5px', right: '5px', background: '#00a63a', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                    ✓
                                                </div>
                                            )}
                                            <div style={{ width: '100%', position: 'relative' }}>
                                                <img src={midia.previewUrl || midia.url} style={{ width: '100%', height: 'auto', display: 'block', opacity: isSelected ? 0.7 : 1 }} />
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '15px 10px 10px', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
                                                    {player?.nome.split(' ')[0] || 'Jogador'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', paddingTop: '20px', borderTop: '1px solid #eee', background: '#fff' }}>
                            <button
                                onClick={() => {
                                    if (selectedHighs.length === possibleHighlights.length) setSelectedHighs([]);
                                    else setSelectedHighs(possibleHighlights.map(m => m.id));
                                }}
                                style={{ flex: 1, padding: '12px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {selectedHighs.length === possibleHighlights.length ? 'DESELECIONAR TUDO' : 'SELECIONAR TUDO'}
                            </button>
                            <button
                                onClick={handleBatchDownload}
                                disabled={selectedHighs.length === 0 || isGeneratingBatch}
                                style={{
                                    flex: 2,
                                    padding: '12px',
                                    background: selectedHighs.length > 0 ? '#00a63a' : '#ccc',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: selectedHighs.length > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                <Save size={18} />
                                {selectedHighs.length <= 1 ? 'BAIXAR AGORA' : `BAIXAR ${selectedHighs.length} ARTES (ZIP)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
