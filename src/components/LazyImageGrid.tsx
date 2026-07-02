import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Star, Eye, Download, X } from 'lucide-react';
import type { Midia } from '../types/midia';

interface LazyImageProps {
    midia: Midia;
    onImageClick?: (midia: Midia) => void;
    showAlunoName?: boolean;
    getAlunoName?: (alunoId: string) => string;
}

const LazyImage: React.FC<LazyImageProps> = ({ midia, onImageClick, showAlunoName, getAlunoName }) => {
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
            } else {
                setIsVisible(false); // Unmount when out of viewport
            }
        }, {
            rootMargin: '200px' // Pre-load 200px before appearing
        });

        if (imgRef.current) observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={imgRef} onClick={() => onImageClick?.(midia)} style={{
            background: '#f5f5f5',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            border: (midia.isConvocacao || (midia as any).isDestaque) ? '2px solid #fadb14' : '2px solid transparent',
            transition: 'transform 0.2s',
            display: 'block',
            width: '100%',
        }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
            {isVisible ? (
                <img
                    src={midia.url}
                    alt="Mídia"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    loading="lazy"
                />
            ) : (
                <div style={{ width: '100%', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                    <Eye size={24} />
                </div>
            )}

            {/* Overlay Gradient for Bottom Info */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none' }}></div>


            {/* Bottom Info */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', pointerEvents: 'none', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(midia.isConvocacao || (midia as any).isDestaque) && (
                    <span style={{ background: '#fadb14', color: '#876800', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                        CONVOCAÇÃO
                    </span>
                )}
                {showAlunoName && getAlunoName && (
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getAlunoName(midia.alunoId) || 'Aluno Desconhecido'}
                    </div>
                )}
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                    {new Date(midia.createdAt).toLocaleDateString('pt-BR')}
                </div>
            </div>
        </div>
    );
};

export const LazyImageGrid: React.FC<{
    midias: Midia[],
    onDelete?: (id: string) => void,
    onToggleConvocacao?: (id: string, currentStatus: boolean) => void,
    showAlunoName?: boolean,
    getAlunoName?: (alunoId: string) => string
}> = ({ midias, onDelete, onToggleConvocacao, showAlunoName, getAlunoName }) => {
    const [selectedMidia, setSelectedMidia] = useState<Midia | null>(null);

    // Sync state se a foto ativa receber mudança externa
    useEffect(() => {
        if (selectedMidia) {
            const updated = midias.find(m => m.id === selectedMidia.id);
            if (!updated) setSelectedMidia(null);
            else if (updated.isConvocacao !== selectedMidia.isConvocacao) setSelectedMidia(updated);
        }
    }, [midias]);

    if (midias.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', borderRadius: '12px', color: '#999', border: '1px dashed #ddd' }}>
                Nenhuma imagem encontrada.
            </div>
        );
    }

    return (
        <>
            <div style={{ columnCount: 'auto', columnWidth: '200px', columnGap: '15px' }}>
                {midias.map(m => (
                    <div key={m.id} style={{ marginBottom: '15px', breakInside: 'avoid', display: 'block' }}>
                        <LazyImage
                            midia={m}
                            onImageClick={setSelectedMidia}
                            showAlunoName={showAlunoName}
                            getAlunoName={getAlunoName}
                        />
                    </div>
                ))}
            </div>

            {/* Modal Lightbox de Visualização In-Focus */}
            {selectedMidia && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
                }}>
                    <button
                        onClick={() => setSelectedMidia(null)}
                        style={{ position: 'absolute', top: '20px', right: '30px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', zIndex: 1001 }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <X size={28} />
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', maxWidth: '90%', maxHeight: '90vh' }}>

                        {/* Box Central (Imagem e tag) */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', height: 'calc(90vh - 120px)', borderRadius: '12px' }}>
                            <img src={selectedMidia.url} alt="Fullscreen Midia" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: (selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '4px solid #fadb14' : '1px solid rgba(255,255,255,0.1)' }} />
                            {(selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) && (
                                <div style={{ position: 'absolute', top: '15px', left: '15px', background: '#fadb14', color: '#876800', padding: '6px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '0.9rem', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                                    FOTO DE CONVOCAÇÃO
                                </div>
                            )}
                        </div>

                        {/* Botões Funcionais Pés */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', padding: '15px 25px', borderRadius: '25px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => window.open(selectedMidia.url, '_blank')}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#fff', color: '#333', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s', fontSize: '0.95rem' }}
                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <Download size={20} /> Baixar
                            </button>

                            {onToggleConvocacao && (
                                <button
                                    onClick={() => onToggleConvocacao(selectedMidia.id, selectedMidia.isConvocacao || (selectedMidia as any).isDestaque)}
                                    style={{ flex: 1, padding: '12px', background: (selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '#fff9c4' : '#fff', color: (selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '#f57f17' : '#666', border: (selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '1px solid #fff59d' : '1px solid #eee', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: (selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '0 4px 12px rgba(245, 127, 23, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)' }}
                                >
                                    <Star size={20} fill={(selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? '#f57f17' : 'none'} />
                                    {(selectedMidia.isConvocacao || (selectedMidia as any).isDestaque) ? 'Remover da Convocação' : 'Definir p/ Convocação'}
                                </button>
                            )}

                            {onDelete && (
                                <button
                                    onClick={() => {
                                        onDelete(selectedMidia.id);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'rgba(255,77,79,0.2)', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.5)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <Trash2 size={20} /> Excluir Arquivo
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
