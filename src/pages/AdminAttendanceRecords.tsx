
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Calendar, ClipboardCheck, Search, ChevronRight, User, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceRecord {
    id: string;
    turmaId: string;
    turmaNome?: string;
    turmaLabel?: string; // Legacy field
    modalidade: string;
    teacherName: string;
    date?: Timestamp; // New system
    dataIso?: any; // Legacy system (Date or string)
    presentCount?: number; // New system
    totalCount?: number; // New system
    totalPresentes?: number; // Legacy system
    totalAlunos?: number; // Legacy system
    presentStudents?: (string | { nome: string; fotoUrl: string | null })[];
    presentes?: string[]; // Legacy system (IDs)
}

const X = ({ size, color }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default function AdminAttendanceRecords() {
    const { showAlert, showConfirm } = useDialog();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'rumo_ao_esporte_2026_chamadas'), orderBy('date', 'desc'));
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
            setRecords(list);
        } catch (error) {
            console.error("Error fetching attendance records:", error);
            showAlert("Erro ao carregar registros de chamada.", "error");
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = records.filter(r => {
        const turma = (r.turmaNome || r.turmaLabel || '').toLowerCase();
        const teacher = (r.teacherName || 'Responsável não informado').toLowerCase();
        const modality = (r.modalidade || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return turma.includes(search) || teacher.includes(search) || modality.includes(search);
    });

    const formatDate = (ts: Timestamp) => {
        if (!ts) return '-';
        const date = ts && (ts as any).toDate ? (ts as any).toDate() : new Date(ts as any);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleDownloadPDF = async (record: AttendanceRecord) => {
        const doc = new jsPDF();
        const dateStr = formatDate(record.date || record.dataIso);
        const fileName = `Chamada_${(record.turmaNome || record.turmaLabel || 'Turma').replace(/\s+/g, '_')}_${dateStr.split(',')[0].replace(/\//g, '-')}.pdf`;

        // Style constants
        const primaryColor = [0, 125, 47]; // #00a63a

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

        // Header
        doc.setFontSize(18);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Frequência', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        doc.text(`Turma: ${record.turmaNome || record.turmaLabel || '-'}`, 20, 35);
        doc.text(`Data/Hora: ${dateStr}`, 20, 42);
        doc.text(`Professor: ${record.teacherName || '-'}`, 20, 49);
        doc.text(`Presentes: ${record.presentCount ?? record.totalPresentes ?? 0} de ${record.totalCount ?? record.totalAlunos ?? 0}`, 20, 56);

        // Pre-load images for the table
        const photos: Record<number, string> = {};
        if (record.presentStudents) {
            await Promise.all(record.presentStudents.map(async (student, index) => {
                if (typeof student !== 'string' && student.fotoUrl) {
                    try {
                        const base64 = await loadImage(student.fotoUrl);
                        photos[index] = base64;
                    } catch (e) {
                        console.error("Error loading image for PDF:", e);
                    }
                }
            }));
        }

        // Table
        const tableData = record.presentStudents?.map((student, index) => {
            const name = typeof student === 'string' ? student : student.nome;
            return ['', index + 1, name, 'Presente'];
        }) || [];

        if (tableData.length > 0) {
            autoTable(doc, {
                startY: 65,
                head: [['FOTO', '#', 'Nome do Aluno', 'Situação']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: primaryColor as [number, number, number], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 10, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 30, halign: 'center' }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 0 && photos[data.row.index]) {
                        const pos = data.cell;
                        const size = 10;
                        const x = pos.x + (pos.width - size) / 2;
                        const y = pos.y + (pos.height - size) / 2;
                        doc.addImage(photos[data.row.index], 'JPEG', x, y, size, size);
                    }
                }
            });
        } else {
            doc.setFont('helvetica', 'italic');
            doc.text('Nenhum aluno registrado como presente ou registro legado sem lista de nomes.', 20, 75);
        }

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Gerado em ${new Date().toLocaleString()} - Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }

        doc.save(fileName);
    };

    const handleDelete = async (record: AttendanceRecord) => {
        showConfirm(
            <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#00a63a', marginTop: 0 }}>Excluir este registro?</h3>
                <p>Esta ação removerá permanentemente este registro de presença do histórico.</p>
            </div>,
            async () => {
                try {
                    await deleteDoc(doc(db, 'rumo_ao_esporte_2026_chamadas', record.id!));
                    setRecords(prev => prev.filter(r => r.id !== record.id));
                    setSelectedRecord(null);
                    showAlert('Registro excluído com sucesso!', 'success');
                } catch (error) {
                    console.error('Error deleting record:', error);
                    showAlert('Erro ao excluir registro.', 'error');
                }
            }
        );
    };

    return (
        <PageContainer>
            <PageTitle title="HISTÓRICO DE CHAMADAS" />

            <div style={{ marginBottom: '20px', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                <input
                    type="text"
                    placeholder="Buscar por turma, professor ou modalidade..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 12px 12px 45px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem'
                    }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Carregando registros...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {filteredRecords.map(record => (
                        <div
                            key={record.id}
                            onClick={() => setSelectedRecord(record)}
                            className="native-card touch-feedback"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                padding: '20px',
                                cursor: 'pointer',
                                borderLeft: `6px solid ${(record.modalidade || '').toLowerCase() === 'futebol' ? '#2e7d32' : (record.modalidade || '').toLowerCase() === 'natacao' ? '#0288d1' : '#ed6c02'}`
                            }}
                        >
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '12px',
                                background: '#f5f5f5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#00a63a'
                            }}>
                                <ClipboardCheck size={28} />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '900', fontSize: '1.1rem', color: '#333' }}>{record.turmaNome || record.turmaLabel || 'Turma sem nome'}</span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        background: '#eee',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        textTransform: 'uppercase',
                                        fontWeight: 'bold',
                                        color: '#666'
                                    }}>
                                        {record.modalidade || 'Modalidade'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', color: '#777', fontSize: '0.85rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <User size={14} /> {record.teacherName || 'Responsável não informado'}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Calendar size={14} /> {formatDate(record.date || record.dataIso)}
                                    </span>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#00a63a' }}>
                                    {record.presentCount ?? record.totalPresentes ?? 0}/{record.totalCount ?? record.totalAlunos ?? 0}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 'bold' }}>Presentes</div>
                            </div>

                            <ChevronRight size={20} color="#ccc" />
                        </div>
                    ))}

                    {filteredRecords.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#999', background: '#fff', borderRadius: '15px' }}>
                            Nenhum registro de chamada encontrado.
                        </div>
                    )}
                </div>
            )}

            {/* Record Details Modal */}
            {selectedRecord && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '10px'
                }}>
                    <div className="native-card square-corners" style={{ width: '100%', maxWidth: '500px', margin: 0, animation: 'scaleIn 0.2s', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '25px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                    <h2 style={{ margin: 0, color: '#00a63a', fontSize: '1.4rem', fontWeight: '900' }}>{selectedRecord.turmaNome || selectedRecord.turmaLabel || 'Turma sem nome'}</h2>
                                    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>{formatDate(selectedRecord.date || selectedRecord.dataIso)}</p>
                                </div>
                                <button onClick={() => setSelectedRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '25px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>
                                    Professor Responsável
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{selectedRecord.teacherName || 'Responsável não informado'}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Alunos Presentes</span>
                                    <span>{selectedRecord.presentCount ?? selectedRecord.totalPresentes ?? 0} de {selectedRecord.totalCount ?? selectedRecord.totalAlunos ?? 0}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {selectedRecord.presentStudents ? (
                                        selectedRecord.presentStudents.map((student, i) => {
                                            const name = typeof student === 'string' ? student : student.nome;
                                            const photoUrl = typeof student === 'string' ? null : student.fotoUrl;

                                            return (
                                                <div key={i} style={{ padding: '12px 15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.95rem', color: '#333', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eee' }}>
                                                    <div style={{ width: '35px', height: '35px', borderRadius: '50%', overflow: 'hidden', background: '#eee', flexShrink: 0, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {photoUrl ? (
                                                            <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 'bold' }}>
                                                                {name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span style={{ fontWeight: '500' }}>{name}</span>
                                                </div>
                                            );
                                        })
                                    ) : (selectedRecord as any).presentes ? (
                                        <div style={{ padding: '15px', background: '#fff9c4', color: '#856404', borderRadius: '8px', fontSize: '0.9rem' }}>
                                            Este é um registro legado. No sistema antigo, apenas a contagem era armazenada individualmente sem os nomes neste log.
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontStyle: 'italic' }}>
                                            Nenhum aluno presente neste dia.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '20px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => handleDownloadPDF(selectedRecord)}
                                className="native-button"
                                style={{
                                    width: '100%',
                                    background: '#17428f',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                <Download size={18} /> Baixar PDF da Chamada
                            </button>
                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="native-button native-button-primary"
                                style={{ width: '100%', borderRadius: '8px' }}
                            >
                                Fechar Detalhes
                            </button>

                            <button
                                onClick={() => handleDelete(selectedRecord)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#999',
                                    fontSize: '0.8rem',
                                    padding: '5px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    marginTop: '5px'
                                }}
                                onMouseOver={e => e.currentTarget.style.color = '#00a63a'}
                                onMouseOut={e => e.currentTarget.style.color = '#999'}
                            >
                                Excluir Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>
                {`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .square-corners, .square-corners * { border-radius: 0 !important; }
                `}
            </style>
        </PageContainer>
    );
}


