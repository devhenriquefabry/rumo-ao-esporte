import {
    Users,
    CreditCard,
    BarChart2,
    Settings,
    Cake,
    DollarSign,
    GraduationCap,
    FileText,
    FolderOpen,
    ScanLine,
    MessageCircle
} from 'lucide-react';

export interface MenuItem {
    path: string;
    label: string;
    icon: any; // Lucide icon component
    subItems?: { to: string; label: string; badge?: any }[];
}

export const ADMIN_MENU_ITEMS: MenuItem[] = [
    {
        path: '/admin/stats',
        label: 'Estatísticas',
        icon: BarChart2,
        subItems: [
            { to: '/admin/stats', label: 'Visão Geral' },
            { to: '/admin/relatorios', label: 'Relatórios' },
            { to: '/admin/simulador', label: 'Simulador de Receita' }
        ]
    },
    {
        path: '/admin/dashboard',
        label: 'Cadastros',
        icon: Users,
        subItems: [
            { to: '/admin/dashboard', label: 'Alunos Cadastrados' },
            { to: '/admin/cadastros/pendentes', label: 'Pendentes de Aprovação' }, // Badge logic handled in component
            { to: '/admin/cadastros/novo', label: 'Novo Cadastro' },
            { to: '/admin/cadastros/desativados', label: 'Alunos Desativados' }
        ]
    },
    {
        path: '/admin/aniversariantes',
        label: 'Aniversariantes',
        icon: Cake
    },
    {
        path: '/admin/financeiro',
        label: 'Financeiro',
        icon: DollarSign,
        subItems: [
            { to: '/admin/financeiro', label: 'Geral' },
            { to: '/admin/financeiro/gastos', label: 'Gastos' },
            { to: '/admin/plans', label: 'Planos' },
            { to: '/admin/financeiro/bancos', label: 'Bancos e APIs' },
            { to: '/admin/financeiro/cobrancas', label: 'Cobranças' }
        ]
    },
    {
        path: '/admin/turmas',
        label: 'Turmas',
        icon: Users,
        subItems: [
            { to: '/admin/turmas', label: 'Lista de Turmas' },
            { to: '/admin/turmas/chamadas', label: 'Chamadas' }
        ]
    },
    {
        path: '/admin/professores',
        label: 'Professores',
        icon: GraduationCap
    },
    {
        path: '/admin/contratos',
        label: 'Contratos',
        icon: FileText,
        subItems: [
            { to: '/admin/contratos', label: 'Lista de Contratos' },
            { to: '/admin/contratos/modelo', label: 'Modelo de Contrato' }
        ]
    },
    {
        path: '/admin/carteirinhas',
        label: 'Carteirinhas',
        icon: CreditCard
    },
    {
        path: '/admin/documentos',
        label: 'Documentos',
        icon: FolderOpen
    },
    {
        path: '/admin/settings',
        label: 'Configurações',
        icon: Settings
    },
    {
        path: '/admin/mensagens-evolution',
        label: 'Mensagens',
        icon: MessageCircle
    },
    {
        path: '/admin/portaria',
        label: 'Portaria',
        icon: ScanLine
    },


];
