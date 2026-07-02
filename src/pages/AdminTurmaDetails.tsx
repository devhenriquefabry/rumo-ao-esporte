import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useDialog } from '../context/CustomDialogContext';
import { useLoading } from '../components/LoadingService';
import { Printer, ArrowLeft, Users, Calendar, User, Trash2, Edit2, Check, X, ArrowRight, RefreshCw, Link, ExternalLink, Plus, Search, ArrowUpDown, Download } from 'lucide-react';
import { normalizeModality } from '../utils/turmasConstants';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sexta', 'Sáb', 'Dom'];
const MODALIDADES = ['futebol'];

interface Student {
    id: string;
    registrationId: string;
    nome: string;
    dataNascimento: string;
    cpf: string;
    modalidade: string;
    fotoUrl: string;
    responsavel: {
        nome: string;
        celular: string;
    };
}

interface Turma {
    id: string;
    nome: string;
    horario: string;
    dias: string[];
    responsavel: string;
    modalidade: string;
    ativo?: boolean;
}

export default function AdminTurmaDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useDialog();
    const { setLoading: setGlobalLoading } = useLoading();

    // Turma State
    const [turma, setTurma] = useState<Turma | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Turma>>({});

    // Transfer State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [movingStudent, setMovingStudent] = useState<Student | null>(null);
    const [availableTurmas, setAvailableTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Add Student State
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [allPotentialStudents, setAllPotentialStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [searchStudent, setSearchStudent] = useState('');
    const [searchYear, setSearchYear] = useState('');
    const [isSavingStudents, setIsSavingStudents] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);
    const [isScrolling, setIsScrolling] = useState(false);
    const [isLoadingPotential, setIsLoadingPotential] = useState(false);
    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [teachers, setTeachers] = useState<{ id: string, name: string, active?: boolean }[]>([]);

    // Sort State
    const [sortBy, setSortBy] = useState<'nome' | 'nascimento'>('nome');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: 'nome' | 'nascimento') => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    // Sort Logic
    const getSortedStudents = () => {
        return [...students].sort((a, b) => {
            let res = 0;
            if (sortBy === 'nome') {
                res = a.nome.localeCompare(b.nome);
            } else {
                // Nascimento
                if (!a.dataNascimento) res = 1;
                else if (!b.dataNascimento) res = -1;
                else {
                    try {
                        const [da, ma, ya] = a.dataNascimento.split('/');
                        const [db, mb, yb] = b.dataNascimento.split('/');
                        const dateA = new Date(parseInt(ya), parseInt(ma) - 1, parseInt(da));
                        const dateB = new Date(parseInt(yb), parseInt(mb) - 1, parseInt(db));
                        res = dateA.getTime() - dateB.getTime();
                    } catch (e) {
                        res = 0;
                    }
                }
            }
            return sortOrder === 'asc' ? res : -res;
        });
    };

    const sortedStudents = getSortedStudents();

    useEffect(() => {
        setVisibleCount(20);
    }, [searchStudent]);

    useEffect(() => {
        if (id) {
            fetchTurmaData();
            fetchTeachers();
        }
    }, [id]);

    const fetchTeachers = async () => {
        try {
            const q = query(collection(db, 'teachers'), orderBy('nome'));
            const snap = await getDocs(q);
            setTeachers(snap.docs.map(doc => ({
                id: doc.id,
                name: doc.data().nome,
                active: doc.data().active !== false // Default to true if not present
            })));
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    };

    const fetchTurmaData = async () => {
        try {
            setLoading(true);
            const turmaDoc = await getDoc(doc(db, 'turmas', id!));
            if (!turmaDoc.exists()) {
                showAlert("Turma não encontrada.", "error");
                navigate('/admin/turmas');
                return;
            }
            const t = turmaDoc.data();
            setTurma({ id: turmaDoc.id, ...t } as Turma);

            const studentsQuery = query(collection(db, "arena_simonesia_2026_registrations"), orderBy("createdAt", "desc"));
            const studentsSnapshot = await getDocs(studentsQuery);

            const studentList: Student[] = [];
            studentsSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data();

                const isArchived = data.contractStatus === 'desativado';
                if (isArchived) return;

                const alunosList = data.alunos && Array.isArray(data.alunos) ? data.alunos : [];
                alunosList.forEach((aluno: any, index: number) => {
                    // Check if this specific student belongs to this turma
                    if (aluno.turmaId !== id) return;

                    studentList.push({
                        id: `${docSnap.id}-${index}`,
                        registrationId: docSnap.id,
                        nome: aluno.nome,
                        dataNascimento: aluno.dataNascimento,
                        cpf: aluno.cpf,
                        modalidade: t.modalidade.charAt(0).toUpperCase() + t.modalidade.slice(1),
                        fotoUrl: aluno.fotoUrl,
                        responsavel: {
                            nome: data.responsavel?.nome || 'Responsável não informado',
                            celular: data.responsavel?.telefonePrincipal || data.responsavel?.telefone || ''
                        }
                    });
                });
            });

            // Sort alphabetically by student name
            studentList.sort((a, b) => a.nome.localeCompare(b.nome));

            setStudents(studentList);
        } catch (error) {
            console.error(error);
            showAlert("Erro ao buscar dados da turma.", "error");
        } finally {
            setLoading(false);
        }
    };

    const copyAttendanceLink = () => {
        const link = `${window.location.origin}/chamada-v2/${id}`;
        navigator.clipboard.writeText(link);
        setLinkCopied(true);
        showAlert("Link da chamada copiado para a área de transferência!", "success");
        setTimeout(() => setLinkCopied(false), 2000);
    };

    // Filter State
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
    const [availableFilters, setAvailableFilters] = useState<string[]>([]);

    // Import helper (assumed to be available or duplicated if import fails context)
    // Actually, I'll use the helper if imported, or re-implement simple logic if needed.
    // Let's assume calculateClass is imported. I need to add the import first.

    const openAddStudentModal = async () => {
        if (!turma) return;
        try {
            setShowAddStudentModal(true);
            setIsLoadingPotential(true);
            setSearchStudent('');
            setSearchYear('');
            setSelectedFilter(null); // Reset filter
            setSelectedStudentIds(new Set());
            const q = query(collection(db, "arena_simonesia_2026_registrations"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const list: (Student & { faixa?: string })[] = [];

            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.contractStatus === 'desativado') return;
                if (normalizeModality(data.modalidade) !== normalizeModality(turma.modalidade)) return;

                const alunos = data.alunos && Array.isArray(data.alunos) ? data.alunos : [];
                alunos.forEach((aluno: any, idx: number) => {
                    if (aluno.turmaId === id) return;

                    // Simple age calc for filter generation
                    // reusing the same logic as migration or similar
                    let age = -1;
                    if (aluno.dataNascimento) {
                        try {
                            const parts = aluno.dataNascimento.split('/');
                            if (parts.length === 3) {
                                const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                const today = new Date();
                                age = today.getFullYear() - d.getFullYear();
                                if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) {
                                    age--;
                                }
                            }
                        } catch (e) { }
                    }

                    let faixa = 'Outros';
                    if (age >= 15) faixa = 'Sub-15';
                    else if (age >= 12) faixa = 'Sub-12/13/14';
                    else if (age >= 10) faixa = 'Sub-10/11';
                    else if (age === 9) faixa = 'Sub-09';
                    else if (age >= 7) faixa = 'Sub-07/08';
                    else if (age >= 2) faixa = 'Iniciação';

                    list.push({
                        id: `${docSnap.id}-${idx}`,
                        registrationId: docSnap.id,
                        nome: aluno.nome,
                        dataNascimento: aluno.dataNascimento,
                        cpf: aluno.cpf,
                        modalidade: data.modalidade,
                        fotoUrl: aluno.fotoUrl,
                        responsavel: {
                            nome: data.responsavel?.nome || '',
                            celular: data.responsavel?.telefonePrincipal || ''
                        },
                        // We store the calculated faixa on the object for easy filtering
                        // using a type assertion or extending the type locally would be cleaner but this works for logic
                        ...({ faixa } as any)
                    });
                });
            });

            // Extract unique faixas for filters
            const faixas = Array.from(new Set(list.map(s => (s as any).faixa))).sort();
            setAvailableFilters(faixas);

            setAllPotentialStudents(list.sort((a, b) => a.nome.localeCompare(b.nome)));
            setVisibleCount(20);
        } catch (e) {
            console.error(e);
            showAlert("Erro ao buscar alunos potenciais.", "error");
        } finally {
            setIsLoadingPotential(false);
        }
    };

    const handleAddStudents = async () => {
        if (selectedStudentIds.size === 0) return;
        setIsSavingStudents(true);
        try {
            // Group by registrationId
            const regGroups: { [key: string]: number[] } = {};
            selectedStudentIds.forEach(sid => {
                const [rid, idx] = sid.split('-');
                if (!regGroups[rid]) regGroups[rid] = [];
                regGroups[rid].push(parseInt(idx));
            });

            const promises = Object.entries(regGroups).map(async ([rid, indices]) => {
                const regRef = doc(db, 'arena_simonesia_2026_registrations', rid);
                const regSnap = await getDoc(regRef);
                if (regSnap.exists()) {
                    const regData = regSnap.data();
                    const updatedAlunos = [...(regData.alunos || [])];
                    indices.forEach(idx => {
                        if (updatedAlunos[idx]) {
                            updatedAlunos[idx].turmaId = id;
                        }
                    });
                    return updateDoc(regRef, { alunos: updatedAlunos });
                }
            });

            await Promise.all(promises);

            setShowAddStudentModal(false);
            fetchTurmaData();
            showAlert("Alunos adicionados com sucesso!", "success");
        } catch (e) {
            console.error(e);
            showAlert("Erro ao adicionar alunos.", "error");
        } finally {
            setIsSavingStudents(false);
        }
    };

    const toggleStudentSelection = (sid: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(sid)) newSet.delete(sid);
        else newSet.add(sid);
        setSelectedStudentIds(newSet);
    };

    const handleRemoveStudent = (student: Student) => {
        showConfirm(`Tem certeza que deseja remover ${student.nome} desta turma?`, async () => {
            try {
                const [rid, idxStr] = student.id.split('-');
                const idx = parseInt(idxStr);
                const regRef = doc(db, 'arena_simonesia_2026_registrations', rid);
                const regSnap = await getDoc(regRef);

                if (regSnap.exists()) {
                    const regData = regSnap.data();
                    const updatedAlunos = [...(regData.alunos || [])];
                    if (updatedAlunos[idx]) {
                        updatedAlunos[idx].turmaId = '';
                    }
                    await updateDoc(regRef, { alunos: updatedAlunos });
                }

                fetchTurmaData();
                showAlert("Aluno removido com sucesso!", "success");
            } catch (e) {
                console.error(e);
                showAlert("Erro ao remover aluno.", "error");
            }
        });
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && !isScrolling) {
            if (visibleCount < allPotentialStudents.length) {
                setIsScrolling(true);
                setTimeout(() => {
                    setVisibleCount(prev => prev + 20);
                    setIsScrolling(false);
                }, 300);
            }
        }
    };

    // Filtered students computation
    const filteredPotentialStudents = allPotentialStudents.filter(s => {
        const matchesName = s.nome.toLowerCase().includes(searchStudent.toLowerCase());

        let matchesYear = true;
        if (searchYear && searchYear.length === 4) {
            const yearPart = s.dataNascimento?.split('/')[2];
            matchesYear = yearPart === searchYear;
        }

        const matchesFilter = selectedFilter ? (s as any).faixa === selectedFilter : true;
        return matchesName && matchesYear && matchesFilter;
    });

    const createPDF = async () => {
        if (!turma) return null;
        const docPDF = new jsPDF();
        const pageWidth = docPDF.internal.pageSize.width;
        const primaryColor = [0, 125, 47] as [number, number, number];

        // Header background
        docPDF.setFillColor(...primaryColor);
        docPDF.rect(0, 0, pageWidth, 45, 'F');

        // Logo
        try {
            const img = new Image();
            img.src = '/arena-logo-transparent.png';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            docPDF.setFillColor(255, 255, 255);
            docPDF.roundedRect((pageWidth - 20) / 2 - 1, 2, 22, 22, 2, 2, 'F');
            docPDF.addImage(img, 'JPEG', (pageWidth - 20) / 2, 3, 20, 20);
        } catch (e) { }

        docPDF.setTextColor(255, 255, 255);
        docPDF.setFontSize(16);
        docPDF.text("LISTA DE ALUNOS - 2026", pageWidth / 2, 32, { align: 'center' });
        docPDF.setFontSize(10);
        docPDF.text(`${turma.modalidade.toUpperCase()} - ${turma.nome} (${turma.horario})`, pageWidth / 2, 38, { align: 'center' });

        // Function to fetch image as base64
        const getImageBase64 = async (url: string): Promise<string | null> => {
            if (!url) return null;
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error("Error loading photo for PDF:", e);
                return null;
            }
        };

        const studentPhotos = await Promise.all(students.map(s => s.fotoUrl ? getImageBase64(s.fotoUrl) : Promise.resolve(null)));

        autoTable(docPDF, {
            startY: 50,
            head: [['#', 'Foto', 'Aluno', 'Nascimento', 'Responsável']],
            body: students.map((s, i) => [i + 1, '', s.nome, s.dataNascimento, s.responsavel.nome]),
            headStyles: { fillColor: primaryColor, textColor: 255, halign: 'center', cellPadding: 2 },
            styles: { minCellHeight: 16, valign: 'middle', fontSize: 9, cellPadding: 1 },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 18 },
                2: { cellWidth: 'auto', fontStyle: 'bold' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 'auto' }
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const photo = studentPhotos[data.row.index];
                    if (photo) {
                        try {
                            const x = data.cell.x + 2;
                            const y = data.cell.y + 1;
                            docPDF.addImage(photo, 'JPEG', x, y, 14, 14);
                        } catch (e) {
                            console.error("Error adding image to PDF table:", e);
                        }
                    }
                }
            }
        });

        return docPDF;
    };

    const generateStudentList = async () => {
        setGlobalLoading(true, 'Gerando PDF...', 0);
        try {
            const docPDF = await createPDF();
            if (docPDF && turma) {
                setGlobalLoading(true, 'Concluído!', 100);
                setTimeout(() => setGlobalLoading(false), 500);
                docPDF.save(`Lista_Alunos_${turma.nome}.pdf`);
            }
        } catch (e) {
            console.error(e);
            showAlert("Erro ao gerar PDF.", "error");
            setGlobalLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!turma) return;
        setGlobalLoading(true, 'Gerando PDF...', 10);
        try {
            const docPDF = await createPDF();
            if (!docPDF) {
                setGlobalLoading(false);
                return;
            }

            setGlobalLoading(true, 'Preparando download...', 50);
            const fileName = `Lista_Alunos_${turma.nome.replace(/\s+/g, '_')}.pdf`;

            // Check if native sharing is available for files
            const pdfBlob = docPDF.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                setGlobalLoading(true, 'Abrindo compartilhamento...', 80);
                try {
                    await navigator.share({
                        files: [file],
                        title: `Lista de Alunos - ${turma.nome}`,
                        text: `Segue a lista da turma ${turma.nome}:`
                    });
                    setGlobalLoading(true, 'Concluído!', 100);
                } catch (e) {
                    // If sharing fails or cancelled, fallback to download
                    docPDF.save(fileName);
                }
            } else {
                // Fallback for browsers that don't support file sharing
                setGlobalLoading(true, 'Iniciando download...', 80);
                docPDF.save(fileName);
                setGlobalLoading(true, 'Concluído!', 100);
            }

            setTimeout(() => setGlobalLoading(false), 500);

        } catch (e) {
            console.error(e);
            showAlert("Erro ao baixar PDF.", "error");
            setGlobalLoading(false);
        }
    };

    const handleDelete = () => {
        showConfirm(`Deseja realmente excluir a turma ${turma?.nome}? Esta ação não pode ser desfeita.`, async () => {
            try {
                await deleteDoc(doc(db, 'turmas', id!));
                navigate('/admin/turmas');
            } catch (e) {
                console.error(e);
                showAlert("Erro ao excluir turma.", "error");
            }
        });
    };

    const handleSave = async () => {
        if (!turma || !id) return;
        try {
            await updateDoc(doc(db, 'turmas', id!), { ...editData });
            setTurma({ ...turma, ...editData });
            setIsEditing(false);
            showAlert("Turma atualizada com sucesso!", "success");
        } catch (e) {
            console.error(e);
            showAlert("Erro ao salvar alterações.", "error");
        }
    };

    const toggleDia = (dia: string) => {
        const currentDias = editData.dias || [];
        const newDias = currentDias.includes(dia)
            ? currentDias.filter(d => d !== dia)
            : [...currentDias, dia];
        setEditData({ ...editData, dias: newDias });
    };

    const handleTransfer = async () => {
        if (!movingStudent || !selectedTurmaId) return;
        try {
            setIsTransferring(true);
            const [rid, idxStr] = movingStudent.id.split('-');
            const idx = parseInt(idxStr);
            const regRef = doc(db, 'arena_simonesia_2026_registrations', rid);
            const regSnap = await getDoc(regRef);

            if (regSnap.exists()) {
                const regData = regSnap.data();
                const updatedAlunos = [...(regData.alunos || [])];
                if (updatedAlunos[idx]) {
                    updatedAlunos[idx].turmaId = selectedTurmaId;
                }
                await updateDoc(regRef, { alunos: updatedAlunos });
            }

            setShowTransferModal(false);
            setMovingStudent(null);
            showAlert("Aluno remanejado com sucesso!", "success");
            fetchTurmaData();
        } catch (e) {
            console.error(e);
            showAlert("Erro ao remanejar aluno.", "error");
        } finally {
            setIsTransferring(false);
        }
    };

    const openTransferModal = async (student: Student) => {
        setMovingStudent(student);
        setShowTransferModal(true);
        setSelectedTurmaId('');
        try {
            const q = query(collection(db, 'turmas'), orderBy('horario'));
            const snap = await getDocs(q);
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Turma))
                .filter(t => t.id !== id && normalizeModality(t.modalidade) === normalizeModality(turma?.modalidade || '') && t.ativo !== false);
            setAvailableTurmas(list);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
    if (!turma) return null;

    const handleTeacherChange = async (teacherObj: { id: string, name: string, active?: boolean } | null) => {
        if (!id || !turma) return;

        const proceedWithAssignment = (name: string | null) => {
            const confirmMsg = name
                ? `Deseja alterar o professor desta turma para ${name}?`
                : `Deseja remover o professor responsável desta turma?`;

            showConfirm(confirmMsg, async () => {
                try {
                    setGlobalLoading(true, 'Atualizando...', 0);
                    await updateDoc(doc(db, 'turmas', id), {
                        responsavel: name || '',
                        responsavelId: name ? (teacherObj?.id || '') : ''
                    });

                    setTurma({ ...turma, responsavel: name || '' });
                    setShowTeacherModal(false);
                    showAlert(name ? "Professor atualizado com sucesso!" : "Professor removido com sucesso!", "success");
                } catch (error) {
                    console.error("Error updating teacher:", error);
                    showAlert("Erro ao atualizar professor.", "error");
                } finally {
                    setGlobalLoading(false);
                }
            });
        };

        if (teacherObj === null) {
            proceedWithAssignment(null);
            return;
        }

        if (teacherObj.active === false) {
            showConfirm(
                <div style={{ textAlign: 'left' }}>
                    <h3 style={{ color: '#007d2f', marginTop: 0 }}>Professor Desativado</h3>
                    <p>O professor <strong>{teacherObj.name}</strong> está desativado no sistema.</p>
                    <p>Deseja ativá-lo primeiro para que ele consiga acessar a turma?</p>
                </div>,
                async () => {
                    try {
                        setGlobalLoading(true, 'Ativando professor...', 0);
                        await updateDoc(doc(db, 'teachers', teacherObj.id), {
                            active: true
                        });

                        // Update local state
                        setTeachers(prev => prev.map(t => t.id === teacherObj.id ? { ...t, active: true } : t));

                        setGlobalLoading(false);
                        // Now proceed to assignment confirmation
                        proceedWithAssignment(teacherObj.name);
                    } catch (error) {
                        console.error("Error activating teacher:", error);
                        showAlert("Erro ao ativar professor.", "error");
                        setGlobalLoading(false);
                    }
                }
            );
        } else {
            proceedWithAssignment(teacherObj.name);
        }
    };

    return (
        <div className="turma-details-container" style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
            <style>
                {`
                    @keyframes borderPulse {
                        0% { border-color: #007d2f; box-shadow: 0 0 0px rgba(0, 125, 47, 0); }
                        50% { border-color: #ef4444; box-shadow: 0 0 15px rgba(0, 125, 47, 0.4); }
                        100% { border-color: #007d2f; box-shadow: 0 0 0px rgba(0, 125, 47, 0); }
                    }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .spin { animation: spin 1s linear infinite; }
                    .animate-target-border { animation: borderPulse 2s infinite ease-in-out; }
                    
                    @media (max-width: 600px) {
                        .turma-details-container {
                            padding: 10px !important;
                            width: 100% !important;
                        }
                        .turma-info-card {
                            padding: 20px !important;
                            margin-bottom: 20px !important;
                        }
                        .turma-title { font-size: 2rem !important; }
                        .turma-title { font-size: 2rem !important; }
                        
                        /* Layout fixes for mobile */
                        .top-actions-container {
                            flex-direction: column;
                            align-items: stretch !important;
                        }
                        .action-buttons-group {
                            flex-direction: column;
                            width: 100%;
                        }
                        .mobile-full-width-btn {
                            width: 100%;
                            justify-content: center;
                            padding: 12px !important;
                        }
                        .desktop-separator {
                            display: none;
                        }
                        
                        /* Student List Mobile Transform */
                        .hide-mobile {
                            display: none !important;
                        }
                        .mobile-only-details {
                            display: block !important;
                        }
                        .student-list-table thead {
                            display: none; /* Hide header on mobile */
                        }
                        .student-row {
                            display: flex;
                            flex-wrap: wrap;
                            align-items: center;
                            justify-content: flex-start; /* Changed from space-between */
                            padding: 15px;
                            margin-bottom: 15px; /* Space between cards */
                            background: #fff;
                            border: 1px solid #eee;
                            border-radius: 12px; /* Rounded corners */
                            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                            position: relative;
                        }
                        .student-photo-cell {
                            padding: 0 15px 0 0 !important;
                            flex: 0 0 auto;
                        }
                        .student-name-cell {
                            padding: 0 !important;
                            flex: 1 1 auto;
                        }
                        /* New: Ensure container handles button group spacing */
                        .student-actions-cell {
                            padding: 15px 0 0 0 !important;
                            flex: 0 0 100%; /* Force actions to new line */
                            border-top: 1px solid #f5f5f5;
                            margin-top: 10px;
                        }
                        .action-buttons {
                            display: flex !important;
                            gap: 10px;
                            justify-content: stretch !important;
                            width: 100%;
                        }
                        .action-buttons button {
                            flex: 1;
                            justify-content: center;
                            padding: 10px !important;
                            height: 40px;
                        }
                    }
                `}
            </style>

            <div className="top-actions-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <button
                    onClick={() => navigate('/admin/turmas')}
                    style={{ background: '#f5f5f5', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <ArrowLeft size={18} /> Voltar
                </button>
                <div className="action-buttons-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => window.open(`/chamada-v2/${id}`, '_blank')}
                                className="mobile-full-width-btn"
                                style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                            >
                                <ExternalLink size={18} /> Acessar Chamada
                            </button>
                            <button
                                onClick={copyAttendanceLink}
                                className="mobile-full-width-btn"
                                style={{ background: linkCopied ? '#22c55e' : '#f5f5f5', color: linkCopied ? '#fff' : '#333', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', justifyContent: 'center' }}
                            >
                                {linkCopied ? <Check size={18} /> : <Link size={18} />}
                                {linkCopied ? 'Link Copiado!' : 'Copiar Link'}
                            </button>
                            <div className="desktop-separator" style={{ width: '1px', background: '#eee', margin: '0 5px' }} />
                            <button
                                onClick={generateStudentList}
                                className="mobile-full-width-btn"
                                style={{ background: '#007d2f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', justifyContent: 'center' }}
                            >
                                <Printer size={18} /> Imprimir Alunos
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="mobile-full-width-btn"
                                style={{ background: '#25D366', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', justifyContent: 'center' }}
                            >
                                <Download size={18} /> Baixar PDF
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setEditData({
                                        nome: turma.nome,
                                        horario: turma.horario,
                                        dias: turma.dias,
                                        responsavel: turma.responsavel,
                                        modalidade: turma.modalidade
                                    });
                                }}
                                className="mobile-full-width-btn"
                                style={{ background: '#fff', color: '#007d2f', border: '1px solid #007d2f', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                            >
                                <Edit2 size={18} /> Editar Turma
                            </button>
                            <button
                                onClick={handleDelete}
                                className="mobile-full-width-btn"
                                style={{ background: '#fff', color: '#666', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                            >
                                <Trash2 size={18} /> Excluir Turma
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                className="mobile-full-width-btn"
                                style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', justifyContent: 'center' }}
                            >
                                <Check size={18} /> Salvar
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="mobile-full-width-btn"
                                style={{ background: '#fff', color: '#ef4444', border: '1px solid #ef4444', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                            >
                                <X size={18} /> Cancelar
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="turma-info-card" style={{ background: '#fff', borderRadius: '15px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '40px', border: '1px solid #eee', textAlign: 'center' }}>
                {!isEditing ? (
                    <>
                        <h1 className="turma-title" style={{ fontSize: '3rem', fontWeight: '900', color: '#333', margin: '0 0 10px 0' }}>{turma.horario}</h1>
                        <h2 style={{ fontSize: '1.5rem', color: '#007d2f', margin: '0 0 20px 0', textTransform: 'uppercase' }}>{turma.nome}</h2>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
                                <Calendar size={20} color="#007d2f" />
                                <strong>Dias:</strong> {turma.dias?.join(', ') || '-'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
                                <User size={20} color="#007d2f" />
                                <strong>Professor:</strong> {turma.responsavel || '-'}
                                <button
                                    onClick={() => setShowTeacherModal(true)}
                                    style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', color: '#007d2f', fontWeight: 'bold', marginLeft: '5px' }}
                                >
                                    ALTERAR
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
                                <Users size={20} color="#007d2f" />
                                <strong>Alunos:</strong> {students.length}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>HORÁRIO</label>
                                <input
                                    type="time"
                                    value={editData.horario}
                                    onChange={(e) => setEditData({ ...editData, horario: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #eee', fontSize: '1.2rem', fontWeight: 'bold' }}
                                />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>MODALIDADE</label>
                                <select
                                    value={editData.modalidade}
                                    onChange={(e) => setEditData({ ...editData, modalidade: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #eee', fontSize: '1rem', height: '54px' }}
                                >
                                    {MODALIDADES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>NOME DA TURMA</label>
                            <input
                                type="text"
                                value={editData.nome}
                                onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #eee', fontSize: '1rem' }}
                                placeholder="Ex: SUB-05 TERÇA/QUINTA"
                            />
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>PROFESSOR RESPONSÁVEL</label>
                            <input
                                type="text"
                                value={editData.responsavel}
                                onChange={(e) => setEditData({ ...editData, responsavel: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #eee', fontSize: '1rem' }}
                                placeholder="Nome do Professor"
                            />
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>DIAS DA SEMANA</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {DIAS_SEMANA.map(dia => (
                                    <button
                                        key={dia}
                                        onClick={() => toggleDia(dia)}
                                        style={{
                                            padding: '8px 15px',
                                            borderRadius: '20px',
                                            border: '1px solid #ddd',
                                            background: editData.dias?.includes(dia) ? '#007d2f' : '#fff',
                                            color: editData.dias?.includes(dia) ? '#fff' : '#666',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {dia}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                <div style={{ padding: '20px 25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#333', fontSize: '1.2rem' }}>
                        <Users size={20} color="#007d2f" />
                        LISTA DE ALUNOS ({students.length})
                    </h2>
                    <button
                        onClick={openAddStudentModal}
                        style={{
                            padding: '8px 16px', background: '#007d2f', color: '#fff', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex',
                            alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                        }}
                    >
                        <Plus size={18} /> Adicionar Aluno
                    </button>
                </div>
                <div className="student-list-container">
                    <table className="student-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                                <th style={{ padding: '15px', textAlign: 'left', color: '#666', fontSize: '0.85rem' }}>Foto</th>
                                <th
                                    onClick={() => handleSort('nome')}
                                    style={{ padding: '15px', textAlign: 'left', color: sortBy === 'nome' ? '#007d2f' : '#666', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        Aluno
                                        <ArrowUpDown
                                            size={14}
                                            style={{
                                                opacity: sortBy === 'nome' ? 1 : 0.3,
                                                transform: sortBy === 'nome' && sortOrder === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>
                                </th>
                                <th
                                    className="hide-mobile"
                                    onClick={() => handleSort('nascimento')}
                                    style={{ padding: '15px', textAlign: 'left', color: sortBy === 'nascimento' ? '#007d2f' : '#666', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        Nascimento
                                        <ArrowUpDown
                                            size={14}
                                            style={{
                                                opacity: sortBy === 'nascimento' ? 1 : 0.3,
                                                transform: sortBy === 'nascimento' && sortOrder === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>
                                </th>
                                <th className="hide-mobile" style={{ padding: '15px', textAlign: 'left', color: '#666', fontSize: '0.85rem' }}>Responsável</th>
                                <th style={{ padding: '15px', textAlign: 'right', color: '#666', fontSize: '0.85rem' }}>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                                        <Users size={40} color="#eee" style={{ marginBottom: '10px' }} />
                                        <div>Nenhum aluno matriculado nesta turma</div>
                                    </td>
                                </tr>
                            ) : (
                                sortedStudents.map(s => (
                                    <tr key={s.id} className="student-row" style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td className="student-photo-cell" style={{ padding: '12px 15px' }}>
                                            {s.fotoUrl ? (
                                                <img src={s.fotoUrl} alt={s.nome} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <User size={20} color="#ccc" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="student-name-cell" style={{ padding: '12px 15px' }}>
                                            <div className="student-info-mobile">
                                                <span
                                                    onClick={() => navigate(`/admin/details/${s.registrationId}`)}
                                                    style={{ fontWeight: 'bold', color: '#007d2f', textDecoration: 'underline', cursor: 'pointer', fontSize: '1rem' }}
                                                >
                                                    {s.nome}
                                                </span>
                                                <div className="mobile-only-details" style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'none' }}>
                                                    <div>{s.dataNascimento}</div>
                                                    <div>Resp: {s.responsavel.nome}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hide-mobile" style={{ padding: '12px 15px', color: '#666' }}>{s.dataNascimento}</td>
                                        <td className="hide-mobile" style={{ padding: '12px 15px' }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{s.responsavel.nome}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>{s.responsavel.celular}</div>
                                        </td>
                                        <td className="student-actions-cell" style={{ padding: '12px 15px', textAlign: 'right' }}>
                                            <div className="action-buttons" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => openTransferModal(s)}
                                                    style={{ background: '#fff', color: '#007d2f', border: '1px solid #007d2f', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                >
                                                    <RefreshCw size={14} /> <span className="btn-text">Remanejar</span>
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveStudent(s)}
                                                    style={{ background: '#fff', color: '#666', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    title="Remover Aluno"
                                                >
                                                    <Trash2 size={14} /> <span className="btn-text">Remover</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Remanejar Modal */}
            {showTransferModal && movingStudent && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}>Remanejar Aluno</h3>
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', marginBottom: '25px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#007d2f', marginBottom: '5px' }}>{movingStudent.nome}</div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>{turma.modalidade.toUpperCase()}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', gap: '15px' }}>
                            <div style={{ flex: 1, textAlign: 'center', padding: '15px', background: '#fff', border: '1px solid #eee', borderRadius: '10px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#999', fontWeight: 'bold', marginBottom: '5px' }}>TURMA ATUAL</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{turma.nome}</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>{turma.horario}</div>
                            </div>
                            <ArrowRight size={24} color="#007d2f" />
                            <div className="animate-target-border" style={{ flex: 1, textAlign: 'center', padding: '15px', background: '#fff', border: '2px dashed #007d2f', borderRadius: '10px', transition: 'all 0.3s ease' }}>
                                <div style={{ fontSize: '0.75rem', color: '#007d2f', fontWeight: 'bold', marginBottom: '5px' }}>NOVA TURMA</div>
                                <select
                                    value={selectedTurmaId}
                                    onChange={(e) => setSelectedTurmaId(e.target.value)}
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    <option value="">Selecionar...</option>
                                    {availableTurmas.map(t => (
                                        <option key={t.id} value={t.id}>{t.nome} ({t.horario})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleTransfer}
                                disabled={!selectedTurmaId || isTransferring}
                                style={{ flex: 1, padding: '12px', background: selectedTurmaId ? '#007d2f' : '#ccc', color: '#fff', border: 'none', borderRadius: '8px', cursor: selectedTurmaId ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
                            >
                                {isTransferring ? 'Processando...' : 'Confirmar Transferência'}
                            </button>
                            <button
                                onClick={() => { setShowTransferModal(false); setMovingStudent(null); }}
                                style={{ flex: 1, padding: '12px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Adicionar Aluno */}
            {showAddStudentModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', maxWidth: '600px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>ADICIONAR ALUNOS</h2>
                            <p style={{ color: '#666', fontSize: '0.9rem' }}>Selecione os alunos da modalidade <strong>{turma?.modalidade}</strong> para adicionar a esta turma.</p>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                                <button
                                    onClick={() => setSelectedFilter(null)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        border: '1px solid #ddd',
                                        background: selectedFilter === null ? '#333' : '#fff',
                                        color: selectedFilter === null ? '#fff' : '#666',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                    }}
                                >
                                    Todos ({allPotentialStudents.length})
                                </button>
                                {availableFilters.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setSelectedFilter(f === selectedFilter ? null : f)}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            border: '1px solid #ddd',
                                            background: selectedFilter === f ? '#007d2f' : '#fff',
                                            color: selectedFilter === f ? '#fff' : '#666',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                            <div style={{ position: 'relative', flex: 2 }}>
                                <Search size={18} color="#999" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome..."
                                    value={searchStudent}
                                    onChange={e => setSearchStudent(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                />
                            </div>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Calendar size={18} color="#999" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="number"
                                    placeholder="Ano (ex: 2018)"
                                    value={searchYear}
                                    onChange={e => setSearchYear(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const allFilteredIds = filteredPotentialStudents.map(s => s.id);
                                    const allSelected = allFilteredIds.every(id => selectedStudentIds.has(id));
                                    const newSet = new Set(selectedStudentIds);

                                    if (allSelected) {
                                        allFilteredIds.forEach(id => newSet.delete(id));
                                    } else {
                                        allFilteredIds.forEach(id => newSet.add(id));
                                    }
                                    setSelectedStudentIds(newSet);
                                }}
                                style={{
                                    padding: '0 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    background: '#f5f5f5',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap',
                                    color: '#666'
                                }}
                            >
                                {filteredPotentialStudents.length > 0 && filteredPotentialStudents.every(s => selectedStudentIds.has(s.id)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        </div>
                        <div onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '20px', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                            {isLoadingPotential ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '40px' }}>
                                    <RefreshCw size={40} className="spin" color="#007d2f" />
                                    <div style={{ color: '#666', fontWeight: 'bold' }}>Buscando alunos...</div>
                                </div>
                            ) : filteredPotentialStudents.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nenhum aluno encontrado com estes filtros.</p>
                            ) : (
                                <>
                                    {filteredPotentialStudents
                                        .slice(0, visibleCount)
                                        .map(student => (
                                            <div key={student.id} onClick={() => toggleStudentSelection(student.id)} style={{ display: 'flex', alignItems: 'center', padding: '12px 15px', borderBottom: '1px solid #eee', cursor: 'pointer', background: selectedStudentIds.has(student.id) ? '#f0f9ff' : 'transparent', transition: 'all 0.1s' }}>
                                                <input type="checkbox" checked={selectedStudentIds.has(student.id)} onChange={() => { }} style={{ marginRight: '15px', width: '20px', height: '20px', cursor: 'pointer' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                                                        {student.fotoUrl ? <img src={student.fotoUrl} alt={student.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={20} color="#ccc" style={{ margin: '10px' }} />}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#333' }}>{student.nome} <span style={{ fontSize: '0.75rem', color: '#fff', background: '#999', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>{(student as any).faixa}</span></div>
                                                        <div style={{ fontSize: '0.8rem', color: '#777' }}>Nascimento: {student.dataNascimento}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {isScrolling && (
                                        <div style={{ padding: '15px', textAlign: 'center', color: '#007d2f', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <RefreshCw size={16} className="spin" /> Carregando mais...
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setShowAddStudentModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                            <button onClick={handleAddStudents} disabled={selectedStudentIds.size === 0 || isSavingStudents} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: selectedStudentIds.size === 0 ? '#ccc' : '#2e7d32', color: '#fff', cursor: selectedStudentIds.size === 0 ? 'default' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {isSavingStudents ? <><RefreshCw size={18} className="spin" /> Salvando...</> : `Adicionar (${selectedStudentIds.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Teacher Change Modal */}
            {showTeacherModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '10px'
                }}>
                    <div className="native-card" style={{ width: '100%', maxWidth: '400px', margin: 0, animation: 'scaleIn 0.2s', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                            <h2 style={{ marginTop: 0, color: '#007d2f', fontSize: '1.2rem' }}>Alterar Professor</h2>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Selecione o novo professor para esta turma.</p>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {teachers.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTeacherChange(t)}
                                        className="touch-feedback"
                                        style={{
                                            padding: '12px 15px',
                                            borderRadius: '8px',
                                            border: '1px solid #eee',
                                            background: turma.responsavel === t.name ? '#f5f5f5' : '#fff',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s',
                                            opacity: t.active === false ? 0.7 : 1
                                        }}
                                    >
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: t.active === false ? '#ffebee' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={18} color={t.active === false ? '#ef5350' : '#999'} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', color: turma.responsavel === t.name ? '#007d2f' : '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {t.name}
                                                {turma.responsavel === t.name && <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'normal' }}>(Atual)</span>}
                                                {t.active === false && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        background: '#ffebee',
                                                        color: '#007d2f',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ffcdd2'
                                                    }}>
                                                        INATIVO
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {turma.responsavel === t.name && <Check size={16} color="#007d2f" />}
                                    </button>
                                ))}
                                {teachers.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                                        Nenhum professor cadastrado.
                                    </div>
                                )}
                            </div>

                            {turma.responsavel && (
                                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                                    <button
                                        onClick={() => handleTeacherChange(null)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #ef4444',
                                            background: '#fff',
                                            color: '#ef4444',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Trash2 size={16} /> Remover Professor Atual
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '20px', borderTop: '1px solid #eee' }}>
                            <button
                                onClick={() => setShowTeacherModal(false)}
                                className="native-button native-button-secondary"
                                style={{ width: '100%' }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
