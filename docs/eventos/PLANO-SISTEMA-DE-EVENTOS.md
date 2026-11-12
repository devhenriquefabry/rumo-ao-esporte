# Sistema de Eventos, Inscrições e Súmulas — REAL

Plano de implementação do módulo de eventos esportivos (campeonatos de futebol/futsal,
torneios e corridas de rua) dentro do sistema existente da Associação Rumo ao Esporte
e ao Lazer – REAL.

## 1. Como o módulo se encaixa no sistema atual

| Peça existente | Como é reaproveitada |
|---|---|
| React 19 + Vite + Firestore | Mesma pilha. Nenhuma dependência nova. |
| `AdminLayout` + `useAdminPermissions` | Novo item de menu **Eventos** em `/admin/eventos`. Funcionários só veem se a rota estiver liberada no perfil deles. |
| Worker Cloudflare `/images/upload` (KV, até 5MB) | Upload do PDF do regulamento, do banner e dos documentos dos atletas. |
| Worker `/create-payment` e `/payment-status` (Cora/Asaas) | Cobrança PIX da taxa de inscrição + confirmação automática. |
| `PixPaymentBox` | Exibição do QR Code / copia e cola. |
| jsPDF + jspdf-autotable | Comprovantes, lista oficial e súmulas, gerados no navegador. |
| `useDialog` / `useLoading` | Todos os alertas/confirmações (regra do `.cursorrules`). |
| Firebase Auth | Conta própria do **responsável pela equipe/corredor** (e-mail + senha). |

## 2. Modelo de dados (Firestore)

| Coleção | Conteúdo | Quem lê / escreve |
|---|---|---|
| `rae_eventos` | Evento completo: dados, categorias (com tempo de jogo, limite de atletas, valor, faixa etária, faltas e pedidos de tempo), formato, pontuação, critérios de desempate, regulamento atual + histórico de versões. | Leitura pública; escrita só staff. |
| `rae_evento_equipes` | Equipe: responsável, pagamento, atletas (com documento e status), aceites do regulamento, lista oficial congelada, log de correções do admin. | Dono (uid) ou staff. Dono não altera após finalizar. |
| `rae_evento_inscricoes` | Inscrição individual (corrida): dados do corredor, documento, pagamento, número de peito, resultado, aceites. | Dono ou staff. |
| `rae_evento_vagas` | Resumo público (mesmo id da equipe/inscrição): nome, categoria, status, nº de peito, resultado. Usado para contar vagas e divulgar resultados sem expor dados pessoais. | Leitura pública; dono cria/atualiza o próprio; staff tudo. |
| `rae_evento_jogos` | Confronto: nº do jogo, fase/rodada, grupo, equipes (id + nome), data, horário, local, árbitros, placar, súmula digital (lances), ocorrências, status. | Leitura pública (resultados); escrita só staff; bloqueado após encerrado (exceto admin principal). |

Atletas ficam dentro do documento da equipe (limite prático de dezenas de atletas,
bem abaixo de 1MB) — isso deixa a finalização atômica e as regras simples.

## 3. Fluxos

### 3.1 Administrador
1. **Eventos → Novo evento**: tipo (equipes / individual), modalidade, nome, descrição,
   banner, datas, local, período de inscrição, formato, pontuação, critérios de desempate,
   regras específicas, orientações de retirada de kit (corrida).
2. **Categorias** (por evento): nome, faixa etária (ano de nascimento mín./máx.), limite de
   equipes/participantes, limite de atletas por equipe, valor, distância (corrida) e
   **tempo de jogo** (nº de períodos, duração, intervalo, prorrogação), faltas por período e
   pedidos de tempo por período. Tudo editável sem programador.
3. **ANEXAR REGULAMENTO DO EVENTO**: envia PDF → vira versão 1. Nova publicação gera
   versão N, mantém histórico e pode ser marcada como "alteração importante" — os
   responsáveis passam a ver um aviso e precisam aceitar a nova versão.
4. **Inscrições**: lista de equipes/participantes, aprovação manual de pagamento,
   aprovação/rejeição de documentos, desbloqueio excepcional de relação (com motivo
   registrado), lista oficial em PDF, nº de peito.
5. **Jogos**: criação manual de confrontos (ou geração automática "todos contra todos"),
   grupos, fases; lançamento de resultado.
6. **Súmulas**: PDF por jogo, por rodada ou por categoria, já com atletas e tempo de jogo.
7. **Classificação**: calculada pelos critérios do evento.
8. **Corrida**: tempos, classificação geral e por categoria.

### 3.2 Responsável pela equipe
1. Página pública do evento (`/eventos/:id`) com regulamento (ver/baixar/imprimir).
2. Cria conta / entra → cadastra equipe e categoria (aceite obrigatório do regulamento).
3. Se houver taxa: PIX → confirmação automática (consulta ao provedor) ou manual pelo admin
   → comprovante PDF. Evento gratuito libera direto.
4. Cadastra atletas (nome, nascimento, camisa, documento) até o limite; corrige à vontade.
5. **FINALIZAR INSCRIÇÃO E GERAR LISTA OFICIAL**: revisão completa, aceite do regulamento
   novamente, aviso de bloqueio → relação congelada, PDF oficial, liberada para súmulas.

### 3.3 Corredor (corrida de rua)
Página do evento → conta → escolhe categoria/distância → dados + documento + aceite →
PIX (se houver) → comprovante de pagamento e de inscrição (categoria, distância, nº de
peito quando atribuído, orientações de kit).

