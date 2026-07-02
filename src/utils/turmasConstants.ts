export const MODALIDADES = [
    { id: 'futebol', label: 'Futebol' }
];

export const SCHEDULE_OPTIONS: Record<string, { days: string[]; times: string[] }[]> = {};

export const FAIXAS_ETARIAS = [
    { id: 'baby', label: 'Baby / Outros', minAge: 0, maxAge: 2 },
    { id: 'sub-05', label: 'Sub-05 (Chupetinha)', minAge: 3, maxAge: 5 },
    { id: 'sub-07', label: 'Sub-07 (Fraldinha)', minAge: 6, maxAge: 7 },
    { id: 'sub-09', label: 'Sub-09 (Pre-Mirim)', minAge: 8, maxAge: 9 },
    { id: 'sub-11', label: 'Sub-11 (Mirim)', minAge: 10, maxAge: 11 },
    { id: 'sub-13', label: 'Sub-13 (Infantil)', minAge: 12, maxAge: 13 },
    { id: 'sub-15', label: 'Sub-15 (Infanto)', minAge: 14, maxAge: 15 },
    { id: 'sub-17', label: 'Sub-17 (Juvenil)', minAge: 16, maxAge: 17 },
    { id: 'adulto', label: 'Adulto (+18)', minAge: 18, maxAge: 99 }
];

export const AGES_TO_MAP = Array.from({ length: 15 }, (_, i) => i + 3);

export const normalizeModality = (raw: string): string => {
    if (!raw) return 'Outros';
    const lower = raw.trim().toLowerCase();
    if (lower === 'futebol' || lower.includes('futebol')) return 'Futebol';
    return 'Outros';
};

const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);

                if (year < 100) {
                    year += 2000;
                    if (year > new Date().getFullYear()) {
                        year -= 100;
                    }
                }

                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) return date;
            }
        }

        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

export const calculateClass = (_modalidade: string, birthDateStr: string): { id: string, label: string } => {
    const birthDate = parseDate(birthDateStr);
    const baby = { id: 'baby', label: 'Baby / Outros' };

    if (!birthDate) return baby;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age >= 18) return { id: 'adulto', label: 'Adulto (+18)' };
    if (age >= 16) return { id: 'sub-17', label: 'Sub-17 (Juvenil)' };
    if (age >= 14) return { id: 'sub-15', label: 'Sub-15 (Infanto)' };
    if (age >= 12) return { id: 'sub-13', label: 'Sub-13 (Infantil)' };
    if (age >= 10) return { id: 'sub-11', label: 'Sub-11 (Mirim)' };
    if (age >= 8) return { id: 'sub-09', label: 'Sub-09 (Pre-Mirim)' };
    if (age >= 6) return { id: 'sub-07', label: 'Sub-07 (Fraldinha)' };
    if (age >= 3) return { id: 'sub-05', label: 'Sub-05 (Chupetinha)' };

    return baby;
};
