/**
 * Dados de exemplo para o modo de teste local (npm run eventos:local).
 *
 * Roda dentro de `firebase emulators:exec`, então grava SOMENTE nos emuladores
 * do Firebase no próprio computador. Os emuladores começam vazios a cada
 * execução, então este script recria tudo sempre.
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';

const PROJETO = 'rumo-ao-esporte';
const AUTH = 'http://127.0.0.1:9099';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Este script só roda dentro dos emuladores (use: npm run eventos:local).');
    process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const dia = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const agora = new Date().toISOString();

async function criarUsuario(email, senha) {
    const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=teste`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    });
    const dados = await r.json();
    if (!dados.localId) throw new Error(`Falha ao criar ${email}: ${JSON.stringify(dados)}`);
    return dados.localId;
}

const NOMES = [
    'JOÃO PEDRO DA SILVA', 'MIGUEL HENRIQUE SOUZA', 'ARTHUR LIMA COSTA', 'GAEL FERREIRA', 'HEITOR ALMEIDA', 'THEO MARTINS',
    'DAVI LUCCA OLIVEIRA', 'BERNARDO GOMES', 'SAMUEL RIBEIRO', 'LORENZO CARVALHO', 'RAVI BARBOSA', 'NOAH ARAÚJO',
    'ENZO MENDES', 'BENÍCIO ROCHA', 'MATHEUS DIAS', 'ISAAC MOREIRA', 'LUCAS NUNES', 'PEDRO CASTRO', 'GUSTAVO CARDOSO',
    'RAFAEL TEIXEIRA', 'FELIPE CORREIA', 'VICENTE PINTO', 'CAIO MONTEIRO', 'BRUNO FREITAS',
];
const atletas = (qtd, inicio, prefixo, status = 'aprovado') => Array.from({ length: qtd }, (_, i) => ({
    id: `${prefixo}${i + 1}`,
    nome: NOMES[(inicio + i) % NOMES.length],
    dataNascimento: `${2014 + (i % 2)}-0${(i % 9) + 1}-1${i % 9}`,
    camisa: String(i + 1),
    documentoUrl: '/carteirinha.png',
    documentoNome: 'documento-exemplo.png',
    documentoStatus: status,
    motivoRejeicao: '',
}));

const REGULAMENTO = {
    versao: 1, url: '/estatuto-social-real.pdf', nomeArquivo: 'regulamento-exemplo.pdf',
    publicadoEm: agora, publicadoPor: 'Administrador (teste)', notas: 'PDF de exemplo — substitua pelo regulamento real', alteracaoImportante: false,
};

const tempo = (periodos, duracaoMin, intervaloMin, prorrogacaoPeriodos = 0, prorrogacaoMin = 0) => ({ periodos, duracaoMin, intervaloMin, prorrogacaoPeriodos, prorrogacaoMin });

const env = await initializeTestEnvironment({ projectId: PROJETO, firestore: { host: '127.0.0.1', port: 8089 } });

const uidResp = await criarUsuario('responsavel@teste.com', 'teste123');

await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Admin principal (login em /admin/login) e PIX em modo sandbox
    await setDoc(doc(db, 'employees/admin-local'), {
        nome: 'Administrador (teste)', email: 'rumoaoesporte@admin.com', senha: 'admin123', active: true, role: 'admin',
        permissions: { canEdit: true, allowedRoutes: ['*'] },
    });
    await setDoc(doc(db, 'staff_access/rumoaoesporte@admin.com'), { active: true, role: 'employee' });
    await setDoc(doc(db, 'system_settings/payment_provider'), { provider: 'cora', environment: 'stage', testMode: true, updatedAt: agora });

    // Responsável de teste
    const conta = { nome: 'Maria Responsável Teste', email: 'responsavel@teste.com', telefone: '(33) 99999-0000', cpf: '52998224725', createdAt: agora };
    await setDoc(doc(db, `rae_evento_contas/${uidResp}`), conta);

    // ---------- Campeonato de futsal ----------
    const copa = {
        tipo: 'equipes', modalidade: 'futsal', nome: 'Copa REAL de Futsal (TESTE)', status: 'publicado',
        descricao: 'Evento de exemplo criado para testes locais. Pode editar, apagar e inscrever à vontade.',
        bannerUrl: '', dataInicio: dia(14), dataFim: dia(21), local: 'Ginásio Poliesportivo', inscricoesInicio: dia(-1), inscricoesFim: dia(30),
        formato: 'todos_contra_todos', pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
        criteriosDesempate: ['pontos', 'vitorias', 'saldo_gols', 'gols_pro', 'confronto_direto', 'menos_cartoes_vermelhos', 'menos_cartoes_amarelos'],
        regrasEspecificas: 'W.O. vale 3 x 0.', orientacoesKit: '', exigirDocumento: true,
        categorias: [
            { id: 'sub12', nome: 'Sub-12', anoNascimentoMin: 2014, anoNascimentoMax: 2015, sexo: 'misto', maxInscricoes: 8, maxAtletas: 12, minAtletas: 5, valor: 0, tempo: tempo(2, 8, 3), faltasPorPeriodo: 5, temposPorPeriodo: 1, observacoes: '' },
            { id: 'sub14', nome: 'Sub-14', anoNascimentoMin: 2012, anoNascimentoMax: 2013, sexo: 'misto', maxInscricoes: 8, maxAtletas: 14, minAtletas: 5, valor: 50, tempo: tempo(2, 10, 5, 2, 3), faltasPorPeriodo: 5, temposPorPeriodo: 1, observacoes: '' },
        ],
        regulamento: REGULAMENTO, regulamentoHistorico: [REGULAMENTO], createdAt: agora, updatedAt: agora,
    };
    await setDoc(doc(db, 'rae_eventos/copa-teste'), copa);

    const batch = writeBatch(db);
    const equipesProntas = [
        { id: 'eq-real', nome: 'ESCOLINHA REAL', qtd: 11, grupo: 'A' },
        { id: 'eq-unidos', nome: 'UNIDOS DO BAIRRO', qtd: 9, grupo: 'A' },
        { id: 'eq-atletico', nome: 'ATLÉTICO MARTINS', qtd: 12, grupo: 'A' },
        { id: 'eq-familia', nome: 'FAMÍLIA FC', qtd: 10, grupo: 'A' },
    ];
    equipesProntas.forEach((e, k) => {
        const lista = atletas(e.qtd, k * 5, `${e.id}-`);
        const owner = `resp-exemplo-${k}`;
        batch.set(doc(db, `rae_evento_equipes/${e.id}`), {
            eventId: 'copa-teste', categoriaId: 'sub12', nome: e.nome, grupo: e.grupo, ownerUid: owner, tecnico: `TÉCNICO ${k + 1}`,
            responsavel: { uid: owner, nome: `Responsável ${e.nome}`, email: `resp${k}@exemplo.com`, telefone: '(33) 98888-000' + k, cpf: '00000000000' },
            status: 'finalizada', pagamento: { valor: 0, status: 'isento', metodo: 'isento', confirmadoEm: agora, confirmadoPor: 'automatico' },
            atletas: lista, aceites: [{ versao: 1, aceitoEm: agora, nome: `Responsável ${e.nome}`, uid: owner, etapa: 'finalizacao' }],
            listaOficial: { geradaEm: agora, geradaPor: `Responsável ${e.nome}`, atletas: lista, regulamentoVersao: 1 },
            finalizadaEm: agora, alteracoes: [], createdAt: agora,
        });
        batch.set(doc(db, `rae_evento_vagas/${e.id}`), { eventId: 'copa-teste', categoriaId: 'sub12', tipo: 'equipe', nome: e.nome, status: 'finalizada', ownerUid: owner, grupo: e.grupo, createdAt: agora });
    });

    // Equipe do responsável de teste: ainda cadastrando atletas (para testar a finalização)
    const minhaLista = [...atletas(5, 12, 'minha-'), { ...atletas(1, 16, 'minha-doc-', 'rejeitado')[0], camisa: '10', motivoRejeicao: 'Documento ilegível (exemplo)' }];
    batch.set(doc(db, 'rae_evento_equipes/eq-minha'), {
        eventId: 'copa-teste', categoriaId: 'sub12', nome: 'MINHA EQUIPE TESTE', grupo: '', ownerUid: uidResp, tecnico: '',
        responsavel: { uid: uidResp, nome: conta.nome, email: conta.email, telefone: conta.telefone, cpf: conta.cpf },
        status: 'liberada', pagamento: { valor: 0, status: 'isento', metodo: 'isento', confirmadoEm: agora, confirmadoPor: 'automatico' },
        atletas: minhaLista, aceites: [{ versao: 1, aceitoEm: agora, nome: conta.nome, uid: uidResp, etapa: 'cadastro' }],
        listaOficial: null, finalizadaEm: null, alteracoes: [], createdAt: agora,
    });
    batch.set(doc(db, 'rae_evento_vagas/eq-minha'), { eventId: 'copa-teste', categoriaId: 'sub12', tipo: 'equipe', nome: 'MINHA EQUIPE TESTE', status: 'liberada', ownerUid: uidResp, grupo: '', createdAt: agora });

    // Jogos (todos contra todos entre as 4 equipes prontas); o jogo 1 já tem resultado
    const pares = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
    pares.forEach(([a, b], i) => {
        const A = equipesProntas[a], B = equipesProntas[b];
        batch.set(doc(db, `rae_evento_jogos/jogo-${i + 1}`), {
            eventId: 'copa-teste', categoriaId: 'sub12', numero: i + 1, fase: `${Math.floor(i / 2) + 1}ª Rodada`, grupo: 'A', eliminatoria: false,
            equipeAId: A.id, equipeANome: A.nome, equipeBId: B.id, equipeBNome: B.nome,
            data: dia(14 + Math.floor(i / 2)), horario: i % 2 ? '10:00' : '09:00', local: 'Ginásio Poliesportivo',
            arbitragem: { principal: 'José Ramos', anotador: 'Ana Lúcia' },
            status: i === 0 ? 'encerrado' : 'agendado', placarA: i === 0 ? 3 : null, placarB: i === 0 ? 1 : null,
            penaltisA: null, penaltisB: null, lances: [], ocorrencias: '', encerradoEm: i === 0 ? agora : null, encerradoPor: i === 0 ? 'Administrador (teste)' : null,
            createdAt: agora,
        });
    });

    // ---------- Corrida de rua ----------
    batch.set(doc(db, 'rae_eventos/corrida-teste'), {
        tipo: 'individual', modalidade: 'corrida', nome: 'Corrida REAL 5K (TESTE)', status: 'publicado',
        descricao: 'Corrida de exemplo para testes locais.', bannerUrl: '', dataInicio: dia(20), dataFim: '', local: 'Praça Central',
        inscricoesInicio: dia(-1), inscricoesFim: dia(18), formato: 'manual', pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
        criteriosDesempate: [], regrasEspecificas: '', exigirDocumento: true,
        orientacoesKit: 'Retirada do kit na sede da REAL, de segunda a sexta, das 8h às 17h, com documento com foto e comprovante de inscrição.',
        categorias: [
            { id: '5k-m', nome: '5 km Masculino', anoNascimentoMin: null, anoNascimentoMax: 2010, sexo: 'masculino', maxInscricoes: 100, maxAtletas: 1, minAtletas: 1, valor: 30, tempo: tempo(1, 1, 0), faltasPorPeriodo: 0, temposPorPeriodo: 0, distancia: '5 km', observacoes: '' },
            { id: '5k-f', nome: '5 km Feminino', anoNascimentoMin: null, anoNascimentoMax: 2010, sexo: 'feminino', maxInscricoes: 100, maxAtletas: 1, minAtletas: 1, valor: 30, tempo: tempo(1, 1, 0), faltasPorPeriodo: 0, temposPorPeriodo: 0, distancia: '5 km', observacoes: '' },
        ],
        regulamento: REGULAMENTO, regulamentoHistorico: [REGULAMENTO], createdAt: agora, updatedAt: agora,
    });
    ['CARLOS EDUARDO LIMA', 'ANDRÉ LUIZ SANTOS', 'PAULO HENRIQUE ROCHA'].forEach((nome, i) => {
        const id = `corredor-${i + 1}`;
        batch.set(doc(db, `rae_evento_inscricoes/${id}`), {
            eventId: 'corrida-teste', categoriaId: '5k-m', ownerUid: `corredor-exemplo-${i}`,
            participante: { nome, dataNascimento: `199${i}-05-10`, sexo: 'masculino', cpf: '00000000000', telefone: '(33) 97777-000' + i, email: `corredor${i}@exemplo.com`, camiseta: 'M', cidade: 'Martins Soares', contatoEmergencia: '' },
            documentoUrl: '/carteirinha.png', documentoNome: 'documento.png', documentoStatus: 'aprovado',
            status: 'finalizada', pagamento: { valor: 30, status: 'confirmado', metodo: 'manual', confirmadoEm: agora, confirmadoPor: 'Administrador (teste)' },
            aceites: [{ versao: 1, aceitoEm: agora, nome, uid: `corredor-exemplo-${i}`, etapa: 'cadastro' }],
            numeroPeito: null, resultado: null, alteracoes: [], createdAt: agora,
        });
        batch.set(doc(db, `rae_evento_vagas/${id}`), { eventId: 'corrida-teste', categoriaId: '5k-m', tipo: 'atleta', nome, status: 'finalizada', ownerUid: `corredor-exemplo-${i}`, numeroPeito: null, resultado: null, createdAt: agora });
    });

    await batch.commit();
});

await env.cleanup();

console.log(`
==============================================================
  MODO TESTE LOCAL PRONTO  (nada aqui vai para produção)
--------------------------------------------------------------
  Site público ........ http://localhost:5173/eventos
  Admin ............... http://localhost:5173/admin/login
                        rumoaoesporte@admin.com / admin123
  Responsável ......... http://localhost:5173/eventos/entrar
                        responsavel@teste.com / teste123
  PIX: sandbox de teste (botão "Simular pagamento").
  Para encerrar: Ctrl+C. Os dados são recriados a cada início.
==============================================================
`);
