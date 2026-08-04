import React from 'react';

/**
 * Tokens visuais das telas de convocação — seguem a paleta do sistema
 * (azul da marca, verde de destaque, bordas #dce7f3).
 */
export const CONV_UI = {
    navy: '#09245c',
    blue: '#17428f',
    blueSoft: '#eef8ff',
    green: '#00a63a',
    greenSoft: '#e8f9ee',
    gold: '#f4c20d',
    danger: '#e74c3c',
    border: '#dce7f3',
    surfaceSoft: '#f8fbff',
    shadow: '0 8px 24px rgba(9, 36, 92, 0.08)',
    label: {
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 800,
        color: '#63708a',
        marginBottom: '8px',
        letterSpacing: '0.5px'
    } as React.CSSProperties,
    input: {
        width: '100%',
        padding: '12px 15px',
        border: '1px solid #dce7f3',
        borderRadius: '8px',
        fontSize: '1rem',
        outline: 'none',
        boxSizing: 'border-box',
        color: '#09245c',
        background: '#fff'
    } as React.CSSProperties,
    addTitular: {
        background: '#eef8ff',
        color: '#17428f',
        border: '1px solid #c3ddf5',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        cursor: 'pointer'
    } as React.CSSProperties,
    addReserva: {
        background: '#e8f9ee',
        color: '#00a63a',
        border: '1px solid #a5e6bd',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        cursor: 'pointer'
    } as React.CSSProperties
};

interface SwitchProps {
    checked: boolean;
    onChange: (value: boolean) => void;
}

export function Switch({ checked, onChange }: SwitchProps) {
    return (
        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px', cursor: 'pointer', flexShrink: 0 }}>
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: checked ? CONV_UI.green : '#c3d3e8', borderRadius: '34px', transition: '.3s'
            }} />
            <span style={{
                position: 'absolute', height: '16px', width: '16px', left: checked ? '25px' : '3px', bottom: '3px',
                backgroundColor: '#fff', borderRadius: '50%', transition: '.3s', boxShadow: '0 1px 3px rgba(9,36,92,0.25)'
            }} />
        </label>
    );
}

interface ConvocacaoToggleProps {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    children?: React.ReactNode;
}

/** Bloco "campo opcional": título + switch e, quando ligado, o conteúdo. */
export function ConvocacaoToggle({ label, hint, checked, onChange, children }: ConvocacaoToggleProps) {
    return (
        <div style={{
            background: checked ? '#fff' : CONV_UI.surfaceSoft,
            padding: '15px',
            borderRadius: '12px',
            border: `1px solid ${checked ? CONV_UI.border : '#e8eef7'}`,
            transition: 'all 0.25s',
            boxShadow: checked ? CONV_UI.shadow : 'none'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: checked ? CONV_UI.blue : '#63708a', letterSpacing: '0.4px' }}>
                        {label}
                    </label>
                    {hint && <div style={{ fontSize: '0.72rem', color: '#8ea3c0', marginTop: '3px' }}>{hint}</div>}
                </div>
                <Switch checked={checked} onChange={onChange} />
            </div>
            {checked && children && <div style={{ marginTop: '14px' }}>{children}</div>}
        </div>
    );
}
