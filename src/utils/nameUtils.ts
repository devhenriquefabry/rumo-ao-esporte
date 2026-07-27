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

const SYNTHETIC_EMAIL_DOMAIN = 'responsaveis.rumoaoesporte.local';

/**
 * E-mail interno determinístico usado como chave técnica do Firebase Auth quando
 * o responsável não tem e-mail real cadastrado (login é feito pelo nome + CPF).
 */
export const buildSyntheticEmail = (cpfDigits: string, regId: string): string =>
    cpfDigits ? `resp-${cpfDigits}@${SYNTHETIC_EMAIL_DOMAIN}` : `reg-${regId}@${SYNTHETIC_EMAIL_DOMAIN}`;
