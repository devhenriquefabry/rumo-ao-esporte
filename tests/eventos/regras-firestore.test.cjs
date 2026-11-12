const path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const P = [RAIZ];
const { initializeTestEnvironment, assertSucceeds, assertFails } = require(require.resolve('@firebase/rules-unit-testing', { paths: P }));
const { doc, getDoc, setDoc, updateDoc } = require(require.resolve('firebase/firestore', { paths: P }));
const fs = require('fs');

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-eventos',
    firestore: { rules: fs.readFileSync(path.join(RAIZ, process.env.REGRAS || 'firestore.fase1.rules'), 'utf8'), host: '127.0.0.1', port: 8089 },
  });
  const anon = env.unauthenticatedContext().firestore();
  const dono = env.authenticatedContext('dono', { email: 'dono@x.com' }).firestore();
  const outro = env.authenticatedContext('outro', { email: 'outro@x.com' }).firestore();
  const admin = env.authenticatedContext('adm', { email: 'rumoaoesporte@admin.com' }).firestore();
  const func = env.authenticatedContext('func', { email: 'func@x.com' }).firestore();
  await env.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'rae_evento_staff/func@x.com'), { active: true });
    await setDoc(doc(c.firestore(), 'rae_evento_staff/inativo@x.com'), { active: false });
    await setDoc(doc(c.firestore(), 'employees/e1'), { email: 'func2@x.com', nome: 'Func 2' });
  });
  const inativo = env.authenticatedContext('inativo', { email: 'inativo@x.com' }).firestore();
  const func2 = env.authenticatedContext('func2', { email: 'func2@x.com' }).firestore();

  let ok = 0;
  const t = async (nome, p) => { try { await p; ok++; console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message); process.exitCode = 1; } };

  const equipe = { eventId: 'e1', categoriaId: 'c1', nome: 'Time', ownerUid: 'dono', status: 'liberada', atletas: [], aceites: [], alteracoes: [], pagamento: { status: 'isento' } };

  await t('público lê evento', assertSucceeds(getDoc(doc(anon, 'rae_eventos/e1'))));
  await t('público não cria evento', assertFails(setDoc(doc(anon, 'rae_eventos/e1'), { nome: 'x' })));
  await t('responsável não cria evento', assertFails(setDoc(doc(dono, 'rae_eventos/e1'), { nome: 'x' })));
  await t('admin cria evento', assertSucceeds(setDoc(doc(admin, 'rae_eventos/e1'), { nome: 'x' })));

  await t('dono cria equipe vazia', assertSucceeds(setDoc(doc(dono, 'rae_evento_equipes/t1'), equipe)));
  await t('dono não cria equipe em nome de outro', assertFails(setDoc(doc(dono, 'rae_evento_equipes/t2'), { ...equipe, ownerUid: 'outro' })));
  await t('dono não cria equipe já finalizada', assertFails(setDoc(doc(dono, 'rae_evento_equipes/t3'), { ...equipe, status: 'finalizada' })));
  await t('outro usuário não lê a equipe', assertFails(getDoc(doc(outro, 'rae_evento_equipes/t1'))));
  await t('público não lê a equipe', assertFails(getDoc(doc(anon, 'rae_evento_equipes/t1'))));
  await t('funcionário lê a equipe', assertSucceeds(getDoc(doc(func, 'rae_evento_equipes/t1'))));
  await t('dono adiciona atleta', assertSucceeds(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { atletas: [{ id: 'a', nome: 'A B' }] })));
  await t('dono não mexe no histórico do admin', assertFails(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { alteracoes: [{ acao: 'x' }] })));
  await t('dono não troca o dono', assertFails(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { ownerUid: 'outro' })));
  await t('dono finaliza a relação', assertSucceeds(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { status: 'finalizada', listaOficial: { atletas: [] } })));
  await t('após finalizar, dono NÃO altera atletas', assertFails(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { atletas: [] })));
  await t('após finalizar, dono NÃO reabre', assertFails(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { status: 'liberada' })));
  await t('após finalizar, dono registra ciência de nova versão', assertSucceeds(updateDoc(doc(dono, 'rae_evento_equipes/t1'), { aceites: [{ versao: 2 }], updatedAt: 'x' })));
  await t('admin faz correção excepcional', assertSucceeds(updateDoc(doc(admin, 'rae_evento_equipes/t1'), { atletas: [], alteracoes: [{ acao: 'corrigiu' }] })));

  await t('dono cria vaga pública', assertSucceeds(setDoc(doc(dono, 'rae_evento_vagas/t1'), { eventId: 'e1', categoriaId: 'c1', nome: 'Time', status: 'liberada', ownerUid: 'dono', tipo: 'equipe' })));
  await t('público lê vagas', assertSucceeds(getDoc(doc(anon, 'rae_evento_vagas/t1'))));
  await t('dono atualiza status da vaga', assertSucceeds(updateDoc(doc(dono, 'rae_evento_vagas/t1'), { status: 'finalizada' })));
  await t('dono não define nº de peito na vaga', assertFails(updateDoc(doc(dono, 'rae_evento_vagas/t1'), { numeroPeito: 7 })));

  const insc = { eventId: 'e1', categoriaId: 'c1', ownerUid: 'dono', status: 'finalizada', numeroPeito: null, resultado: null, alteracoes: [], aceites: [], documentoStatus: 'rejeitado' };
  await t('corredor se inscreve', assertSucceeds(setDoc(doc(dono, 'rae_evento_inscricoes/i1'), insc)));
  await t('corredor não cria com nº de peito', assertFails(setDoc(doc(dono, 'rae_evento_inscricoes/i2'), { ...insc, numeroPeito: 1 })));
  await t('corredor reenviar documento após confirmar', assertSucceeds(updateDoc(doc(dono, 'rae_evento_inscricoes/i1'), { documentoUrl: 'u', documentoStatus: 'pendente', motivoRejeicao: '', updatedAt: 'x' })));
  await t('corredor não lança o próprio tempo', assertFails(updateDoc(doc(dono, 'rae_evento_inscricoes/i1'), { resultado: { tempo: '00:10:00' } })));
  await t('admin lança tempo', assertSucceeds(updateDoc(doc(admin, 'rae_evento_inscricoes/i1'), { resultado: { tempo: '00:20:00' }, numeroPeito: 5 })));

  await t('admin cria jogo', assertSucceeds(setDoc(doc(admin, 'rae_evento_jogos/j1'), { status: 'agendado', placarA: null })));
  await t('público lê jogo', assertSucceeds(getDoc(doc(anon, 'rae_evento_jogos/j1'))));
  await t('responsável não altera jogo', assertFails(updateDoc(doc(dono, 'rae_evento_jogos/j1'), { placarA: 9 })));
  await t('funcionário encerra jogo', assertSucceeds(updateDoc(doc(func, 'rae_evento_jogos/j1'), { status: 'encerrado', placarA: 2 })));
  await t('funcionário NÃO altera jogo encerrado', assertFails(updateDoc(doc(func, 'rae_evento_jogos/j1'), { placarA: 3 })));
  await t('admin principal corrige jogo encerrado', assertSucceeds(updateDoc(doc(admin, 'rae_evento_jogos/j1'), { placarA: 3 })));

  await t('conta: dono lê o próprio perfil', assertSucceeds(getDoc(doc(dono, 'rae_evento_contas/dono'))));
  await t('conta: outro não lê', assertFails(getDoc(doc(outro, 'rae_evento_contas/dono'))));


  // ===== FASE 1: operadores de eventos =====
  await t('operador inativo não lê equipes', assertFails(getDoc(doc(inativo, 'rae_evento_equipes/t1'))));
  await t('funcionário NÃO listado não lê equipes', assertFails(getDoc(doc(func2, 'rae_evento_equipes/t1'))));
  await t('só admin principal grava operadores', assertFails(setDoc(doc(func, 'rae_evento_staff/novo@x.com'), { active: true })));
  await t('visitante não grava operadores', assertFails(setDoc(doc(anon, 'rae_evento_staff/x@x.com'), { active: true })));
  await t('responsável não se cadastra como operador', assertFails(setDoc(doc(dono, 'rae_evento_staff/dono@x.com'), { active: true })));
  await t('admin principal cadastra operador', assertSucceeds(setDoc(doc(admin, 'rae_evento_staff/func2@x.com'), { active: true })));
  await t('operador recém-cadastrado lê equipes', assertSucceeds(getDoc(doc(func2, 'rae_evento_equipes/t1'))));
  await t('operador NÃO lê a lista de operadores', assertFails(getDoc(doc(func, 'rae_evento_staff/func@x.com'))));

  // Brecha de auto-promoção: staff_access segue aberta (login de funcionário grava nela),
  // mas NÃO dá acesso a eventos
  await t('visitante grava staff_access (comportamento atual preservado)', assertSucceeds(setDoc(doc(outro, 'staff_access/outro@x.com'), { active: true })));
  await t('...mas isso NÃO dá acesso às equipes', assertFails(getDoc(doc(outro, 'rae_evento_equipes/t1'))));
  await t('...nem para criar jogos', assertFails(setDoc(doc(outro, 'rae_evento_jogos/jx'), { status: 'agendado' })));

  // ===== FASE 1: resto do banco continua EXATAMENTE como hoje (aberto) =====
  for (const col of ['rumo_ao_esporte_2026_registrations', 'teachers', 'employees', 'financial_payments', 'turmas', 'system_settings',
                     'rae_store_orders', 'whatsapp_logs', 'rumo_ao_esporte_2026_chamadas', 'qualquer_colecao_nova']) {
    await t(`legado aberto: visitante lê ${col}`, assertSucceeds(getDoc(doc(anon, `${col}/x`))));
    await t(`legado aberto: visitante grava ${col}`, assertSucceeds(setDoc(doc(anon, `${col}/x`), { a: 1 })));
  }
  await t('legado aberto: subcoleção', assertSucceeds(setDoc(doc(anon, 'turmas/x/chamadas/y'), { a: 1 })));
  await t('eventos NÃO vazam por subcoleção', assertFails(setDoc(doc(anon, 'rae_evento_equipes/t1/lixo/y'), { a: 1 })));

  console.log(`\n${ok} verificações OK`);
  await env.cleanup();
})();
