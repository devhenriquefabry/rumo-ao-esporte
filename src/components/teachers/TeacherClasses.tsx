import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, XCircle, ArrowRight } from 'lucide-react';

interface TeacherClassesProps {
    teacher: {
        id: string;
        nome: string;
        active: boolean;
    };
    classes: Array<{
        id: string;
        nome: string;
        horario: string;
    }>;
    studentCounts: Record<string, number>;
    onAssignClass: () => void;
    onUnassignClass: (turmaId: string, teacherName: string) => void;
}

export default function TeacherClasses({ teacher, classes, studentCounts, onAssignClass, onUnassignClass }: TeacherClassesProps) {
    const navigate = useNavigate();

    return (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#999', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={12} /> Turmas Coordenadas ({classes.length})
                </div>
                {teacher.active && classes.length > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAssignClass();
                        }}
                        style={{
                            background: '#f0f4f8',
                            color: '#00a63a',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.65rem',
                            fontWeight: '900',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <Plus size={10} /> MAIS
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {classes.length > 0 ? (
                    classes.map(t => (
                        <div
                            key={t.id}
                            onClick={teacher.active ? () => navigate(`/admin/turmas/${t.id}`) : undefined}
                            style={{
                                background: '#f8f9fa', color: '#333', padding: '8px 10px', borderRadius: '8px',
                                fontSize: '0.75rem', fontWeight: 'bold', cursor: teacher.active ? 'pointer' : 'default', border: '1px solid transparent',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', gap: '10px'
                            }}
                            onMouseEnter={teacher.active ? (e) => {
                                e.currentTarget.style.borderColor = '#00a63a';
                                e.currentTarget.style.background = '#fff';
                            } : undefined}
                            onMouseLeave={teacher.active ? (e) => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.background = '#f8f9fa';
                            } : undefined}
                        >
                            <div style={{ flex: 1 }}>
                                <span>{t.nome} <span style={{ color: '#999', fontWeight: 'normal', fontSize: '0.7rem' }}>• {t.horario}</span> <span style={{ color: '#00a63a', fontWeight: 'bold', fontSize: '0.7rem', marginLeft: '5px' }}>({studentCounts[t.id] || 0} alunos)</span></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {teacher.active && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUnassignClass(t.id, teacher.nome);
                                        }}
                                        title="Remover Professor desta Turma"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '50%',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                        <XCircle size={14} />
                                    </button>
                                )}
                                {teacher.active && <ArrowRight size={14} color="#00a63a" />}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '15px', textAlign: 'center', background: '#fafafa', borderRadius: '12px', color: '#bbb', fontSize: '0.8rem', fontStyle: 'italic', border: '1px dashed #eee', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span>Nenhuma turma vinculada atualmente.</span>
                        {teacher.active && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignClass();
                                }}
                                style={{
                                    alignSelf: 'center',
                                    background: '#00a63a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <Plus size={14} /> Atribuir Turma
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
