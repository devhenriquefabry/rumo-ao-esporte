import { useState, useMemo, useEffect } from 'react';
import { useLoading } from '../../../components/LoadingService';
import { useDashboardData } from './useDashboardData';
import { generatePDF } from '../utils/pdfGenerator';

const parseBirthDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    return new Date(0);
};

const getTimestamp = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'string') return new Date(val).getTime();
    if (typeof val === 'number') return val;
    return 0;
};

export function useAdminDashboard(filterStatus?: string) {
    const { showLoading } = useLoading();
    const { allStudents, turmas, plans, loading, removeRegistrationIds } = useDashboardData();

    const [activeModality, setActiveModality] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<string>('name_asc');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState<string[]>(['photo', 'name', 'birth', 'turma', 'plano', 'statusFin', 'waButton', 'resp', 'contact']);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const filteredStudents = useMemo(() => {
        const search = searchTerm.toLowerCase();
        const filtered = allStudents.filter(item => {
            const studentName = item.aluno?.nome?.toLowerCase() || '';
            const respName = item.responsavel?.nome?.toLowerCase() || '';
            const cpf = item.responsavel?.cpf?.replace(/\D/g, '') || '';
            const matchesSearch = studentName.includes(search) || respName.includes(search) || cpf.includes(search);

            const isArchived = item.contractStatus === 'desativado' || item.status === 'desativado';

            if (filterStatus === 'desativados') {
                return matchesSearch && isArchived;
            }

            if (isArchived) return false; // Hide from other views

            const matchesModality = activeModality ? (item.modalidade?.toLowerCase() === activeModality.toLowerCase()) : true;
            const matchesStatus = filterStatus === 'pendente' ? item.contractStatus !== 'aprovado' : item.contractStatus === 'aprovado';
            return matchesSearch && matchesModality && matchesStatus;
        });

        return [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'name_asc':
                    return (a.aluno?.nome || '').localeCompare(b.aluno?.nome || '');
                case 'name_desc':
                    return (b.aluno?.nome || '').localeCompare(a.aluno?.nome || '');
                case 'birth_asc': {
                    const dateA = parseBirthDate(a.aluno?.dataNascimento);
                    const dateB = parseBirthDate(b.aluno?.dataNascimento);
                    if (dateA.getTime() === 0) return 1;
                    if (dateB.getTime() === 0) return -1;
                    return dateB.getTime() - dateA.getTime();
                }
                case 'birth_desc': {
                    const dateA = parseBirthDate(a.aluno?.dataNascimento);
                    const dateB = parseBirthDate(b.aluno?.dataNascimento);
                    if (dateA.getTime() === 0) return 1;
                    if (dateB.getTime() === 0) return -1;
                    return dateA.getTime() - dateB.getTime();
                }
                case 'pending_desc':
                    return (b.financialPendingAmount || 0) - (a.financialPendingAmount || 0);
                case 'pending_asc':
                    return (a.financialPendingAmount || 0) - (b.financialPendingAmount || 0);
                case 'created_desc':
                    return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
                case 'created_asc':
                    return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
                default:
                    return 0;
            }
        });
    }, [allStudents, searchTerm, activeModality, filterStatus, sortBy]);

    const handleModalityClick = (mod: string) => {
        const nextModality = mod || null;
        if (activeModality !== nextModality) {
            showLoading(1500);
            setActiveModality(nextModality);
        }
    };

    const handleGeneratePDF = async (pdfSortBy?: string) => {
        showLoading(4000);
        setIsExportModalOpen(false);
        const exportScope = activeModality || 'todos';

        let studentsToExport = [...filteredStudents];
        const targetSort = pdfSortBy || sortBy;
        if (targetSort !== sortBy) {
            studentsToExport.sort((a, b) => {
                switch (targetSort) {
                    case 'name_asc':
                        return (a.aluno?.nome || '').localeCompare(b.aluno?.nome || '');
                    case 'name_desc':
                        return (b.aluno?.nome || '').localeCompare(a.aluno?.nome || '');
                    case 'birth_asc': {
                        const dateA = parseBirthDate(a.aluno?.dataNascimento);
                        const dateB = parseBirthDate(b.aluno?.dataNascimento);
                        if (dateA.getTime() === 0) return 1;
                        if (dateB.getTime() === 0) return -1;
                        return dateB.getTime() - dateA.getTime();
                    }
                    case 'birth_desc': {
                        const dateA = parseBirthDate(a.aluno?.dataNascimento);
                        const dateB = parseBirthDate(b.aluno?.dataNascimento);
                        if (dateA.getTime() === 0) return 1;
                        if (dateB.getTime() === 0) return -1;
                        return dateA.getTime() - dateB.getTime();
                    }
                    case 'pending_desc':
                        return (b.financialPendingAmount || 0) - (a.financialPendingAmount || 0);
                    case 'pending_asc':
                        return (a.financialPendingAmount || 0) - (b.financialPendingAmount || 0);
                    case 'created_desc':
                        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
                    case 'created_asc':
                        return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
                    default:
                        return 0;
                }
            });
        }

        await generatePDF(exportScope, studentsToExport, turmas, plans, selectedColumns, targetSort);
    };

    const toggleColumn = (id: string) => {
        setSelectedColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    return {
        allStudents, turmas, plans, loading, activeModality, searchTerm, setSearchTerm,
        sortBy, setSortBy, isExportModalOpen, setIsExportModalOpen, selectedColumns, isMobile, filteredStudents,
        handleModalityClick, handleGeneratePDF, toggleColumn, removeRegistrationIds
    };
}
