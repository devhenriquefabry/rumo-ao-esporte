/**
 * Formata a modalidade para exibição na carteirinha (ex.: "futsal" -> "Futsal").
 * Aceita uma modalidade única (registro) ou a lista de modalidades do aluno,
 * já que o mesmo aluno pode estar matriculado em mais de uma.
 */
export const formatModalidade = (modalidade?: string | string[]): string => {
    const lista = (Array.isArray(modalidade) ? modalidade : [modalidade])
        .map(m => (m || '').trim())
        .filter(Boolean);

    if (lista.length === 0) return '-';

    return lista
        .map(m => m
            .split(/\s+/)
            .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
            .join(' '))
        .join(' / ');
};
