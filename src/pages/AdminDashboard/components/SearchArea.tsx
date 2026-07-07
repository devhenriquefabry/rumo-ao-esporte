import React from 'react';
import { X, ArrowUpDown } from 'lucide-react';
import { SORT_OPTIONS } from '../constants';

interface SearchAreaProps {
    isMobile: boolean;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    sortBy: string;
    onSortChange: (value: string) => void;
}

export const SearchArea: React.FC<SearchAreaProps> = ({
    isMobile,
    searchTerm,
    onSearchChange,
    sortBy,
    onSortChange
}) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '10px',
            alignItems: isMobile ? 'stretch' : 'center',
            marginBottom: '10px'
        }}>
            <div style={{ position: 'relative', flex: 1 }}>
                <input
                    type="text"
                    placeholder="Buscar por nome, responsável ou CPF..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: isMobile ? '8px 12px' : '10px 15px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00a63a'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />
                {searchTerm && (
                    <button
                        onClick={() => onSearchChange('')}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#999', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                minWidth: isMobile ? '100%' : '240px',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    position: 'absolute',
                    left: '12px',
                    pointerEvents: 'none',
                    color: '#00a63a',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <ArrowUpDown size={15} />
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: isMobile ? '8px 12px 8px 36px' : '10px 15px 10px 36px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '0.82rem',
                        fontWeight: '500',
                        color: '#444',
                        backgroundColor: '#fff',
                        outline: 'none',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
                <div style={{
                    position: 'absolute',
                    right: '12px',
                    pointerEvents: 'none',
                    color: '#666',
                    fontSize: '0.6rem',
                    transform: 'scaleY(0.7)'
                }}>
                    ▼
                </div>
            </div>
        </div>
    );
};