## 4. Súmula oficial (PDF)
Estrutura visual do modelo REAL: logo, campeonato, categoria, nº do jogo, data, horário,
local, fase/rodada, árbitros, Equipes A e B lado a lado (nº, atleta, gols, CA, CV), faltas
acumuladas por período, pedidos de tempo, placar por período, registro de gols,
ocorrências e assinaturas.

**Nada fixo:**
- Cabeçalho mostra o tempo da categoria (ex.: `2 x 10 MINUTOS · INTERVALO 5 MIN · PRORROGAÇÃO 2 x 3 MIN`).
- Linhas de atletas = maior relação entre as duas equipes; só nomes reais da lista
  oficial; a altura da linha se ajusta e, acima do que cabe, a relação continua em página
  adicional.
- Colunas de faltas e de pedidos de tempo seguem os períodos e limites da categoria.

## 5. Súmula digital (2ª etapa — entregue em versão inicial)
Tela para celular/tablet em `/admin/eventos/jogo/:id/sumula`: registrar gols, faltas,
cartões, pedidos de tempo e ocorrências por período; placar automático; finalizar
partida (bloqueia alterações) e emitir PDF já preenchido. Acesso controlado pelas
permissões de funcionário (rota `/admin/eventos`).

## 6. Segurança
- Regras do Firestore atualizadas para as 5 coleções (padrão: dono ou staff).
- Responsável não altera relação após finalizar (regra no banco, não só na tela).
- Jogo encerrado só pode ser alterado pelo administrador principal.
- Toda correção excepcional do admin fica registrada (quem, quando, motivo).

**Limitação conhecida:** a confirmação automática do PIX é feita pelo navegador do
responsável consultando o Worker (mesmo modelo da Loja e das Reservas). Para tornar a
confirmação à prova de adulteração, o próximo passo é o Worker gravar a confirmação via
webhook com credencial de serviço. O painel mostra a origem da confirmação
(automática/manual) e o id da transação para conferência.

## 7. Etapas
**Etapa 1 (este entregável):** eventos, categorias configuráveis, regulamento com versões e
aceites, equipes, pagamento PIX/manual, comprovantes, atletas e documentos, finalização
com lista oficial, jogos manuais + todos contra todos, resultados, classificação,
súmulas automáticas para impressão, corrida de rua (inscrição, nº de peito, tempos,
classificação), painel administrativo.

**Etapa 2 (próximos passos):** sorteio automático e chaveamento visual de mata-mata,
evolução da súmula digital (cronômetro, assinatura na tela), atualização automática da
classificação a partir da súmula digital em tempo real, integração com cronometragem
(importação de planilha/chip), confirmação de PIX por webhook no Worker, e-mail/WhatsApp
aos responsáveis quando o regulamento mudar.

## 8. Teste local (antes de publicar)

```bash
npm run eventos:local
```

Sobe o Firestore e o Login (Firebase Auth) **simulados no próprio computador**, com as
regras novas, cria dados de exemplo e abre o site em http://localhost:5173.
Nada é gravado em produção; os dados são recriados a cada execução.

- Admin: http://localhost:5173/admin/login — `rumoaoesporte@admin.com` / `admin123`
- Responsável: http://localhost:5173/eventos/entrar — `responsavel@teste.com` / `teste123`
- PIX em modo sandbox (cobranças de teste no Worker) com botão "Simular pagamento".
- Requisitos: Node 20+, Java 21+ (para o emulador) e o arquivo `.env` do projeto.

## 9. Testes automatizados

Regras de negócio (classificação, desempate, todos contra todos, idade, tempos):

```bash
npx esbuild tests/eventos/regras-negocio.test.ts --bundle --platform=node --format=esm | node --input-type=module
```

Regras de segurança do Firestore (68 cenários: dono, outro usuário, público,
operador, admin principal e "resto do banco continua aberto"), no emulador.
Para testar o arquivo da fase 2: `REGRAS=firestore.rules` antes do comando.

```bash
npx firebase-tools emulators:exec --project demo-eventos --only firestore "node tests/eventos/regras-firestore.test.cjs"
```

## 10. Publicação e segurança do banco (fases)

**Situação encontrada:** o Firestore de produção está **totalmente aberto**
(`allow read, write: if true`). O arquivo `firestore.rules`, que fecha o banco inteiro, nunca
foi publicado, porque travaria partes do sistema (o Worker da Cloudflare acessa o banco como
visitante anônimo; a tela pública de chamada lê cadastros sem login).

**Fase 1 (esta entrega) — `firestore.fase1.rules`** (é a regra que o `firebase.json` publica):
- Protege **somente** as coleções de eventos (`rae_evento*`). O resto do banco continua aberto,
  exatamente como hoje.
- Quem opera eventos = **administrador principal** + e-mails que ele cadastra no cartão
  "Equipe de operação de eventos" (coleção `rae_evento_staff`, só ele grava).
- Não usa `staff_access` (aberta nesta fase; senão qualquer pessoa se auto-promoveria a operador).
- Funcionários só operam eventos se (a) estiverem na equipe de operação **e** (b) tiverem a rota
  "Eventos" liberada no cadastro de funcionários.

**Fase 2 (futura):** fechar o restante do banco. Antes: dar credencial de serviço ao Worker,
decidir a tela pública de chamada e testar login de alunos/professores/funcionários. Quando
pronto, trocar `firestore.fase1.rules` por `firestore.rules` em `firebase.json`.

**Como publicar:**
1. `npm run build`
2. `firebase deploy --only firestore:rules` (publica a fase 1)
3. `firebase deploy --only hosting`
4. Entrar como administrador principal → Eventos → "Equipe de operação" e cadastrar os funcionários.

O módulo não exige mudanças no Worker (usa `/images/upload`, `/create-payment`, `/payment-status`).
