import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { planService } from '../utils/planService';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';
import {
    Users,
    TrendingUp,
    Activity,
    PieChart,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    FileText,
    CreditCard,
    Banknote,
    QrCode,
    XCircle,
    Printer
} from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';
import { generateOverduePDF } from './AdminDashboard/utils/pdfGenerator';
import { expenseService } from '../utils/expenseService';



export default function AdminStats() {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    const { showConfirm, showAlert } = useDialog();
    const [loading, setLoading] = useState(true);

    // Month Navigator
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() }); // 0-indexed month

    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st
        end: new Date().toISOString().split('T')[0]
    });

    const [stats, setStats] = useState({
        totalRegistrations: 0,
        approvedRegistrations: 0,
        pendingRegistrations: 0,
        cancelledRegistrations: 0,
        totalStudents: 0,
        associates: 0,
        nonAssociates: 0,
        projectedMRR: 0, // Monthly Recurring Revenue (Based on Plans)
        totalRevenue: 0, // Actual Received (Sum of financialReceivedAmount)
        toReceiveCount: 0,
        toReceiveValue: 0,
        toReceiveList: [] as Array<{ name: string, value: number, invoiceUrl: string, regId: string, whatsapp: string }>,
        overdueCount: 0,
        overdueValue: 0,
        overdueList: [] as Array<any>,
        modalities: {} as Record<string, number>,
        mrrByModality: {} as Record<string, number>,
        receivedByModality: {} as Record<string, number>,
        paidStudentsByModality: {} as Record<string, number>,
        ageGroups: {
            baby: 0, // 0-5
            kids: 0, // 6-12
            teens: 0, // 13-17
            adults: 0 // 18+
        },
        rawGrowthData: [] as Array<{ date: Date, count: number }>,
        totalExpenses: 0,
        netProfit: 0
    });

    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState<any[]>([]);
    const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
    const [allPayments, setAllPayments] = useState<any[]>([]);
    const [allExpenses, setAllExpenses] = useState<any[]>([]);

    // View Modes
    const [paymentViewMode, setPaymentViewMode] = useState<'calendar' | 'chart'>('calendar');
    const [regViewMode, setRegViewMode] = useState<'calendar' | 'chart'>('calendar');

    // Calendars
    const [payCalendarDate, setPayCalendarDate] = useState(new Date());
    const [regCalendarDate, setRegCalendarDate] = useState(new Date());

    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [selectedDayType, setSelectedDayType] = useState<'payment' | 'registration'>('payment');
    const [selectedDayItems, setSelectedDayItems] = useState<any[]>([]);



    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Registrations, Plans, Payments and Expenses
                const [regSnap, fetchedPlans, paySnap, expensesData] = await Promise.all([
                    getDocs(collection(db, "arena_simonesia_2026_registrations")),
                    planService.getPlans(),
                    getDocs(collection(db, "financial_payments")),
                    expenseService.listExpenses(workerUrl || '')
                ]);



                const registrations = regSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                const payments = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                setAllRegistrations(registrations);
                setAllPayments(payments);

                // Identify associations for looking up names in payments
                const regMap = new Map();
                registrations.forEach(r => regMap.set(r.id, r));

                // Process payments for calendar
                const processedPayments = payments
                    .filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'pago', 'confirmado'].includes(p.status))
                    .map(p => {
                        const dateStr = p.paymentDate || p.dateCreated || p.lastUpdate;
                        let date: Date;

                        if (dateStr && typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            // If it's exactly YYYY-MM-DD, parse as local midnight to avoid UTC-3 shift
                            const [year, month, day] = dateStr.split('-').map(Number);
                            date = new Date(year, month - 1, day);
                        } else {
                            date = dateStr ? new Date(dateStr) : new Date();
                        }

                        // Extract name from registration if possible
                        let payerName = "Desconhecido";
                        const reg = regMap.get(p.studentId);
                        if (reg) {
                            if (reg.alunos && reg.alunos.length > 0) payerName = reg.alunos[0].nome;
                            else if (reg.responsavel?.nome) payerName = reg.responsavel.nome;
                        }

                        return {
                            ...p,
                            actualDate: date,
                            payerName,
                            modalidade: reg?.modalidade || 'outros',
                            isManual: p.externalReference?.startsWith('MANUAL_') || (p.description || '').toLowerCase().includes('uniforme') || (p.description || '').toLowerCase().includes('kit'),
                            studentCount: reg?.alunos?.length || 1,
                            formattedValue: (p.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        };
                    });

                setPaymentData(processedPayments);

                const newStats = {
                    totalRegistrations: registrations.length,
                    approvedRegistrations: 0,
                    pendingRegistrations: 0,
                    cancelledRegistrations: 0,
                    totalStudents: 0,
                    associates: 0,
                    nonAssociates: 0,
                    projectedMRR: 0,
                    totalRevenue: 0,
                    toReceiveCount: 0,
                    toReceiveValue: 0,
                    toReceiveList: [] as Array<{ name: string, value: number, invoiceUrl: string, regId: string, whatsapp: string }>,
                    overdueCount: 0,
                    overdueValue: 0,
                    overdueList: [] as Array<any>,
                    modalities: {} as Record<string, number>,
                    mrrByModality: {} as Record<string, number>,
                    receivedByModality: {} as Record<string, number>,
                    paidStudentsByModality: {} as Record<string, number>,
                    ageGroups: { baby: 0, kids: 0, teens: 0, adults: 0 },
                    rawGrowthData: [] as Array<{ date: Date, count: number }>,
                    totalExpenses: 0,
                    netProfit: 0
                };

                // Calculate total expenses (Firestore expenses are all manual)
                setAllExpenses(expensesData || []);
                const totalExpenses = (expensesData || []).reduce((acc: number, exp: any) => {
                    return acc + (exp.value || 0);
                }, 0);

                newStats.totalExpenses = totalExpenses;

                registrations.forEach((reg: any) => {
                    // EXCLUDE DEACTIVATED FROM ALL STATS
                    const status = reg.contractStatus?.toLowerCase();
                    if (status === 'desativado') return;

                    const regDate = reg.createdAt instanceof Timestamp ? reg.createdAt.toDate() : (reg.createdAt ? new Date(reg.createdAt) : null);

                    // Approval Status
                    if (status === 'aprovado') {
                        newStats.approvedRegistrations++;

                        // To Receive (Approved with actual pending amount > 0)
                        const isPaid = reg.status === 'pago' || reg.status === 'confirmado' || reg.status === 'RECEIVED' || reg.status === 'CONFIRMED' || reg.status === 'RECEIVED_IN_CASH';
                        const isEmpty = reg.status === 'vazio'; // No invoice created
                        const pendingAmount = reg.financialPendingAmount || 0;

                        const planId = reg.planId;
                        const plan = planId ? fetchedPlans.find((p: any) => p.id === planId) : null;
                        let monthlyVal = 0;

                        if (plan) {
                            monthlyVal = plan.valores?.mensalidade?.ateVencimento ||
                                plan.valor || 0;
                        } else if (reg.modalidade) {
                            // FALLBACK: Guess by modality if planId is missing or plan not found
                            const mod = reg.modalidade.toLowerCase();
                            const modalityPlan = fetchedPlans.find((p: any) => p.modalidade?.toLowerCase() === mod && p.active);
                            if (modalityPlan) {
                                monthlyVal = modalityPlan.valores?.mensalidade?.ateVencimento || modalityPlan.valor || 0;
                            }
                        }

                        const studentCount = reg.alunos?.length || 1;
                        const currentMRR = (monthlyVal / 100) * studentCount;

                        const modName = (reg.modalidade || 'outros').toLowerCase();
                        if (currentMRR > 0) {
                            newStats.projectedMRR += currentMRR;
                            newStats.mrrByModality[modName] = (newStats.mrrByModality[modName] || 0) + currentMRR;
                        }

                        if (reg.financialReceivedAmount && reg.financialReceivedAmount > 0) {
                            newStats.totalRevenue += reg.financialReceivedAmount;
                            newStats.receivedByModality[modName] = (newStats.receivedByModality[modName] || 0) + reg.financialReceivedAmount;

                            // Count as paid student for this modality
                            newStats.paidStudentsByModality[modName] = (newStats.paidStudentsByModality[modName] || 0) + (reg.alunos?.length || 1);
                        }

                        if (!isPaid && !isEmpty && pendingAmount > 0) {
                            newStats.toReceiveCount++;
                            newStats.toReceiveValue += pendingAmount; // Use actual pending amount, not plan value

                            // Add student details
                            const alunos = reg.alunos || [];
                            if (alunos.length > 0 && alunos[0]?.nome) {
                                newStats.toReceiveList.push({
                                    name: alunos[0].nome,
                                    value: pendingAmount,
                                    invoiceUrl: reg.financialInvoiceUrl || '',
                                    regId: reg.id,
                                    whatsapp: reg.responsavel?.telefonePrincipal || ''
                                });
                            }
                        }

                        const isOverdue = reg.status === 'overdue' || reg.status === 'atrasado' || reg.status === 'OVERDUE';
                        if (isOverdue && pendingAmount > 0) {
                            newStats.overdueCount++;
                            newStats.overdueValue += pendingAmount;

                            // Detailed overdue list for PDF
                            const overduePayments = payments
                                .filter(p =>
                                    p.studentId === reg.id &&
                                    !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'pago', 'confirmado'].includes(p.status) &&
                                    p.dueDate && new Date(p.dueDate) < new Date()
                                )
                                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                            const oldest = overduePayments[0];
                            const days = oldest ? Math.floor((new Date().getTime() - new Date(oldest.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

                            newStats.overdueList.push({
                                ...reg,
                                oldestDueDate: oldest?.dueDate,
                                daysOverdue: days,
                                pendingItems: overduePayments.map(p => ({
                                    description: p.description,
                                    value: p.value,
                                    dueDate: p.dueDate
                                }))
                            });
                        }
                    } else {
                        newStats.pendingRegistrations++;
                    }

                    // Growth Data Aggregation
                    if (regDate) {
                        newStats.rawGrowthData.push({ ...reg, date: regDate, count: 1 });
                    }



                    // Modality
                    const mod = (reg.modalidade || 'outros').toLowerCase();
                    newStats.modalities[mod] = (newStats.modalities[mod] || 0) + 1;

                    // Students and Age Groups
                    const alunos = reg.alunos || [];
                    if (Array.isArray(alunos)) {
                        newStats.totalStudents += alunos.length;

                        alunos.forEach((aluno: any) => {
                            if (aluno.dataNascimento) {
                                const [day, month, year] = aluno.dataNascimento.split('/').map(Number);
                                const birthDate = new Date(year, month - 1, day);
                                const age = new Date().getFullYear() - birthDate.getFullYear();

                                if (age <= 5) newStats.ageGroups.baby++;
                                else if (age <= 12) newStats.ageGroups.kids++;
                                else if (age <= 17) newStats.ageGroups.teens++;
                                else newStats.ageGroups.adults++;
                            }
                        });
                    }
                });

                newStats.netProfit = newStats.totalRevenue - newStats.totalExpenses;

                setStats(newStats);
            } catch (error) {
                console.error("Error calculating statistics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleExportOverduePDF = () => {
        if (stats.overdueList.length === 0) {
            showAlert('Não há inadimplentes para exportar.', 'info');
            return;
        }

        showConfirm(
            'Deseja incluir o botão de COBRAR no PDF?',
            async () => {
                await generateOverduePDF(stats.overdueList, true);
            },
            'info',
            'Exportar PDF',
            async () => {
                await generateOverduePDF(stats.overdueList, false);
            }
        );
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // ==================== MONTHLY FILTERING ====================
    const monthlyPayments = useMemo(() => {
        return paymentData.filter(p => {
            const d = p.actualDate;
            return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
        });
    }, [paymentData, selectedMonth]);

    const monthlyExpenses = useMemo(() => {
        return allExpenses.filter((exp: any) => {
            const d = exp.scheduleDate ? new Date(exp.scheduleDate) : null;
            if (!d || isNaN(d.getTime())) return false;
            return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
        });
    }, [allExpenses, selectedMonth]);

    const monthlyRevenue = useMemo(() => {
        return monthlyPayments.reduce((acc: number, p: any) => acc + (p.value || 0), 0);
    }, [monthlyPayments]);

    const monthlyExpenseTotal = useMemo(() => {
        return monthlyExpenses.reduce((acc: number, exp: any) => acc + (exp.value || 0), 0);
    }, [monthlyExpenses]);

    const monthlyAsaasFees = useMemo(() => {
        let pix = 0;
        let boleto = 0;
        const total = monthlyPayments.reduce((acc: number, p: any) => {
            const type = String(p.billingType || '').toUpperCase();
            if (type === 'PIX') {
                pix++;
                return acc + 1.99;
            } else if (type === 'BOLETO') {
                boleto++;
                return acc + 1.99;
            }
            return acc;
        }, 0);
        return { total, pix, boleto };
    }, [monthlyPayments]);

    const monthlyNetProfit = monthlyRevenue - monthlyExpenseTotal;
    const finalNetProfit = monthlyNetProfit - monthlyAsaasFees.total;

    // Monthly revenue by modality
    const monthlyReceivedByModality = useMemo(() => {
        const map: Record<string, number> = {};
        monthlyPayments.forEach((p: any) => {
            if (p.isManual) return;
            const mod = (p.modalidade || 'outros').toLowerCase();
            map[mod] = (map[mod] || 0) + (p.value || 0);
        });
        return map;
    }, [monthlyPayments]);

    const monthlyManualRevenue = useMemo(() => {
        return monthlyPayments
            .filter(p => p.isManual)
            .reduce((acc, p) => acc + (p.value || 0), 0);
    }, [monthlyPayments]);

    // Monthly paid students by modality (count unique studentIds per modality)
    const monthlyPaidStudentsByModality = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        monthlyPayments.forEach((p: any) => {
            if (p.isManual) return;
            const mod = (p.modalidade || 'outros').toLowerCase();
            if (!map[mod]) map[mod] = new Set();
            if (p.studentId) map[mod].add(p.studentId);
        });
        const result: Record<string, number> = {};
        Object.entries(map).forEach(([mod, students]) => {
            // Multiply by student count from the payment data
            let total = 0;
            students.forEach(sid => {
                const payment = monthlyPayments.find((p: any) => p.studentId === sid && !p.isManual);
                total += payment?.studentCount || 1;
            });
            result[mod] = total;
        });
        return result;
    }, [monthlyPayments]);

    const monthlyStudentFinancialRows = useMemo(() => {
        const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'pago', 'confirmado'];
        const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1);
        const monthEnd = new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999);

        const parseLocalDate = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Timestamp) return value.toDate();
            if (value instanceof Date) return value;
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                const [year, month, day] = value.split('-').map(Number);
                return new Date(year, month - 1, day);
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const isInSelectedMonth = (date: Date | null) => {
            if (!date) return false;
            return date >= monthStart && date <= monthEnd;
        };

        return allRegistrations
            .filter((reg: any) => reg.contractStatus?.toLowerCase() === 'aprovado')
            .map((reg: any) => {
                const student = reg.alunos?.[0] || {};
                const relatedPayments = allPayments.filter((payment: any) => payment.studentId === reg.id);
                const pendingInvoice = relatedPayments
                    .filter((payment: any) => !paidStatuses.includes(payment.status) && isInSelectedMonth(parseLocalDate(payment.dueDate)))
                    .sort((a: any, b: any) => {
                        const dateA = parseLocalDate(a.dueDate)?.getTime() || 0;
                        const dateB = parseLocalDate(b.dueDate)?.getTime() || 0;
                        return dateA - dateB;
                    })[0];
                const paidInvoice = relatedPayments
                    .filter((payment: any) => {
                        const paidDate = parseLocalDate(payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate || payment.dateCreated || payment.lastUpdate);
                        return paidStatuses.includes(payment.status) && isInSelectedMonth(paidDate);
                    })
                    .sort((a: any, b: any) => {
                        const dateA = parseLocalDate(a.paymentDate || a.clientPaymentDate || a.confirmedDate || a.dateCreated || a.lastUpdate)?.getTime() || 0;
                        const dateB = parseLocalDate(b.paymentDate || b.clientPaymentDate || b.confirmedDate || b.dateCreated || b.lastUpdate)?.getTime() || 0;
                        return dateB - dateA;
                    })[0];
                const paidDate = paidInvoice ? parseLocalDate(paidInvoice.paymentDate || paidInvoice.clientPaymentDate || paidInvoice.confirmedDate || paidInvoice.dateCreated || paidInvoice.lastUpdate) : null;

                if (!pendingInvoice && !paidInvoice) return null;

                const phone = reg.responsavel?.telefonePrincipal || reg.responsavel?.telefone || '';
                const invoiceUrl = pendingInvoice?.invoiceUrl || pendingInvoice?.bankSlipUrl || reg.financialInvoiceUrl || '';
                const pendingDescription = pendingInvoice?.description || pendingInvoice?.title || 'Fatura pendente';
                const paidDescription = paidInvoice?.description || paidInvoice?.title || 'Última fatura paga';
                const value = pendingInvoice?.value || paidInvoice?.value || reg.financialPendingAmount || 0;
                const firstName = (reg.responsavel?.nome || 'Responsável').split(' ')[0];
                const message = [
                    `Olá, ${firstName}!`,
                    '',
                    `Identificamos uma pendência em aberto: ${pendingDescription}.`,
                    value ? `Valor: ${formatCurrency(value)}` : '',
                    invoiceUrl ? `Link da fatura: ${invoiceUrl}` : '',
                    '',
                    'Qualquer dúvida, estamos à disposição.'
                ].filter(Boolean).join('\n');

                return {
                    id: reg.id,
                    photoUrl: student.fotoUrl || student.photoUrl || '',
                    name: student.nome || reg.responsavel?.nome || 'Sem nome',
                    status: pendingInvoice ? 'PENDENTE' : 'REGULAR',
                    paidDateLabel: !pendingInvoice && paidDate ? paidDate.toLocaleDateString('pt-BR') : '-',
                    pendingDescription: pendingInvoice ? pendingDescription : paidDescription,
                    valueLabel: value ? formatCurrency(value) : '-',
                    invoiceUrl,
                    chargeUrl: phone ? `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : ''
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                if (a.status !== b.status) return a.status === 'PENDENTE' ? -1 : 1;
                return a.name.localeCompare(b.name, 'pt-BR');
            }) as Array<{
                id: string;
                photoUrl: string;
                name: string;
                status: 'PENDENTE' | 'REGULAR';
                paidDateLabel: string;
                pendingDescription: string;
                valueLabel: string;
                invoiceUrl: string;
                chargeUrl: string;
            }>;
    }, [allRegistrations, allPayments, selectedMonth]);

    // Month navigation helpers
    const selectedMonthLabel = new Date(selectedMonth.year, selectedMonth.month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();

    const goToPrevMonth = () => {
        setSelectedMonth(prev => {
            const newMonth = prev.month === 0 ? 11 : prev.month - 1;
            const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
            return { year: newYear, month: newMonth };
        });
    };

    const goToNextMonth = () => {
        setSelectedMonth(prev => {
            const newMonth = prev.month === 11 ? 0 : prev.month + 1;
            const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
            return { year: newYear, month: newMonth };
        });
    };

    const goToCurrentMonth = () => {
        setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
    };

    // ==================== CHART DATA ====================
    const filteredGrowthData = useMemo(() => {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        const filtered = stats.rawGrowthData.filter(d => d.date >= start && d.date <= end);

        // Group by month for the chart
        const groups: Record<string, number> = {};
        filtered.forEach(d => {
            const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
            groups[key] = (groups[key] || 0) + 1;
        });

        return Object.entries(groups)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [stats.rawGrowthData, dateRange]);

    const paymentChartData = useMemo(() => {
        // Simple aggregation of received payments by month
        const groups: Record<string, number> = {};
        paymentData.forEach(p => {
            const key = `${p.actualDate.getFullYear()}-${String(p.actualDate.getMonth() + 1).padStart(2, '0')}`;
            groups[key] = (groups[key] || 0) + (p.value || 0);
        });

        return Object.entries(groups)
            .map(([month, total]) => ({ month, value: total }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [paymentData]);

    const StatCard = ({ title, value, subValue, icon: Icon, color, trend, trendType, gradient }: any) => (
        <div className="animate-scale-in" style={{
            background: gradient ? `linear-gradient(135deg, ${color} 0%, ${gradient} 100%)` : '#fff',
            padding: '24px',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            overflow: 'hidden',
            color: gradient ? '#fff' : '#1e293b',
            transition: 'transform 0.2s',
            cursor: 'default'
        }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: gradient ? 0.2 : 0.05, pointerEvents: 'none' }}>
                <Icon size={100} color={gradient ? '#fff' : color} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: gradient ? 'rgba(255,255,255,0.2)' : `${color}15`,
                    backdropFilter: gradient ? 'blur(10px)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: gradient ? '#fff' : color
                }}>
                    <Icon size={22} />
                </div>
                <span style={{ color: gradient ? 'rgba(255,255,255,0.9)' : '#64748b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
            </div>
            <div style={{ position: 'relative', zIndex: 1, marginTop: '10px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, textShadow: gradient ? '0 2px 10px rgba(0,0,0,0.1)' : 'none' }}>{value}</h3>
                {subValue && <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: gradient ? 'rgba(255,255,255,0.9)' : color, fontWeight: '700' }}>{subValue}</p>}
            </div>
            {trend && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', background: gradient ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '4px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>
                    {trendType === 'up' ? <ArrowUpRight size={14} color={gradient ? '#fff' : "#10b981"} /> : trendType === 'down' ? <ArrowDownRight size={14} color={gradient ? '#fff' : "#ef4444"} /> : null}
                    <span style={{ fontSize: '0.75rem', color: gradient ? '#fff' : (trendType === 'up' ? '#10b981' : trendType === 'down' ? '#ef4444' : '#64748b'), fontWeight: '800' }}>{trend}</span>
                </div>
            )}
        </div>
    );

    const GrowthChart = ({ data, color = '#007d2f', type = 'count' }: { data: any[], color?: string, type?: 'count' | 'currency' }) => {
        const max = data.length > 0 ? Math.max(...data.map(d => type === 'count' ? d.count : d.value)) : 10;
        const axisMax = Math.ceil(max / 5) * 5;
        const steps = 5;
        const stepValue = axisMax / steps;

        return (
            <div style={{ position: 'relative', width: '100%', height: '300px', padding: '10px 0 20px 40px', animation: 'fadeIn 0.5s ease-out' }}>
                <style>{`
                    @keyframes growUp { from { height: 0; } to { height: var(--target-height); } }
                    .bar-fill { animation: growUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    .bar-container:hover .bar-tooltip { opacity: 1 !important; transform: translateY(-5px); }
                `}</style>

                {/* Y-Axis & Grid Lines */}
                <div style={{ position: 'absolute', top: 0, left: '40px', right: 0, bottom: '30px', zIndex: 0 }}>
                    {Array.from({ length: steps + 1 }).map((_, i) => {
                        const value = Math.round(axisMax - (i * stepValue));
                        const top = `${(i / steps) * 100}%`;
                        return (
                            <div key={i} style={{ position: 'absolute', top, left: 0, right: 0, borderTop: i === steps ? '1px solid #e2e8f0' : '1px dashed #f1f5f9' }}>
                                <span style={{ position: 'absolute', left: '-40px', top: '-8px', fontSize: '0.65rem', color: '#94a3b8', width: '35px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {type === 'currency' ? `R$${(value / 1000).toFixed(1)}k` : value}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div style={{
                    position: 'absolute', top: 0, left: '40px', right: 0, bottom: '30px',
                    display: 'flex', alignItems: 'flex-end', gap: '15px', zIndex: 1, paddingBottom: '5px'
                }}>
                    {data.map((d) => {
                        const val = type === 'count' ? d.count : d.value;
                        const heightPercent = (val / (axisMax || 1)) * 100;
                        const [year, month] = d.month.split('-');
                        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();

                        return (
                            <div key={d.month} className="bar-container" style={{
                                flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
                                justifyContent: 'flex-end', alignItems: 'center', position: 'relative'
                            }}>
                                <div className="bar-tooltip" style={{
                                    opacity: 0, transition: 'all 0.2s', marginBottom: '8px', padding: '4px 8px',
                                    fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', background: '#1e293b',
                                    borderRadius: '6px', position: 'absolute', bottom: `${heightPercent}%`, zIndex: 10,
                                    whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                }}>
                                    {type === 'currency' ? formatCurrency(val) : `${val} cadastros`}
                                </div>
                                <div
                                    className="bar-fill"
                                    style={{
                                        width: '100%', maxWidth: '40px', '--target-height': `${heightPercent}%`,
                                        height: `${heightPercent}%`, background: `linear-gradient(180deg, ${color} 0%, ${color}aa 100%)`,
                                        borderRadius: '8px 8px 0 0', minHeight: '4px',
                                        boxShadow: `0 4px 12px ${color}33`, cursor: 'pointer'
                                    } as any}
                                />
                                <div style={{ marginTop: '10px', fontSize: '0.6rem', fontWeight: 'bold', color: '#64748b' }}>
                                    {monthName}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const StatusCalendar = ({ date, items, type, onDateChange }: {
        date: Date,
        items: any[],
        type: 'registration' | 'payment',
        onDateChange: (d: Date) => void
    }) => {
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();

        // Calculate record (max value/count) for the CURRENT month/year being viewed
        const dayStats = useMemo(() => {
            const dayMap: Record<number, number> = {};
            items.forEach(item => {
                const itemDate = type === 'registration' ? item.date : item.actualDate;
                if (itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth()) {
                    const d = itemDate.getDate();
                    const val = type === 'payment' ? (item.value || 0) : 1;
                    dayMap[d] = (dayMap[d] || 0) + val;
                }
            });
            return dayMap;
        }, [items, date, type]);

        const maxDayVal = Math.max(...Object.values(dayStats), 0);

        return (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                <style>{`
                    .cal-day:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important; z-index: 5; }
                `}</style>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>&larr;</button>
                        <button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>&rarr;</button>
                    </div>
                    <span style={{ fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                        {date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', paddingBottom: '8px' }}>{d}</div>
                    ))}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayDate = new Date(date.getFullYear(), date.getMonth(), day);
                        const isToday = new Date().toDateString() === dayDate.toDateString();
                        const currentVal = dayStats[day] || 0;
                        const isRecord = maxDayVal > 0 && currentVal === maxDayVal;

                        const dayItems = items.filter(item => {
                            const itemDate = type === 'registration' ? item.date : item.actualDate;
                            return itemDate.toDateString() === dayDate.toDateString();
                        });

                        const indicatorColor = type === 'registration' ? '#007d2f' : '#10b981';

                        return (
                            <div
                                key={day}
                                onClick={() => {
                                    if (dayItems.length > 0) {
                                        setSelectedDay(dayDate);
                                        setSelectedDayType(type);
                                        setSelectedDayItems(dayItems);
                                    }
                                }}
                                className="cal-day"
                                style={{
                                    aspectRatio: '1', 
                                    background: isRecord ? `rgba(251, 191, 36, 0.12)` : (dayItems.length > 0 ? `${indicatorColor}08` : '#f8fafc'),
                                    border: isRecord ? `2px solid #fbbf24` : (isToday ? `2px solid ${indicatorColor}` : '1px solid #f1f5f9'),
                                    borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', position: 'relative', cursor: dayItems.length > 0 ? 'pointer' : 'default',
                                    transition: 'all 0.2s', 
                                    boxShadow: isRecord ? '0 4px 12px rgba(251, 191, 36, 0.15)' : 'none'
                                }}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: isToday ? indicatorColor : (isRecord ? '#b45309' : '#64748b') }}>{day}</span>
                                {dayItems.length > 0 && (
                                    <div style={{
                                        marginTop: '4px', background: isRecord ? '#fbbf24' : indicatorColor, 
                                        color: isRecord ? '#92400e' : '#fff', fontSize: '0.6rem',
                                        fontWeight: '900', padding: '1px 6px', borderRadius: '6px', minWidth: '16px', textAlign: 'center'
                                    }}>
                                        {type === 'payment' ? formatCurrency(currentVal).replace('R$', '').trim() : currentVal}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const compressReportImage = async (url: string): Promise<string> => {
        if (!url) return '';

        try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
            });

            const size = 96;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';

            const scale = Math.max(size / image.width, size / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            const x = (size - width) / 2;
            const y = (size - height) / 2;

            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(image, x, y, width, height);

            return canvas.toDataURL('image/jpeg', 0.62);
        } catch (error) {
            console.warn('Nao foi possivel comprimir imagem do relatorio:', error);
            return '';
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                    <div className="skeleton" style={{ height: '100px', borderRadius: '16px' }} />
                    <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer style={{ background: '#f8fafc' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .native-input { border: 1px solid #e2e8f0; border-radius: 8px; outline: none; transition: all 0.2s; }
                .native-input:focus { border-color: #007d2f; box-shadow: 0 0 0 3px rgba(0, 125, 47, 0.1); }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <PageTitle
                    title="SISTEMA DE ESTATÍSTICAS"
                    subtitle="Monitoramento estratégico, financeiro e crescimento Arena Simonésia 2026"
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => {
                            if (monthlyExpenses.length === 0) {
                                showAlert("Nenhuma despesa manual encontrada neste mês.", "info");
                                return;
                            }

                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            const total = monthlyExpenses.reduce((acc: number, exp: any) => acc + (exp.value || 0), 0);

                            printWindow.document.write(`
                                    <html>
                                    <head>
                                        <title>Relatório de Despesas - ${selectedMonthLabel}</title>
                                        <style>
                                            body { font-family: sans-serif; padding: 20px; }
                                            h1 { color: #007d2f; text-align: center; }
                                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                            th { background-color: #f8fafc; color: #334155; }
                                            tr:nth-child(even) { background-color: #f1f5f9; }
                                            .total { margin-top: 30px; text-align: right; font-size: 1.2rem; font-weight: bold; color: #007d2f; border-top: 2px solid #007d2f; padding-top: 10px; }
                                            .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 0.8rem; }
                                        </style>
                                    </head>
                                    <body>
                                        <h1>RELATÓRIO DE DESPESAS - ${selectedMonthLabel}</h1>
                                        <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                                        
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Data</th>
                                                    <th>Descrição</th>
                                                    <th>Categoria</th>
                                                    <th>Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${monthlyExpenses.map((exp: any) => `
                                                    <tr>
                                                        <td>${new Date(exp.scheduleDate).toLocaleDateString('pt-BR')}</td>
                                                        <td>${exp.description}</td>
                                                        <td>${exp.category || '-'}</td>
                                                        <td>${(exp.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>

                                        <div class="total">TOTAL: ${(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                        
                                        <div class="footer">Sisteminha de Contrato - Arena Simonésia 2026</div>

                                        <script>
                                            window.onload = () => { window.print(); };
                                        </script>
                                    </body>
                                    </html>
                                `);
                            printWindow.document.close();
                        }}
                        className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Printer size={18} /> Relatório de Gastos
                    </button>

                    <button
                        onClick={async () => {
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            printWindow.document.write(`
                                <html>
                                    <head><title>Preparando relatório...</title></head>
                                    <body style="font-family: sans-serif; padding: 32px; color: #1e293b;">
                                        <strong>Preparando relatório...</strong>
                                        <p>Comprimindo imagens para deixar o arquivo mais leve.</p>
                                    </body>
                                </html>
                            `);
                            printWindow.document.close();

                            const reportRows = await Promise.all(monthlyStudentFinancialRows.map(async (item) => ({
                                ...item,
                                reportPhotoUrl: item.photoUrl ? await compressReportImage(item.photoUrl) : ''
                            })));

                            const monthlyRowsHtml = monthlyStudentFinancialRows.length === 0
                                ? `<tr><td colspan="7" class="empty-row">Nenhum aluno com pagamento ou pend&ecirc;ncia neste per&iacute;odo.</td></tr>`
                                : reportRows.map((item) => `
                                    <tr>
                                        <td>${item.reportPhotoUrl ? `<img class="student-photo" src="${item.reportPhotoUrl}" />` : `<div class="student-photo placeholder">FOTO</div>`}</td>
                                        <td><strong>${item.name}</strong></td>
                                        <td><span class="status ${item.status === 'PENDENTE' ? 'pending' : 'regular'}">${item.status}</span></td>
                                        <td>${item.paidDateLabel}</td>
                                        <td>${item.pendingDescription}</td>
                                        <td><strong>${item.valueLabel}</strong></td>
                                        <td>${item.status === 'PENDENTE' && item.chargeUrl ? `<a class="charge-button" href="${item.chargeUrl}" target="_blank">Cobrar</a>` : '-'}</td>
                                    </tr>
                                `).join('');

                            printWindow.document.write(`
                                    <html>
                                    <head>
                                        <title>Relat&oacute;rio Estat&iacute;stico - ${selectedMonthLabel}</title>
                                        <style>
                                            body { font-family: sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; }
                                            h1 { color: #007d2f; text-align: center; }
                                            .header { margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; text-align: center; }
                                            .month-badge { font-weight: 900; font-size: 2rem; color: #007d2f; border: 3px solid #007d2f; border-radius: 12px; padding: 12px 24px; display: inline-block; margin: 10px auto; letter-spacing: 2px; }
                                            .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }
                                            .stat-card { min-height: 120px; background: #fff; border-left: 5px solid var(--color); padding: 18px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); position: relative; overflow: hidden; }
                                            .stat-card.dark { background: #152033; color: #fff; border-left-color: #152033; }
                                            .stat-card.green { background: #10b981; color: #fff; border-left-color: #10b981; }
                                            .stat-card.purple { background: #7c3aed; color: #fff; border-left-color: #7c3aed; }
                                            .card-title { font-size: 0.78rem; font-weight: 900; color: inherit; opacity: 0.78; text-transform: uppercase; margin-bottom: 28px; }
                                            .card-value { font-size: 1.75rem; font-weight: 900; color: inherit; }
                                            .card-sub { margin-top: 8px; font-size: 0.78rem; font-weight: 800; color: inherit; opacity: 0.86; }
                                            .section-title { font-size: 1.1rem; font-weight: 900; color: #1e293b; margin: 30px 0 15px; border-left: 4px solid #007d2f; padding-left: 10px; }
                                            table { width: 100%; border-collapse: collapse; background: #fff; }
                                            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: middle; }
                                            th { background: #f8fafc; font-size: 0.72rem; text-transform: uppercase; color: #64748b; }
                                            .student-photo { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; }
                                            .student-photo.placeholder { display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; font-size: 0.58rem; font-weight: 900; }
                                            .status { display: inline-block; padding: 5px 10px; border-radius: 999px; font-size: 0.68rem; font-weight: 900; }
                                            .status.pending { background: #fef2f2; color: #dc2626; }
                                            .status.regular { background: #ecfdf5; color: #059669; }
                                            .charge-button { display: inline-block; background: #25D366; color: #fff; padding: 7px 12px; border-radius: 8px; text-decoration: none; font-size: 0.72rem; font-weight: 900; }
                                            .empty-row { text-align: center; color: #94a3b8; font-weight: 800; padding: 24px; }
                                            .modality-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                                            .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 0.8rem; }
                                            @media print { body { background: #fff; } .charge-button { color: #fff !important; } }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="header">
                                            <h1 style="margin-bottom: 5px;">ARENA SIMON&Eacute;SIA - RESUMO ESTAT&Iacute;STICO</h1>
                                            <div class="month-badge">${selectedMonthLabel}</div>
                                            <p style="margin-top: 10px; color: #64748b;">Relat&oacute;rio gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                                        </div>

                                        <div class="cards-grid">
                                            <div class="stat-card" style="--color: #3b82f6;">
                                                <div class="card-title">Alunos Ativos</div>
                                                <div class="card-value">${stats.approvedRegistrations}</div>
                                                <div class="card-sub">Total: ${stats.totalStudents}</div>
                                            </div>
                                            <div class="stat-card dark">
                                                <div class="card-title">Receita Mensal Recorrente</div>
                                                <div class="card-value">${formatCurrency(stats.projectedMRR)}</div>
                                                <div class="card-sub">Previs&atilde;o baseada nos planos</div>
                                            </div>
                                            <div class="stat-card green">
                                                <div class="card-title">Receita do M&ecirc;s</div>
                                                <div class="card-value">${formatCurrency(monthlyRevenue)}</div>
                                                <div class="card-sub">Total geral: ${formatCurrency(stats.totalRevenue)}</div>
                                            </div>
                                            <div class="stat-card" style="--color: #ef4444;">
                                                <div class="card-title">Despesas do M&ecirc;s</div>
                                                <div class="card-value">${formatCurrency(monthlyExpenseTotal)}</div>
                                                <div class="card-sub">Total geral: ${formatCurrency(stats.totalExpenses)}</div>
                                            </div>
                                            <div class="stat-card purple">
                                                <div class="card-title">Lucro L&iacute;quido (Operacional)</div>
                                                <div class="card-value">${formatCurrency(monthlyNetProfit)}</div>
                                                <div class="card-sub">Receita - Despesas do m&ecirc;s</div>
                                            </div>
                                            <div class="stat-card" style="--color: #f59e0b;">
                                                <div class="card-title">Taxas Asaas (Est.)</div>
                                                <div class="card-value">${formatCurrency(monthlyAsaasFees.total)}</div>
                                                <div class="card-sub">${monthlyAsaasFees.pix} Pix / ${monthlyAsaasFees.boleto} Boleto</div>
                                            </div>
                                            <div class="stat-card green">
                                                <div class="card-title">Lucro L&iacute;quido Real</div>
                                                <div class="card-value">${formatCurrency(finalNetProfit)}</div>
                                                <div class="card-sub">Descontando taxas Asaas</div>
                                            </div>
                                            <div class="stat-card" style="--color: #0891b2;">
                                                <div class="card-title">Alunos a Receber</div>
                                                <div class="card-value">${stats.toReceiveCount}</div>
                                                <div class="card-sub">${formatCurrency(stats.toReceiveValue)}</div>
                                            </div>
                                            <div class="stat-card" style="--color: #ef4444;">
                                                <div class="card-title">Inadimpl&ecirc;ncia</div>
                                                <div class="card-value">${stats.overdueCount}</div>
                                                <div class="card-sub">${formatCurrency(stats.overdueValue)}</div>
                                            </div>
                                        </div>

                                        <div class="section-title">VIS&Atilde;O GERAL DO M&Ecirc;S - ALUNOS PENDENTES E REGULARES</div>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Foto</th>
                                                    <th>Nome</th>
                                                    <th>Situa&ccedil;&atilde;o</th>
                                                    <th>Dia pago</th>
                                                    <th>Pend&ecirc;ncia</th>
                                                    <th>Valor</th>
                                                    <th>Cobrar</th>
                                                </tr>
                                            </thead>
                                            <tbody>${monthlyRowsHtml}</tbody>
                                        </table>

                                        <div class="section-title">DISTRIBUI&Ccedil;&Atilde;O POR MODALIDADE (PAGO NO M&Ecirc;S)</div>
                                        <div>
                                            ${Object.entries(stats.modalities).map(([mod]: any) => `
                                                <div class="modality-item">
                                                    <strong>${mod.toUpperCase()}</strong>
                                                    <span>Pago: ${formatCurrency(monthlyReceivedByModality[mod] || 0)} / MRR: ${formatCurrency(stats.mrrByModality[mod] || 0)}</span>
                                                </div>
                                            `).join('')}
                                        </div>

                                        <div class="footer">Este documento &eacute; um resumo operacional do sistema Arena Simon?sia.</div>

                                        <script>
                                            window.onload = () => { window.print(); };
                                        </script>
                                    </body>
                                    </html>
                                `);
                            printWindow.document.close();
                        }}
                        className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Printer size={18} /> Imprimir Geral
                    </button>
                </div>
            </div>


            <>
                {/* ==================== MONTH NAVIGATOR ==================== */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '20px',
                    padding: '20px 28px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <button
                        onClick={goToPrevMonth}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '12px',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <ChevronLeft size={22} />
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            letterSpacing: '2px',
                            textTransform: 'uppercase'
                        }}>DADOS DO MÊS</span>
                        <span style={{
                            color: '#fff',
                            fontSize: '1.3rem',
                            fontWeight: '900',
                            letterSpacing: '1px'
                        }}>{selectedMonthLabel}</span>
                        {!isCurrentMonth && (
                            <button
                                onClick={goToCurrentMonth}
                                style={{
                                    background: 'rgba(0, 125, 47, 0.8)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '4px 14px',
                                    color: '#fff',
                                    fontSize: '0.7rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(0, 125, 47, 1)'}
                                onMouseOut={e => e.currentTarget.style.background = 'rgba(0, 125, 47, 0.8)'}
                            >
                                IR PARA MÊS ATUAL
                            </button>
                        )}
                    </div>

                    <button
                        onClick={goToNextMonth}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '12px',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>

                {/* Top Metrics Grid - Responsive */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '24px',
                    marginBottom: '32px'
                }}>
                    {/* Modality Distribution - MOVED TO TOP */}
                    <div style={{
                        background: '#fff',
                        padding: '24px',
                        borderRadius: '20px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                        gridColumn: '1 / -1',
                        marginBottom: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <PieChart size={22} color="#007d2f" />
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>DISTRIBUIÇÃO POR MODALIDADE (RECEITA)</h3>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '24px'
                        }}>
                            {Object.entries(stats.modalities).sort((a, b) => b[1] - a[1]).map(([key, value]: any) => {
                                const colors: any = { futebol: '#007d2f', natacao: '#0891b2', voleibol: '#d97706', outros: '#64748b' };
                                const monthlyPaid = monthlyReceivedByModality[key] || 0;
                                const monthlyPaidStudents = monthlyPaidStudentsByModality[key] || 0;
                                return (
                                    <div key={key} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>{key}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '900', color: colors[key.toLowerCase()] || '#007d2f', fontSize: '1.1rem', lineHeight: '1.2' }}>
                                                    {formatCurrency(stats.mrrByModality[key] || 0)}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#059669', marginTop: '2px' }}>
                                                    PAGO (MÊS): {formatCurrency(monthlyPaid)}
                                                    <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                                                        ({stats.mrrByModality[key] > 0
                                                            ? ((monthlyPaid / stats.mrrByModality[key]) * 100).toFixed(0)
                                                            : 0}%)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                                            <div style={{ width: `${(value / (stats.totalRegistrations || 1)) * 100}% `, height: '100%', background: colors[key.toLowerCase()] || '#64748b', borderRadius: '10px' }} />
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{monthlyPaidStudents} / {value} pagos no mês</span>
                                            <span>{((value / (stats.totalRegistrations || 1)) * 100).toFixed(0)}% do total</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Manual Entries Section */}
                            {monthlyManualRevenue > 0 && (
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontWeight: '900', color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase' }}>LANÇAMENTOS MANUAIS</span>
                                            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>Cobranças avulsas e ajustes</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.3rem' }}>
                                                {formatCurrency(monthlyManualRevenue)}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>
                                                {monthlyPayments.filter(p => p.isManual).length} itens no mês
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* 1. Alunos Ativos */}
                    <StatCard
                        title="Alunos Ativos"
                        value={stats.approvedRegistrations}
                        subValue={`Total: ${stats.totalStudents}`}
                        icon={Users}
                        color="#3b82f6"
                        trend="+ Novos este mês"
                        trendType="up"
                    />

                    {/* 2. MRR - Receita Recorrente - DARK CARD for emphasis */}
                    <StatCard
                        title="Receita Mensal Recorrente"
                        value={formatCurrency(stats.projectedMRR)}
                        subValue="Previsão baseada nos planos"
                        icon={TrendingUp}
                        color="#1e293b"
                        gradient="#0f172a"
                        trendType="up"
                    />

                    {/* 3. RECEITA REALIZADA DO MÊS */}
                    <StatCard
                        title="Receita do Mês"
                        value={formatCurrency(monthlyRevenue)}
                        subValue={`Total geral: ${formatCurrency(stats.totalRevenue)}`}
                        icon={CheckCircle2}
                        color="#10b981"
                        gradient="#059669"
                    />

                    {/* 3b. DESPESAS E LUCRO LÍQUIDO DO MÊS */}
                    <StatCard
                        title="Despesas do Mês"
                        value={formatCurrency(monthlyExpenseTotal)}
                        subValue={`Total geral: ${formatCurrency(stats.totalExpenses)}`}
                        icon={ArrowDownRight}
                        color="#ef4444"
                    />

                    <StatCard
                        title="Lucro Líquido (Operacional)"
                        value={formatCurrency(monthlyNetProfit)}
                        subValue="Receita - Despesas do mês"
                        icon={Activity}
                        color="#8b5cf6"
                        gradient="#7c3aed"
                        trend={monthlyNetProfit > 0 ? "Saldo Positivo" : (monthlyNetProfit < 0 ? "Saldo Negativo" : null)}
                        trendType={monthlyNetProfit > 0 ? "up" : "down"}
                    />

                    {/* 3c. TAXAS ASAAS E LUCRO REAL */}
                    <StatCard
                        title="Taxas Asaas (Est.)"
                        value={formatCurrency(monthlyAsaasFees.total)}
                        subValue={`${monthlyAsaasFees.pix} Pix / ${monthlyAsaasFees.boleto} Boleto`}
                        icon={CreditCard}
                        color="#f59e0b"
                    />

                    <StatCard
                        title="Lucro Líquido Real"
                        value={formatCurrency(finalNetProfit)}
                        subValue="Descontando taxas Asaas"
                        icon={Banknote}
                        color="#059669"
                        gradient="#10b981"
                        trend={finalNetProfit > 0 ? "Resultado Final" : null}
                        trendType="up"
                    />

                    {/* 4. Alunos a Receber - Expandable */}
                    <div
                        onClick={() => setExpandedCard(expandedCard === 'toReceive' ? null : 'toReceive')}
                        style={{
                            background: '#fff',
                            padding: '24px',
                            borderRadius: '20px',
                            boxShadow: expandedCard === 'toReceive' ? '0 20px 40px rgba(8, 145, 178, 0.2)' : '0 10px 30px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative',
                            overflow: 'visible',
                            borderLeft: '5px solid #0891b2',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            gridColumn: expandedCard === 'toReceive' ? '1 / -1' : 'auto',
                            zIndex: expandedCard === 'toReceive' ? 100 : 1
                        }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
                            <Clock size={80} color="#0891b2" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#0891b215',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#0891b2'
                            }}>
                                <Clock size={20} />
                            </div>
                            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase' }}>Alunos a Receber</span>
                            <div style={{ marginLeft: 'auto', color: '#0891b2', transform: expandedCard === 'toReceive' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                <ChevronDown size={20} />
                            </div>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{stats.toReceiveCount}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '1rem', color: '#0891b2', fontWeight: '700' }}>{formatCurrency(stats.toReceiveValue)}</p>
                        </div>

                        {/* Expanded List */}
                        {expandedCard === 'toReceive' && stats.toReceiveList.length > 0 && (
                            <div style={{
                                marginTop: '20px',
                                borderTop: '1px solid #f1f5f9',
                                paddingTop: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                animation: 'slideUp 0.3s ease-out'
                            }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {stats.toReceiveList.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>{item.name}</div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Reg: ...{item.regId.slice(-4)}</span>
                                                {item.whatsapp && (
                                                    <a href={`https://wa.me/55${item.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: '#25D366', fontSize: '0.8rem', fontWeight: '600' }}>
                                                        <MessageCircle size={12} /> WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                            <span style={{ fontWeight: '800', color: '#0891b2' }}>{formatCurrency(item.value)}</span>
                                            {item.invoiceUrl ? (
                                                <a
                                                    href={item.invoiceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        background: '#0891b2',
                                                        color: '#fff',
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        textDecoration: 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <FileText size={12} /> VER FATURA
                                                </a>
                                            ) : (
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>Sem link</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            background: '#fff',
                            padding: '24px',
                            borderRadius: '20px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative',
                            overflow: 'hidden',
                            borderLeft: '5px solid #ef4444'
                        }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05, pointerEvents: 'none' }}>
                            <AlertCircle size={80} color="#ef4444" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#ef444415',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444'
                            }}>
                                <AlertCircle size={20} />
                            </div>
                            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase' }}>Inadimplência</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleExportOverduePDF();
                                    }}
                                    title="Exportar Relatório em PDF"
                                    style={{
                                        background: '#ef444415',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '6px',
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Printer size={18} />
                                </button>
                            </div>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{stats.overdueCount}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '1rem', color: '#ef4444', fontWeight: '700' }}>{formatCurrency(stats.overdueValue)}</p>
                        </div>
                    </div>
                </div>

                {/* Registrations Section (Toggle Calendar/Chart) */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '32px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#007d2f15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#007d2f' }}>
                                <TrendingUp size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>CADASTROS (CRESCIMENTO)</h3>
                        </div>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                            <button
                                onClick={() => setRegViewMode('calendar')}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: regViewMode === 'calendar' ? '#fff' : 'transparent',
                                    color: regViewMode === 'calendar' ? '#007d2f' : '#64748b',
                                    fontWeight: 'bold', fontSize: '0.8rem', boxShadow: regViewMode === 'calendar' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >Calendário</button>
                            <button
                                onClick={() => setRegViewMode('chart')}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: regViewMode === 'chart' ? '#fff' : 'transparent',
                                    color: regViewMode === 'chart' ? '#007d2f' : '#64748b',
                                    fontWeight: 'bold', fontSize: '0.8rem', boxShadow: regViewMode === 'chart' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >Gráfico</button>
                        </div>
                    </div>

                    {regViewMode === 'calendar' ? (
                        <StatusCalendar
                            date={regCalendarDate}
                            items={stats.rawGrowthData}
                            type="registration"
                            onDateChange={setRegCalendarDate}
                        />
                    ) : (
                        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '15px' }}>
                                <input type="date" className="native-input" style={{ padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }} value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>até</span>
                                <input type="date" className="native-input" style={{ padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }} value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                            </div>
                            <GrowthChart data={filteredGrowthData} color="#007d2f" type="count" />
                        </div>
                    )}
                </div>

                {/* Payment Calendar/Chart Section */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <Calendar size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>FINANCEIRO (RECEBIMENTOS)</h3>
                        </div>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                            <button
                                onClick={() => setPaymentViewMode('calendar')}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: paymentViewMode === 'calendar' ? '#fff' : 'transparent',
                                    color: paymentViewMode === 'calendar' ? '#10b981' : '#64748b',
                                    fontWeight: 'bold', fontSize: '0.8rem', boxShadow: paymentViewMode === 'calendar' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >Calendário</button>
                            <button
                                onClick={() => setPaymentViewMode('chart')}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: paymentViewMode === 'chart' ? '#fff' : 'transparent',
                                    color: paymentViewMode === 'chart' ? '#10b981' : '#64748b',
                                    fontWeight: 'bold', fontSize: '0.8rem', boxShadow: paymentViewMode === 'chart' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >Gráfico</button>
                        </div>
                    </div>

                    {paymentViewMode === 'calendar' ? (
                        <StatusCalendar
                            date={payCalendarDate}
                            items={paymentData}
                            type="payment"
                            onDateChange={setPayCalendarDate}
                        />
                    ) : (
                        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                            <GrowthChart data={paymentChartData} color="#10b981" type="currency" />
                        </div>
                    )}
                </div>

                {/* Selected Day Modal */}
                {selectedDay && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        padding: '20px'
                    }} onClick={() => setSelectedDay(null)}>
                        <div style={{
                            background: '#fff',
                            width: '100%',
                            maxWidth: '500px',
                            borderRadius: '24px',
                            padding: '30px',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>
                                        {selectedDayType === 'payment' ? 'Pagamentos do Dia' : 'Cadastros do Dia'}
                                    </h2>
                                    <p style={{ margin: '4px 0 0', color: selectedDayType === 'payment' ? '#10b981' : '#007d2f', fontWeight: '800', fontSize: '1rem' }}>
                                        {selectedDay.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedDay(null)}
                                    style={{ background: '#f8fafc', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <XCircle size={20} color="#64748b" />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '5px' }}>
                                {selectedDayItems.map((item, idx) => (
                                    <div key={idx} style={{
                                        background: '#f8fafc',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '800', color: '#334155', fontSize: '0.95rem' }}>
                                                {selectedDayType === 'payment' ? item.payerName : (item.alunos?.[0]?.nome || item.responsavel?.nome || 'Cadastro')}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                marginTop: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontWeight: '700'
                                            }}>
                                                {selectedDayType === 'payment' ? (
                                                    <>
                                                        PAGO COM {
                                                            item.billingType === 'CREDIT_CARD' ? <><CreditCard size={14} color="#3b82f6" /> CARTÃO</> :
                                                                item.billingType === 'PIX' ? <><QrCode size={14} color="#00bfa5" /> PIX</> :
                                                                    item.billingType === 'BOLETO' ? <><FileText size={14} color="#f59e0b" /> BOLETO</> :
                                                                        item.billingType === 'RECEIVED_IN_CASH' ? <><Banknote size={14} color="#10b981" /> DINHEIRO</> :
                                                                            <><Banknote size={14} color="#94a3b8" /> {item.billingType || 'OUTRO'}</>
                                                        }
                                                    </>
                                                ) : (
                                                    <>MODALIDADE: <span style={{ color: '#007d2f' }}>{String(item.modalidade || 'N/A').toUpperCase()}</span></>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {selectedDayType === 'payment' ? (
                                                <>
                                                    <div style={{ fontWeight: '900', color: '#059669', fontSize: '1.1rem' }}>{item.formattedValue}</div>
                                                    {item.invoiceUrl && (
                                                        <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: '#3b82f6', textDecoration: 'none', fontWeight: '800' }}>
                                                            VER FATURA →
                                                        </a>
                                                    )}
                                                </>
                                            ) : (
                                                <div style={{
                                                    padding: '4px 8px', borderRadius: '6px', background: '#007d2f15',
                                                    color: '#007d2f', fontWeight: '900', fontSize: '0.7rem'
                                                }}>
                                                    REGISTRADO
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setSelectedDay(null)}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: '#1e293b',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    marginTop: '24px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#0f172a'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content Grid - Responsive Breakpoints */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', // Reduced min-width
                    gap: '24px'
                }}>

                    {/* Approval Funnel */}
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <Activity size={20} color="#007d2f" />
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>FUNIL DE APROVAÇÃO</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>TOTAL DE CADASTROS</p><span style={{ fontSize: '1.2rem', fontWeight: '800' }}>{stats.totalRegistrations}</span></div>
                                <Calendar size={20} color="#94a3b8" />
                            </div>
                            <div style={{ textAlign: 'center', padding: '2px' }}><div style={{ width: '2px', height: '10px', background: '#e2e8f0', margin: '0 auto' }} /></div>
                            <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #007d2f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontSize: '0.75rem', color: '#007d2f', fontWeight: 'bold' }}>AGUARDANDO APROVAÇÃO</p><span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#007d2f' }}>{stats.pendingRegistrations}</span></div>
                                <Clock size={20} color="#007d2f" />
                            </div>
                            <div style={{ textAlign: 'center', padding: '2px' }}><div style={{ width: '2px', height: '10px', background: '#e2e8f0', margin: '0 auto' }} /></div>
                            <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontSize: '0.75rem', color: '#059669', fontWeight: 'bold' }}>CONTRATOS APROVADOS</p><span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#059669' }}>{stats.approvedRegistrations}</span></div>
                                <CheckCircle2 size={20} color="#10b981" />
                            </div>
                        </div>
                    </div>


                    {/* Demographics */}
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <Users size={20} color="#007d2f" />
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>DEMOGRAFIA (FAIXA ETÁRIA)</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
                            {[
                                { label: 'Arena Baby', sub: '(0-5 anos)', val: stats.ageGroups.baby, color: '#ec4899' },
                                { label: 'Arena Kids', sub: '(6-12 anos)', val: stats.ageGroups.kids, color: '#3b82f6' },
                                { label: 'Arena Teens', sub: '(13-17 anos)', val: stats.ageGroups.teens, color: '#f59e0b' },
                                { label: 'Arena Adults', sub: '(18+ anos)', val: stats.ageGroups.adults, color: '#1e293b' }
                            ].map(group => (
                                <div key={group.label} style={{ background: '#f8fafc', padding: '15px', borderRadius: '16px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '0.8rem', fontWeight: '800', color: group.color }}>{group.label.toUpperCase()}</p>
                                    <p style={{ margin: '0 0 10px', fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>{group.sub}</p>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b' }}>{group.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>



                </div>
            </>
        </PageContainer>
    );
}
