import { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import StudentCard from '../components/StudentCard';
import { Download, Search, FileDown, Eye } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';

export default function AdminCarteirinhas() {
    const navigate = useNavigate();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(20);
    const [isScrolling, setIsScrolling] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [modalityFilter, setModalityFilter] = useState('futebol');

    useEffect(() => {
        const fetchRegs = async () => {
            try {
                const q = query(collection(db, "arena_simonesia_2026_registrations"));
                const querySnapshot = await getDocs(q);
                const rawData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Flatten to student level
                const flatList: any[] = [];
                rawData.forEach((reg: any) => {
                    if (reg.contractStatus === 'desativado') return;
                    if (reg.alunos && reg.alunos.length > 0) {
                        reg.alunos.forEach((aluno: any, index: number) => {
                            flatList.push({
                                uniqueId: `${reg.id}_${index}`,
                                regId: reg.id,
                                aluno: aluno,
                                responsavel: reg.responsavel,
                                modalidade: reg.modalidade,
                                numeroCota: reg.numeroCota,
                                contractStatus: reg.contractStatus,
                                createdAt: reg.createdAt
                            });
                        });
                    }
                });

                // Sort alphabetically by student name
                flatList.sort((a, b) => {
                    const nameA = a.aluno?.nome || '';
                    const nameB = b.aluno?.nome || '';
                    return nameA.localeCompare(nameB);
                });

                setAllStudents(flatList);
            } catch (error) {
                console.error("Error fetching:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRegs();
    }, []);

    // Reset pagination when searching or changing modality
    useEffect(() => {
        setVisibleCount(20);
    }, [searchTerm, modalityFilter]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && !isScrolling) {
            if (visibleCount < filteredStudents.length) {
                setIsScrolling(true);
                setTimeout(() => {
                    setVisibleCount(prev => prev + 20);
                    setIsScrolling(false);
                }, 300);
            }
        }
    };

    const filteredStudents = allStudents.filter(item => {
        const search = searchTerm.toLowerCase();
        const studentName = item.aluno?.nome?.toLowerCase() || '';
        const respName = item.responsavel?.nome?.toLowerCase() || '';
        const cpf = item.responsavel?.cpf?.replace(/\D/g, '') || '';
        const cota = item.numeroCota ? String(item.numeroCota) : '';

        // Added modality filter
        const matchesModality = item.modalidade?.toLowerCase() === modalityFilter.toLowerCase();
        const matchesSearch = studentName.includes(search) || respName.includes(search) || cpf.includes(search) || cota.includes(search);

        return matchesModality && matchesSearch;
    });

    // Formatting Logic (First Name + First Surname preserved, abbreviate middle if 4+ parts)
    const formatName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 4) {
            for (let i = 2; i < parts.length - 1; i++) {
                parts[i] = parts[i][0].toUpperCase() + '.';
            }
        }
        return parts.join(' ');
    };

    const generateSinglePDF = async (student: any, numeroCota: string, responsavel?: any) => {
        const { default: jsPDF } = await import('jspdf');
        const docPDF = new jsPDF({
            orientation: 'l',
            unit: 'mm',
            format: [85.6, 54] // Standard ID card size
        });

        const pageWidth = docPDF.internal.pageSize.width;
        const pageHeight = docPDF.internal.pageSize.height;

        try {
            // Load background image
            const bgImg = new Image();
            bgImg.src = '/carteirinha.png';
            await new Promise((resolve) => { bgImg.onload = resolve; bgImg.onerror = resolve; });
            docPDF.addImage(bgImg, 'PNG', 0, 0, pageWidth, pageHeight);

            // Load student photo with cropping (Object-Fit: Cover Simulation)
            if (student.fotoUrl) {
                try {
                    const response = await fetch(student.fotoUrl);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);

                    const photoData = await new Promise<string>((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const size = Math.min(img.width, img.height);
                            canvas.width = size;
                            canvas.height = size;

                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                reject(new Error('Canvas context failed'));
                                return;
                            }

                            // Calculate center crop
                            const sx = (img.width - size) / 2;
                            const sy = (img.height - size) / 2;

                            ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                            resolve(canvas.toDataURL('image/jpeg', 0.9));
                            URL.revokeObjectURL(objectUrl);
                        };
                        img.onerror = (e) => {
                            URL.revokeObjectURL(objectUrl);
                            reject(e);
                        };
                        img.src = objectUrl;
                    });

                    docPDF.addImage(photoData, 'JPEG', 7.7, 25.7, 18.0, 18.0);
                } catch (e) {
                    console.error("Error loading photo for PDF:", e);
                }
            }

            // Text coordinates matching StudentCard.tsx
            docPDF.setFontSize(7.5);
            docPDF.setTextColor(0, 125, 47); // Arena Green
            docPDF.setFont('helvetica', 'bold');

            // Name: (40.2%, 46.0%)
            docPDF.text(formatName(student.nome.toUpperCase()), 39.4, 24.0);

            docPDF.setTextColor(50, 50, 50);
            docPDF.setFontSize(6.5);

            // Cota: (50.8%, 52.5%)
            docPDF.text(numeroCota || '-', 45.0, 29.6);

            // CPF: (60.6%, 43.0%)
            docPDF.text(student.cpf || '-', 36.8, 34.8);

            // Birth: (70.8%, 68.0%)
            docPDF.text(student.dataNascimento || '-', 58.2, 40.2);

            // QR Code Generation for PDF
            try {
                const QRCodeModule = await import('qrcode');
                const QRCode = QRCodeModule.default || QRCodeModule;
                const qrData = `${student.cpf}|${student.dataNascimento}|${student.nome}`;

                const qrCanvas = document.createElement('canvas');
                await QRCode.toCanvas(qrCanvas, qrData, { margin: 1, width: 256 });
                const qrDataUrl = qrCanvas.toDataURL('image/png');

                docPDF.addImage(qrDataUrl, 'PNG', 66.8, 3.2, 15.4, 15.4);
            } catch (qrErr) {
                console.error("Error adding QR to PDF:", qrErr);
            }

            // =====================
            // BACK SIDE (Page 2) - Matching UI Design
            // =====================
            docPDF.addPage([85.6, 54], 'l');

            // Solid black back side
            docPDF.setFillColor(0, 0, 0);
            docPDF.rect(0, 0, pageWidth, pageHeight, 'F');

            // White text
            docPDF.setTextColor(255, 255, 255);

            // Header: Logo text + "Responsável Financeiro"
            docPDF.setFont('helvetica', 'bold');
            docPDF.setFontSize(7);
            docPDF.text('Arena Simonésia 2026', 5, 6);
            docPDF.setFont('helvetica', 'normal');
            docPDF.setFontSize(5);
            docPDF.text('RESPONSÁVEL FINANCEIRO', pageWidth - 5, 6, { align: 'right' });

            if (responsavel) {
                // Name (larger, bold)
                docPDF.setFont('helvetica', 'bold');
                docPDF.setFontSize(9);
                const nomeResp = responsavel.nome || '-';
                docPDF.text(nomeResp.length > 35 ? nomeResp.substring(0, 35) + '...' : nomeResp, 5, 14);

                // CPF and Phone on same line
                docPDF.setFontSize(5);
                docPDF.setFont('helvetica', 'normal');
                docPDF.text('CPF', 5, 20);
                docPDF.text('Telefone', pageWidth / 2, 20);
                docPDF.setFont('helvetica', 'bold');
                docPDF.setFontSize(6);
                docPDF.text(responsavel.cpf || '-', 5, 24);
                docPDF.text(responsavel.telefonePrincipal || '-', pageWidth / 2, 24);

                // Email
                docPDF.setFontSize(5);
                docPDF.setFont('helvetica', 'normal');
                docPDF.text('Email', 5, 30);
                docPDF.setFont('helvetica', 'bold');
                docPDF.setFontSize(6);
                docPDF.text(responsavel.email || '-', 5, 34);

                // Address
                const endereco = responsavel.endereco || {};
                const enderecoStr = [endereco.rua, endereco.numero, endereco.bairro, endereco.cidade, endereco.uf].filter(Boolean).join(', ');
                docPDF.setFontSize(5);
                docPDF.setFont('helvetica', 'normal');
                docPDF.text('Endereço', 5, 40);
                docPDF.setFont('helvetica', 'bold');
                docPDF.setFontSize(5.5);
                const maxCharsPerLine = 50;
                if (enderecoStr.length > maxCharsPerLine) {
                    docPDF.text(enderecoStr.substring(0, maxCharsPerLine), 5, 44);
                    docPDF.text(enderecoStr.substring(maxCharsPerLine, maxCharsPerLine * 2), 5, 48);
                } else {
                    docPDF.text(enderecoStr || '-', 5, 44);
                }
            }

            // Logo at bottom right
            const logoImg = new Image();
            logoImg.src = '/arena-logo-transparent.png';
            await new Promise((resolve) => { logoImg.onload = resolve; logoImg.onerror = resolve; });
            docPDF.addImage(logoImg, 'JPEG', pageWidth - 14, pageHeight - 10, 10, 7);

            docPDF.save(`Carteirinha_${student.nome.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF card:', error);
            alert('Erro ao gerar PDF da carteirinha.');
        }
    };

    const generateBatchPDF = async () => {
        if (exporting) return;
        setExporting(true);

        const { default: jsPDF } = await import('jspdf');
        const docPDF = new jsPDF({
            orientation: 'l',
            unit: 'mm',
            format: [85.6, 54]
        });

        const pageWidth = docPDF.internal.pageSize.width;
        const pageHeight = docPDF.internal.pageSize.height;

        try {
            // Load background image once
            const bgImg = new Image();
            bgImg.src = '/carteirinha.png';
            await new Promise((resolve) => { bgImg.onload = resolve; bgImg.onerror = resolve; });

            // Process filtered students
            for (let i = 0; i < filteredStudents.length; i++) {
                const item = filteredStudents[i];
                if (i > 0) docPDF.addPage();

                docPDF.addImage(bgImg, 'PNG', 0, 0, pageWidth, pageHeight);

                // Load photo
                if (item.aluno.fotoUrl) {
                    try {
                        const response = await fetch(item.aluno.fotoUrl);
                        const blob = await response.blob();
                        const photoData = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        docPDF.addImage(photoData, 'JPEG', 7.7, 25.7, 18.0, 18.0);
                    } catch (e) {
                        console.error(`Error loading photo for ${item.aluno.nome}:`, e);
                    }
                }

                docPDF.setFontSize(7.5);
                docPDF.setTextColor(0, 125, 47);
                docPDF.setFont('helvetica', 'bold');
                docPDF.text(formatName(item.aluno.nome.toUpperCase()), 39.4, 24.0);

                docPDF.setTextColor(50, 50, 50);
                docPDF.setFontSize(6.5);
                docPDF.text(item.numeroCota ? String(item.numeroCota) : '-', 45.0, 29.6);
                docPDF.text(item.aluno.cpf || '-', 36.8, 34.8);
                docPDF.text(item.aluno.dataNascimento || '-', 58.2, 40.2);
            }

            docPDF.save('Todas_Carteirinhas.pdf');
        } catch (error) {
            console.error('Error generating batch PDF:', error);
            alert('Erro ao gerar exportação em PDF.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <PageContainer style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header Content */}
            <div style={{ marginBottom: '30px', flexShrink: 0 }}>
                <PageTitle
                    title="CARTEIRINHAS"
                    subtitle="Visualize e exporte as carteirinhas de todos os alunos"
                >
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Buscar por nome, cota ou CPF..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '10px 15px',
                                    paddingLeft: '35px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.9rem',
                                    width: '300px',
                                    outline: 'none'
                                }}
                            />
                            <Search size={16} color="#888" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                        <button
                            onClick={generateBatchPDF}
                            disabled={exporting || loading || filteredStudents.length === 0}
                            style={{
                                background: '#007d2f',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: exporting || loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600',
                                opacity: exporting || loading ? 0.7 : 1
                            }}
                        >
                            {exporting ? 'Gerando PDF...' : (
                                <>
                                    <FileDown size={18} />
                                    Exportar Todas ({filteredStudents.length})
                                </>
                            )}
                        </button>
                    </div>
                </PageTitle>

                {/* Modality Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '20px',
                    overflowX: 'auto',
                    paddingBottom: '5px',
                    borderBottom: '1px solid #eee'
                }}>
                    {[
                        { id: 'futebol', label: 'FUTEBOL' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setModalityFilter(tab.id)}
                            style={{
                                padding: '12px 30px',
                                borderRadius: '12px 12px 0 0',
                                border: 'none',
                                background: modalityFilter === tab.id ? '#007d2f' : 'transparent',
                                color: modalityFilter === tab.id ? '#fff' : '#888',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease',
                                borderBottom: modalityFilter === tab.id ? '3px solid #9a1a1f' : '3px solid transparent'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>Carregando dados...</div>
            ) : (
                <div
                    onScroll={handleScroll}
                    style={{
                        background: '#f5f7fa',
                        borderRadius: '12px',
                        flex: 1,
                        overflowY: 'auto',
                        paddingRight: '5px'
                    }}
                >
                    {filteredStudents.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                            Nenhum aluno encontrado.
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px',
                            paddingBottom: '20px'
                        }}>
                            {filteredStudents.slice(0, visibleCount).map((item) => (
                                <div key={item.uniqueId} style={{
                                    background: '#fff',
                                    padding: '15px',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px'
                                }}>
                                    <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                                        <StudentCard
                                            student={item.aluno}
                                            responsavel={item.responsavel}
                                            numeroCota={item.numeroCota}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => generateSinglePDF(item.aluno, item.numeroCota, item.responsavel)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#f0f0f0',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: '#333',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#e0e0e0'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        >
                                            <Download size={16} /> Baixar
                                        </button>
                                        <button
                                            onClick={() => navigate(`/admin/details/${item.regId}`)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#fff',
                                                border: '1px solid #007d2f',
                                                borderRadius: '6px',
                                                color: '#007d2f',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#007d2f';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = '#fff';
                                                e.currentTarget.style.color = '#007d2f';
                                            }}
                                        >
                                            <Eye size={16} /> Detalhes do Aluno
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {isScrolling && (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                            Carregando mais...
                        </div>
                    )}
                </div>
            )}
            {/* Loading Overlay */}
            {exporting && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.9)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #007d2f',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                    <h3 style={{ marginTop: '20px', color: '#333', fontSize: '1.2rem' }}>Gerando PDF com todas as carteirinhas...</h3>
                    <p style={{ color: '#666' }}>Aguarde, isso pode levar alguns segundos.</p>
                </div>
            )}
        </PageContainer>
    );
}
