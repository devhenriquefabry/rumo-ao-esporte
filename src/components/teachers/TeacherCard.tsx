import { Edit, Trash2, User, Phone, Mail, MessageSquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import TeacherCredentials from './TeacherCredentials';
import TeacherClasses from './TeacherClasses';

interface TeacherCardProps {
    teacher: {
        id: string;
        nome: string;
        email: string;
        telefone?: string;
        cpf?: string;
        active: boolean;
        senha?: string;
    };
    classes: Array<{
        id: string;
        nome: string;
        horario: string;
    }>;
    studentCounts: Record<string, number>;
    isPasswordVisible: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: () => void;
    onTogglePassword: () => void;
    onCopyToClipboard: (text: string, label: string) => void;
    onAssignClass: () => void;
    onUnassignClass: (turmaId: string, teacherName: string) => void;
    onCredentialsUpdated?: (newEmail?: string, newPassword?: string) => void;
    readOnly?: boolean;
}

export default function TeacherCard({
    teacher,
    classes,
    studentCounts,
    isPasswordVisible,
    onEdit,
    onDelete,
    onToggleStatus,
    onTogglePassword,
    onCopyToClipboard,
    onAssignClass,
    onUnassignClass,
    onCredentialsUpdated,
    readOnly
}: TeacherCardProps) {
    const whatsappUrl = `https://wa.me/55${(teacher.telefone || '').replace(/\D/g, '')}`;

    return (
        <div className="native-card" style={{
            position: 'relative',
            padding: '15px',
            paddingTop: !teacher.active ? '45px' : '15px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            border: '1px solid #f0f0f0',
            borderRadius: '16px',
            background: teacher.active ? '#fff' : '#fcfcfc',
            boxShadow: teacher.active ? '0 4px 20px rgba(0,0,0,0.05)' : 'none',
            overflow: 'hidden',
            transition: 'all 0.3s'
        }}>
            {/* Status bar - colorida no topo */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: teacher.active ? '#4caf50' : '#007d2f'
            }} />

            {/* Faixa DESATIVADO - reta no topo */}
            {!teacher.active && (
                <div style={{
                    position: 'absolute',
                    top: '4px',
                    left: 0,
                    right: 0,
                    background: '#007d2f',
                    color: '#fff',
                    padding: '6px 15px',
                    fontWeight: '900',
                    fontSize: '0.7rem',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}>
                    <AlertTriangle size={14} /> PROFESSOR DESATIVADO
                </div>
            )}

            {/* Content com dimming quando inativo */}
            <div style={{
                opacity: teacher.active ? 1 : 0.35,
                filter: teacher.active ? 'none' : 'grayscale(0.8)',
                transition: 'all 0.3s',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: teacher.active ? 'auto' : 'none'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: '2px' }}>{teacher.nome}</div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '0.65rem', color: teacher.active ? '#2e7d32' : '#757575',
                            background: teacher.active ? '#e8f5e9' : '#f5f5f5',
                            padding: '2px 8px', borderRadius: '20px', fontWeight: '900'
                        }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: teacher.active ? '#4caf50' : '#9e9e9e' }} />
                            {teacher.active ? 'ATIVO' : 'INATIVO'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', pointerEvents: 'auto' }}>
                        <button onClick={onEdit} title={readOnly ? "Visualizar" : "Editar"} style={{ background: '#f8f9fa', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#1976d2', transition: 'background 0.2s' }}>
                            {readOnly ? <User size={16} /> : <Edit size={16} />}
                        </button>
                        {!readOnly && (
                            <button onClick={onDelete} style={{ background: '#fff5f5', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#007d2f', transition: 'background 0.2s' }}><Trash2 size={16} /></button>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#444', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={14} color="#455a64" />
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Phone size={14} color="#455a64" />
                        </div>
                        <span>{teacher.telefone || '(Não informado)'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ minWidth: '24px', height: '24px', borderRadius: '6px', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={14} color="#455a64" />
                        </div>
                        <span>CPF: {teacher.cpf || '---.---.--- --'}</span>
                    </div>

                    <TeacherCredentials
                        teacher={teacher}
                        isVisible={isPasswordVisible}
                        onToggleVisibility={onTogglePassword}
                        onCopy={onCopyToClipboard}
                        onCredentialsUpdated={onCredentialsUpdated}
                    />

                    <TeacherClasses
                        teacher={teacher}
                        classes={classes}
                        studentCounts={studentCounts}
                        onAssignClass={onAssignClass}
                        onUnassignClass={onUnassignClass}
                    />
                </div>
            </div>

            {/* Action buttons - FORA do wrapper de dimming */}
            <div style={{ marginTop: '15px', display: 'flex', gap: '8px', position: 'relative', zIndex: 20 }}>
                <a
                    href={teacher.active ? whatsappUrl : '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        flex: 1.2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px',
                        background: teacher.active ? '#25D366' : '#eee',
                        color: teacher.active ? '#fff' : '#aaa',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '900',
                        fontSize: '0.8rem',
                        boxShadow: teacher.active ? '0 4px 10px rgba(37, 211, 102, 0.2)' : 'none',
                        transition: 'transform 0.2s',
                        pointerEvents: teacher.active ? 'auto' : 'none'
                    }}
                    onMouseEnter={(e) => { if (teacher.active) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { if (teacher.active) e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <MessageSquare size={16} /> WhatsApp
                </a>
                {!readOnly && (
                    <button
                        onClick={onToggleStatus}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px',
                            background: teacher.active ? '#fff' : '#4caf50',
                            color: teacher.active ? '#007d2f' : '#fff',
                            borderRadius: '8px',
                            border: teacher.active ? '1.5px solid #007d2f' : 'none',
                            fontWeight: '900',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: teacher.active ? 'none' : '0 4px 10px rgba(76, 175, 80, 0.2)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (teacher.active) {
                                e.currentTarget.style.background = '#fff5f5';
                            } else {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (teacher.active) {
                                e.currentTarget.style.background = '#fff';
                            } else {
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                    >
                        {teacher.active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                        {teacher.active ? 'Desativar' : 'Ativar'}
                    </button>
                )}
            </div>
        </div >
    );
}
