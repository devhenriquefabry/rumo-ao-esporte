import { useState } from 'react';
import StudentCard from '../components/StudentCard';
import { User, FileText, AlertTriangle, IdCard, Download, Camera, Loader } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { useDialog } from '../context/CustomDialogContext';
import StudentGalleryTab from './StudentGalleryTab';

interface StudentDetailsProps {
    aluno: any;
    index: number;
    data: any;
    setData: (data: any) => void;
    turmas: any[];
    generateStudentCardPDF: (student: any) => void;
    navigate: (path: string) => void;
    isEditing?: boolean;
    onTransfer?: () => void;
    allRegistrations?: any[];
    onRemoveModality?: (regId: string, modalityName: string) => void;
    canEdit?: boolean;
    activeTab: 'overview' | 'galerie';
    setActiveTab: (tab: 'overview' | 'galerie') => void;
}

export default function StudentDetailsSection({
    aluno,
    index,
    data,
    setData,
    turmas,
    generateStudentCardPDF,
    navigate,
    isEditing: _isEditing = false,
    onTransfer,
    allRegistrations = [],
    onRemoveModality,
    canEdit = true,
    activeTab,
    setActiveTab
}: StudentDetailsProps) {
    const { showAlert } = useDialog();
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = async (e: any) => {
        if (!canEdit) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const compressedFile = await compressImage(file);
            const formData = new FormData();
            formData.append('studentId', aluno.id);
            formData.append('photo', compressedFile);

            const response = await fetch('https://sistema-playkids-kids-geo-v2.thayron-alves-da-silva.workers.dev/upload-photo', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], fotoUrl: result.photoUrl };
                setData({ ...data, alunos: updatedAlunos });
                showAlert('Foto atualizada com sucesso!', 'success');
            } else {
                showAlert('Erro ao atualizar foto.', 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Erro ao enviar foto.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const getAge = (birthDate: string) => {
        if (!birthDate) return '';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} anos`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '20px' }}>
            {/* TABS HEADER */}
            <div style={{ display: 'flex', gap: '10px', padding: '0 10px', marginBottom: '-1px', zIndex: 1, position: 'relative' }}>
                <button
                    onClick={() => setActiveTab('overview')}
                    style={{ padding: '12px 24px', background: activeTab === 'overview' ? '#007d2f' : '#eee', color: activeTab === 'overview' ? '#fff' : '#666', borderRadius: '12px 12px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: activeTab === 'overview' ? '0 -2px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                    <User size={18} /> Visão Geral
                </button>
                <button
                    onClick={() => setActiveTab('galerie')}
                    style={{ padding: '12px 24px', background: activeTab === 'galerie' ? '#007d2f' : '#eee', color: activeTab === 'galerie' ? '#fff' : '#666', borderRadius: '12px 12px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: activeTab === 'galerie' ? '0 -2px 10px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                >
                    <Camera size={18} /> Galeria de Mídias
                </button>
            </div>

            <div style={{ background: activeTab === 'overview' ? '#007d2f' : 'transparent', borderRadius: '16px', borderTopLeftRadius: activeTab === 'overview' ? '0' : '16px', overflow: 'hidden', border: activeTab === 'overview' ? '1px solid rgba(255,255,255,0.1)' : 'none', boxShadow: activeTab === 'overview' ? '0 10px 25px rgba(0, 125, 47, 0.25)' : 'none' }}>

                {activeTab === 'overview' && (
                    <div className="student-grid-layout" style={{
                        display: 'grid',
                        gridTemplateColumns: '150px 1fr 350px',
                        gap: '20px',
                        padding: '25px',
                        alignItems: 'start',
                        color: '#fff'
                    }}>
                        {/* 1. PHOTO (Left) */}
                        <div className="student-photo-cell" style={{
                            width: '150px',
                            height: '150px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#fff',
                            border: '1px solid #ddd',
                            position: 'relative',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            flexShrink: 0
                        }}>
                            <input
                                type="file"
                                id={`photo-upload-${index}`}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                disabled={!canEdit}
                            />
                            <label
                                htmlFor={`photo-upload-${index}`}
                                style={{
                                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: canEdit ? 'pointer' : 'default',
                                    position: 'relative'
                                }}
                            >
                                {aluno.fotoUrl ? (
                                    <img src={aluno.fotoUrl} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <User size={32} />
                                        <span style={{ fontSize: '0.8rem', marginTop: '5px' }}>Sem Foto</span>
                                    </div>
                                )}

                                {/* HOVER OVERLAY - ONLY IF CAN EDIT */}
                                {canEdit && (
                                    <div className="photo-overlay" style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', opacity: 0, transition: 'opacity 0.2s',
                                        zIndex: 10
                                    }}>
                                        {uploading ? <Loader className="spin" size={24} /> : <Camera size={24} />}
                                        <span style={{ fontSize: '0.8rem', marginTop: '5px', fontWeight: 'bold' }}>
                                            {uploading ? 'Enviando...' : 'Alterar Foto'}
                                        </span>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* 2. DETAILS (Middle) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>{aluno.nome}</h3>
                                {data.contractStatus === 'desativado' && (
                                    <span style={{
                                        fontSize: '0.7rem', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '12px',
                                        background: '#ffeb3b', color: '#000', fontWeight: '900', border: '1px solid rgba(0,0,0,0.1)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        Desativado
                                    </span>
                                )}
                                {aluno.sexo && (
                                    <span style={{
                                        fontSize: '0.7rem', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '12px',
                                        background: aluno.sexo === 'M' ? '#e3f2fd' : '#fce4ec',
                                        color: aluno.sexo === 'M' ? '#1565c0' : '#c2185b',
                                        fontWeight: 'bold'
                                    }}>
                                        {aluno.sexo === 'M' ? 'Masculino' : 'Feminino'}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>Nascimento</label>
                                    <div style={{ fontSize: '1rem', color: '#fff', fontWeight: '600' }}>
                                        {aluno.dataNascimento ? new Date(aluno.dataNascimento).toLocaleDateString() : '-'}
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginLeft: '5px' }}>({getAge(aluno.dataNascimento)})</span>
                                    </div>
                                </div>
                                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '15px' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>Nº Camisa</label>
                                    {_isEditing ? (
                                        <input
                                            type="text"
                                            value={aluno.camisa || ''}
                                            placeholder="Ex: 10"
                                            onChange={(e) => {
                                                const updatedAlunos = [...data.alunos];
                                                updatedAlunos[index] = { ...updatedAlunos[index], camisa: e.target.value };
                                                setData({ ...data, alunos: updatedAlunos });
                                            }}
                                            style={{
                                                width: '70px',
                                                background: '#fff',
                                                border: '2px solid #ccc',
                                                borderRadius: '6px',
                                                color: '#333',
                                                padding: '6px 10px',
                                                fontSize: '1rem',
                                                fontWeight: 'bold',
                                                outline: 'none',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                            }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: '800' }}>
                                            {aluno.camisa || '-'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* HEALTH INFO */}
                            {(aluno.alergia || aluno.medicamento || aluno.planoSaude) && (
                                <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e65100', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>
                                        <AlertTriangle size={14} /> Informações de Saúde
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: '#666' }}>
                                        {aluno.alergia && <div><strong>Alergia:</strong> {aluno.alergia}</div>}
                                        {aluno.medicamento && <div><strong>Medicamento:</strong> {aluno.medicamento}</div>}
                                        {aluno.planoSaude && <div><strong>Plano de Saúde:</strong> {aluno.planoSaude}</div>}
                                    </div>
                                </div>
                            )}

                            {/* MODALITIES LIST */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(allRegistrations.length > 0 ? allRegistrations : [{ ...aluno, id: aluno.id || 'temp', modalidade: aluno.modalidade }]).map((reg, regIndex) => {
                                    return (
                                        <div key={reg.id || regIndex} style={{
                                            background: 'rgba(0,0,0,0.2)',
                                            color: '#fff',
                                            borderRadius: '12px',
                                            padding: '15px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '8px', height: '8px', borderRadius: '50%',
                                                        background: '#fff',
                                                        boxShadow: '0 0 5px rgba(255,255,255,0.5)'
                                                    }} />
                                                    <span style={{ fontWeight: '800', fontSize: '1rem', color: '#fff', letterSpacing: '0.5px' }}>
                                                        {(reg.modalidade || 'Modalidade não definida').toUpperCase()}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1' }}>
                                                    {onRemoveModality && canEdit && (
                                                        <div
                                                            onClick={() => onRemoveModality(reg.id, reg.modalidade)}
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                padding: '5px 10px',
                                                                background: '#fff',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontWeight: '800',
                                                                color: '#007d2f',
                                                                border: 'none',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}
                                                        >
                                                            EXCLUIR
                                                        </div>
                                                    )}

                                                    {onTransfer && canEdit && (
                                                        <div
                                                            onClick={() => (onTransfer as any)(reg)}
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                padding: '5px 10px',
                                                                background: 'rgba(255,255,255,0.2)',
                                                                border: '1px solid rgba(255,255,255,0.3)',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontWeight: '800',
                                                                color: '#fff',
                                                            }}
                                                        >
                                                            REMANEJAR
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => navigate(`/admin/contract/${reg.id}/${regIndex}`)}
                                                        style={{
                                                            background: '#fff',
                                                            border: 'none',
                                                            color: '#1e40af',
                                                            fontSize: '0.65rem',
                                                            padding: '5px 10px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: '800',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}
                                                    >
                                                        CONTRATO
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="category-turma-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {/* Modality specifics (Category/Plan) */}
                                                {(reg.modalidade?.toLowerCase() === 'futebol' || reg.modalidade?.toLowerCase() === 'voleibol' || reg.modalidade?.toLowerCase() === 'hidroginástica' || reg.modalidade?.toLowerCase() === 'natação') && (
                                                    <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
                                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px', fontWeight: 'bold' }}>
                                                            {reg.modalidade?.toLowerCase() === 'futebol' ? 'CATEGORIA' : 'PLANO'}
                                                        </div>
                                                        <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '0.9rem', color: '#fff', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                            {reg.modalidade?.toLowerCase() === 'futebol' ? reg.categoriaFutebol : (reg.planoVoleibol || reg.planId || '-')}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Turma Section */}
                                                <div style={{ flex: '2 1 250px', minWidth: '200px' }}>
                                                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>TURMA / HORÁRIO</label>
                                                    <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '0.9rem', color: '#fff', fontWeight: '500', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        {(() => {
                                                            const regTurmaId = reg.alunos?.[0]?.turmaId || reg.turmaId;
                                                            const t = turmas.find(t => t.id === regTurmaId);
                                                            return t ? `${t.horario} - ${t.nome}` : 'Sem turma definida';
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '5px' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>
                                                    STATUS: <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        background: reg.status === 'pago' ? '#2e7d32' : '#fff',
                                                        color: reg.status === 'pago' ? '#fff' : '#007d2f'
                                                    }}>{(reg.status || 'pendente').toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {
                                aluno.documentoUrl && (
                                    <a href={aluno.documentoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#333', textDecoration: 'none', background: '#f5f5f5', padding: '8px 12px', borderRadius: '6px', alignSelf: 'flex-start', width: '100%', boxSizing: 'border-box' }}>
                                        <FileText size={14} /> Ver Documento de Identidade
                                    </a>
                                )
                            }
                        </div>

                        {/* 3. CARD PREVIEW (Right) */}
                        <div className="student-card-preview-cell" style={{ width: '350px', maxWidth: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IdCard size={18} /> Carteirinha</span>
                                <button onClick={() => generateStudentCardPDF(aluno)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', padding: '5px', borderRadius: '50%', display: 'flex' }}><Download size={16} /></button>
                            </div>

                            {/* Wrapper IDENTICAL to AdminCarteirinhas grid cell */}
                            <div style={{
                                background: '#fff',
                                padding: '15px',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                minWidth: '320px', // Critical: matches minmax(320px, 1fr) from AdminCarteirinhas
                                boxSizing: 'border-box'
                            }}>
                                <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                                    <StudentCard student={aluno} responsavel={data.responsavel} numeroCota={data.numeroCota} />
                                </div>
                            </div>
                        </div>

                        <style>{`
                @media (min-width: 769px) and (max-width: 1100px) {
                    .student-grid-layout { 
                        grid-template-columns: 80px 1fr 280px !important; 
                        padding: 8px !important;
                        gap: 10px !important;
                    }
                    .student-photo-cell {
                        width: 80px !important;
                        height: 80px !important;
                    }
                    .student-grid-layout h3 {
                        font-size: 1.1rem !important;
                        white-space: normal !important;
                        line-height: 1.2 !important;
                    }
                    .student-card-preview-cell {
                        width: 280px !important;
                    }
                    .student-card-preview-cell > div:last-child {
                        min-width: 260px !important;
                        padding: 5px !important;
                    }
                    .category-turma-row > div {
                        min-width: 90px !important;
                    }
                    .student-grid-layout label {
                        font-size: 0.55rem !important;
                    }
                }
                @media (max-width: 768px) {
                    .student-grid-layout { grid-template-columns: 1fr !important; padding: 15px !important; }
                    .student-grid-layout > div { width: 100% !important; }
                    .student-grid-layout > .student-photo-cell { width: 120px !important; height: 120px !important; margin: 0 auto; }
                    .student-photo-cell label img { border-radius: 12px; }
                    .student-card-preview-cell { 
                        width: 100% !important; 
                        margin-top: 20px;
                        align-items: center;
                    }
                }
                    .student-photo-cell:hover .photo-overlay {
                        opacity: 1 !important;
                    }
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `}</style>
                    </div>
                )}

                {activeTab === 'galerie' && (
                    <div style={{ paddingTop: '5px' }}>
                        <StudentGalleryTab alunoId={`${data.id}_${index}`} />
                    </div>
                )}
            </div>
        </div>
    );
}
