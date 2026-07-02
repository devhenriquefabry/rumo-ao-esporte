/**
 * Cloudflare Worker: Proxy para Evolution API v2 + Armazenamento de Imagens + Fila de Mensagens
 */

const EVOLUTION_URL = "https://mcu-nightrun-whatsapp.fly.dev";
const ASAAS_URL = "https://api.asaas.com/v3";
const INSTANCE_NAME = "uba_instance";
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REGISTRATIONS_COLLECTION = "arena_simonesia_2026_registrations";
const FINANCIAL_PAYMENTS_COLLECTION = "financial_payments";

const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "Portal Supremo Arena SimonÃ©sia 2026",
    description: "Este portal Ã© a central tÃ©cnica definitiva do ecossistema Arena SimonÃ©sia 2026. Ele integra a documentaÃ§Ã£o de Backend (Cloudflare Workers), PersistÃªncia (Firestore) e Frontend (React Portals). Abaixo vocÃª encontrarÃ¡ o mapeamento de APIs, rotas de navegaÃ§Ã£o do usuÃ¡rio e algoritmos de sincronizaÃ§Ã£o financeira. Esta Ã© a Ãºnica fonte de verdade para a engenharia do projeto.",
    version: "1.3.0"
  },
  servers: [{ url: "https://arenasimonesia-whatsapp-proxy.thayrufino2.workers.dev", description: "ProduÃ§Ã£o" }],
  tags: [
    { name: "Sistemas & Infraestrutura", description: "Endpoints do Worker para WhatsApp, processamento de mÃ­dias e logÃ­stica de fila." },
    { name: "Portal do Administrador", description: "Interfaces e rotas de gestÃ£o (Dashboard, Turmas, Financeiro, ConfiguraÃ§Ãµes)." },
    { name: "Portal do Aluno", description: "Rotas de autoatendimento para responsÃ¡veis (Carteirinha, Financeiro, Perfil)." },
    { name: "Protocolos de Dados", description: "Esquemas de coleÃ§Ãµes do Firestore e modelos das entidades de negÃ³cio." }
  ],
  paths: {
    /* --- BACKEND --- */
    "/queue/enqueue": {
      post: {
        tags: ["Sistemas & Infraestrutura"],
        summary: "Enfileiramento Massivo de Mensagens",
        responses: { 200: { description: "Sucesso no enfileiramento." } }
      }
    },
    "/upload": {
      post: {
        tags: ["Sistemas & Infraestrutura"],
        summary: "Armazenamento Persistente de MÃ­dias",
        responses: { 200: { description: "URL de acesso concedida." } }
      }
    },

    /* --- FRONTEND ADMIN --- */
    "/admin/dashboard": {
      get: {
        tags: ["Portal do Administrador"],
        summary: "Painel Principal de GestÃ£o",
        description: "PÃ¡gina mestre com listagem de alunos, filtros de inadimplÃªncia e aÃ§Ãµes rÃ¡pidas de matrÃ­cula.",
        responses: { 200: { description: "VisualizaÃ§Ã£o do Dashboard." } }
      }
    },
    "/admin/financeiro": {
      get: {
        tags: ["Portal do Administrador"],
        summary: "MÃ³dulo Financeiro Central",
        description: "GestÃ£o de integraÃ§Ã£o Asaas, faturas, fluxo de caixa e reconciliaÃ§Ã£o bancÃ¡ria.",
        responses: { 200: { description: "VisualizaÃ§Ã£o Financeira." } }
      }
    },
    "/admin/turmas": {
      get: {
        tags: ["Portal do Administrador"],
        summary: "GestÃ£o AcadÃªmica de Turmas",
        description: "Controle de horÃ¡rios, alocaÃ§Ã£o de modalidades (Futebol/NataÃ§Ã£o) e diÃ¡rio de classe.",
        responses: { 200: { description: "VisualizaÃ§Ã£o de Turmas." } }
      }
    },

    /* --- FRONTEND ALUNO --- */
    "/aluno/carteirinha": {
      get: {
        tags: ["Portal do Aluno"],
        summary: "Acesso Digital do Estudante",
        description: "Interface para exibiÃ§Ã£o da carteirinha digital com QR Code de acesso ao clube.",
        responses: { 200: { description: "VisualizaÃ§Ã£o da Carteirinha." } }
      }
    },
    "/aluno/financeiro": {
      get: {
        tags: ["Portal do Aluno"],
        summary: "Portal de Pagamentos (ResponsÃ¡vel)",
        description: "VisualizaÃ§Ã£o de faturas em aberto e link direto para pagamento via Asaas.",
        responses: { 200: { description: "VisualizaÃ§Ã£o do Financeiro Aluno." } }
      }
    },
    "/finance/balance": {
      get: {
        tags: ["Sistemas & Infraestrutura"],
        summary: "Consulta de Saldo Asaas",
        description: "Retorna o saldo atual da conta Asaas integrada via proxy.",
        responses: { 200: { description: "Saldo retornado com sucesso." } }
      }
    }
  },
  components: {
    schemas: {
      RegistrationDoc: {
        type: "object",
        description: "Modelo de dados mestre no Firestore (arena_simonesia_2026_registrations).",
        properties: {
          responsavel: { type: "object", description: "Dados do titular financeiro." },
          status: { type: "string", enum: ["pago", "pendente", "atrasado"], description: "Status calculado via Deep Sync." },
          alunos: { type: "array", items: { type: "object" }, description: "Lista de dependentes vinculados." }
        }
      },
      FinancialStatus: {
        type: "object",
        description: "Resultado do processamento de adimplÃªncia.",
        properties: {
          pendingAmount: { type: "number" },
          description: { type: "string" },
          invoiceUrl: { type: "string" }
        }
      }
    }
  }
};

