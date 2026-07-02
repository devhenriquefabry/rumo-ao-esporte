import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import PageContainer from '../components/PageContainer';
import PageTitle from '../components/PageTitle';
import { Download, ArrowRight, ArrowLeft, Share2, RefreshCw, CheckCircle, Settings } from 'lucide-react';
import html2canvas from 'html2canvas';
import { loadWhatsAppConfig, sendWhatsApp, saveWhatsAppConfig, WORKER_URL } from './AdminMensagens/whatsappUtils';
import type { WhatsAppFullConfig } from './AdminMensagens/whatsappUtils';

interface BirthdayStudent {
    id: string;
    nome: string;
    fotoUrl: string;
    turma: string;
    dataNascimento: string;
    day: number;
    month: number;
    nextBirthday: Date;
    isFuture: boolean;
    isToday: boolean;
    telefoneResponsavel: string;
}

export default function AdminBirthdays() {
    const [activeTab, setActiveTab] = useState<'futuros' | 'passados'>('futuros');
    const [students, setStudents] = useState<BirthdayStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [customPhotos, setCustomPhotos] = useState<Record<string, string>>({});
    const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppFullConfig | null>(null);
    const [sendingStatus, setSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({});
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; student: BirthdayStudent | null }>({
        isOpen: false,
        student: null
    });
    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTriggering, setIsTriggering] = useState(false);

    // Store refs to the DOM elements we want to capture
    const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Infinite Scroll State
    const [visibleCount, setVisibleCount] = useState(10);
    const observerTarget = useRef<HTMLDivElement>(null);

    // Reset visible count when tab changes
    useEffect(() => {
        setVisibleCount(10);
    }, [activeTab]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const q = query(collection(db, "arena_simonesia_2026_registrations"));
                const querySnapshot = await getDocs(q);
                const list: BirthdayStudent[] = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const alunos = Array.isArray(data.alunos) ? data.alunos : [];
                    alunos.forEach((aluno: any, idx: number) => {
                        if (aluno.dataNascimento) {
                            const [d, m] = aluno.dataNascimento.split('/');
                            const day = parseInt(d);
                            const month = parseInt(m);

                            // Normalize specific birthday to current year for comparison
                            const currentYearBday = new Date(today.getFullYear(), month - 1, day);

                            let isFuture = false;

                            if (currentYearBday.getTime() === today.getTime()) {
                                isFuture = true; // Today counts as future/active
                            } else if (currentYearBday > today) {
                                isFuture = true;
                            } else {
                                isFuture = false;
                            }

                            list.push({
                                id: `${doc.id}-${idx}`,
                                nome: aluno.nome,
                                fotoUrl: aluno.fotoUrl,
                                turma: aluno.turma || 'Sem Turma',
                                dataNascimento: aluno.dataNascimento,
                                day,
                                month,
                                nextBirthday: currentYearBday,
                                isFuture,
                                isToday: currentYearBday.getTime() === today.getTime(),
                                telefoneResponsavel: data.responsavel?.telefonePrincipal || ''
                            });
                        }
                    });
                });

                setStudents(list);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        loadWhatsAppConfig().then(setWhatsappConfig);
    }, []);

    const filteredStudents = students.filter(s =>
        activeTab === 'futuros' ? s.isFuture : !s.isFuture
    ).sort((a, b) => {
        if (activeTab === 'futuros') {
            // Ascending: Closest to today first
            return a.nextBirthday.getTime() - b.nextBirthday.getTime();
        } else {
            // Descending: Closest to today (but past) first.
            return b.nextBirthday.getTime() - a.nextBirthday.getTime();
        }
    });

    const displayedStudents = filteredStudents.slice(0, visibleCount);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => prev + 10);
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [filteredStudents, visibleCount]);

    // --- Sincronização Automática de Artes de Aniversário ---
    useEffect(() => {
        if (loading || students.length === 0 || !whatsappConfig?.birthdayAutomationEnabled) return;

        const syncUpcomingCards = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const next7Days = new Date(today);
            next7Days.setDate(today.getDate() + 7);

            const upcoming = students.filter(s => {
                const bday = new Date(today.getFullYear(), s.month - 1, s.day);
                return bday >= today && bday <= next7Days;
            });

            console.log(`Verificando sincronização para ${upcoming.length} aniversariantes próximos...`);

            for (const student of upcoming) {
                // Pequeno delay para garantir que o DOM renderizou
                await new Promise(r => setTimeout(r, 1000));
                
                const blob = await generateCardImage(student.id);
                if (blob) {
                    const customId = `bday_card_${student.id.replace(/-/g, '_')}`;
                    try {
                        const res = await fetch(`${WORKER_URL}/upload?customId=${customId}`, {
                            method: 'POST',
                            body: blob
                        });
                        if (res.ok) console.log(`✓ Arte sincronizada: ${student.nome}`);
                    } catch (e) {
                        console.error(`Falha ao sincronizar arte para ${student.nome}:`, e);
                    }
                }
            }
        };

        const timer = setTimeout(syncUpcomingCards, 3000); // Inicia após 3s do carregamento
        return () => clearTimeout(timer);
    }, [loading, students, whatsappConfig?.birthdayAutomationEnabled]);

    const formatLongDate = (dateStr: string) => {
        const [d, m] = dateStr.split('/');
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${d.padStart(2, '0')} de ${months[parseInt(m) - 1]}`;
    };

    const generateCardImage = async (studentId: string): Promise<Blob | null> => {
        const element = cardRefs.current[studentId];
        if (!element) return null;

        // Garantir que todas as imagens internas foram carregadas antes da captura
        const imgs = Array.from(element.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        // Pequeno delay adicional para fontes e renderização estável
        await new Promise(r => setTimeout(r, 300));

        try {
            const canvas = await html2canvas(element, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true
        });
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png', 0.8); // 0.8 quality for faster blob creation
            });
        } catch (err) {
            console.error("Image generation failed", err);
            return null;
        }
    };

    const handleDownload = async (studentId: string, studentName: string) => {
        const blob = await generateCardImage(studentId);
        if (!blob) {
            alert("Erro ao gerar imagem. Tente novamente.");
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `Aniversario_${studentName.replace(/\s+/g, '_')}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, studentId: string) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setCustomPhotos(prev => ({
                        ...prev,
                        [studentId]: ev.target!.result as string
                    }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleWhatsApp = (studentName: string, telefone: string, studentId: string, studentPhotoUrl?: string) => {
        setConfirmModal({ isOpen: true, student: { nome: studentName, telefoneResponsavel: telefone, id: studentId, fotoUrl: studentPhotoUrl } as BirthdayStudent });
    };

    const executeWhatsAppSend = async (toTest: boolean) => {
        const student = confirmModal.student;
        if (!student) return;

        if (!whatsappConfig) {
            const config = await loadWhatsAppConfig();
            if (!config) {
                alert("Configuração do WhatsApp não encontrada.");
                return;
            }
            setWhatsappConfig(config);
        }

        const firstName = student.nome.split(' ')[0];
        const text = `Parabéns ${firstName}!\n\nA Arena Simonésia deseja a você um dia repleto de alegria, saúde e muitas conquistas. Que este novo ciclo seja brilhante!\n\nFeliz aniversário!`;

        setSendingStatus(prev => ({ ...prev, [student.id]: 'sending' }));
        setConfirmModal({ isOpen: false, student: null });

        // Pequeno delay para permitir que o modal feche e o spinner renderize antes do bloco pesado de CPU
        await new Promise(r => setTimeout(r, 150));

        // 1. Gera a imagem real do cartão de aniversário antes de enviar
        const blob = await generateCardImage(student.id);
        let birthdayCardDataUrl: string | undefined = undefined;
        
        if (blob) {
            birthdayCardDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        }

        try {
            const res = await sendWhatsApp(
                student.telefoneResponsavel,
                text,
                whatsappConfig!,
                toTest,
                birthdayCardDataUrl, // Usamos o card gerado dinamicamente aqui!
                undefined,
                student.nome,
                student.fotoUrl
            );

            if (res.success) {
                setSendingStatus(prev => ({ ...prev, [student.id]: 'success' }));
                setTimeout(() => {
                    setSendingStatus(prev => ({ ...prev, [student.id]: 'idle' }));
                }, 3000);
            } else {
                setSendingStatus(prev => ({ ...prev, [student.id]: 'error' }));
                alert(`Erro ao enviar: ${res.log}`);
            }
        } catch (err) {
            console.error(err);
            setSendingStatus(prev => ({ ...prev, [student.id]: 'error' }));
        }
    };

    const handleSaveAutomation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!whatsappConfig) return;
        setIsSaving(true);
        const success = await saveWhatsAppConfig({
            birthdayAutomationEnabled: whatsappConfig.birthdayAutomationEnabled,
            birthdaySendTime: whatsappConfig.birthdaySendTime,
            birthdayTemplateText: whatsappConfig.birthdayTemplateText,
            birthdayDefaultImage: whatsappConfig.birthdayDefaultImage,
            birthdayAutomationTestMode: whatsappConfig.birthdayAutomationTestMode,
        });
        setIsSaving(false);
        if (success) {
            setShowAutomationModal(false);
            alert("Configurações de automação salvas com sucesso!");
        } else {
            alert("Erro ao salvar configurações.");
        }
    };

    const handleTriggerNow = async () => {
        if (!window.confirm("Deseja disparar as mensagens de aniversário agora? Isso enviará mensagens para TODOS os aniversariantes do dia, ignorando o horário agendado.")) return;
        
        setIsTriggering(true);
        try {
            const res = await fetch(`${WORKER_URL}/birthday-automation-trigger`, {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(data.message || "Automação disparada com sucesso!");
            } else {
                alert(`Erro ao disparar: ${data.error || "Erro desconhecido"}`);
            }
        } catch (err: any) {
            alert(`Erro na requisição: ${err.message}`);
        } finally {
            setIsTriggering(false);
        }
    };

    return (
        <PageContainer>
            <PageTitle title="ANIVERSARIANTES" subtitle="Homenagens personalizadas">
                <div style={{ display: 'flex', gap: '5px', background: '#e0e0e0', padding: '4px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setActiveTab('futuros')}
                        style={{
                            padding: '8px 20px',
                            background: activeTab === 'futuros' ? '#fff' : 'transparent',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 'bold',
                            color: activeTab === 'futuros' ? '#007d2f' : '#666',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: activeTab === 'futuros' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.3s'
                        }}
                    >
                        <ArrowRight size={16} /> Próximos
                    </button>
                    <button
                        onClick={() => setActiveTab('passados')}
                        style={{
                            padding: '8px 20px',
                            background: activeTab === 'passados' ? '#fff' : 'transparent',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 'bold',
                            color: activeTab === 'passados' ? '#007d2f' : '#666',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: activeTab === 'passados' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.3s'
                        }}
                    >
                        <ArrowLeft size={16} /> Passados
                    </button>
                    <button
                        onClick={() => setShowAutomationModal(true)}
                        style={{
                            padding: '8px 20px',
                            background: '#00237f',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 'bold',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Settings size={16} /> Automação
                    </button>
                </div>
            </PageTitle>

            {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div> : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '30px',
                    paddingBottom: '40px'
                }}>
                    {displayedStudents.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: '40px' }}>
                            Nenhum aniversariante encontrado nesta categoria.
                        </div>
                    )}

                    {displayedStudents.map((student, index) => (
                        <div
                            key={student.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                animationDelay: `${index * 0.1}s`
                            }}
                            className="birthday-card-animate"
                        >
                            {/* 
                                The Card Container 
                                1. We display this responsively to the user.
                                2. html2canvas captures this exact element.
                            */}
                            <div
                                className="force-radius-card"
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                                    background: '#fff',
                                    containerType: 'inline-size' // Define container for cqw scaling
                                }}
                            >
                                <div
                                    ref={el => {
                                        if (el) cardRefs.current[student.id] = el;
                                    }}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                    }}
                                >
                                    {/* Background Image - Relative Position to define height */}
                                    <img
                                        src="/aniversario.png"
                                        alt="Background"
                                        style={{
                                            width: '100%',
                                            display: 'block',
                                            height: 'auto'
                                        }}
                                    />

                                    {/* Photo Container */}
                                    <div
                                        className="force-radius-photo"
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(29.5% - 5.5cqw)', // Scale-invariant 22px (at 400px width)
                                            left: '21.5%',
                                            width: '57%',
                                            height: '47%',
                                            overflow: 'hidden',
                                            backgroundImage: `url(${customPhotos[student.id] || student.fotoUrl || '/placeholder.png'})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => document.getElementById(`file-${student.id}`)?.click()}
                                    >
                                    </div>
                                    <input
                                        type="file"
                                        id={`file-${student.id}`}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={(e) => handlePhotoChange(e, student.id)}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => handleDownload(student.id, student.nome)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: '#333',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'transform 0.2s'
                                    }}
                                    className="touch-feedback"
                                >
                                    <Download size={18} /> Baixar
                                </button>
                                <button
                                    onClick={() => handleWhatsApp(student.nome, student.telefoneResponsavel, student.id, student.fotoUrl)}
                                    disabled={!student.telefoneResponsavel || sendingStatus[student.id] === 'sending'}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: sendingStatus[student.id] === 'success' ? '#10b981' : (student.telefoneResponsavel ? '#25D366' : '#ccc'),
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: (student.telefoneResponsavel && sendingStatus[student.id] !== 'sending') ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    className="touch-feedback"
                                >
                                    {sendingStatus[student.id] === 'sending' ? (
                                        <RefreshCw size={18} className="spin" />
                                    ) : sendingStatus[student.id] === 'success' ? (
                                        <CheckCircle size={18} />
                                    ) : (
                                        <Share2 size={18} />
                                    )}
                                    {sendingStatus[student.id] === 'sending' ? 'Enviando...' : 
                                     sendingStatus[student.id] === 'success' ? 'Enviado!' : 'Enviar Mensagem'}
                                </button>

                            </div>
                        </div>
                    ))
                    }
                </div >
            )}

            {/* Sentinel for Infinite Scroll */}
            {
                visibleCount < filteredStudents.length && (
                    <div
                        ref={observerTarget}
                        style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: '#999',
                            fontWeight: '500'
                        }}
                    >
                        Carregando mais...
                    </div>
                )
            }

            {/* Confirmation Modal */}
            {confirmModal.isOpen && confirmModal.student && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '24px', padding: '30px',
                        maxWidth: '450px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                        textAlign: 'center', position: 'relative'
                    }}>
                        <div style={{ color: '#25D366', marginBottom: '20px' }}>
                            <Share2 size={48} />
                        </div>
                        <h3 style={{ margin: '0 0 10px', color: '#334155', fontWeight: '800', fontSize: '1.4rem' }}>
                            Enviar Parabéns
                        </h3>
                        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '1rem' }}>
                            Deseja enviar o cartão de aniversário para o responsável de <strong>{confirmModal.student.nome}</strong>?
                        </p>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '25px', textAlign: 'left' }}>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Prévia da Mensagem:</p>
                            <p style={{ fontSize: '0.9rem', color: '#334155', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                Parabéns {confirmModal.student.nome.split(' ')[0]}! 🥳🎂...
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            <button
                                onClick={() => executeWhatsAppSend(false)}
                                style={{
                                    padding: '16px', borderRadius: '14px', border: 'none',
                                    background: '#25D366', color: '#fff', fontWeight: '800',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    fontSize: '1rem'
                                }}
                            >
                                <Share2 size={20} /> Enviar para Responsável
                            </button>
                            <button
                                onClick={() => executeWhatsAppSend(true)}
                                style={{
                                    padding: '12px', borderRadius: '14px', border: '1px solid #25D366',
                                    background: '#fff', color: '#25D366', fontWeight: '700',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                <Settings size={18} /> Enviar p/ Número Teste
                            </button>
                            <button
                                onClick={() => setConfirmModal({ isOpen: false, student: null })}
                                style={{
                                    padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0',
                                    background: '#fff', color: '#64748b', fontWeight: '700', cursor: 'pointer', marginTop: '5px'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Automation Settings Modal */}
            {showAutomationModal && whatsappConfig && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <form 
                        onSubmit={handleSaveAutomation}
                        style={{
                            background: '#fff', borderRadius: '28px', padding: '35px',
                            maxWidth: '500px', width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            position: 'relative', overflow: 'hidden'
                        }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #00237f, #007d2f)' }}></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <h3 style={{ margin: 0, color: '#00237f', fontWeight: '900', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Settings size={24} /> Automação de Parabéns
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setShowAutomationModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <ArrowLeft size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setWhatsappConfig({...whatsappConfig, birthdayAutomationEnabled: !whatsappConfig.birthdayAutomationEnabled})}>
                                <span style={{ fontWeight: 'bold', color: '#334155' }}>Ativar Envio Automático Diário</span>
                                <div style={{ width: '50px', height: '26px', background: whatsappConfig.birthdayAutomationEnabled ? '#00237f' : '#cbd5e1', borderRadius: '13px', position: 'relative', transition: 'all 0.3s' }}>
                                    <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: whatsappConfig.birthdayAutomationEnabled ? '27px' : '3px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', padding: '15px', borderRadius: '14px', border: '1px solid #fef3c7', cursor: 'pointer' }} onClick={() => setWhatsappConfig({...whatsappConfig, birthdayAutomationTestMode: !whatsappConfig.birthdayAutomationTestMode})}>
                                <span style={{ fontWeight: 'bold', color: '#92400e' }}>Enviar Mensagem p/ Número de Teste</span>
                                <div style={{ width: '50px', height: '26px', background: whatsappConfig.birthdayAutomationTestMode ? '#d97706' : '#cbd5e1', borderRadius: '13px', position: 'relative', transition: 'all 0.3s' }}>
                                    <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: whatsappConfig.birthdayAutomationTestMode ? '27px' : '3px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginLeft: '5px' }}>Horário do Disparo</span>
                                <input 
                                    type="time" 
                                    value={whatsappConfig.birthdaySendTime}
                                    onChange={(e) => setWhatsappConfig({...whatsappConfig, birthdaySendTime: e.target.value})}
                                    style={{ padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none', color: '#334155' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Horário em que o servidor processará os aniversariantes do dia.</span>
                            </div>

                            <button 
                                type="button"
                                onClick={handleTriggerNow}
                                disabled={isTriggering}
                                style={{
                                    marginTop: '10px', padding: '12px', borderRadius: '16px', border: '2px solid #00237f',
                                    background: 'transparent', color: '#00237f', fontWeight: '800', fontSize: '0.9rem',
                                    cursor: isTriggering ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isTriggering ? <RefreshCw className="spin" size={18} /> : <span>🚀</span>}
                                {isTriggering ? 'Disparando...' : 'Disparar Agora'}
                            </button>

                            <button 
                                type="submit" 
                                disabled={isSaving}
                                style={{
                                    marginTop: '10px', padding: '16px', borderRadius: '16px', border: 'none',
                                    background: '#00237f', color: '#fff', fontWeight: '800', fontSize: '1rem',
                                    cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    transition: 'all 0.2s', boxShadow: '0 10px 20px rgba(0,35,127,0.2)'
                                }}
                            >
                                {isSaving ? <RefreshCw className="spin" size={20} /> : <CheckCircle size={20} />}
                                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Hidden Sync Container for Automation (html2canvas needs elements in DOM) */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '400px' }}>
                {students.filter(s => {
                    const today = new Date();
                    const bday = new Date(today.getFullYear(), s.month - 1, s.day);
                    const next7Days = new Date();
                    next7Days.setDate(today.getDate() + 7);
                    return bday >= today && bday <= next7Days;
                }).map(student => (
                    <div
                        key={`sync-${student.id}`}
                        ref={el => { if (el) cardRefs.current[student.id] = el; }}
                        style={{ width: '400px', marginBottom: '50px' }}
                    >
                        {/* Duplicate of the card structure or use a shared component if possible */}
                        {/* Here we just render the minimal structure needed for the sync capture */}
                        <div style={{ position: 'relative', width: '100%', background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', containerType: 'inline-size' }}>
                             {/* Background */}
                             <img src="/aniversario.png" style={{ width: '100%', display: 'block', height: 'auto' }} />
                             
                             {/* Photo */}
                             <div style={{ 
                                position: 'absolute', 
                                top: 'calc(29.5% - 22px)', // 22px approximates 5.5cqw at 400px width
                                left: '21.5%', 
                                width: '57%', 
                                height: '47%', 
                                backgroundImage: `url(${customPhotos[student.id] || student.fotoUrl || '/placeholder.png'})`, 
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                borderRadius: '4px'
                             }}></div>

                             {/* Name and Date */}
                             <div style={{ 
                                position: 'absolute', 
                                top: '85%', 
                                left: '50%', 
                                transform: 'translateX(-50%)', 
                                width: '85%', 
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                             }}>
                                <h2 style={{ 
                                    margin: 0,
                                    color: '#00237f', 
                                    fontFamily: "'DucksFiesta', sans-serif", 
                                    fontSize: '44px', // Approximates 11cqw at 400px
                                    textTransform: 'capitalize',
                                    textShadow: '3px 3px 0 #fff'
                                }}>
                                    {student.nome.split(' ')[0].charAt(0).toUpperCase() + student.nome.split(' ')[0].slice(1).toLowerCase()}
                                </h2>
                                <div style={{
                                    color: 'black',
                                    fontFamily: "'BeneathTheSilence', serif",
                                    fontSize: '24px', // Approximates 6cqw
                                    marginTop: '8px'
                                }}>
                                    {formatLongDate(student.dataNascimento)}
                                </div>
                             </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @font-face {
                    font-family: 'BeneathTheSilence';
                    src: url('/Beneath the Silence.ttf') format('truetype');
                }

                @font-face {
                    font-family: 'DucksFiesta';
                    src: url('/Ducks Fiesta.ttf') format('truetype');
                }
                
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .birthday-card-animate {
                    animation: fadeInUp 0.6s ease forwards;
                    opacity: 0;
                }

                .force-radius-card {
                    border-radius: 0px !important;
                }
                
                .force-radius-photo {
                    border-radius: 45px !important;
                    border: 3.75cqw solid white !important; /* Scale-invariant 15px (at 400px width) */
                    box-sizing: content-box !important;
                }

                .touch-feedback:active {
                    transform: scale(0.98);
                }
            `}</style>
        </PageContainer >
    );
}
