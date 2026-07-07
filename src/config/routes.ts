export interface AppRoute {
    path: string;
    label: string;
}

export interface RouteCategory {
    category: string;
    routes: AppRoute[];
}

export const ALL_SYSTEM_ROUTES: RouteCategory[] = [
    {
        category: 'Cadastros e Dashboard',
        routes: [
            { path: '/admin/dashboard', label: 'Alunos Cadastrados' },
            { path: '/admin/cadastros/pendentes', label: 'Pendentes' },
            { path: '/admin/cadastros/novo', label: 'Novo Cadastro' },
            { path: '/admin/cadastros/desativados', label: 'Alunos Desativados' },
            { path: '/admin/details', label: 'Detalhes do Aluno' },
        ]
    },
    {
        category: 'Turmas e Professores',
        routes: [
            { path: '/admin/turmas', label: 'Lista de Turmas' },
            { path: '/admin/turmas/chamadas', label: 'Histórico de Chamadas' },
            { path: '/admin/turmas/migration', label: 'Migração de Turmas' },
            { path: '/admin/turmas/auto-allocation', label: 'Alocação Automática' },
            { path: '/admin/professores', label: 'Professores' },
        ]
    },
    {
        category: 'Financeiro',
        routes: [
            { path: '/admin/financeiro', label: 'Visão Geral (Financeiro)' },
            { path: '/admin/financeiro/gastos', label: 'Gastos' },
            { path: '/admin/financeiro/bancos', label: 'Bancos e APIs de Pagamento' },
            { path: '/admin/financeiro/fatura', label: 'Detalhes da Fatura' },
            { path: '/admin/plans', label: 'Planos' },
            { path: '/admin/plans/auto-allocation', label: 'Alocação de Planos (Auto)' },
        ]
    },
    {
        category: 'Comunicação',
        routes: [
            { path: '/admin/mensagens', label: 'Disparos de Mensagens' },
            { path: '/admin/mensagens/cobrancas', label: 'Mensagens de Cobrança' },
            { path: '/admin/mensagens/historico', label: 'Histórico de Mensagens' },
            { path: '/admin/mensagens/automacao', label: 'Automação de Mensagens' },
            { path: '/admin/mensagens/configuracoes', label: 'Configurações de Mensagem' },
            { path: '/admin/mensagens-evolution', label: 'Mensagens Evolution' },
            { path: '/admin/whatsapp', label: 'WhatsApp' },
            { path: '/admin/links', label: 'Links Uteis' },
        ]
    },
    {
        category: 'Outros Módulos',
        routes: [
            { path: '/admin/carteirinhas', label: 'Carteirinhas' },
            { path: '/admin/aniversariantes', label: 'Aniversariantes' },
            { path: '/admin/contratos', label: 'Contratos' },
            { path: '/admin/contratos/modelo', label: 'Modelo de Contrato' },
            { path: '/admin/portaria', label: 'Portaria' },
            { path: '/admin/alugueis', label: 'Aluguel de Espaços' },
            { path: '/admin/midias', label: 'Mídias' },
            { path: '/admin/jogos/convocacao', label: 'Jogos / Convocação' },
        ]
    },
    {
        category: 'Opções do Sistema',
        routes: [
            { path: '/admin/stats', label: 'Estatísticas' },
            { path: '/admin/relatorios', label: 'Relatórios' },
            { path: '/admin/simulador', label: 'Simulador de Receita' },
            { path: '/admin/export', label: 'Exportação' },
            { path: '/admin/funcionarios', label: 'Funcionários' },
            { path: '/admin/settings', label: 'Configurações do Sistema' },
            { path: '/admin/testes', label: 'Testes' },
            { path: '/admin/payment-test', label: 'Testes de Pagamento' },
        ]
    }
];

export const getAllFlatRoutes = () => {
    return ALL_SYSTEM_ROUTES.flatMap(cat => cat.routes.map(r => r.path));
};
