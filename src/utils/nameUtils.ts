const DIACRITICS_REGEX = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

/**
 * Normaliza um nome para uso como chave de busca exata (login por nome):
 * remove acentos, colapsa espaços e padroniza para caixa alta.
 */
export const normalizeNameKey = (name: string): string =>
    (name || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(DIACRITICS_REGEX, '')
        .replace(/\s+/g, ' ');

export const SYNTHETIC_EMAIL_DOMAIN = 'responsaveis.rumoaoesporte.local';

/** CPF utilizável como identificador: 11 dígitos e não uma sequência repetida (000..., 111...). */
export const isUsableCpf = (cpfDigits: string): boolean =>
    /^\d{11}$/.test(cpfDigits) && !/^(\d)\1{10}$/.test(cpfDigits);

/**
 * E-mail interno determinístico usado como chave técnica do Firebase Auth quando
 * o responsável não tem e-mail real cadastrado (login é feito pelo nome + CPF).
 *
 * CPFs preenchidos com zeros/placeholder NÃO servem de chave: gerariam o mesmo
 * e-mail para famílias diferentes, misturando os cadastros. Nesse caso a chave
 * cai para o id da matrícula, que é único.
 */
export const buildSyntheticEmail = (cpfDigits: string, regId: string): string =>
    isUsableCpf(cpfDigits)
        ? `resp-${cpfDigits}@${SYNTHETIC_EMAIL_DOMAIN}`
        // O e-mail é sempre comparado em minúsculas (.toLowerCase()) antes de
        // qualquer busca. Sem este toLowerCase() aqui, o id do Firestore (que
        // tem maiúsculas) fica embutido "cru" no e-mail salvo — a busca por
        // ele (já normalizada) nunca bate com o valor salvo.
        : `reg-${regId.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;

export const isSyntheticEmail = (email: string): boolean =>
    (email || '').toLowerCase().includes(`@${SYNTHETIC_EMAIL_DOMAIN}`);