const SWAGGER_HTML = (url) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Manual Supremo | Arena SimonÃ©sia 2026</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
  <style>
    body { background: #f1f5f9; margin: 0; font-family: 'Inter', system-ui, sans-serif; }
    .swagger-ui .topbar { background-color: #00237f; border-bottom: 5px solid #007d2f; padding: 15px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .swagger-ui .info .title { color: #00237f; font-size: 3em; font-weight: 900; letter-spacing: -1.5px; }
    .swagger-ui .info .description { font-size: 1.2em; line-height: 1.8; color: #1e293b; max-width: 1000px; border-left: 4px solid #007d2f; padding-left: 20px; background: #fff; border-radius: 4px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    
    .swagger-ui .opblock-tag { font-size: 1.8em; color: #00237f; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-top: 50px; }
    
    /* BotÃµes Execute */
    .swagger-ui .btn.execute { background-color: #007d2f; border: none; font-weight: 900; padding: 15px 50px; font-size: 1.1em; }
    .swagger-ui .btn.execute:hover { background-color: #a01c21; transform: scale(1.02); }
    
    /* Blocos Operacionais */
    .swagger-ui .opblock.opblock-post { border-radius: 8px; border-color: #007d2f; background: #fff; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #007d2f; }
    .swagger-ui .opblock.opblock-get { border-radius: 8px; border-color: #00237f; background: #fff; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #00237f; }

    .swagger-ui section.models { border-radius: 12px; margin: 60px 0; overflow: hidden; border: 1px solid #e2e8f0; }
    .swagger-ui section.models h4 { background: #00237f; color: #fff; padding: 15px 25px; margin: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${url}/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, apikey, ApiKey, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- DOCUMENTAÃ‡ÃƒO SWAGGER ---
    if (path === "/docs") {
      return new Response(SWAGGER_HTML(url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
      });
    }

    if (path === "/openapi.json") {
      return new Response(JSON.stringify(OPENAPI_SPEC), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/asaas/webhook" && request.method === "POST") {
      try {
        if (env.ASAAS_WEBHOOK_TOKEN) {
          const receivedToken = request.headers.get("asaas-access-token") || "";
          if (receivedToken !== env.ASAAS_WEBHOOK_TOKEN) {
            return jsonResponse({ success: false, error: "Token invÃ¡lido" }, 401, corsHeaders);
          }
        }

        const body = await request.json();
        const payment = body.payment;
        if (!payment?.id) {
          return jsonResponse({ success: true, ignored: true, reason: "Evento sem pagamento" }, 200, corsHeaders);
        }

        const studentId = await resolveWebhookStudentId(env, payment);
        if (!studentId) {
          await saveWebhookEvent(env, body, null, "ignored_without_student");
          return jsonResponse({ success: true, ignored: true, reason: "Cadastro nÃ£o identificado" }, 200, corsHeaders);
        }

        await savePaymentFromWebhook(env, payment, studentId, body.event);
        const payments = await listPaymentsByStudent(env, studentId);
        const statusData = calculateFinancialStatusFromPayments(payments);
        await updateRegistrationFinancialSummary(env, studentId, statusData);
        await saveWebhookEvent(env, body, studentId, "processed");

        return jsonResponse({ success: true, received: true, studentId, event: body.event }, 200, corsHeaders);
      } catch (err) {
        console.error("Erro no webhook Asaas:", err);
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    // --- ENDPOINT DE ENFILEIRAMENTO ---
    if (path === "/queue/enqueue" && request.method === "POST") {
      try {
        const { messages } = await request.json();
        if (!Array.isArray(messages)) throw new Error("Mensagens devem ser um array");

        const batchId = crypto.randomUUID().substring(0, 8);
        const timestamp = Date.now();

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const id = crypto.randomUUID();
          // mq:pending:{timestamp}:{batchId}:{index}
          const key = `mq:pending:${timestamp}:${batchId}:${i.toString().padStart(4, '0')}`;
          await env.UBA_STORAGE.put(key, JSON.stringify({
            ...msg,
            enqueuedAt: new Date().toISOString()
          }));
        }

        return new Response(JSON.stringify({ success: true, count: messages.length, batchId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- ENDPOINTS DE GESTÃƒO DE FILA ---
    if (path === "/queue/list" && request.method === "GET") {
      const list = await env.UBA_STORAGE.list({ prefix: "mq:pending:", limit: 100 });
      const items = [];
      for (const key of list.keys) {
        const val = await env.UBA_STORAGE.get(key.name);
        if (val) items.push({ key: key.name, ...JSON.parse(val) });
      }
      const paused = await env.UBA_STORAGE.get("mq:paused") === "true";
      return new Response(JSON.stringify({ success: true, items, paused }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/queue/clear" && request.method === "POST") {
      const list = await env.UBA_STORAGE.list({ prefix: "mq:pending:" });
      for (const key of list.keys) {
        await env.UBA_STORAGE.delete(key.name);
      }
      return new Response(JSON.stringify({ success: true, message: "Fila limpa com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/queue/toggle-pause" && request.method === "POST") {
      const current = await env.UBA_STORAGE.get("mq:paused");
      const next = current === "true" ? "false" : "true";
      await env.UBA_STORAGE.put("mq:paused", next);
      return new Response(JSON.stringify({ success: true, paused: next === "true" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/queue/process" && request.method === "POST") {
      await processQueue(env);
      return new Response(JSON.stringify({ success: true, message: "Processamento da fila disparado manualmente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- ENDPOINT DE GATILHO MANUAL DE AUTOMAÃ‡ÃƒO DE ANIVERSÃRIOS ---
    if (path === "/birthday-automation-trigger" && request.method === "POST") {
      try {
        const count = await processBirthdays(env, true);
        // Tenta processar a fila imediatamente em background apÃ³s enfileirar
        ctx.waitUntil(processQueue(env)); 
        return new Response(JSON.stringify({ success: true, count, message: `Sucesso: ${count} mensagens de aniversÃ¡rio enfileiradas.` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- ENDPOINT DE GATILHO MANUAL DE AUTOMAÃ‡ÃƒO FINANCEIRA ---
    if (path === "/financial-automation-trigger" && request.method === "POST") {
      try {
        const { testDate, testPhone } = await request.json();
        const dateToProcess = testDate || new Date().toISOString().split('T')[0];
        
        console.log(`[Manual Trigger] Processando para data: ${dateToProcess}, Fone: ${testPhone}`);
        
        // Fetch full config to avoid overwriting enabled toggles with undefined
        const configRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_settings/whatsapp?key=${env.FIREBASE_API_KEY}`);
        const configData = await configRes.json();
        const fullConfig = configData.fields || {};
        
        // Se um telefone foi passado, substituÃ­mos temporariamente a config
        if (testPhone) {
           fullConfig.testPhone = { stringValue: testPhone };
           fullConfig.finAutoTestMode = { booleanValue: true };
        }
        
        const count = await processFinancialAutomation(env, dateToProcess, true, fullConfig);
        
        const resultMsg = count > 0 
          ? `Sucesso: ${count} mensagens enviadas para a data ${dateToProcess}.` 
          : `Processado: Nenhuma fatura pendente encontrada para as regras na data ${dateToProcess}.`;

        return new Response(JSON.stringify({ success: true, count, message: resultMsg }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- ENDPOINT DE UPLOAD VIA FORMDATA (usado pelo PublicForm) ---
    if (path === "/images/upload" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const folder = formData.get("folder") || "uploads";

        if (!file || !(file instanceof File)) {
          return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const body = await file.arrayBuffer();

        if (body.byteLength > 5 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Arquivo muito grande (mÃ¡x 5MB)" }), {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const id = `${folder}_${crypto.randomUUID()}`;
        const mime = file.type || "image/jpeg";

        await env.UBA_STORAGE.put(`img:${id}`, body, {
          metadata: { contentType: mime }
        });

        const viewerUrl = `${url.origin}/view/${id}`;
        return new Response(JSON.stringify({ data: { url: viewerUrl }, url: viewerUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("Erro no /images/upload:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- ENDPOINT DE UPLOAD (legado, raw binary) ---
    if (path === "/upload" && request.method === "POST") {
      try {
        const urlParams = new URL(request.url).searchParams;
        const customId = urlParams.get("customId");
        const contentType = request.headers.get("Content-Type") || "image/jpeg";
        const body = await request.arrayBuffer();

        if (body.byteLength > 2 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Imagem muito grande (mÃ¡x 2MB)" }), {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const id = customId || crypto.randomUUID();
        const mime = contentType.split(";")[0] || "image/jpeg";

        await env.UBA_STORAGE.put(`img:${id}`, body, {
          metadata: { contentType: mime }
        });

        const viewerUrl = `${url.origin}/view/${id}`;
        return new Response(JSON.stringify({ url: viewerUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- ENDPOINT DE VISUALIZAÃ‡ÃƒO ---
    if (path.startsWith("/view/")) {
      const id = path.split("/view/")[1];
      const { value, metadata } = await env.UBA_STORAGE.getWithMetadata(`img:${id}`, { type: "arrayBuffer" });

      if (!value) {
        return new Response("Not Found", { status: 404 });
      }

      return new Response(value, {
        headers: {
          "Content-Type": metadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // --- ENDPOINTS ASAAS / FINANCEIRO ---
    if (path.startsWith("/customers-by-cpf/") && request.method === "GET") {
      try {
        const cpf = path.split("/customers-by-cpf/")[1]?.replace(/\D/g, "");
        const customers = await asaasJson(env, `/customers?cpfCnpj=${encodeURIComponent(cpf || "")}`);
        const list = customers.data || [];

        if (!list.length) {
          return jsonResponse({ success: false, error: "Cliente nÃ£o encontrado", customers: [] }, 404, corsHeaders);
        }

        return jsonResponse({ success: true, customer: list[0], customers: list }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/create-payment" && request.method === "POST") {
      try {
        const payload = await request.json();
        const customer = payload.customer || await ensureAsaasCustomer(env, payload);
        const paymentPayload = buildAsaasPaymentPayload(payload, customer);
        const payment = await asaasJson(env, "/payments", {
          method: "POST",
          body: JSON.stringify(paymentPayload)
        });

        const enrichedPayment = await enrichPixPayment(env, payment);
        return jsonResponse({ success: true, payment: enrichedPayment }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/generate-carnet" && request.method === "POST") {
      try {
        const payload = await request.json();
        const customer = payload.customer || await ensureAsaasCustomer(env, payload);
        const payments = await createCarnetPayments(env, payload, customer);
        return jsonResponse({ success: true, payments }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payment-status" && request.method === "GET") {
      try {
        const paymentId = url.searchParams.get("paymentId");
        if (!paymentId) return jsonResponse({ success: false, error: "paymentId obrigatÃ³rio" }, 400, corsHeaders);
        const payment = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`);
        return jsonResponse({ success: true, payment }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/finance/balance" && request.method === "GET") {
      try {
        const balance = await asaasJson(env, "/finance/balance");
        return jsonResponse({ success: true, ...balance }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payments" && request.method === "GET") {
      try {
        const paymentList = await asaasJson(env, `/payments${url.search || ""}`);
        return jsonResponse(paymentList, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path.startsWith("/payments/")) {
      try {
        const parts = path.split("/").filter(Boolean);
        const paymentId = parts[1];
        const action = parts[2];

        if (!paymentId) {
          return jsonResponse({ success: false, error: "ID da fatura obrigatÃ³rio" }, 400, corsHeaders);
        }

        if (action === "receive-in-cash" && request.method === "POST") {
          const body = await request.json();
          const paid = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}/receiveInCash`, {
            method: "POST",
            body: JSON.stringify({
              paymentDate: body.paymentDate || new Date().toISOString().split("T")[0],
              value: normalizeCurrencyValue(body.value),
              notifyCustomer: body.notify === true
            })
          });
          return jsonResponse({ success: true, payment: paid }, 200, corsHeaders);
        }

        if (request.method === "GET") {
          const payment = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`);
          return jsonResponse({ success: true, payment }, 200, corsHeaders);
        }

        if (request.method === "PUT") {
          const body = await request.json();
          const updated = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`, {
            method: "PUT",
            body: JSON.stringify(normalizePaymentUpdate(body))
          });
          return jsonResponse({ success: true, payment: updated }, 200, corsHeaders);
        }

        if (request.method === "DELETE") {
          const deleted = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`, {
            method: "DELETE"
          });
          return jsonResponse({ success: true, deleted }, 200, corsHeaders);
        }
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    // --- PROXY PARA EVOLUTION API ---
    try {
      let targetUrl = `${EVOLUTION_URL}${path}`;
      if (path === "/send") targetUrl = `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`;

      const headers = new Headers();
      headers.set("apikey", env.EVOLUTION_API_KEY || request.headers.get("apikey") || "");
      headers.set("Content-Type", "application/json");

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: METHODS_WITH_BODY.has(request.method) ? await request.text() : undefined,
      });

      // Se a resposta for JSON, vamos tentar garantir que chegue limpa
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        return new Response(JSON.stringify(json), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Para outros tipos (ou se falhar o json), respondemos o original mas sem compressÃ£o forÃ§ada
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers: { 
          ...corsHeaders, 
          "Content-Type": contentType || "application/json" 
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy Error: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },

  // --- PROCESSADOR DE FILA E AUTOMAÃ‡ÃƒO (CRON) ---
  async scheduled(event, env, ctx) {
    // 1. Processa Fila de Mensagens Pendentes (Cron a cada 1 min)
    await processQueue(env);
    
    // 2. Processa AutomaÃ§Ã£o de AniversÃ¡rios
    await processBirthdays(env);

    // 3. Processa AutomaÃ§Ã£o Financeira (CobranÃ§as)
    await handleFinancialAutomationFlow(env);
  }
};

/**
 * Gerencia o fluxo da automaÃ§Ã£o financeira (DiÃ¡rio + Agendamento de Teste)
 */
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function asaasJson(env, path, options = {}) {
  const apiKey = env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY nÃ£o configurada no Worker.");

  const response = await fetch(`${ASAAS_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Arena-Simonesia-System/1.0",
      "access_token": apiKey,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { raw: text };
  }

  if (!response.ok) {
    const msg = data.errors?.[0]?.description || data.error || data.message || `Asaas retornou ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

function normalizeCurrencyValue(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return number > 1000 ? Math.round(number) / 100 : number;
}

function normalizePaymentUpdate(body) {
  const update = { ...body };
  if (update.amount !== undefined && update.value === undefined) {
    update.value = normalizeCurrencyValue(update.amount);
    delete update.amount;
  }
  if (update.value !== undefined) update.value = normalizeCurrencyValue(update.value);
  return update;
}

function normalizePhone(phone) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return undefined;
  return clean.length > 11 && clean.startsWith("55") ? clean.substring(2) : clean;
}

async function ensureAsaasCustomer(env, payload) {
  const cpf = String(payload.responsibleCpf || payload.cpf || "").replace(/\D/g, "");
  if (cpf) {
    const existing = await asaasJson(env, `/customers?cpfCnpj=${encodeURIComponent(cpf)}`);
    if (existing.data?.[0]?.id) return existing.data[0].id;
  }

  const customer = await asaasJson(env, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: payload.responsibleName || payload.name || "Respons\u00e1vel Arena Simon\u00e9sia",
      cpfCnpj: cpf || undefined,
      email: payload.responsibleEmail || payload.email || undefined,
      mobilePhone: normalizePhone(payload.responsiblePhone || payload.phone),
      notificationDisabled: true
    })
  });

  return customer.id;
}

function buildAsaasPaymentPayload(payload, customer) {
  const payment = {
    customer,
    billingType: payload.billingType || "PIX",
    value: normalizeCurrencyValue(payload.amount ?? payload.value),
    dueDate: payload.dueDate || new Date().toISOString().split("T")[0],
    description: payload.description || "Cobran\u00e7a Arena Simon\u00e9sia",
    externalReference: payload.externalReference || payload.registrationId || undefined
  };

  if (payload.discount) payment.discount = payload.discount;
  if (payload.fine) payment.fine = payload.fine;
  if (payload.interest) payment.interest = payload.interest;
  if (payload.installmentCount) payment.installmentCount = payload.installmentCount;
  if (payload.installmentValue) payment.installmentValue = normalizeCurrencyValue(payload.installmentValue);

  return payment;
}

async function enrichPixPayment(env, payment) {
  if (!payment?.id || !["PIX", "BOLETO"].includes(payment.billingType)) return payment;

  try {
    const qr = await asaasJson(env, `/payments/${encodeURIComponent(payment.id)}/pixQrCode`);
    return {
      ...payment,
      pixQrCode: qr.payload || payment.pixQrCode,
      pixQrCodeUrl: qr.encodedImage || payment.pixQrCodeUrl
    };
  } catch (err) {
    return payment;
  }
}

async function createCarnetPayments(env, payload, customer) {
  const payments = [];
  const childName = payload.childName ? ` - ${payload.childName}` : "";
  const modality = payload.modalidade ? ` (${payload.modalidade})` : "";
  const paymentDay = Number(payload.paymentDay || 10);
  const today = new Date();
  const minDueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const formatDueDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const safeDueDate = (monthOffset = 0) => {
    const planned = new Date(minDueDate.getFullYear(), minDueDate.getMonth() + monthOffset, Math.min(paymentDay, 28));
    return planned < minDueDate ? new Date(minDueDate) : planned;
  };

  if (payload.matriculaValue && Number(payload.matriculaValue) > 0) {
    const dueDate = new Date(minDueDate);
    const payment = await asaasJson(env, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer,
        billingType: payload.billingType || "PIX",
        value: normalizeCurrencyValue(payload.matriculaValue),
        dueDate: formatDueDate(dueDate),
        description: `MatrÃ­cula${childName}${modality}`,
        externalReference: `${payload.registrationId || "UBA"}_MATRICULA_${Date.now()}`
      })
    });
    payments.push(await enrichPixPayment(env, payment));
  }

  const mensalidadeValue = Number(payload.mensalidadeValue || 0);
  if (mensalidadeValue > 0) {
    for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
      const dueDate = safeDueDate(monthOffset);
      const monthLabel = dueDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      const payment = await asaasJson(env, "/payments", {
        method: "POST",
        body: JSON.stringify({
          customer,
          billingType: payload.billingType || "PIX",
          value: normalizeCurrencyValue(mensalidadeValue),
          dueDate: formatDueDate(dueDate),
          description: `Mensalidade ${monthLabel}${childName}${modality}`,
          externalReference: `${payload.registrationId || "UBA"}_${monthOffset + 1}_${Date.now()}`
        })
      });
      payments.push(await enrichPixPayment(env, payment));
    }
  }

  return payments;
}

async function handleFinancialAutomationFlow(env) {
  try {
    const configRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_settings/whatsapp?key=${env.FIREBASE_API_KEY}`);
    if (!configRes.ok) return;
    const configDoc = await configRes.json();
    const f = configDoc.fields || {};

    const now = new Date();
    const spTime = new Date(now.getTime() - 3 * 3600 * 1000); // UTC-3
    const todayStr = spTime.toISOString().split('T')[0];
    const currentTimeStr = spTime.toISOString().split('T')[1].substring(0, 5);

    // 1. Processamento DiÃ¡rio (respeitando finAutoSendTime)
    const sendTime = f.finAutoSendTime?.stringValue || "09:00";
    const lastDailyRun = await env.UBA_STORAGE.get(`fin_daily_run:${todayStr}`);
    
    if (currentTimeStr >= sendTime && !lastDailyRun) {
      await processFinancialAutomation(env, todayStr, false, f);
      await env.UBA_STORAGE.put(`fin_daily_run:${todayStr}`, "done");
    }

    // 2. Processamento de Teste Agendado
    const testDate = f.finAutoTestDate?.stringValue || "";
    const testTime = f.finAutoTestTime?.stringValue || "";
    const lastTestSentAt = f.finAutoTestSentAt?.stringValue || ""; // "YYYY-MM-DDTHH:MM..."
    
    if (testDate && testTime) {
      // Usamos uma chave composta para o agendamento
      const scheduleId = `${testDate}_${testTime}`;
      
      // Se jÃ¡ passou do horÃ¡rio do teste (naquele dia simulado ou hoje) 
      // e ainda nÃ£o marcamos como enviado PARA ESSE ID ESPECÃFICO
      if (currentTimeStr >= testTime && lastTestSentAt !== scheduleId) {
        console.log(`Executando teste agendado de automaÃ§Ã£o para data simulada: ${testDate}`);
        const count = await processFinancialAutomation(env, testDate, true, f);
        
        const resultMsg = count > 0 
          ? `Sucesso: ${count} mensagens enviadas para a data ${testDate}.` 
          : `Processado: Nenhuma fatura pendente encontrada para as regras na data ${testDate}.`;

        // Atualiza Firestore para avisar a UI que enviou e marcar como concluÃ­do
        await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_settings/whatsapp?key=${env.FIREBASE_API_KEY}&updateMask.fieldPaths=finAutoTestSentAt&updateMask.fieldPaths=finAutoTestResult`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { 
              finAutoTestSentAt: { stringValue: scheduleId },
              finAutoTestResult: { stringValue: resultMsg }
            }
          })
        });
      }
    }
  } catch (e) {
    console.error("Erro no fluxo financeiro:", e);
  }
}

/**
 * AutomaÃ§Ã£o de CobranÃ§as Financeiras (LÃ³gica Core)
 */
async function processFinancialAutomation(env, virtualTodayStr, isTestForce = false, configFields = null) {
  // Helper para normalizar datas (suporta YYYY-MM-DD e DD/MM/YYYY)
  const parseDate = (dStr) => {
    if (!dStr) return null;
    if (dStr.includes('/')) {
      const [d, m, y] = dStr.split('/');
      return new Date(`${y}-${m}-${d}T12:00:00`);
    }
    return new Date(dStr + 'T12:00:00');
  };

  try {
    // 1. Carrega ConfiguraÃ§Ãµes (se nÃ£o passadas)
    let f = configFields;
    if (!f) {
      const configRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_settings/whatsapp?key=${env.FIREBASE_API_KEY}`);
      if (!configRes.ok) return 0;
      const configDoc = await configRes.json();
      f = configDoc.fields || {};
    }

    const beforeEnabled = f.finAutoBeforeEnabled?.booleanValue || false;
    const beforeDays = parseInt(f.finAutoBeforeDays?.integerValue || "3");
    const onDayEnabled = f.finAutoOnDayEnabled?.booleanValue || false;
    const afterEnabled = f.finAutoAfterEnabled?.booleanValue || false;
    const afterDays = parseInt(f.finAutoAfterDays?.integerValue || "5");
    const testMode = isTestForce || (f.finAutoTestMode?.booleanValue || false);
    const testPhone = f.testPhone?.stringValue || "5533998200546";
    const pendingImageUrl = f.pendingImageUrl?.stringValue || "";

    if (!beforeEnabled && !onDayEnabled && !afterEnabled) return 0;
    console.log(`[Financeiro] Iniciando Processamento. VirtualToday: ${virtualTodayStr}, TestForce: ${isTestForce}`);

    // 2. Busca todos os pagamentos PENDENTES E ATRASADOS usando runQuery
    const paymentsQuery = {
      structuredQuery: {
        from: [{ collectionId: 'financial_payments' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'IN',
            value: {
              arrayValue: {
                values: [ { stringValue: 'PENDING' }, { stringValue: 'OVERDUE' } ]
              }
            }
          }
        },
        limit: 1000
      }
    };

    const payRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentsQuery)
    });

    if (!payRes.ok) {
       console.error("[Financeiro] Erro ao buscar pagamentos:", await payRes.text());
       return 0;
    }
    const payData = await payRes.json();
    
    // Filtra pagamentos que batem com as datas
    const activePayments = [];
    for (const item of payData) {
      if (!item.document) continue;
      const doc = item.document;
      const fields = doc.fields || {};
      const dueDateStr = fields.dueDate?.stringValue || "";
      const studentId = fields.studentId?.stringValue || "";
      const invoiceUrl = fields.invoiceUrl?.stringValue || "";
      const description = fields.description?.stringValue || "Mensalidade";
      
      if (!dueDateStr || !studentId) continue;

      const due = parseDate(dueDateStr);
      const today = parseDate(virtualTodayStr);
      if (!due || isNaN(due.getTime()) || !today || isNaN(today.getTime())) continue;

      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let ruleMatched = null;
      if (diffDays <= beforeDays && diffDays > 0 && beforeEnabled) ruleMatched = "BEFORE";
      else if (diffDays === 0 && onDayEnabled) ruleMatched = "ONDAY";
      else if (diffDays <= -afterDays && diffDays < 0 && afterEnabled) ruleMatched = "AFTER";

      if (ruleMatched) {
         activePayments.push({
           paymentId: doc.name.split('/').pop(),
           studentId,
           dueDateStr,
           invoiceUrl,
           description,
           ruleMatched,
           diffDays // info extra (opcional)
         });
      }
    }

    if (activePayments.length === 0) {
      console.log(`[Financeiro] Nenhuma fatura bateu com as regras de ${virtualTodayStr}.`);
      return 0;
    }

    console.log(`[Financeiro] ${activePayments.length} faturas prontas para disparo.`);
    
    let toProcess = activePayments;
    if (isTestForce && activePayments.length > 5) {
      console.log(`[Financeiro] Modo teste ativo: limitando disparo para 5 (de ${activePayments.length} faturas) para evitar SPAM no nÃºmero teste.`);
      toProcess = activePayments.slice(0, 5);
    }

    // 3. Busca InformaÃ§Ãµes das MatrÃ­culas para pegar telefone e nome
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/arena_simonesia_2026_registrations?key=${env.FIREBASE_API_KEY}&pageSize=500`);
    if (!res.ok) return 0;
    const data = await res.json();
    const docs = data.documents || [];
    
    const studentsMap = {};
    for (const d of docs) {
      const id = d.name.split('/').pop();
      studentsMap[id] = d.fields || {};
    }

    let countSent = 0;

    for (const p of toProcess) {
      const studentFields = studentsMap[p.studentId];
      if (!studentFields) continue; // Aluno nÃ£o encontrado (pode estar na paginaÃ§Ã£o seguinte se houver +500)

      const phoneRaw = studentFields.responsavel?.mapValue?.fields?.telefonePrincipal?.stringValue || "";
      let studentName = studentFields.alunos?.arrayValue?.values?.[0]?.mapValue?.fields?.nome?.stringValue || "Aluno";
      const contractStatus = studentFields.contractStatus?.stringValue || "pendente";
      
      // Limpeza basica de nome (opcional)
      studentName = studentName.trim().split(' ')[0];

      // Ignora alunos de fato cancelados/removidos, mas mantem "aprovado" ou "pendente" (pagamentos antigos)
      if (contractStatus === 'cancelado') continue;
      if (!phoneRaw) continue;

      // Controle de duplicidade (KV) -> A key em produÃ§Ã£o NÃƒO leva a data virtual, para que evite o duplo envio de "AFTER"
      const kvKey = isTestForce 
        ? `fin_test_sent:${p.paymentId}:${p.ruleMatched}:${virtualTodayStr}`
        : `fin_sent:${p.paymentId}:${p.ruleMatched}`;
        
      const alreadySent = await env.UBA_STORAGE.get(kvKey);
      if (alreadySent && !isTestForce) continue; 

      // DestinatÃ¡rio
      let phone = phoneRaw.replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;
      if (testMode) phone = testPhone;

      // Texto da Mensagem
      let message = "";
      const manualMsg = "\n\nPara regularizar seu pagamento, por favor, entre em contato via WhatsApp com a secretaria da Arena Simon\u00e9sia ou utilize a Chave PIX da escola.";
      const paymentInfo = p.invoiceUrl ? "" : manualMsg;

      if (p.ruleMatched === "BEFORE") {
        message = `Olá! Passando para lembrar que a cobrança de *${p.description}* do(a) aluno(a) *${studentName}* vence em breve (dia ${p.dueDateStr.split('-').reverse().join('/')}).${paymentInfo}\n\nObrigado por fortalecer nosso esporte!`;
      } else if (p.ruleMatched === "ONDAY") {
        message = `Informamos que hoje é o vencimento da cobrança (*${p.description}*) do(a) aluno(a) *${studentName}*.\n\nCaso já tenha efetuado o pagamento, desconsidere este aviso.${paymentInfo}`;
      } else if (p.ruleMatched === "AFTER") {
        const diasAtraso = Math.abs(p.diffDays);
        message = `Olá! Consta em nosso sistema que a cobrança (*${p.description}*) do(a) aluno(a) *${studentName}* está vencida há ${diasAtraso} dias (vencimento em ${p.dueDateStr.split('-').reverse().join('/')}).${paymentInfo}\n\nSe o pagamento já foi feito, favor nos enviar o comprovante.`;
      }

      const msgPayload = {
        phone: phone,
        text: message,
        imageUrl: pendingImageUrl, // Opcional, mantido das regras
        alunoNome: studentName
      };

      if (p.invoiceUrl) {
        msgPayload.buttons = [
          {
            type: 'url',
            displayText: 'Pagar Agora',
            url: p.invoiceUrl
          }
        ];
      }

      try {
        await queueMessage(msgPayload, env);
        await env.UBA_STORAGE.put(kvKey, "true", { expirationTtl: 86400 * 30 }); // Protege por 30 dias na chave
        countSent++;
      } catch (e) {
        console.error(`Erro ao enfileirar fin auto para ${studentName}:`, e);
      }
    }
    console.log(`[Financeiro] Finalizado. Total de cobranÃ§as enviadas para o teste/fluxo atual: ${countSent} / ${activePayments.length} detectadas.`);
    return countSent;
  } catch (err) {
    console.error("Erro na automaÃ§Ã£o financeira:", err);
    return 0;
  }
}

/**
 * Processa mensagens na fila KV
 */
async function processQueue(env) {
  const isPaused = await env.UBA_STORAGE.get("mq:paused") === "true";
  if (isPaused) {
    console.log("[Queue] Processamento pausado manualmente.");
    return;
  }

  const list = await env.UBA_STORAGE.list({ prefix: "mq:pending:", limit: 20 });
  if (list.keys.length === 0) return;

  for (const key of list.keys) {
    const msgData = await env.UBA_STORAGE.get(key.name);
    if (!msgData) continue;

    const msg = JSON.parse(msgData);
    
    try {
      const result = await processMessage(msg, env);
      await logToFirestore(msg, result, env);
      await env.UBA_STORAGE.delete(key.name);
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.error(`Erro ao processar ${key.name}:`, err);
    }
  }
}

/**
 * AutomaÃ§Ã£o DiÃ¡ria de AniversÃ¡rios
 */
async function processBirthdays(env, force = false) {
  try {
    // 1. Carrega ConfiguraÃ§Ãµes do Firestore via REST
    const configRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_settings/whatsapp?key=${env.FIREBASE_API_KEY}`);
    if (!configRes.ok) return;
    const configDoc = await configRes.json();
    const fields = configDoc.fields || {};
    
    const enabled = fields.birthdayAutomationEnabled?.booleanValue || false;
    const sendTime = fields.birthdaySendTime?.stringValue || "09:00";
    const defaultImage = fields.birthdayDefaultImage?.stringValue || "";
    const testMode = fields.birthdayAutomationTestMode?.booleanValue || false;
    const testPhone = fields.testPhone?.stringValue || "5533998200546";
    
    if (!enabled) return;

    // 2. Checa HorÃ¡rio (America/Sao_Paulo)
    const now = new Date();
    const spTime = new Date(now.getTime() - 3 * 3600 * 1000); // UTC-3
    const todayStr = spTime.toISOString().split('T')[0]; // "2026-03-21"
    const currentTimeStr = spTime.toISOString().split('T')[1].substring(0, 5); // "09:01"

    // 3. Evita re-execuÃ§Ã£o no mesmo dia (A menos que seja force)
    const lastRun = await env.UBA_STORAGE.get("last_birthday_run");
    if (lastRun === todayStr && !force) return 0;

    // 4. Se chegou o horÃ¡rio (A menos que seja force)
    if (currentTimeStr >= sendTime || force) {
      console.log(`Iniciando automaÃ§Ã£o de aniversÃ¡rios para ${todayStr}... (Modo Teste: ${testMode}, Force: ${force})`);
      if (!force) await env.UBA_STORAGE.put("last_birthday_run", todayStr); // Marca como rodado apenas no fluxo auto

      // 5. Busca todos os alunos (limitando a 300 registros para seguranÃ§a)
      const registrationsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/arena_simonesia_2026_registrations?key=${env.FIREBASE_API_KEY}&pageSize=300`);
      if (!registrationsRes.ok) return;
      const registrations = await registrationsRes.json();
      
      const bdayStudents = [];
      const [todayDay, todayMonth] = [spTime.getDate(), spTime.getMonth() + 1];

      (registrations.documents || []).forEach(doc => {
        const docFields = doc.fields || {};
        const alunos = docFields.alunos?.arrayValue?.values || [];
        const phone = docFields.responsavel?.mapValue?.fields?.telefonePrincipal?.stringValue || "";
        const id = doc.name.split('/').pop();
        
        alunos.forEach((alunoVal, idx) => {
          const aluno = alunoVal.mapValue?.fields || {};
          const bdayStr = aluno.dataNascimento?.stringValue; // "DD/MM/YYYY"
          if (bdayStr && phone) {
            const [d, m] = bdayStr.split('/');
            if (parseInt(d) === todayDay && parseInt(m) === todayMonth) {
              bdayStudents.push({
                id: `${id}-${idx}`,
                name: aluno.nome?.stringValue || "Aluno",
                phone: phone,
                photoUrl: aluno.fotoUrl?.stringValue || ""
              });
            }
          }
        });
      });

      console.log(`Encontrados ${bdayStudents.length} aniversariantes hoje.`);

      // 6. Dispara Mensagens
      const workerUrl = "https://arenasimonesia-whatsapp-proxy.thayrufino2.workers.dev";
      
      for (const student of bdayStudents) {
        const firstName = student.name.split(' ')[0];
        const baseText = `Parab\u00e9ns ${firstName}!\n\nA Arena Simon\u00e9sia deseja a voc\u00ea um dia repleto de alegria, sa\u00fade e muitas conquistas. Que este novo ciclo seja brilhante!\n\nFeliz anivers\u00e1rio!`;
        
        const destino = testMode ? testPhone : student.phone;
        const textoFinal = testMode 
          ? `*[MODO TESTE AUTOM\u00c1TICO]*\n_Destinat\u00e1rio original: ${student.phone}_\n\n${baseText}`
          : baseText;

        // Tenta localizar o cartÃ£o prÃ©-renderizado (enviado pelo frontend)
        const customCardId = `bday_card_${student.id.replace(/-/g, '_')}`;
        const hasCustom = await env.UBA_STORAGE.get(`img:${customCardId}`);
        
        // Determina a imagem final (Precedence: Custom Card -> Student Photo -> Default Image)
        let finalImageUrl = defaultImage;
        if (hasCustom) {
          finalImageUrl = `${workerUrl}/view/${customCardId}`;
        } else if (student.photoUrl) {
          finalImageUrl = student.photoUrl;
        }

        const msg = {
          phone: destino,
          text: textoFinal,
          imageUrl: finalImageUrl,
          alunoNome: student.name,
          alunoFotoUrl: student.photoUrl
        };

        try {
          await queueMessage(msg, env);
        } catch (e) {
          console.error(`Erro ao enfileirar bday para ${student.name}:`, e);
        }
      }
    }
  } catch (err) {
    console.error("Erro na automaÃ§Ã£o de aniversÃ¡rios:", err);
  }
}

/**
 * Enfileira uma mensagem no KV
 */
async function queueMessage(msg, env) {
  const timestamp = Date.now();
  const random = crypto.randomUUID().substring(0, 8);
  const key = `mq:pending:${timestamp}:${random}`;
  await env.UBA_STORAGE.put(key, JSON.stringify({
    ...msg,
    enqueuedAt: new Date().toISOString()
  }));
}

/**
 * Envia a mensagem usando a Evolution API
 */
async function processMessage(msg, env) {
  const isMedia = !!msg.imageUrl;
  const hasButtons = Array.isArray(msg.buttons) && msg.buttons.length > 0;
  
  // Se tiver botÃµes (URL de pagamento), vamos incorporar no texto de forma bonita
  // pois os botÃµes nativos estÃ£o falhando na renderizaÃ§Ã£o do WhatsApp MD
  let finalMessage = msg.text;
  if (hasButtons) {
    const payBtn = msg.buttons.find(b => b.type === 'url');
    if (payBtn) {
      finalMessage += `\n\n*Clique no link abaixo para pagar:*\n${payBtn.url}\n\n_Se precisar de ajuda, estamos aqui!_`;
    }
  }

  const endpoint = isMedia ? `/message/sendMedia/${INSTANCE_NAME}` : `/message/sendText/${INSTANCE_NAME}`;
  const url = `${EVOLUTION_URL}${endpoint}`;

  let payload = {
    number: msg.phone,
    delay: 1500,
    options: { delay: 1500, presence: "composing", linkPreview: true }
  };

  if (isMedia) {
    let mediaContent = msg.imageUrl;
    let mimeType = 'image/png';

    // Se for uma URL (comeÃ§a com http), tentamos converter para Base64 para garantir que a Evolution API receba
    if (msg.imageUrl.startsWith('http')) {
      try {
        const b64res = await getBase64FromUrl(msg.imageUrl);
        mediaContent = b64res.base64;
        mimeType = b64res.mimeType;
      } catch (err) {
        console.error("[Worker] Erro ao converter imagem para base64:", err);
        // Mantemos a URL original se falhar
      }
    }

    payload.mediatype = 'image';
    payload.mediaType = 'image';
    payload.mimetype = mimeType;
    payload.caption = finalMessage;
    payload.media = mediaContent;
  } else {
    payload.text = finalMessage;
    payload.linkPreview = true;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.EVOLUTION_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let jsonResponse = {};
  try {
    jsonResponse = JSON.parse(text);
  } catch (e) {
    jsonResponse = { raw: text };
  }

  console.log(`[Evolution] Result: ${res.ok ? 'SUCESSO' : 'ERRO'} | Body: ${text.substring(0, 100)}`);

  return {
    success: res.ok,
    status: res.ok ? 'SUCESSO' : 'ERRO',
    response: jsonResponse
  };
}

/**
 * FunÃ§Ã£o auxiliar para converter URL em Base64 dentro do Worker
 */
async function getBase64FromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar imagem: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  
  // Usamos um loop para evitar erro de "Maximum call stack size exceeded" 
  // que ocorre com o spread operator (...) em arquivos grandes.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return { base64, mimeType: contentType };
}

/**
 * Salva log no Firestore via REST API
 */
async function logToFirestore(msg, result, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const apiKey = env.FIREBASE_API_KEY;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsapp_logs?key=${apiKey}`;

  const fields = {
    destinatario: { stringValue: msg.phone },
    mensagem: { stringValue: msg.text },
    status: { stringValue: result.status },
    dataHora: { stringValue: new Date().toISOString() },
    tipo: { stringValue: msg.imageUrl ? 'MEDIA' : 'TEXTO' }
  };

  if (msg.name) fields.alunoNome = { stringValue: msg.name };
  if (msg.photoUrl) fields.alunoFotoUrl = { stringValue: msg.photoUrl };
  
  const responseStr = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
  if (!result.success) fields.erro = { stringValue: responseStr.substring(0, 1000) };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
}

function firestoreBaseUrl(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, toFirestoreValue(item)])
        )
      }
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)])
    );
  }
  return undefined;
}

function firestoreDocumentToObject(doc) {
  if (!doc?.fields) return null;
  const data = Object.fromEntries(
    Object.entries(doc.fields).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
  return { id: doc.name.split("/").pop(), ...data };
}

async function getFirestoreDocument(env, collectionId, documentId) {
  const res = await fetch(`${firestoreBaseUrl(env)}/${collectionId}/${encodeURIComponent(documentId)}?key=${env.FIREBASE_API_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET falhou: ${res.status}`);
  return firestoreDocumentToObject(await res.json());
}

async function patchFirestoreDocument(env, collectionId, documentId, data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  const masks = entries.map(([key]) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
  const url = `${firestoreBaseUrl(env)}/${collectionId}/${encodeURIComponent(documentId)}?key=${env.FIREBASE_API_KEY}${masks ? `&${masks}` : ""}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(entries.map(([key, value]) => [key, toFirestoreValue(value)]))
    })
  });
  if (!res.ok) throw new Error(`Firestore PATCH falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

async function addFirestoreDocument(env, collectionId, data) {
  const res = await fetch(`${firestoreBaseUrl(env)}/${collectionId}?key=${env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]))
    })
  });
  if (!res.ok) throw new Error(`Firestore POST falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

async function runFirestoreQuery(env, structuredQuery) {
  const res = await fetch(`${firestoreBaseUrl(env)}:runQuery?key=${env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) throw new Error(`Firestore runQuery falhou: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.filter(item => item.document).map(item => firestoreDocumentToObject(item.document));
}

function inferRegistrationIdFromExternalReference(externalReference) {
  if (!externalReference || typeof externalReference !== "string") return "";
  if (externalReference.startsWith("MANUAL_") || externalReference.startsWith("ADJUSTED_") || externalReference.startsWith("EDITED_")) return "";

  const parts = externalReference.split("_");
  const last = parts[parts.length - 1];
  if (/^\d{10,}$/.test(last)) parts.pop();
  const marker = parts[parts.length - 1];
  if (marker === "MATRICULA" || /^\d+$/.test(marker)) parts.pop();
  return parts.join("_");
}

async function resolveWebhookStudentId(env, payment) {
  const existing = await getFirestoreDocument(env, FINANCIAL_PAYMENTS_COLLECTION, payment.id);
  if (existing?.studentId) return existing.studentId;

  const inferredId = inferRegistrationIdFromExternalReference(payment.externalReference);
  if (inferredId) {
    const registration = await getFirestoreDocument(env, REGISTRATIONS_COLLECTION, inferredId);
    if (registration) return inferredId;
  }

  return "";
}

async function savePaymentFromWebhook(env, payment, studentId, event) {
  const status = event === "PAYMENT_DELETED" ? "DELETED" : (payment.status || "UNKNOWN");
  const dataToSave = {
    id: payment.id,
    studentId,
    customer: payment.customer || payment.customerId || null,
    value: payment.value || 0,
    netValue: payment.netValue || 0,
    dueDate: payment.dueDate || null,
    status,
    description: payment.description || "",
    billingType: payment.billingType || null,
    invoiceUrl: payment.invoiceUrl || null,
    externalReference: payment.externalReference || null,
    discount: payment.discount || null,
    fine: payment.fine || null,
    interest: payment.interest || null,
    originalValue: payment.originalValue || null,
    dateCreated: payment.dateCreated || new Date().toISOString(),
    paymentDate: payment.paymentDate || payment.clientPaymentDate || null,
    clientPaymentDate: payment.clientPaymentDate || null,
    webhookEvent: event || null,
    lastUpdate: new Date().toISOString()
  };

  await patchFirestoreDocument(env, FINANCIAL_PAYMENTS_COLLECTION, payment.id, dataToSave);
}

async function listPaymentsByStudent(env, studentId) {
  return runFirestoreQuery(env, {
    from: [{ collectionId: FINANCIAL_PAYMENTS_COLLECTION }],
    where: {
      fieldFilter: {
        field: { fieldPath: "studentId" },
        op: "EQUAL",
        value: { stringValue: studentId }
      }
    },
    limit: 500
  });
}

function calculateFinancialStatusFromPayments(payments) {
  const activePayments = payments.filter(p => !["DELETED", "REFUNDED", "REMOVED_BY_RECEIVER"].includes(p.status));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const paidStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DONE"];

  const isManual = (p) => {
    const desc = (p.description || "").toLowerCase();
    return p.externalReference?.startsWith("MANUAL_") || desc.includes("uniforme") || desc.includes("kit");
  };

  const overdue = activePayments.filter(p => {
    const due = new Date(`${p.dueDate}T00:00:00`);
    return !paidStatuses.includes(p.status) && due < now && !isManual(p);
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const pending = activePayments.filter(p => {
    const due = new Date(`${p.dueDate}T00:00:00`);
    return !paidStatuses.includes(p.status) && due >= now && !isManual(p);
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  let status = "vazio";
  if (activePayments.length > 0) {
    const hasUnpaidCurrentMonth = pending.some(p => new Date(`${p.dueDate}T00:00:00`) <= endOfMonth);
    if (overdue.length > 0) status = "atrasado";
    else if (hasUnpaidCurrentMonth) status = "pendente";
    else status = "pago";
  }

  let financialPendingAmount = 0;
  let financialPendingDescription = "EM DIA";
  let financialInvoiceUrl = "";
  let financialDueDate = "";

  if (status === "atrasado") {
    financialPendingAmount = overdue.reduce((sum, p) => sum + (p.value || 0), 0);
    const months = overdue.map(p => new Date(`${p.dueDate}T00:00:00`).toLocaleDateString("pt-BR", { month: "short" }).toUpperCase().replace(".", ""));
    financialPendingDescription = `${overdue.length > 1 ? "MÃšM?LTIPLOS ATRASOS" : "ATRASADO"}: ${[...new Set(months)].join(", ")}`;
    financialInvoiceUrl = overdue[0]?.invoiceUrl || "";
    financialDueDate = overdue[0]?.dueDate || "";
  } else if (status === "pendente") {
    const currentMonthPending = pending.filter(p => new Date(`${p.dueDate}T00:00:00`) <= endOfMonth);
    financialPendingAmount = currentMonthPending.reduce((sum, p) => sum + (p.value || 0), 0);
    if (currentMonthPending.length > 1) {
      financialPendingDescription = `${currentMonthPending.length} FATURAS (${new Date(currentMonthPending[0].dueDate).toLocaleDateString("pt-BR", { month: "2-digit" })})`;
    } else {
      const next = currentMonthPending[0];
      financialPendingDescription = `${next?.description || "Fatura"} (${new Date(next?.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})`;
    }
    financialInvoiceUrl = currentMonthPending[0]?.invoiceUrl || "";
    financialDueDate = currentMonthPending[0]?.dueDate || "";
  } else if (status === "vazio") {
    financialPendingDescription = "Sem cobranÃ§a cadastrada";
  } else if (status === "pago") {
    financialPendingDescription = "Em dia";
  }

  const receivedPayments = activePayments.filter(p => paidStatuses.includes(p.status));
  const financialReceivedAmount = receivedPayments.reduce((sum, p) => sum + (p.value || 0), 0);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastYear = lastMonthDate.getFullYear();
  const lastMonth = lastMonthDate.getMonth();

  const isMonth = (dateStr, year, month) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T00:00:00`);
    return d.getFullYear() === year && d.getMonth() === month;
  };

  const financialReceivedThisMonth = receivedPayments
    .filter(p => isMonth(p.paymentDate || p.clientPaymentDate || p.dueDate, currentYear, currentMonth))
    .reduce((sum, p) => sum + (p.value || 0), 0);
  const financialReceivedLastMonth = receivedPayments
    .filter(p => isMonth(p.paymentDate || p.clientPaymentDate || p.dueDate, lastYear, lastMonth))
    .reduce((sum, p) => sum + (p.value || 0), 0);

  const unpaid = activePayments.filter(p => !paidStatuses.includes(p.status) && !isManual(p));
  const financialPendingThisMonth = unpaid
    .filter(p => isMonth(p.dueDate, currentYear, currentMonth))
    .reduce((sum, p) => sum + (p.value || 0), 0);
  const financialPendingLastMonth = unpaid
    .filter(p => isMonth(p.dueDate, lastYear, lastMonth))
    .reduce((sum, p) => sum + (p.value || 0), 0);

  const lastPayment = receivedPayments.sort((a, b) =>
    new Date(b.paymentDate || b.clientPaymentDate || b.dueDate).getTime() -
    new Date(a.paymentDate || a.clientPaymentDate || a.dueDate).getTime()
  )[0];

  return {
    status,
    financialPendingAmount,
    financialPendingDescription,
    financialInvoiceUrl,
    financialDueDate,
    financialReceivedAmount,
    financialReceivedThisMonth,
    financialReceivedLastMonth,
    financialPendingThisMonth,
    financialPendingLastMonth,
    financialLastPaymentValue: lastPayment ? (lastPayment.value || 0) : 0,
    lastWebhookSync: new Date().toISOString()
  };
}

async function updateRegistrationFinancialSummary(env, studentId, statusData) {
  await patchFirestoreDocument(env, REGISTRATIONS_COLLECTION, studentId, statusData);
}

async function saveWebhookEvent(env, payload, studentId, status) {
  await addFirestoreDocument(env, "asaas_webhook_events", {
    event: payload.event || "",
    paymentId: payload.payment?.id || "",
    studentId: studentId || "",
    status,
    receivedAt: new Date().toISOString()
  });
}

