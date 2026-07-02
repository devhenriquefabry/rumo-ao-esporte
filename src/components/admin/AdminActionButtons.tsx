

import { Check, Edit, Trash2, Archive, RefreshCw } from 'lucide-react';

interface AdminActionButtonsProps {
    contractStatus: string;
    isEditing: boolean;
    onToggleEdit: () => void;
    onApprove: () => void;
    onDelete: () => void;
    onDeactivate?: () => void;
    onReactivate?: () => void;
    canEdit?: boolean;
}

export default function AdminActionButtons({
    contractStatus, isEditing, onToggleEdit, onApprove, onDelete, onDeactivate, onReactivate, canEdit = true
}: AdminActionButtonsProps) {

    // If no permission, hide EVERYTHING
    if (!canEdit) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#fff',
            borderTop: '1px solid #eee',
            padding: '15px 20px',
            paddingBottom: 'calc(15px + env(safe-area-inset-bottom, 0))',
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
            zIndex: 1000
        }}>
            {isEditing ? (
                <>
                    <button onClick={onToggleEdit}
                        className="touch-feedback"
                        style={{
                            background: '#198754',
                            color: '#fff',
                            border: 'none',
                            padding: '14px 28px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            minHeight: '50px',
                            boxShadow: '0 4px 12px rgba(25, 135, 84, 0.3)'
                        }}
                    >
                        <Check size={20} /> Salvar Alterações
                    </button>
                    <button onClick={onToggleEdit}
                        className="touch-feedback"
                        style={{
                            background: '#f8f9fa',
                            color: '#666',
                            border: '1px solid #ddd',
                            padding: '14px 28px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            minHeight: '50px'
                        }}>
                        Cancelar
                    </button>
                </>
            ) : (
                <>
                    {contractStatus !== 'aprovado' && (
                        <button onClick={onApprove}
                            className="touch-feedback"
                            style={{
                                background: '#198754',
                                color: '#fff',
                                border: 'none',
                                padding: '14px 28px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                minHeight: '50px',
                                boxShadow: '0 4px 12px rgba(25, 135, 84, 0.3)'
                            }}
                        >
                            <Check size={20} /> Aprovar
                        </button>
                    )}
                    <button onClick={onToggleEdit}
                        className="touch-feedback"
                        style={{
                            background: '#e3f2fd',
                            color: '#1565c0',
                            border: 'none',
                            padding: '14px 28px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            minHeight: '50px'
                        }}>
                        <Edit size={20} /> Editar
                    </button>

                    {contractStatus === 'desativado' ? (
                        <button onClick={onReactivate}
                            className="touch-feedback"
                            style={{
                                background: '#e8f5e9',
                                color: '#2e7d32',
                                border: 'none',
                                padding: '14px 28px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                minHeight: '50px'
                            }}>
                            <RefreshCw size={20} /> Reativar
                        </button>
                    ) : (
                        <button onClick={onDeactivate}
                            className="touch-feedback"
                            style={{
                                background: '#fff3e0',
                                color: '#e65100',
                                border: 'none',
                                padding: '14px 28px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                minHeight: '50px'
                            }}>
                            <Archive size={20} /> Desativar
                        </button>
                    )}

                    <button onClick={onDelete}
                        className="touch-feedback"
                        style={{
                            background: '#ffebee',
                            color: '#c62828',
                            border: 'none',
                            padding: '14px 28px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            minHeight: '50px'
                        }}>
                        <Trash2 size={20} /> Excluir
                    </button>
                </>
            )}
        </div>
    );
}
