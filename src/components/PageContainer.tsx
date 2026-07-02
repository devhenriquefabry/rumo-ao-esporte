import React from 'react';

interface PageContainerProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export default function PageContainer({ children, style, className }: PageContainerProps) {
    return (
        <div
            className={`page-container page-enter ${className || ''}`}
            style={{
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%',
                ...style
            }}
        >
            <style>
                {`
                    .page-container {
                        padding: 40px;
                    }
                    @media (max-width: 768px) {
                        .page-container {
                            padding: 15px;
                        }
                    }
                `}
            </style>
            {children}
        </div>
    );
}
