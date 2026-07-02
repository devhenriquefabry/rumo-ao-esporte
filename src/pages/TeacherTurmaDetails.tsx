
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, query, collection, getDocs, addDoc, Timestamp, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import PageContainer from '../components/PageContainer';
import { Users, CheckCircle, ArrowLeft, Printer, Search, X, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLoading } from '../components/LoadingService';

export default function TeacherTurmaDetails() {
    const { id } = useParams(); // turmaId
    const navigate = useNavigate();
    const { showAlert } = useDialog();
    const { showLoading } = useLoading();
    const [turma, setTurma] = useState<any>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [checkingAttendance, setCheckingAttendance] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && user.email) {
                // Security check before fetching data
                try {
                    const qTeacher = query(collection(db, 'teachers'), where('email', '==', user.email));
                    const snapTeacher = await getDocs(qTeacher);

                    if (!snapTeacher.empty) {
                        const teacherData = snapTeacher.docs[0].data();
                        if (teacherData.active === false) {
                            localStorage.removeItem('uba_teacher_name');
                            localStorage.removeItem('uba_teacher_role');
                            await auth.signOut();
                            alert("Seu acesso de professor foi desativado. Entre em contato com a secretaria.");
                            navigate('/aluno/login');
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Security check error:", e);
                }

                fetchData();
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [id]);

    const fetchData = async () => {
        if (!id) return;
        try {
            const turmaDoc = await getDoc(doc(db, 'turmas', id));
            if (!turmaDoc.exists()) {
                showAlert('Turma não encontrada', 'error');
                navigate('/professor/turmas');
                return;
            }
            setTurma({ id: turmaDoc.id, ...turmaDoc.data() });

            const q = query(collection(db, 'arena_simonesia_2026_registrations'), orderBy('responsavel.nome'));
            const snap = await getDocs(q);

            const list: any[] = [];
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.contractStatus === 'desativado') return;
                
                if (Array.isArray(data.alunos)) {
                    data.alunos.forEach((aluno: any, index: number) => {
                        if (aluno.turmaId === id) {
                            list.push({
                                registrationId: doc.id,
                                studentIndex: index,
                                nome: aluno.nome,
                                dataNascimento: aluno.dataNascimento,
                                fotoUrl: aluno.fotoUrl,
                                responsavel: data.responsavel?.nome,
                                telefone: data.responsavel?.telefonePrincipal
                            });
                        }
                    });
                }
            });

            list.sort((a, b) => a.nome.localeCompare(b.nome));
            setStudents(list);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintList = async () => {
        if (!turma || students.length === 0) return;

        console.log("=== PDF PRINT START ===");
        showLoading(3000, "Gerando lista de chamada...");

        const docPDF = new jsPDF();
        const pageWidth = docPDF.internal.pageSize.width;

        // Helper to load image as Base64
        const loadImage = (url: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = url;
            });
        };

        // Red Header
        docPDF.setFillColor(0, 125, 47);
        docPDF.rect(0, 0, pageWidth, 40, 'F');

        docPDF.setTextColor(255, 255, 255);
        docPDF.setFontSize(22);
        docPDF.setFont('helvetica', 'bold');
        docPDF.text("LISTA DE CHAMADA - Arena Simonésia 2026", pageWidth / 2, 25, { align: 'center' });

        docPDF.setFontSize(10);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 15, 35, { align: 'right' });

        docPDF.setTextColor(0, 0, 0);
        docPDF.setFontSize(14);
        docPDF.setFont('helvetica', 'bold');
        docPDF.text(turma.nome.toUpperCase(), 14, 55);

        docPDF.setFontSize(11);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text(`Professor: ${turma.responsavel || '-'}`, 14, 62);
        docPDF.text(`Horário: ${turma.horario}`, 14, 69);
        docPDF.text(`Dias: ${turma.dias?.join(', ')}`, 14, 76);

        // Pre-load images
        const photos: Record<number, string> = {};
        await Promise.all(students.map(async (s, index) => {
            if (s.fotoUrl) {
                try {
                    const base64 = await loadImage(s.fotoUrl);
                    photos[index] = base64;
                } catch (e) {
                    console.error("Error loading image for PDF:", e);
                }
            }
        }));

        const headers = [['FOTO', 'Nº', 'ALUNO', 'RESPONSÁVEL', 'PRESENÇA']];
        const data = students.map((s, i) => [
            '',
            i + 1,
            s.nome.toUpperCase(),
            s.responsavel?.toUpperCase() || '-',
            '____________________'
        ]);

        console.log("DEBUG: Calling autoTable function with docPDF");
        try {
            autoTable(docPDF, {
                startY: 85,
                head: headers,
                body: data,
                theme: 'grid',
                headStyles: { fillColor: [0, 125, 47], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 8, halign: 'center' },
                    2: { cellWidth: 60 },
                    3: { cellWidth: 50 },
                    4: { halign: 'center' }
                },
                didDrawCell: (cellData) => {
                    if (cellData.section === 'body' && cellData.column.index === 0 && photos[cellData.row.index]) {
                        const pos = cellData.cell;
                        const size = 8;
                        const x = pos.x + (pos.width - size) / 2;
                        const y = pos.y + (pos.height - size) / 2;
                        docPDF.addImage(photos[cellData.row.index], 'JPEG', x, y, size, size);
                    }
                }
            });
        } catch (error) {
            console.error("autoTable error:", error);
        }

        const fileName = `Chamada_${turma.nome.replace(/\s+/g, '_')}.pdf`;

        docPDF.save(fileName);

        console.log("DEBUG: PDF gerado com sucesso.");
    };

    const handleAttendance = async (presentIds: string[]) => {
        if (!turma) return;
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

        try {
            await addDoc(collection(db, 'arena_simonesia_2026_chamadas'), {
                date: Timestamp.now(),
                data: today,
                dataIso: new Date().toISOString(),
                turmaId: turma.id,
                turmaNome: turma.nome,
                modalidade: (turma.modalidade || '').toLowerCase(),
                totalCount: students.length,
                presentCount: presentIds.length,
                presentStudents: students
                    .filter(s => presentIds.includes(`${s.registrationId}-${s.studentIndex}`))
                    .map(s => ({ nome: s.nome, fotoUrl: s.fotoUrl || null })),
                teacherName: turma.responsavel || 'Portal Professor'
            });

            showAlert('Chamada registrada com sucesso!', 'success');
            setCheckingAttendance(false);
        } catch (error) {
            console.error("Error saving attendance:", error);
            showAlert('Erro ao salvar chamada.', 'error');
        }
    };

    const filteredStudents = students.filter(s =>
        s.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <PageContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button
                    onClick={() => navigate('/professor/turmas')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#555', fontWeight: 'bold' }}
                >
                    <ArrowLeft size={20} /> Voltar
                </button>
                <button
                    onClick={handlePrintList}
                    className="native-button native-button-secondary"
                    style={{ background: '#007d2f', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                >
                    <Download size={18} /> Baixar Lista (PDF)
                </button>
            </div>

            {loading ? <div className="loading-container">Carregando...</div> : (
                <>
                    <style>
                        {`
                        .bottom-sheet {
                            animation: slideUp 0.3s ease-out;
                            border-radius: 0 !important;
                            margin-top: auto !important;
                        }
                        @keyframes slideUp {
                            from { transform: translateY(100%); }
                            to { transform: translateY(0); }
                        }
                        .fixed-bottom-bar {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            background: rgba(255, 255, 255, 0.85);
                            backdrop-filter: blur(10px);
                            padding: 15px 20px;
                            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                            display: flex;
                            gap: 15px;
                            z-index: 100;
                        }
                        .square-corners, .square-corners * {
                            border-radius: 0 !important;
                        }
                        `}
                    </style>

                    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '20px', borderLeft: '4px solid #007d2f', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                        <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#007d2f' }}>{turma.nome}</h1>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', color: '#555', fontSize: '0.9rem' }}>
                            <div><strong>Dias:</strong> {turma.dias?.join(', ')}</div>
                            <div><strong>Horário:</strong> {turma.horario}</div>
                            <div><strong>Total:</strong> {students.length} Alunos</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 12px 12px 45px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gap: '10px', paddingBottom: '100px' }}>
                        {filteredStudents.map((student, index) => (
                            <div
                                key={`${student.registrationId}-${student.studentIndex}`}
                                onClick={() => navigate(`/professor/aluno/${student.registrationId}/${student.studentIndex}`)}
                                className="native-card touch-feedback"
                                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', cursor: 'pointer', margin: 0 }}
                            >
                                <div style={{ fontWeight: 'bold', color: '#ccc', width: '25px' }}>{index + 1}</div>

                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                                    {student.fotoUrl ? (
                                        <img src={student.fotoUrl} alt={student.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <Users size={24} color="#999" style={{ margin: '8px' }} />
                                    )}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', color: '#333', textTransform: 'uppercase' }}>{student.nome}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                        Resp: {student.responsavel?.split(' ')[0]} {student.telefone ? `• ${student.telefone}` : ''}
                                    </div>
                                </div>

                                <ArrowLeft size={16} color="#ccc" style={{ transform: 'rotate(180deg)' }} />
                            </div>
                        ))}
                    </div>

                    <div className="fixed-bottom-bar">
                        <button
                            onClick={handlePrintList}
                            className="native-button native-button-secondary"
                            style={{ flex: 1, height: '52px', fontSize: '1rem', fontWeight: 'bold' }}
                        >
                            <Printer size={20} style={{ marginRight: '8px' }} /> PDF
                        </button>
                        <button
                            onClick={() => setCheckingAttendance(true)}
                            className="native-button native-button-primary"
                            style={{ flex: 2, height: '52px', fontSize: '1rem', fontWeight: '900' }}
                        >
                            <CheckCircle size={20} style={{ marginRight: '8px' }} /> FAZER CHAMADA
                        </button>
                    </div>

                    {checkingAttendance && (
                        <AttendanceModal
                            students={students}
                            onClose={() => setCheckingAttendance(false)}
                            onSave={handleAttendance}
                        />
                    )}
                </>
            )}
        </PageContainer>
    );
}

function AttendanceModal({ students, onClose, onSave }: any) {
    const [selected, setSelected] = useState<string[]>([]);

    const toggle = (id: string) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(s => s !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const handleSelectAll = () => {
        if (selected.length === students.length) {
            setSelected([]);
        } else {
            setSelected(students.map((s: any) => `${s.registrationId}-${s.studentIndex}`));
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', flexDirection: 'column'
        }}>
            <div
                className="bottom-sheet square-corners"
                style={{
                    background: '#fff', width: '100%', maxWidth: '600px', margin: '0 auto',
                    height: '92vh', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfc' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#007d2f', fontSize: '1.2rem', fontWeight: '900' }}>Realizar Chamada</h3>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>{new Date().toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f0f0f0', border: 'none', borderRadius: '0', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} color="#666" />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ background: '#fff9c4', padding: '12px 15px', borderRadius: '0', marginBottom: '20px', fontSize: '0.85rem', color: '#856404', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '8px', height: '8px', background: '#856404', borderRadius: '0' }} />
                        Toque no nome para marcar como <strong>PRESENTE</strong>.
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                        {students.map((s: any) => {
                            const uid = `${s.registrationId}-${s.studentIndex}`;
                            const isPresent = selected.includes(uid);
                            return (
                                <div
                                    key={uid}
                                    onClick={() => toggle(uid)}
                                    className={`touch-feedback ${isPresent ? 'selected' : ''}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 15px',
                                        background: isPresent ? '#e8f5e9' : '#fff',
                                        border: `1px solid ${isPresent ? '#2e7d32' : '#eee'}`,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isPresent ? '0 2px 8px rgba(46, 125, 50, 0.15)' : 'none'
                                    }}
                                >
                                    {/* Photo Fallback */}
                                    <div style={{ width: '35px', height: '35px', borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {s.fotoUrl ? (
                                            <img src={s.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#999' }}>{s.nome.charAt(0)}</span>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, fontWeight: 'bold', color: isPresent ? '#1b5e20' : '#444', fontSize: '0.95rem', textTransform: 'uppercase' }}>
                                        {s.nome}
                                    </div>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '0',
                                        background: isPresent ? '#2e7d32' : '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: isPresent ? '#fff' : '#ccc',
                                        transition: 'all 0.2s'
                                    }}>
                                        {isPresent && <CheckCircle size={18} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ padding: '20px 25px', borderTop: '1px solid #eee', background: '#fff', boxShadow: '0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <button
                        onClick={handleSelectAll}
                        className="native-button native-button-secondary"
                        style={{ width: '100%', height: '45px', marginBottom: '10px', fontSize: '0.9rem', borderRadius: '0', fontWeight: 'bold' }}
                    >
                        {selected.length === students.length ? 'DESELECIONAR TODOS' : 'SELECIONAR TODOS'}
                    </button>
                    <button
                        onClick={() => onSave(selected)}
                        className="native-button native-button-primary"
                        style={{ width: '100%', height: '55px', fontSize: '1.1rem', borderRadius: '0', boxShadow: '0 4px 12px rgba(0, 125, 47, 0.3)' }}
                    >
                        FINALIZAR CHAMADA ({selected.length})
                    </button>
                    <button
                        onClick={onClose}
                        style={{ width: '100%', background: 'none', border: 'none', padding: '12px', color: '#999', cursor: 'pointer', fontSize: '0.9rem', marginTop: '5px' }}
                    >
                        Cancelar e Sair
                    </button>
                </div>
            </div>
        </div>
    );
}
