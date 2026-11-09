import assert from 'node:assert/strict';
import * as R from '../../src/utils/eventos/eventosRules';
import type { InscricaoIndividual } from '../../src/types/eventos';

const cat = R.novaCategoria({ nome: 'Sub-12', anoNascimentoMin: 2014, anoNascimentoMax: 2015 });
assert.equal(R.validarIdade(cat, '2014-05-01'), null);
assert.ok(R.validarIdade(cat, '2013-12-31'));
assert.ok(R.validarIdade(cat, '2016-01-01'));

assert.equal(R.formatarTempoDeJogo({ periodos: 2, duracaoMin: 8, intervaloMin: 0, prorrogacaoPeriodos: 0, prorrogacaoMin: 0 }), '2 x 8 MINUTOS');
assert.equal(R.formatarTempoDeJogo({ periodos: 2, duracaoMin: 15, intervaloMin: 5, prorrogacaoPeriodos: 2, prorrogacaoMin: 3 }), '2 x 15 MINUTOS · INTERVALO 5 MIN · PRORROGAÇÃO 2 x 3 MIN');
assert.deepEqual(R.nomesPeriodos({ periodos: 4, duracaoMin: 10, intervaloMin: 0, prorrogacaoPeriodos: 1, prorrogacaoMin: 5 }), ['1º PERÍODO','2º PERÍODO','3º PERÍODO','4º PERÍODO','PRORR. 1']);

// Round robin: 5 equipes -> 5 rodadas, 10 jogos, cada par uma vez
const eqs = ['A','B','C','D','E'];
const rr = R.gerarTodosContraTodos(eqs);
assert.equal(rr.length, 5);
const pares = rr.flat().map(([a,b]) => [a,b].sort().join(''));
assert.equal(pares.length, 10);
assert.equal(new Set(pares).size, 10);
rr.forEach(r => { const ts = r.flat(); assert.equal(new Set(ts).size, ts.length); });
assert.equal(R.gerarTodosContraTodos(['A','B','C','D'], true).flat().length, 12);

// Classificação com confronto direto
const j = (a: string, b: string, ga: number, gb: number) => ({ eventId: 'e', categoriaId: 'c', numero: 1, fase: '', equipeAId: a, equipeANome: a, equipeBId: b, equipeBNome: b, status: 'encerrado' as const, placarA: ga, placarB: gb, createdAt: '' });
const times = [{ id: 'X', nome: 'X' }, { id: 'Y', nome: 'Y' }, { id: 'Z', nome: 'Z' }];
// X e Y empatam em pontos (3), saldo, gols; Y venceu X
const jogos = [j('Y','X',1,0), j('X','Z',1,0), j('Z','Y',1,0)];
const t1 = R.calcularClassificacao(times, jogos, { vitoria: 3, empate: 1, derrota: 0 }, ['pontos','confronto_direto']);
assert.equal(t1[0].pontos, 3);
assert.equal(t1.find(l => l.equipeId === 'Y')!.saldo, 0);
const iy = t1.findIndex(l => l.equipeId === 'Y'), ix = t1.findIndex(l => l.equipeId === 'X');
assert.ok(iy < ix, 'Y deve ficar à frente de X pelo confronto direto');
// jogo agendado não conta
const t2 = R.calcularClassificacao(times, [...jogos, { ...j('X','Y',5,0), status: 'agendado' as const }], { vitoria: 3, empate: 1, derrota: 0 }, ['pontos']);
assert.equal(t2.reduce((s, l) => s + l.jogos, 0), 6);

// Corrida
assert.equal(R.normalizarTempo('25:41'), '00:25:41');
assert.equal(R.normalizarTempo('1:2:3'), '01:02:03');
assert.equal(R.normalizarTempo('abc'), null);
const c5m = R.novaCategoria({ id: 'm', distancia: '5 km' }), c5f = R.novaCategoria({ id: 'f', distancia: '5 km' });
const ins = (id: string, cat: string, tempo: string) => ({ id, categoriaId: cat, status: 'finalizada', resultado: { tempo } }) as unknown as InscricaoIndividual;
const res = R.calcularResultadosCorrida([ins('1','m','00:20:00'), ins('2','f','00:19:00'), ins('3','m','00:18:00')], [c5m, c5f]);
assert.deepEqual(res.get('3'), { posicaoGeral: 1, posicaoCategoria: 1 });
assert.deepEqual(res.get('2'), { posicaoGeral: 2, posicaoCategoria: 1 });
assert.deepEqual(res.get('1'), { posicaoGeral: 3, posicaoCategoria: 2 });
console.log('OK — todas as verificações de regras passaram');
