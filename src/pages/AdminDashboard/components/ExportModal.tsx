import React, { useState, useEffect } from 'react';
import { X, ArrowUpDown } from 'lucide-react';
import { COLUMN_OPTIONS, SORT_OPTIONS } from '../constants';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeModality: string | null;
    selectedColumns: string[];
    onColumnToggle: (colId: string) => void;
    onGenerate: (pdfSortBy: string) => void;
    currentSortBy: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen, onClose, activeModality, selectedColumns, onColumnToggle, onGenerate, currentSortBy
}) => {
    const [pdfSortBy, setPdfSortBy] = useState<string>(currentSortBy);
    const scopeLabel = activeModality ? activeModality.toUpperCase() : 'TODOS';

    useEffect(() => {
        if (isOpen) {
            setPdfSortBy(currentSortBy);
        }
    }, [isOpen, currentSortBy]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px', backdropFilter: 'blur(3px)'
        }}>
            <div className="animate-scale-in" style={{
                background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px',
                padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontWeight: 'bold' }}>Colunas do PDF</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}>
                        <X size={24} />
                    </button>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>Selecione as informações para <strong>{scopeLabel}</strong>:</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
                    {COLUMN_OPTIONS.map((col) => {
                        if (col.id === 'waButton') return null;

                        const isSelected = selectedColumns.includes(col.id);
                        const isStatusFin = col.id === 'statusFin';
                        const isWaButtonSelected = selectedColumns.includes('waButton');

                        return (
                            <div key={col.id} style={{
                                display: 'flex', flexDirection: 'column',
                                gridColumn: isStatusFin && isSelected ? 'span 2' : 'auto'
                            }}>
                                <label style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    padding: '16px 10px', borderRadius: '12px',
                                    background: isSelected ? '#fff1f1' : '#f8f9fa',
                                    border: `2px solid ${isSelected ? '#00a63a' : '#eee'}`,
                                    cursor: 'pointer', textAlign: 'center', position: 'relative',
                                    minHeight: '70px', transition: 'all 0.2s'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onColumnToggle(col.id)}
                                        style={{ position: 'absolute', top: '8px', right: '8px', accentColor: '#00a63a', width: '16px', height: '16px' }}
                                    />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isSelected ? '#00a63a' : '#666' }}>{col.label}</span>

                                    {isStatusFin && isSelected && (
                                        <div
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onColumnToggle('waButton'); }}
                                            style={{
                                                marginTop: '12px', padding: '8px 12px', borderRadius: '8px',
                                                background: isWaButtonSelected ? '#00a63a' : '#fff',
                                                border: `1px solid ${isWaButtonSelected ? '#00a63a' : '#ddd'}`,
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '14px', height: '14px', borderRadius: '3px',
                                                border: `1px solid ${isWaButtonSelected ? '#fff' : '#ccc'}`,
                                                background: isWaButtonSelected ? '#fff' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {isWaButtonSelected && <div style={{ width: '8px', height: '8px', background: '#00a63a', borderRadius: '1px' }} />}
                                            </div>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: '600',
                                                color: isWaButtonSelected ? '#fff' : '#666'
                                            }}>
                                                Incluir Botão de Cobrar
                                            </span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                        Ordenar PDF por:
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', left: '12px', pointerEvents: 'none', color: '#00a63a', display: 'flex', alignItems: 'center' }}>
                            <ArrowUpDown size={15} />
                        </div>
                        <select
                            value={pdfSortBy}
                            onChange={(e) => setPdfSortBy(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 15px 10px 36px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                color: '#444',
                                backgroundColor: '#fff',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#00a63a';
                                e.target.style.boxShadow = '0 0 0 2px rgba(0, 125, 47, 0.15)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#ddd';
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <div style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: '#666', fontSize: '0.6rem', transform: 'scaleY(0.7)' }}>
                            ▼
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', fontWeight: 'bold' }}>Cancelar</button>
                    <button onClick={() => onGenerate(pdfSortBy)} disabled={selectedColumns.length === 0} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: 'bold', opacity: selectedColumns.length === 0 ? 0.5 : 1 }}>Gerar PDF</button>
                </div>
            </div>
        </div>
    );
};
