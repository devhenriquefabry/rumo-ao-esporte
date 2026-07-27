import type { Employee } from '../types/user';

/**
 * Perfil de acesso "Diretoria" (compartilhado).
 *
 * Login fixo utilizado pelos membros da diretoria. Diferente do administrador
 * principal, este perfil só pode acessar um conjunto restrito de painéis:
 * Aniversariantes, Contratos, Carteirinhas e Documentos.
 *
 * As permissões são definidas aqui (no código) e NÃO no localStorage, para que
 * não possam ser adulteradas pelo cliente — mesmo padrão de confiança usado
 * para o administrador principal.
 */
export const DIRETORIA_EMAIL = 'rumoaoesporte@diretoria.com';
export const DIRETORIA_PASSWORD = 'diretoria2026@';

// Rotas liberadas para a diretoria.
// Obs.: a verificação usa `startsWith`, então '/admin/contratos' cobre a lista e
// o modelo de contrato, e '/admin/contract' cobre a visualização individual de
// um contrato (ex.: /admin/contract/:id/:studentIndex).
export const DIRETORIA_ALLOWED_ROUTES = [
    '/admin/aniversariantes',
    '/admin/contratos',
    '/admin/contract',
    '/admin/carteirinhas',
    '/admin/documentos',
];

export const DIRETORIA_PERMISSIONS = {
    canEdit: true,
    allowedRoutes: DIRETORIA_ALLOWED_ROUTES,
};

export const DIRETORIA_PROFILE: Employee = {
    id: 'diretoria',
    nome: 'Diretoria',
    email: DIRETORIA_EMAIL,
    role: 'employee',
    active: true,
    permissions: DIRETORIA_PERMISSIONS,
};

export const isDiretoriaEmail = (email?: string | null) =>
    !!email && email.trim().toLowerCase() === DIRETORIA_EMAIL;
