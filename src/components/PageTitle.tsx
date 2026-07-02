
import React from 'react';

interface PageTitleProps {
    title: string;
    subtitle?: string;
    count?: number | string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export default function PageTitle({ title, subtitle, count, children, style, className }: PageTitleProps) {
    return (
        <div className={className} style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', ...style }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1 style={{ color: '#007d2f', fontSize: '1.8rem', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>
                        {title}
                    </h1>
                    {(count !== undefined && count !== null) && (
                        <div style={{ background: '#f5f5f5', padding: '5px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#333', fontWeight: 'bold', fontSize: '1.2rem' }}>{count}</span>
                        </div>
                    )}
                </div>
                {subtitle && <p style={{ color: '#666', marginTop: '5px', fontSize: '1rem' }}>{subtitle}</p>}
            </div>
            {children && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {children}
                </div>
            )}
        </div>
    );
}
