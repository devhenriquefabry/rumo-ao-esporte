import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingContextType {
    isLoading: boolean;
    progress: number;
    message: string;
    setLoading: (loading: boolean, message?: string, progress?: number) => void;
    showLoading: (duration?: number, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Carregando...');

    const setLoading = useCallback((loading: boolean, msg?: string, prog?: number) => {
        setIsLoading(loading);
        if (msg) setMessage(msg);
        if (prog !== undefined) setProgress(prog);
        else setProgress(0);
    }, []);

    const showLoading = useCallback((duration: number = 2000, msg?: string) => {
        setIsLoading(true);
        if (msg) setMessage(msg);
        setProgress(0);
        setTimeout(() => {
            setIsLoading(false);
        }, duration);
    }, []);

    return (
        <LoadingContext.Provider value={{ isLoading, progress, message, setLoading, showLoading }}>
            {children}
            {isLoading && <LoadingOverlay message={message} progress={progress} />}
        </LoadingContext.Provider>
    );
};

const LoadingOverlay = ({ message, progress }: { message: string, progress: number }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 2147483647,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.3s ease-in-out'
        }}>
            <div style={{
                background: '#fff',
                padding: '30px',
                borderRadius: '20px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1px solid rgba(0,0,0,0.05)'
            }}>
                <div style={{ position: 'relative', marginBottom: '15px' }}>
                    <Loader2
                        size={48}
                        color="#007d2f"
                        className="spin-animation"
                    />
                </div>
                <span style={{
                    color: '#007d2f',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    letterSpacing: '0.5px',
                    marginBottom: progress > 0 ? '10px' : '0'
                }}>
                    {message}
                </span>

                {progress > 0 && (
                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: '#007d2f', transition: 'width 0.1s linear' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px', fontWeight: 'bold' }}>{Math.round(progress)}%</span>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};
