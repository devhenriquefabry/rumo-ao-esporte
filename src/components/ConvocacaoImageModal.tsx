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
import { CONV_UI } from './convocacao/ConvocacaoToggle';

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

    /** Miniatura clicável de um layout; mostra esqueleto enquanto a prévia é gerada. */
    const renderLayoutOption = (label: string, preview: string | null, onClick: () => void) => (
        <div
            onClick={() => { if (!isLoadingPreview) onClick(); }}
            style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: isLoadingPreview ? 'progress' : 'pointer',
                border: `2px solid ${CONV_UI.border}`,
                transition: 'all 0.2s',
                background: '#fff',
                boxShadow: CONV_UI.shadow
            }}
            onMouseOver={(e) => { if (!isLoadingPreview) { e.currentTarget.style.borderColor = CONV_UI.green; e.currentTarget.style.transform = 'translateY(-3px)'; } }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = CONV_UI.border; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            {preview ? (
                <img src={preview} alt={`Layout ${label}`} style={{ width: '100%', display: 'block' }} />
            ) : (
                <div style={{ width: '100%', aspectRatio: '2 / 3', background: CONV_UI.blueSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8ea3c0', fontSize: '0.85rem', fontWeight: 700 }}>
                    Gerando prévia...
                </div>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(9,36,92,0.92))', color: '#fff', padding: '22px 10px 10px', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '1px' }}>
                {isLoadingPreview ? 'GERANDO...' : label}
            </div>
        </div>
    );

    return (
        <>
            {/* Modal de Escolha de Layout */}
            {isImageModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,26,64,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: hasAnyPhoto ? '620px' : '420px', boxShadow: '0 18px 50px rgba(9,36,92,0.28)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ImageIcon size={20} color={CONV_UI.gold} /> Arte da Convocação
                            </h3>
                            <button onClick={handleCloseAll} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '22px', overflowY: 'auto', background: CONV_UI.surfaceSoft }}>
                            <p style={{ color: '#63708a', margin: '0 0 18px 0', lineHeight: 1.5, fontSize: '0.92rem' }}>
                                {hasAnyPhoto
                                    ? 'Escolha o layout. Clique na miniatura para baixar em alta resolução.'
                                    : 'Clique na miniatura para baixar a arte em alta resolução.'}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: hasAnyPhoto ? '1fr 1fr' : '1fr', gap: '15px' }}>
                                {renderLayoutOption(
                                    'GERAL',
                                    previewGeral,
                                    async () => {
                                        setLoading(true, 'Gerando imagem geral...');
                                        const success = await downloadImage(convocacao, 'geral');
                                        setLoading(false);
                                        if (success) showAlert('Arte geral baixada!', 'success');
                                        else showAlert('Erro ao gerar a imagem.', 'error');
                                        handleCloseAll();
                                    }
                                )}
                                {hasAnyPhoto && renderLayoutOption('INDIVIDUAL', previewIndividual, handlePrepareIndividualImage)}
                            </div>

                            {!hasAnyPhoto && (
                                <div style={{ marginTop: '16px', background: CONV_UI.blueSoft, border: `1px solid ${CONV_UI.border}`, borderRadius: '10px', padding: '12px 14px', color: CONV_UI.blue, fontSize: '0.82rem', lineHeight: 1.5 }}>
                                    O layout <strong>individual</strong> aparece quando algum atleta escalado tiver foto marcada como
                                    “convocação” ou “destaque” em <strong>Jogos → Mídias dos Atletas</strong>.
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '14px 22px', borderTop: `1px solid ${CONV_UI.border}`, display: 'flex', justifyContent: 'flex-end', background: '#fff' }}>
                            <button
                                onClick={handleCloseAll}
                                style={{ background: 'none', border: 'none', color: '#8ea3c0', cursor: 'pointer', fontWeight: 'bold', padding: '10px' }}
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Escolha de Foto para Layout Individual */}
            {isHighlightModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,26,64,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
                    <div className="animate-scale-in" style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '620px', boxShadow: '0 18px 50px rgba(9,36,92,0.32)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: CONV_UI.navy, fontSize: '1.25rem', fontWeight: 800 }}>Escolher Foto de Convocação</h3>
                            <button onClick={handleCloseAll} style={{ background: CONV_UI.blueSoft, border: 'none', cursor: 'pointer', color: CONV_UI.blue, padding: '6px', borderRadius: '8px', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <p style={{ color: '#63708a', marginBottom: '18px', lineHeight: '1.5', fontSize: '0.92rem' }}>
                            Encontramos fotos de convocação ativas para os atletas escalados. Selecione quais deseja estampar na arte individual.
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
                                                background: CONV_UI.blueSoft,
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

                        <div style={{ display: 'flex', gap: '10px', paddingTop: '20px', borderTop: `1px solid ${CONV_UI.border}`, background: '#fff' }}>
                            <button
                                onClick={() => {
                                    if (selectedHighs.length === possibleHighlights.length) setSelectedHighs([]);
                                    else setSelectedHighs(possibleHighlights.map(m => m.id));
                                }}
                                style={{ flex: 1, padding: '12px', background: '#fff', color: '#63708a', border: `1px solid ${CONV_UI.border}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
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
