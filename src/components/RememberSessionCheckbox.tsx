import { useState } from 'react';
import { Check } from 'lucide-react';

interface RememberSessionCheckboxProps {
    checked: boolean;
    id: string;
    onChange: (checked: boolean) => void;
}

export default function RememberSessionCheckbox({
    checked,
    id,
    onChange
}: RememberSessionCheckboxProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <label
            htmlFor={id}
            style={{
                position: 'relative',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                width: '100%',
                padding: '12px 14px',
                border: `1px solid ${checked ? '#9ad8ae' : '#dce7f3'}`,
                borderRadius: '10px',
                background: checked ? '#f2fbf5' : '#f8fbff',
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left',
                textTransform: 'none',
                boxSizing: 'border-box'
            }}
        >
            <input
                id={id}
                name="remember"
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                aria-describedby={`${id}-description`}
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    margin: 0,
                    padding: 0,
                    display: 'block',
                    overflow: 'hidden',
                    opacity: 0,
                    pointerEvents: 'none'
                }}
            />

            <span
                aria-hidden="true"
                style={{
                    width: '22px',
                    height: '22px',
                    flex: '0 0 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '1px',
                    border: `2px solid ${checked ? '#00a63a' : '#8ca0bc'}`,
                    borderRadius: '5px',
                    background: checked ? '#00a63a' : '#fff',
                    color: '#fff',
                    boxSizing: 'border-box',
                    boxShadow: isFocused
                        ? '0 0 0 4px rgba(244, 194, 13, 0.42)'
                        : (checked ? '0 3px 8px rgba(0, 166, 58, 0.2)' : 'none')
                }}
            >
                {checked && <Check size={16} strokeWidth={3} />}
            </span>

            <span style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: '3px', lineHeight: 1.35 }}>
                <strong style={{ color: '#17428f', fontSize: '0.88rem', textTransform: 'none' }}>
                    Manter conectado
                </strong>
                <small
                    id={`${id}-description`}
                    style={{ color: '#63708a', fontSize: '0.75rem', textTransform: 'none' }}
                >
                    Não será necessário digitar seus dados novamente neste aparelho.
                </small>
            </span>
        </label>
    );
}
