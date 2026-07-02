import { useDialog } from '../../../context/CustomDialogContext';
import type { Student, Turma } from '../types';

const STUDENT_LOGIN_URL = 'https://arenasimonesia.web.app/aluno/login';

export function useMessaging(turmas: Turma[]) {
    const { showAlert } = useDialog();

    const handleResendApproval = (item: Student) => {
        const rawPhone = item.responsavel?.telefonePrincipal || item.responsavel?.celular || item.responsavel?.telefone || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');

        if (!cleanPhone) {
            showAlert('Telefone do responsável não encontrado para envio.', 'error');
            return;
        }

        const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        const student = item.aluno;
        if (!student) return;

        const assignedTurma = turmas.find(t => t.id === student.turmaId);
        const nomeResponsavel = (item.responsavel.nome || '').split(' ')[0].trim();
        const nomeAluno = (student.nome || '').trim();
        const cpfNumbers = (item.responsavel.cpf || '').replace(/\D/g, '');
        const currentPassword = item.senha || cpfNumbers;
        const requiresContractSignature = !student.signatureData;

        const lines = [
            `Olá ${nomeResponsavel}, tudo bem?`,
            '',
            `O cadastro do aluno(a) *${nomeAluno}* foi *APROVADO* com sucesso na Arena Simonésia!`,
            '',
            ...(assignedTurma ? [
                '*DETALHES DA TURMA:*',
                `Turma: ${assignedTurma.nome.trim()}`,
                `Dias: ${Array.isArray(assignedTurma.dias) ? assignedTurma.dias.join(', ') : assignedTurma.dias || ''}`,
                `Horário: ${assignedTurma.horario.trim()}`,
                ''
            ] : []),
            '*ACESSO À ÁREA DO ALUNO:*',
            'Você já pode acessar sua área restrita para visualizar a carteirinha e os boletos.',
            `Link: ${STUDENT_LOGIN_URL}`,
            `Login: ${item.responsavel?.email?.trim() || ''}`,
            `Senha: ${currentPassword}`,
            '',
            ...(requiresContractSignature ? [
                '*PRÓXIMO PASSO:*',
                'Ao acessar, você será direcionado para assinar o contrato digitalmente. É rápido e necessário para liberar seu acesso total.',
                '',
            ] : []),
            'Atenciosamente,',
            'Equipe Arena Simonésia',
            '',
            'Dúvidas? Entre em contato: +55 33 8414-4053'
        ];

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
    };

    return { handleResendApproval };
}
