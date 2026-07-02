import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, HelpCircle, CheckCircle, XCircle, Info } from 'lucide-react';

type DialogType = 'alert' | 'confirm';
type DialogSeverity = 'info' | 'success' | 'warning' | 'error';

interface CustomDialogOptions {
    title?: string;
    message: ReactNode;
    type?: DialogType;
    severity?: DialogSeverity;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface CustomDialogContextType {
    showAlert: (message: string, severity?: DialogSeverity, title?: string) => void;
    showConfirm: (message: ReactNode, onConfirm: () => void, severity?: DialogSeverity, title?: string, onCancel?: () => void) => void;
}

const CustomDialogContext = createContext<CustomDialogContextType | undefined>(undefined);

export const useDialog = () => {
    const context = useContext(CustomDialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a CustomDialogProvider');
    }
    return context;
};

export const CustomDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<CustomDialogOptions | null>(null);

    const showAlert = (message: string, severity: DialogSeverity = 'info', title?: string) => {
        setOptions({
            message,
            severity,
            title: title || (severity === 'error' ? 'Erro' : severity === 'success' ? 'Sucesso' : severity === 'warning' ? 'Atenção' : 'Aviso'),
            type: 'alert',
            confirmLabel: 'OK'
        });
        setIsOpen(true);
    };

    const showConfirm = (message: ReactNode, onConfirm: () => void, severity: DialogSeverity = 'warning', title?: string, onCancel?: () => void) => {
        setOptions({
            message,
            severity,
            title: title || 'Confirmar',
            type: 'confirm',
            confirmLabel: 'Sim',
            cancelLabel: 'Não',
            onConfirm,
            onCancel
        });
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        if (options?.onCancel) options.onCancel();
    };

    const handleConfirm = () => {
        setIsOpen(false);
        if (options?.onConfirm) options.onConfirm();
    };

    const getIcon = () => {
        const size = 48;
        switch (options?.severity) {
            case 'success': return <CheckCircle size={size} color="#22c55e" />;
            case 'error': return <XCircle size={size} color="#ef4444" />;
            case 'warning': return <AlertCircle size={size} color="#f59e0b" />;
            case 'info': return <Info size={size} color="#3b82f6" />;
            default: return <HelpCircle size={size} color="#6366f1" />;
        }
    };

    const getSeverityColor = () => {
        switch (options?.severity) {
            case 'success': return '#22c55e';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6366f1';
        }
    };

    return (
        <CustomDialogContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {isOpen && options && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                    backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease'
                }}>
                    <style>
                        {`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}
                    </style>
                    <div style={{
                        background: '#fff', borderRadius: '20px', padding: '35px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', borderTop: `6px solid ${getSeverityColor()}`,
                        textAlign: 'center', animation: 'slideUp 0.3s ease-out'
                    }}>
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                            {getIcon()}
                        </div>

                        <h2 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '1.5rem', fontWeight: '800' }}>
                            {options.title}
                        </h2>

                        <div style={{ margin: '0 0 30px 0', color: '#4b5563', lineHeight: '1.6', fontSize: '1.1rem' }}>
                            {options.message}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            {options.type === 'confirm' && (
                                <button
                                    onClick={handleClose}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb',
                                        background: '#f9fafb', color: '#4b5563', cursor: 'pointer', fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
                                >
                                    {options.cancelLabel}
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                    background: getSeverityColor(), color: '#fff', cursor: 'pointer', fontWeight: 'bold',
                                    boxShadow: `0 4px 6px -1px ${getSeverityColor()}33`, transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                                {options.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </CustomDialogContext.Provider>
    );
};
