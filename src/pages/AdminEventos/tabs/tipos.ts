import type { Dispatch, SetStateAction } from 'react';
import type { Evento, EquipeEvento, InscricaoIndividual, JogoEvento } from '../../../types/eventos';

export interface TabProps {
    evento: Evento;
    setEvento: Dispatch<SetStateAction<Evento | null>>;
    equipes: EquipeEvento[];
    inscricoes: InscricaoIndividual[];
    jogos: JogoEvento[];
    recarregar: () => Promise<void>;
    adminNome: string;
    canEdit: boolean;
}
