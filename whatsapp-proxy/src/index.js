/**
 * Cloudflare Worker: Proxy para Evolution API v2 + Armazenamento de Imagens + Fila de Mensagens
 */

const EVOLUTION_URL = "https://mcu-nightrun-whatsapp.fly.dev";
const ASAAS_URL = "https://api.asaas.com/v3";
const CORA_STAGE_URL = "https://matls-clients.api.stage.cora.com.br";
const CORA_PRODUCTION_URL = "https://matls-clients.api.cora.com.br";
const INSTANCE_NAME = "rae_instance";
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REGISTRATIONS_COLLECTION = "rumo_ao_esporte_2026_registrations";
const FINANCIAL_PAYMENTS_COLLECTION = "financial_payments";
const PAYMENT_PROVIDERS = {
  asaas: {
    id: "asaas",
    name: "Asaas",
    logo: "/asaas-logo.svg",
    environments: ["production"],
    capabilities: ["customers", "pix", "boleto", "credit_card", "carnet", "list", "status", "cancel", "cash_receive", "balance"]
  },
  cora: {
    id: "cora",
    name: "Cora",
    logo: "/cora-logo.svg",
    environments: ["stage", "production"],
    capabilities: ["pix", "boleto", "carnet", "list", "status", "cancel", "stage_pay", "balance"]
  }
};

const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "Portal Supremo Rumo ao Esporte 2026",
    description: "Este portal Ã© a central tÃ©cnica definitiva do ecossistema Rumo ao Esporte 2026. Ele integra a documentaÃ§Ã£o de Backend (Cloudflare Workers), PersistÃªncia (Firestore) e Frontend (React Portals). Abaixo vocÃª encontrarÃ¡ o mapeamento de APIs, rotas de navegaÃ§Ã£o do usuÃ¡rio e algoritmos de sincronizaÃ§Ã£o financeira. Esta Ã© a Ãºnica fonte de verdade para a engenharia do projeto.",
    version: "1.3.0"
  },
  servers: [{ url: "https://rumo-ao-esporte-whatsapp-proxy.rumoaoesporte.workers.dev", description: "ProduÃ§Ã£o" }],
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
        description: "Modelo de dados mestre no Firestore (rumo_ao_esporte_2026_registrations).",
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
  <title>Manual Supremo | Rumo ao Esporte 2026</title>
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

    // --- PÁGINA DE FATURA (SANDBOX CORA) VISÍVEL PELO CLIENTE ---
    if (path.startsWith("/sandbox/cora/payments/") && request.method === "GET") {
      const invoiceId = decodeURIComponent(path.split("/").filter(Boolean).slice(3).join("/"));
      const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", ...corsHeaders };
      try {
        const payment = await getSandboxPayment(env, invoiceId);
        return new Response(renderSandboxInvoiceHtml(payment), { headers: htmlHeaders });
      } catch (err) {
        return new Response(renderSandboxInvoiceNotFoundHtml(invoiceId), { status: 404, headers: htmlHeaders });
      }
    }

    if ((path === "/send-whatsapp" || path === "/api/whatsapp/send") && request.method === "POST") {
      try {
        const body = await request.json();
        const msg = {
          phone: body.phone || body.number,
          text: body.text || body.message || body.caption || "",
          imageUrl: body.imageUrl || body.mediaUrl || ""
        };

        if (!msg.phone || !msg.text) {
          return jsonResponse({ success: false, error: "phone e message/text são obrigatórios." }, 400, corsHeaders);
        }

        const result = await processMessage(msg, env);
        await logToFirestore(msg, result, env).catch((err) => console.error("Erro ao salvar log:", err));
        return jsonResponse({ success: result.success, ...result }, result.success ? 200 : 502, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/api/whatsapp/status" && request.method === "GET") {
      try {
        const data = await evolutionJson(env, `/instance/connectionState/${INSTANCE_NAME}`);
        const state = data?.instance?.state || data?.state || data?.connectionState || data?.status || "unknown";
        return jsonResponse({ success: true, state, status: state, raw: data }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, state: "error", error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/api/whatsapp/qr" && request.method === "GET") {
      try {
        const data = await evolutionJson(env, `/instance/connect/${INSTANCE_NAME}`);
        const qr = data?.base64 || data?.qrcode || data?.qrCode || data?.code || "";
        return jsonResponse({ success: true, qr, qrCode: qr, ...data }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/api/whatsapp/logout" && request.method === "POST") {
      try {
        const data = await evolutionJson(env, `/instance/logout/${INSTANCE_NAME}`, { method: "DELETE" });
        return jsonResponse({ success: true, ...data }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/messaging/instances" && request.method === "GET") {
      try {
        const instances = await listEvolutionInstances(env);
        return jsonResponse({ success: true, instances }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/messaging/instances" && request.method === "POST") {
      try {
        const body = await request.json();
        const instanceName = body.instanceName;
        if (!instanceName) return jsonResponse({ success: false, error: "instanceName é obrigatório." }, 400, corsHeaders);
        const instance = await createEvolutionInstance(env, instanceName);
        const connection = await evolutionJson(env, `/instance/connect/${encodeURIComponent(instanceName)}`);
        return jsonResponse({ success: true, instance, connection }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path.startsWith("/messaging/instances/")) {
      try {
        const parts = path.split("/").filter(Boolean);
        const instanceName = decodeURIComponent(parts[2] || "");
        const action = parts[3] || "";
        if (!instanceName) return jsonResponse({ success: false, error: "instanceName é obrigatório." }, 400, corsHeaders);

        if (action === "connect" && request.method === "GET") {
          const connection = await evolutionJson(env, `/instance/connect/${encodeURIComponent(instanceName)}`);
          return jsonResponse({ success: true, connection }, 200, corsHeaders);
        }
        if (action === "status" && request.method === "GET") {
          const connection = await evolutionJson(env, `/instance/connectionState/${encodeURIComponent(instanceName)}`);
          return jsonResponse({ success: true, connection }, 200, corsHeaders);
        }
        if (action === "restart" && request.method === "PUT") {
          const connection = await evolutionJson(env, `/instance/restart/${encodeURIComponent(instanceName)}`, { method: "PUT" });
          return jsonResponse({ success: true, connection }, 200, corsHeaders);
        }
        if (action === "logout" && request.method === "DELETE") {
          const connection = await evolutionJson(env, `/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
          return jsonResponse({ success: true, connection }, 200, corsHeaders);
        }
        if (!action && request.method === "DELETE") {
          const deleted = await evolutionJson(env, `/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
          return jsonResponse({ success: true, deleted }, 200, corsHeaders);
        }

        return jsonResponse({ success: false, error: "Rota de mensageria não suportada." }, 404, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/update-student-credentials" && request.method === "POST") {
      try {
        const body = await request.json();
        const result = await updateStudentCredentials(env, body);
        return jsonResponse({ success: true, ...result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 400, corsHeaders);
      }
    }

    if (path === "/update-teacher-credentials" && request.method === "POST") {
      try {
        const body = await request.json();
        const result = await updateTeacherCredentials(env, body);
        return jsonResponse({ success: true, ...result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 400, corsHeaders);
      }
    }

    if (path === "/sync-student-payments" && request.method === "GET") {
      try {
        const result = await syncStudentPayments(env, url.searchParams.get("registrationId"), url.searchParams.get("cpf"));
        return jsonResponse({ success: true, ...result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 400, corsHeaders);
      }
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
          await env.RAE_STORAGE.put(key, JSON.stringify({
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
      const list = await env.RAE_STORAGE.list({ prefix: "mq:pending:", limit: 100 });
      const items = [];
      for (const key of list.keys) {
        const val = await env.RAE_STORAGE.get(key.name);
        if (val) items.push({ key: key.name, ...JSON.parse(val) });
      }
      const paused = await env.RAE_STORAGE.get("mq:paused") === "true";
      return new Response(JSON.stringify({ success: true, items, paused }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/queue/clear" && request.method === "POST") {
      const list = await env.RAE_STORAGE.list({ prefix: "mq:pending:" });
      for (const key of list.keys) {
        await env.RAE_STORAGE.delete(key.name);
      }
      return new Response(JSON.stringify({ success: true, message: "Fila limpa com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/queue/toggle-pause" && request.method === "POST") {
      const current = await env.RAE_STORAGE.get("mq:paused");
      const next = current === "true" ? "false" : "true";
      await env.RAE_STORAGE.put("mq:paused", next);
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

        await env.RAE_STORAGE.put(`img:${id}`, body, {
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

        await env.RAE_STORAGE.put(`img:${id}`, body, {
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
      const { value, metadata } = await env.RAE_STORAGE.getWithMetadata(`img:${id}`, { type: "arrayBuffer" });

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

    // --- ENDPOINTS DE PROVEDORES FINANCEIROS ---
    if (path === "/payment-providers" && request.method === "GET") {
      try {
        return jsonResponse({
          success: true,
          defaultProvider: resolvePaymentProvider(request, url, null, env),
          providers: getPaymentProviderStatus(env)
        }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payment-providers/test" && request.method === "POST") {
      try {
        const body = await request.json();
        const provider = normalizeProvider(body.provider || "asaas");
        if (!provider) return jsonResponse({ success: false, error: "provider inválido." }, 400, corsHeaders);
        const result = await testPaymentProvider(env, provider, body.environment || "stage", body.action || "auth");
        return jsonResponse({ success: true, provider, ...result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payment-providers/cora/stage-pay" && request.method === "POST") {
      try {
        const body = await request.json();
        if (String(body.invoiceId || body.id || "").startsWith("test_inv_")) {
          const payment = await markSandboxPaymentAsPaid(env, body.invoiceId || body.id, body);
          return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, payment }, 200, corsHeaders);
        }
        const result = await coraStagePayInvoice(env, body.invoiceId || body.id);
        return jsonResponse({ success: true, ...result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    // --- ENDPOINTS ASAAS / CORA / FINANCEIRO ---
    if (path.startsWith("/customers-by-cpf/") && request.method === "GET") {
      try {
        const provider = resolvePaymentProvider(request, url, null, env);
        if (provider === "cora") {
          const cpf = path.split("/customers-by-cpf/")[1]?.replace(/\D/g, "");
          if (isCoraStageSandbox(url, null, env)) {
            const payments = await listSandboxPayments(env, { document: cpf });
            if (!payments.length) return jsonResponse({ success: false, error: "Cliente nao encontrado no sandbox Cora", customers: [] }, 404, corsHeaders);
            return jsonResponse({ success: true, customer: buildSandboxCustomer(cpf, payments[0]), customers: [buildSandboxCustomer(cpf, payments[0])] }, 200, corsHeaders);
          }
          const invoices = await coraListInvoices(env, { search: cpf, environment: resolveCoraEnvironment(url.searchParams.get("environment"), env) });
          const list = invoices.data || invoices.items || [];
          if (!list.length) return jsonResponse({ success: false, error: "Cliente não encontrado na Cora", customers: [] }, 404, corsHeaders);
          // A Cora nao tem cadastro de cliente: derivamos o cliente das faturas.
          // Sem deduplicar, um CPF com 15 faturas virava 15 "clientes" iguais e o
          // Deep Sync repetia a mesma busca de pagamentos 15 vezes.
          const uniqueCustomers = [];
          const seenCustomerIds = new Set();
          for (const item of list) {
            const customer = normalizeCoraCustomerFromInvoice(item, cpf);
            if (seenCustomerIds.has(customer.id)) continue;
            seenCustomerIds.add(customer.id);
            uniqueCustomers.push(customer);
          }
          return jsonResponse({ success: true, customer: uniqueCustomers[0], customers: uniqueCustomers }, 200, corsHeaders);
        }
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
        const provider = resolvePaymentProvider(request, url, payload, env);
        if (provider === "cora") {
          if (isCoraStageSandbox(url, payload, env)) {
            const payment = await createSandboxPayment(env, payload);
            return jsonResponse({ success: true, provider, environment: "stage", sandbox: true, payment }, 200, corsHeaders);
          }
          const payment = await createCoraPayment(env, payload);
          return jsonResponse({ success: true, provider, payment }, 200, corsHeaders);
        }

        const customer = payload.customer || await ensureAsaasCustomer(env, payload);
        const paymentPayload = buildAsaasPaymentPayload(payload, customer);
        const payment = await asaasJson(env, "/payments", {
          method: "POST",
          body: JSON.stringify(paymentPayload)
        });
        const enrichedPayment = await enrichPixPayment(env, payment);
        return jsonResponse({ success: true, provider, payment: enrichedPayment }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/generate-carnet" && request.method === "POST") {
      try {
        const payload = await request.json();
        const provider = resolvePaymentProvider(request, url, payload, env);
        if (provider === "cora") {
          if (isCoraStageSandbox(url, payload, env)) {
            const payments = await createSandboxCarnetPayments(env, payload);
            return jsonResponse({ success: true, provider, environment: "stage", sandbox: true, payments }, 200, corsHeaders);
          }
          const payments = await createCoraCarnetPayments(env, payload);
          return jsonResponse({ success: true, provider, payments }, 200, corsHeaders);
        }
        const customer = payload.customer || await ensureAsaasCustomer(env, payload);
        const payments = await createCarnetPayments(env, payload, customer);
        return jsonResponse({ success: true, provider, payments }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payment-status" && request.method === "GET") {
      try {
        const provider = resolvePaymentProvider(request, url, null, env);
        const paymentId = url.searchParams.get("paymentId");
        if (!paymentId) return jsonResponse({ success: false, error: "paymentId obrigatÃ³rio" }, 400, corsHeaders);
        if (paymentId.startsWith("test_inv_")) {
          const payment = await getSandboxPayment(env, paymentId);
          return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, payment }, 200, corsHeaders);
        }
        if (provider === "cora" || paymentId.startsWith("inv_")) {
          const payment = await coraGetPayment(env, paymentId, resolveCoraEnvironment(url.searchParams.get("environment"), env));
          return jsonResponse({ success: true, provider: "cora", payment }, 200, corsHeaders);
        }
        const payment = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`);
        return jsonResponse({ success: true, provider, payment }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/finance/balance" && request.method === "GET") {
      try {
        const provider = resolvePaymentProvider(request, url, null, env);
        if (provider === "cora") {
          const balance = await coraBalance(env, resolveCoraEnvironment(url.searchParams.get("environment"), env));
          return jsonResponse({ success: true, provider, ...balance }, 200, corsHeaders);
        }
        const balance = await asaasJson(env, "/finance/balance");
        return jsonResponse({ success: true, provider, ...balance }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
      }
    }

    if (path === "/payments" && request.method === "GET") {
      try {
        const provider = resolvePaymentProvider(request, url, null, env);
        if (provider === "cora") {
          if (isCoraStageSandbox(url, null, env)) {
            const payments = await listSandboxPayments(env, {
              customer: url.searchParams.get("customer"),
              search: url.searchParams.get("search"),
              state: url.searchParams.get("status") || url.searchParams.get("state")
            });
            return jsonResponse({ provider, environment: "stage", sandbox: true, data: payments, raw: { totalItems: payments.length, items: payments } }, 200, corsHeaders);
          }
          const listParams = {
            environment: resolveCoraEnvironment(url.searchParams.get("environment"), env),
            search: url.searchParams.get("customer") || url.searchParams.get("search"),
            start: url.searchParams.get("start"),
            end: url.searchParams.get("end"),
            state: url.searchParams.get("status") || url.searchParams.get("state"),
            page: url.searchParams.get("page") || "1",
            perPage: url.searchParams.get("limit") || url.searchParams.get("perPage") || "50"
          };
          // detailed=false desliga o enriquecimento quando so importam valores/datas.
          const detailed = url.searchParams.get("detailed") !== "false";
          const invoices = await coraListInvoices(env, listParams);
          const items = invoices.data || invoices.items || invoices.invoices || [];
          const data = detailed
            ? await enrichCoraInvoices(env, items, listParams.environment)
            : items.map(normalizeCoraPayment);
          return jsonResponse({ provider, data, raw: invoices }, 200, corsHeaders);
        }
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
          if (paymentId.startsWith("test_inv_")) {
            const body = await request.json();
            const payment = await markSandboxPaymentAsPaid(env, paymentId, body);
            return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, payment }, 200, corsHeaders);
          }
          if (paymentId.startsWith("inv_")) {
            const body = await request.json();
            if (body.stagePay === true) {
              const paid = await coraStagePayInvoice(env, paymentId);
              return jsonResponse({ success: true, provider: "cora", payment: paid.payment || paid }, 200, corsHeaders);
            }
            return jsonResponse({ success: false, provider: "cora", error: "Baixa manual na Cora não é equivalente ao Asaas. Em stage, envie { stagePay: true } para simular pagamento." }, 422, corsHeaders);
          }
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
          if (paymentId.startsWith("test_inv_")) {
            const payment = await getSandboxPayment(env, paymentId);
            return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, payment }, 200, corsHeaders);
          }
          if (paymentId.startsWith("inv_")) {
            const payment = await coraGetPayment(env, paymentId, resolveCoraEnvironment(url.searchParams.get("environment"), env));
            return jsonResponse({ success: true, provider: "cora", payment }, 200, corsHeaders);
          }
          const payment = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`);
          return jsonResponse({ success: true, payment }, 200, corsHeaders);
        }

        if (request.method === "PUT") {
          if (paymentId.startsWith("test_inv_")) {
            const body = await request.json();
            const payment = await updateSandboxPayment(env, paymentId, body);
            return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, payment }, 200, corsHeaders);
          }
          if (paymentId.startsWith("inv_")) {
            return jsonResponse({ success: false, provider: "cora", error: "Edição de fatura Cora não foi habilitada neste adaptador. Cancele e gere uma nova cobrança para preservar a lógica atual." }, 422, corsHeaders);
          }
          const body = await request.json();
          const updated = await asaasJson(env, `/payments/${encodeURIComponent(paymentId)}`, {
            method: "PUT",
            body: JSON.stringify(normalizePaymentUpdate(body))
          });
          return jsonResponse({ success: true, payment: updated }, 200, corsHeaders);
        }

        if (request.method === "DELETE") {
          if (paymentId.startsWith("test_inv_")) {
            const deleted = await deleteSandboxPayment(env, paymentId);
            return jsonResponse({ success: true, provider: "cora", environment: "stage", sandbox: true, deleted }, 200, corsHeaders);
          }
          if (paymentId.startsWith("inv_")) {
            const deleted = await coraCancelPayment(env, paymentId, resolveCoraEnvironment(url.searchParams.get("environment"), env));
            return jsonResponse({ success: true, provider: "cora", deleted }, 200, corsHeaders);
          }
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

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return PAYMENT_PROVIDERS[provider] ? provider : null;
}

function resolvePaymentProvider(request, url, payload, env) {
  return normalizeProvider(
    payload?.provider ||
    payload?.paymentProvider ||
    payload?.gateway ||
    url.searchParams.get("provider") ||
    request.headers.get("X-Payment-Provider") ||
    env.PAYMENT_PROVIDER
  ) || "asaas";
}

function resolveCoraEnvironment(value, env) {
  const selected = String(value || env.CORA_ENVIRONMENT || env.CORA_DEFAULT_ENVIRONMENT || "stage").toLowerCase();
  return selected === "production" || selected === "prod" ? "production" : "stage";
}

function isCoraStageSandbox(url, payload, env) {
  return resolveCoraEnvironment(payload?.environment || url.searchParams.get("environment"), env) === "stage" &&
    (
      payload?.financialTestMode === true ||
      payload?.testMode === true ||
      url.searchParams.get("financialTestMode") === "true" ||
      url.searchParams.get("testMode") === "true"
    );
}

function sandboxPaymentKey(id) {
  return `payment:sandbox:cora:${id}`;
}

function sandboxPaymentListKey(id) {
  return `payment:sandbox:cora:index:${id}`;
}

function buildSandboxCustomer(document, payment = {}) {
  const clean = String(document || payment.customerDocument || payment.responsibleCpf || "").replace(/\D/g, "");
  return {
    id: `cora_test_${clean || "customer"}`,
    name: payment.customerName || payment.responsibleName || "Cliente Teste Cora",
    cpfCnpj: clean,
    email: payment.customerEmail || payment.responsibleEmail || ""
  };
}

function buildSandboxPayment(payload, amount, description, dueDate, suffix = "") {
  const value = payload.amount !== undefined ? currencyFromCents(payload.amount) : normalizeCurrencyValue(amount);
  const id = `test_inv_${crypto.randomUUID()}`;
  const document = String(payload.responsibleCpf || payload.cpf || payload.document || "").replace(/\D/g, "");
  const now = new Date().toISOString();
  return {
    id,
    provider: "cora",
    environment: "stage",
    sandbox: true,
    customer: `cora_test_${document || "customer"}`,
    customerName: payload.responsibleName || payload.name || "Cliente Teste Cora",
    customerDocument: document,
    customerEmail: payload.responsibleEmail || payload.email || "",
    value,
    netValue: value,
    dueDate,
    status: "PENDING",
    description: description || payload.description || "Cobranca teste Cora Stage",
    billingType: String(payload.billingType || "PIX").toUpperCase() === "BOLETO" ? "BOLETO" : "PIX",
    invoiceUrl: `${payload.workerPublicUrl || ""}/sandbox/cora/payments/${id}`,
    bankSlipUrl: null,
    pixQrCode: `00020101021226880014br.gov.bcb.pix2566sandbox.rumoaoesporte.local/${id}520400005303986540${value.toFixed(2)}5802BR5917RUMO AO ESPORTE6009SAO PAULO62070503***6304TEST`,
    pixQrCodeUrl: null,
    externalReference: String(suffix ? `${payload.externalReference || payload.registrationId || "RAE_TEST"}_${suffix}` : payload.externalReference || payload.registrationId || `RAE_TEST_${Date.now()}`).slice(0, 80),
    dateCreated: now,
    paymentDate: null,
    raw: {
      status: "SANDBOX",
      message: "Pagamento criado no sandbox financeiro Cora Stage para testes completos do sistema."
    }
  };
}

async function saveSandboxPayment(env, payment) {
  await env.RAE_STORAGE.put(sandboxPaymentKey(payment.id), JSON.stringify(payment));
  await env.RAE_STORAGE.put(sandboxPaymentListKey(payment.id), JSON.stringify({
    id: payment.id,
    customer: payment.customer,
    customerDocument: payment.customerDocument,
    externalReference: payment.externalReference
  }));
  return payment;
}

async function createSandboxPayment(env, payload) {
  const dueDate = payload.dueDate || new Date().toISOString().split("T")[0];
  const payment = buildSandboxPayment(env ? { ...payload, workerPublicUrl: env.WORKER_PUBLIC_URL } : payload, payload.amount ?? payload.value, payload.description, dueDate);
  return saveSandboxPayment(env, payment);
}

async function createSandboxCarnetPayments(env, payload) {
  const payments = [];
  const childName = payload.childName ? ` - ${payload.childName}` : "";
  const modality = payload.modalidade ? ` (${payload.modalidade})` : "";
  const paymentDay = Number(payload.paymentDay || 10);
  const today = new Date();
  const formatDueDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (payload.matriculaValue && Number(payload.matriculaValue) > 0) {
    payments.push(await createSandboxPayment(env, {
      ...payload,
      amount: payload.matriculaValue,
      dueDate: formatDueDate(today),
      description: `Matricula${childName}${modality}`,
      externalReference: `${payload.registrationId || "RAE"}_MATRICULA_${Date.now()}`
    }));
  }

  const mensalidadeValue = Number(payload.mensalidadeValue || 0);
  if (mensalidadeValue > 0) {
    const endDate = payload.installmentEndDate ? new Date(`${payload.installmentEndDate}T12:00:00`) : null;
    const maxMonths = endDate ? 36 : 12;
    for (let monthOffset = 0; monthOffset < maxMonths; monthOffset++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, Math.min(paymentDay, 28));
      if (dueDate < today) dueDate.setDate(today.getDate());
      if (endDate && dueDate > endDate) break;
      const monthLabel = dueDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      payments.push(await createSandboxPayment(env, {
        ...payload,
        amount: mensalidadeValue,
        dueDate: formatDueDate(dueDate),
        description: `Mensalidade ${monthLabel}${childName}${modality}`,
        externalReference: `${payload.registrationId || "RAE"}_${monthOffset + 1}_${Date.now()}`
      }));
    }
  }
  return payments;
}

async function getSandboxPayment(env, id) {
  const data = await env.RAE_STORAGE.get(sandboxPaymentKey(id), "json");
  if (!data) throw new Error("Fatura sandbox nao encontrada.");
  return data;
}

async function listSandboxPayments(env, filters = {}) {
  const list = await env.RAE_STORAGE.list({ prefix: "payment:sandbox:cora:index:" });
  const payments = [];
  const wanted = String(filters.customer || filters.search || filters.document || "").replace(/^cora_test_/, "").replace(/\D/g, "");
  const state = String(filters.state || "").toUpperCase();

  for (const key of list.keys) {
    const index = await env.RAE_STORAGE.get(key.name, "json");
    if (!index?.id) continue;
    if (wanted && !String(index.customerDocument || "").includes(wanted)) continue;
    const payment = await getSandboxPayment(env, index.id);
    if (state && payment.status !== state) continue;
    payments.push(payment);
  }
  return payments.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

async function updateSandboxPayment(env, id, body = {}) {
  const payment = await getSandboxPayment(env, id);
  const update = normalizePaymentUpdate(body);
  const next = {
    ...payment,
    description: update.description ?? payment.description,
    dueDate: update.dueDate ?? payment.dueDate,
    value: update.value ?? payment.value,
    netValue: update.value ?? payment.netValue,
    discount: update.discount ?? payment.discount,
    fine: update.fine ?? payment.fine,
    interest: update.interest ?? payment.interest,
    lastUpdate: new Date().toISOString()
  };
  return saveSandboxPayment(env, next);
}

async function markSandboxPaymentAsPaid(env, id, body = {}) {
  const payment = await getSandboxPayment(env, id);
  const next = {
    ...payment,
    status: "RECEIVED",
    paymentDate: body.paymentDate || new Date().toISOString().split("T")[0],
    value: body.value !== undefined ? normalizeCurrencyValue(body.value) : payment.value,
    lastUpdate: new Date().toISOString()
  };
  next.netValue = next.value;
  return saveSandboxPayment(env, next);
}

async function deleteSandboxPayment(env, id) {
  const payment = await getSandboxPayment(env, id);
  await env.RAE_STORAGE.delete(sandboxPaymentKey(id));
  await env.RAE_STORAGE.delete(sandboxPaymentListKey(id));
  return { ...payment, deleted: true, status: "DELETED" };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sandboxInvoiceStatusInfo(status) {
  const s = String(status || "").toUpperCase();
  if (["RECEIVED", "CONFIRMED", "PAID", "RECEIVED_IN_CASH"].includes(s)) {
    return { label: "PAGO", color: "#0a7a34", bg: "#e6f7ec" };
  }
  if (s === "OVERDUE") {
    return { label: "VENCIDA", color: "#b91c1c", bg: "#fdecec" };
  }
  return { label: "PENDENTE", color: "#b45309", bg: "#fdf3e2" };
}

function renderSandboxInvoiceHtml(payment) {
  const value = Number(payment.value || 0);
  const valueStr = value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const due = payment.dueDate
    ? new Date(`${payment.dueDate}T12:00:00`).toLocaleDateString("pt-BR")
    : "-";
  const status = sandboxInvoiceStatusInfo(payment.status);
  const isPaid = status.label === "PAGO";
  const pix = String(payment.pixQrCode || "");
  const billing = String(payment.billingType || "PIX").toUpperCase() === "BOLETO" ? "Boleto" : "Pix";

  const row = (label, val) => `
        <div class="row">
          <span class="row-label">${escapeHtml(label)}</span>
          <span class="row-value">${escapeHtml(val)}</span>
        </div>`;

  const pixBlock = (!isPaid && pix) ? `
      <div class="pix">
        <div class="pix-title">Pague com ${escapeHtml(billing)} — copia e cola</div>
        <textarea id="pixCode" readonly onclick="this.select()">${escapeHtml(pix)}</textarea>
        <button id="copyBtn" onclick="copyPix()">Copiar código ${escapeHtml(billing)}</button>
      </div>` : "";

  const paidBlock = isPaid ? `<div class="paid-banner">Pagamento confirmado ✓</div>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fatura — Rumo ao Esporte</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; background: #eef2f7; color: #1f2937; padding: 20px; display: flex; justify-content: center; }
  .card { width: 100%; max-width: 440px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
  .header { background: linear-gradient(135deg, #0b3a8c, #1560d6); color: #fff; padding: 22px 24px; }
  .header .brand { font-size: 0.78rem; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; }
  .header .title { font-size: 1.25rem; font-weight: 800; margin-top: 2px; }
  .amount { padding: 24px; text-align: center; border-bottom: 1px solid #eef2f7; }
  .amount .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
  .amount .value { font-size: 2.2rem; font-weight: 800; color: #0b3a8c; margin-top: 4px; }
  .status { display: inline-block; margin-top: 10px; padding: 4px 14px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.5px; color: ${status.color}; background: ${status.bg}; }
  .body { padding: 20px 24px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
  .row:last-child { border-bottom: none; }
  .row-label { color: #6b7280; }
  .row-value { font-weight: 600; text-align: right; }
  .pix { margin: 4px 24px 20px; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; }
  .pix-title { font-size: 0.8rem; font-weight: 700; color: #0b3a8c; margin-bottom: 8px; }
  .pix textarea { width: 100%; height: 74px; resize: none; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; font-size: 0.72rem; font-family: monospace; color: #334155; background: #fff; }
  .pix button { width: 100%; margin-top: 10px; padding: 12px; border: none; border-radius: 8px; background: #0a7a34; color: #fff; font-weight: 700; font-size: 0.9rem; cursor: pointer; }
  .pix button:active { transform: scale(0.99); }
  .paid-banner { margin: 4px 24px 20px; padding: 14px; background: #e6f7ec; color: #0a7a34; border-radius: 12px; text-align: center; font-weight: 800; }
  .foot { padding: 14px 24px 22px; text-align: center; font-size: 0.72rem; color: #9ca3af; }
  .badge-test { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 6px; background: #fef3c7; color: #92400e; font-size: 0.65rem; font-weight: 700; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">Rumo ao Esporte 2026</div>
      <div class="title">Fatura de Pagamento</div>
    </div>
    <div class="amount">
      <div class="label">Valor</div>
      <div class="value">${escapeHtml(valueStr)}</div>
      <span class="status">${escapeHtml(status.label)}</span>
    </div>
    ${paidBlock}
    <div class="body">
      ${row("Descrição", payment.description || "-")}
      ${row("Vencimento", due)}
      ${row("Pagador", payment.customerName || "-")}
      ${payment.customerDocument ? row("CPF", payment.customerDocument) : ""}
      ${row("Forma de pagamento", billing)}
    </div>
    ${pixBlock}
    <div class="foot">
      Fatura gerada pelo sistema Rumo ao Esporte.
      <br /><span class="badge-test">AMBIENTE DE TESTE</span>
    </div>
  </div>
  <script>
    function copyPix() {
      var el = document.getElementById('pixCode');
      var btn = document.getElementById('copyBtn');
      el.select();
      el.setSelectionRange(0, 99999);
      var done = function () { var t = btn.textContent; btn.textContent = 'Copiado!'; setTimeout(function () { btn.textContent = t; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.value).then(done).catch(function () { try { document.execCommand('copy'); done(); } catch (e) {} });
      } else { try { document.execCommand('copy'); done(); } catch (e) {} }
    }
  </script>
</body>
</html>`;
}

function renderSandboxInvoiceNotFoundHtml(id) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fatura não encontrada</title>
<style>
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; background: #eef2f7; color: #1f2937; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .box { background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); padding: 32px; max-width: 420px; text-align: center; }
  h1 { color: #0b3a8c; font-size: 1.3rem; margin-bottom: 10px; }
  p { color: #6b7280; font-size: 0.9rem; line-height: 1.5; }
  code { font-size: 0.72rem; color: #9ca3af; word-break: break-all; }
</style>
</head>
<body>
  <div class="box">
    <h1>Fatura não encontrada</h1>
    <p>Esta fatura não está mais disponível ou já foi removida. Entre em contato com a secretaria do Rumo ao Esporte.</p>
    <p style="margin-top:12px"><code>${escapeHtml(id)}</code></p>
  </div>
</body>
</html>`;
}

function getPaymentProviderStatus(env) {
  return Object.values(PAYMENT_PROVIDERS).map((provider) => {
    if (provider.id === "asaas") {
      return {
        ...provider,
        configured: Boolean(env.ASAAS_API_KEY),
        environments: [{ id: "production", configured: Boolean(env.ASAAS_API_KEY) }]
      };
    }

    return {
      ...provider,
      configured: isCoraEnvironmentConfigured(env, "stage") || isCoraEnvironmentConfigured(env, "production"),
      environments: [getCoraEnvironmentStatus(env, "stage"), getCoraEnvironmentStatus(env, "production")]
    };
  });
}

function getCoraEnvironmentStatus(env, environment) {
  return {
    id: environment,
    configured: isCoraEnvironmentConfigured(env, environment),
    clientId: maskSecret(getCoraClientId(env, environment)),
    hasClientId: Boolean(getCoraClientId(env, environment)),
    hasCertificateBinding: Boolean(getCoraFetcher(env, environment))
  };
}

function isCoraEnvironmentConfigured(env, environment) {
  return Boolean(getCoraClientId(env, environment) && getCoraFetcher(env, environment));
}

function getCoraClientId(env, environment) {
  return environment === "production"
    ? env.CORA_PRODUCTION_CLIENT_ID || env.CORA_CLIENT_ID
    : env.CORA_STAGE_CLIENT_ID || env.CORA_CLIENT_ID;
}

function getCoraFetcher(env, environment) {
  return environment === "production"
    ? env.CORA_PRODUCTION_CERT || env.CORA_CERT
    : env.CORA_STAGE_CERT || env.CORA_CERT;
}

function getCoraBaseUrl(environment) {
  return environment === "production" ? CORA_PRODUCTION_URL : CORA_STAGE_URL;
}

function maskSecret(value) {
  const str = String(value || "");
  if (!str) return "";
  if (str.length <= 8) return "********";
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

async function testPaymentProvider(env, provider, environment, action) {
  if (provider === "asaas") {
    if (!env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada no Worker.");
    const result = await asaasJson(env, "/finance/balance");
    return { environment: "production", configured: true, message: "Asaas respondeu com sucesso.", result };
  }

  const coraEnv = resolveCoraEnvironment(environment, env);
  const status = getCoraEnvironmentStatus(env, coraEnv);
  if (!status.configured) {
    return {
      environment: coraEnv,
      configured: false,
      message: "Cora ainda precisa de client-id e binding mTLS do certificado neste ambiente.",
      missing: {
        clientId: !status.hasClientId,
        certificateBinding: !status.hasCertificateBinding
      }
    };
  }

  const token = await getCoraAccessToken(env, coraEnv, true);
  if (action === "balance") {
    const balance = await coraBalance(env, coraEnv);
    return { environment: coraEnv, configured: true, message: "Cora autenticou e retornou saldo.", token: tokenSummary(token), result: balance };
  }

  return { environment: coraEnv, configured: true, message: "Cora autenticou com sucesso.", token: tokenSummary(token) };
}

function tokenSummary(token) {
  return {
    token_type: token.token_type || "Bearer",
    expires_in: token.expires_in,
    scope: token.scope || "",
    access_token: maskSecret(token.access_token)
  };
}

async function getCoraAccessToken(env, environment = "stage", forceRefresh = false) {
  const clientId = getCoraClientId(env, environment);
  const fetcher = getCoraFetcher(env, environment);
  if (!clientId) throw new Error(`CORA_${environment === "production" ? "PRODUCTION" : "STAGE"}_CLIENT_ID não configurado.`);
  if (!fetcher?.fetch) throw new Error(`Binding mTLS CORA_${environment === "production" ? "PRODUCTION" : "STAGE"}_CERT não configurado no Worker.`);

  const cacheKey = `cora:token:${environment}:${clientId}`;
  if (!forceRefresh && env.RAE_STORAGE) {
    const cached = await env.RAE_STORAGE.get(cacheKey, "json").catch(() => null);
    if (cached?.access_token && cached.expiresAt && cached.expiresAt > Date.now() + 60000) return cached;
  }

  const response = await fetcher.fetch(`${getCoraBaseUrl(environment)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId }).toString()
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(getApiErrorMessage(data, `Cora token retornou ${response.status}`));

  const token = {
    ...data,
    expiresAt: Date.now() + Math.max(Number(data.expires_in || 3600) - 120, 60) * 1000
  };

  if (env.RAE_STORAGE) {
    await env.RAE_STORAGE.put(cacheKey, JSON.stringify(token), {
      expirationTtl: Math.max(Number(data.expires_in || 3600) - 120, 60)
    }).catch(() => null);
  }

  return token;
}

async function coraJson(env, path, options = {}, environment = "stage") {
  const fetcher = getCoraFetcher(env, environment);
  if (!fetcher?.fetch) throw new Error(`Binding mTLS Cora não configurado para ${environment}.`);
  const token = await getCoraAccessToken(env, environment);
  const response = await fetcher.fetch(`${getCoraBaseUrl(environment)}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token.access_token}`,
      ...(options.headers || {})
    }
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(getApiErrorMessage(data, `Cora retornou ${response.status}`));
  return data;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return { raw: text };
  }
}

function getApiErrorMessage(data, fallback) {
  return data.errors?.[0]?.description || data.errors?.[0]?.message || data.error_description || data.message || data.error || data.detail || fallback;
}

async function asaasJson(env, path, options = {}) {
  const apiKey = env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY nÃ£o configurada no Worker.");

  const response = await fetch(`${ASAAS_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Rumo-Ao-Esporte-System/1.0",
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

async function evolutionJson(env, path, options = {}) {
  const response = await fetch(`${EVOLUTION_URL}${path}`, {
    ...options,
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.EVOLUTION_API_KEY || "",
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
    throw new Error(data.message || data.error || `Evolution retornou ${response.status}`);
  }

  return data;
}

async function listEvolutionInstances(env) {
  const data = await evolutionJson(env, "/instance/fetchInstances");
  const items = Array.isArray(data) ? data : (data.instances || data.data || []);
  return items.map((item) => ({
    id: item.id || item.name || item.instanceName || item.instance?.instanceName || "",
    name: item.name || item.instanceName || item.instance?.instanceName || "",
    connectionStatus: item.connectionStatus || item.state || item.instance?.state || item.status || "unknown",
    owner: item.owner || item.profileName || "",
    profileName: item.profileName || item.instance?.profileName || "",
    profilePictureUrl: item.profilePictureUrl || item.profilePicUrl || ""
  })).filter((item) => item.name);
}

async function createEvolutionInstance(env, instanceName) {
  const data = await evolutionJson(env, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      token: env.EVOLUTION_API_KEY || undefined,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    })
  });

  return {
    id: data.id || data.instance?.instanceName || instanceName,
    name: data.name || data.instanceName || data.instance?.instanceName || instanceName,
    connectionStatus: data.connectionStatus || data.state || data.instance?.state || "created",
    owner: data.owner || "",
    profileName: data.profileName || "",
    profilePictureUrl: data.profilePictureUrl || ""
  };
}

async function updateStudentCredentials(env, body) {
  if (!body.registrationId) throw new Error("registrationId é obrigatório.");
  if (!body.newEmail && !body.newPassword) throw new Error("Informe newEmail ou newPassword.");

  const registration = await getFirestoreDocument(env, REGISTRATIONS_COLLECTION, body.registrationId);
  if (!registration) throw new Error("Cadastro não encontrado.");

  const updates = {};
  if (body.newEmail) {
    updates.responsavel = {
      ...(registration.responsavel || {}),
      email: String(body.newEmail).trim().toLowerCase()
    };
  }
  if (body.newPassword) updates.senha = String(body.newPassword);

  await patchFirestoreDocument(env, REGISTRATIONS_COLLECTION, body.registrationId, updates);
  return {
    authUpdated: false,
    firestoreUpdated: true,
    note: "Firebase Auth exige credencial Admin/service account; este Worker atualizou o Firestore."
  };
}

async function updateTeacherCredentials(env, body) {
  if (!body.teacherId) throw new Error("teacherId é obrigatório.");
  if (!body.newEmail && !body.newPassword) throw new Error("Informe newEmail ou newPassword.");

  const updates = {};
  if (body.newEmail) updates.email = String(body.newEmail).trim().toLowerCase();
  if (body.newPassword) updates.senha = String(body.newPassword);

  await patchFirestoreDocument(env, "teachers", body.teacherId, updates);
  return {
    authUpdated: false,
    firestoreUpdated: true,
    note: "Firebase Auth exige credencial Admin/service account; este Worker atualizou o Firestore."
  };
}

async function syncStudentPayments(env, registrationId, cpf) {
  if (!registrationId) throw new Error("registrationId é obrigatório.");

  const registration = await getFirestoreDocument(env, REGISTRATIONS_COLLECTION, registrationId);
  const cleanCpf = String(cpf || registration?.responsavel?.cpf || "").replace(/\D/g, "");
  if (!cleanCpf) throw new Error("CPF não informado.");

  const customers = await asaasJson(env, `/customers?cpfCnpj=${encodeURIComponent(cleanCpf)}`);
  const customer = customers.data?.[0];
  if (!customer?.id) {
    return { synced: 0, customerFound: false };
  }

  const paymentsData = await asaasJson(env, `/payments?customer=${encodeURIComponent(customer.id)}&limit=100`);
  const payments = paymentsData.data || [];

  for (const payment of payments) {
    await savePaymentFromWebhook(env, payment, registrationId, "MANUAL_SYNC");
  }

  const savedPayments = await listPaymentsByStudent(env, registrationId);
  const statusData = calculateFinancialStatusFromPayments(savedPayments);
  await updateRegistrationFinancialSummary(env, registrationId, statusData);

  return {
    synced: payments.length,
    customerFound: true,
    customerId: customer.id,
    status: statusData.status
  };
}

function normalizeCurrencyValue(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return number > 1000 ? Math.round(number) / 100 : number;
}

function currencyFromCents(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number) / 100;
}

function normalizeAmountOrValue(payload) {
  if (payload.amount !== undefined) return currencyFromCents(payload.amount);
  return normalizeCurrencyValue(payload.value);
}

function normalizePaymentUpdate(body) {
  const update = { ...body };
  if (update.amount !== undefined && update.value === undefined) {
    update.value = currencyFromCents(update.amount);
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
      name: payload.responsibleName || payload.name || "Respons\u00e1vel Rumo ao Esporte",
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
    value: normalizeAmountOrValue(payload),
    dueDate: payload.dueDate || new Date().toISOString().split("T")[0],
    description: payload.description || "Cobran\u00e7a Rumo ao Esporte",
    externalReference: payload.externalReference || payload.registrationId || undefined
  };

  if (payload.discount) payment.discount = payload.discount;
  if (payload.fine) payment.fine = payload.fine;
  if (payload.interest) payment.interest = payload.interest;
  if (payload.installmentCount) payment.installmentCount = payload.installmentCount;
  if (payload.installmentValue) payment.installmentValue = currencyFromCents(payload.installmentValue);

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
        value: currencyFromCents(payload.matriculaValue),
        dueDate: formatDueDate(dueDate),
        description: `MatrÃ­cula${childName}${modality}`,
        externalReference: `${payload.registrationId || "RAE"}_MATRICULA_${Date.now()}`
      })
    });
    payments.push(await enrichPixPayment(env, payment));
  }

  const mensalidadeValue = Number(payload.mensalidadeValue || 0);
  if (mensalidadeValue > 0) {
    // installmentEndDate (opcional): para de gerar mensalidades apos essa data,
    // em vez do padrao fixo de 12 meses rolantes. Usado no fechamento de temporada
    // (ex.: matricula no meio do ano so cobra ate 10/12, sem virar o ano).
    const endDate = payload.installmentEndDate ? new Date(`${payload.installmentEndDate}T12:00:00`) : null;
    const maxMonths = endDate ? 36 : 12; // 36 e so um teto de seguranca quando ha data limite.
    for (let monthOffset = 0; monthOffset < maxMonths; monthOffset++) {
      const dueDate = safeDueDate(monthOffset);
      if (endDate && dueDate > endDate) break;
      const monthLabel = dueDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      const payment = await asaasJson(env, "/payments", {
        method: "POST",
        body: JSON.stringify({
          customer,
          billingType: payload.billingType || "PIX",
          value: currencyFromCents(mensalidadeValue),
          dueDate: formatDueDate(dueDate),
          description: `Mensalidade ${monthLabel}${childName}${modality}`,
          externalReference: `${payload.registrationId || "RAE"}_${monthOffset + 1}_${Date.now()}`
        })
      });
      payments.push(await enrichPixPayment(env, payment));
    }
  }

  return payments;
}

function centsFromCurrency(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return number > 1000 ? Math.round(number) : Math.round(number * 100);
}

function centsFromAmountOrValue(payload, amount) {
  if (payload.amount !== undefined) return Math.round(Number(amount || 0));
  return centsFromCurrency(amount);
}

function documentType(identity) {
  return String(identity || "").replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
}

function buildCoraCustomer(payload) {
  const identity = String(payload.responsibleCpf || payload.cpf || payload.document || "").replace(/\D/g, "");
  const address = payload.address || payload.responsibleAddress || {};
  return {
    name: payload.responsibleName || payload.name || "Responsável Rumo ao Esporte",
    email: payload.responsibleEmail || payload.email || "financeiro@rumoaoesporte.com.br",
    document: {
      identity,
      type: documentType(identity)
    },
    address: {
      street: address.street || address.logradouro || "Rua não informada",
      number: String(address.number || address.numero || "S/N"),
      district: address.district || address.bairro || "Centro",
      city: address.city || address.cidade || "Cidade não informada",
      state: address.state || address.uf || "SP",
      complement: address.complement || address.complemento || "N/A",
      zip_code: String(address.zipCode || address.cep || "00000000").replace(/\D/g, "")
    }
  };
}

function buildCoraPaymentForms(payload) {
  const billingType = String(payload.billingType || "PIX").toUpperCase();
  if (billingType === "CREDIT_CARD") throw new Error("A Cora não oferece cartão de crédito neste adaptador. Use PIX ou BOLETO.");
  if (billingType === "BOLETO") return ["BANK_SLIP", "PIX"];
  return ["PIX"];
}

function buildCoraInvoicePayload(payload, amount, description, codeSuffix = "") {
  const codeBase = payload.externalReference || payload.registrationId || `RAE_${Date.now()}`;
  const dueDate = payload.dueDate || new Date().toISOString().split("T")[0];
  const paymentTerms = { due_date: dueDate };
  if (payload.fine?.value || payload.fine?.amount) paymentTerms.fine = { amount: centsFromCurrency(payload.fine.amount ?? payload.fine.value) };
  if (payload.interest?.value || payload.interest?.rate) paymentTerms.interest = { rate: Number(payload.interest.rate ?? payload.interest.value) };
  if (payload.discount?.value) paymentTerms.discount = { type: payload.discount.type || "PERCENT", value: Number(payload.discount.value) };

  return {
    code: String(codeSuffix ? `${codeBase}_${codeSuffix}` : codeBase).slice(0, 60),
    customer: buildCoraCustomer(payload),
    services: [{
      name: description || payload.description || "Cobrança Rumo ao Esporte",
      description: description || payload.description || "Cobrança Rumo ao Esporte",
      amount: centsFromAmountOrValue(payload, amount)
    }],
    payment_terms: paymentTerms,
    payment_forms: buildCoraPaymentForms(payload)
  };
}

async function createCoraPayment(env, payload) {
  const environment = resolveCoraEnvironment(payload.environment, env);
  const invoicePayload = buildCoraInvoicePayload(payload, payload.amount ?? payload.value, payload.description);
  const invoice = await coraJson(env, "/v2/invoices/", {
    method: "POST",
    headers: { "Idempotency-Key": payload.idempotencyKey || crypto.randomUUID() },
    body: JSON.stringify(invoicePayload)
  }, environment);
  return normalizeCoraPayment(invoice);
}

async function createCoraCarnetPayments(env, payload) {
  const payments = [];
  const childName = payload.childName ? ` - ${payload.childName}` : "";
  const modality = payload.modalidade ? ` (${payload.modalidade})` : "";
  const today = new Date();
  const paymentDay = Number(payload.paymentDay || 10);

  const formatDueDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (payload.matriculaValue && Number(payload.matriculaValue) > 0) {
    const dueDate = new Date(today);
    payments.push(await createCoraPayment(env, {
      ...payload,
      amount: payload.matriculaValue,
      dueDate: formatDueDate(dueDate),
      description: `Matrícula${childName}${modality}`,
      externalReference: `${payload.registrationId || "RAE"}_MATRICULA_${Date.now()}`
    }));
  }

  const mensalidadeValue = Number(payload.mensalidadeValue || 0);
  if (mensalidadeValue > 0) {
    // installmentEndDate (opcional): para de gerar mensalidades apos essa data,
    // em vez do padrao fixo de 12 meses rolantes. Usado no fechamento de temporada
    // (ex.: matricula no meio do ano so cobra ate 10/12, sem virar o ano).
    const endDate = payload.installmentEndDate ? new Date(`${payload.installmentEndDate}T12:00:00`) : null;
    const maxMonths = endDate ? 36 : 12; // 36 e so um teto de seguranca quando ha data limite.
    for (let monthOffset = 0; monthOffset < maxMonths; monthOffset++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, Math.min(paymentDay, 28));
      if (dueDate < today) dueDate.setDate(today.getDate());
      if (endDate && dueDate > endDate) break;
      const monthLabel = dueDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      payments.push(await createCoraPayment(env, {
        ...payload,
        amount: mensalidadeValue,
        dueDate: formatDueDate(dueDate),
        description: `Mensalidade ${monthLabel}${childName}${modality}`,
        externalReference: `${payload.registrationId || "RAE"}_${monthOffset + 1}_${Date.now()}`
      }));
    }
  }

  return payments;
}

async function coraGetPayment(env, paymentId, environment = "stage") {
  const invoice = await coraJson(env, `/v2/invoices/${encodeURIComponent(paymentId)}`, { method: "GET" }, environment);
  return normalizeCoraPayment(invoice);
}

async function coraListInvoices(env, params = {}) {
  const environment = resolveCoraEnvironment(params.environment, env);
  const query = new URLSearchParams();
  if (params.start) query.set("start", params.start);
  if (params.end) query.set("end", params.end);
  if (params.state) query.set("state", params.state);
  // O Deep Sync manda o id devolvido por /customers-by-cpf, que na Cora e
  // "cora_<cpf>" (o "cus_" e do Asaas). A busca da Cora espera o documento puro:
  // sem tirar os dois prefixos, nenhuma fatura era encontrada.
  if (params.search) query.set("search", String(params.search).replace(/^(cus_|cora_)/, ""));
  query.set("page", params.page || "1");
  query.set("perPage", params.perPage || "50");
  return coraJson(env, `/v2/invoices/?${query.toString()}`, { method: "GET" }, environment);
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * A listagem /v2/invoices/ da Cora nao devolve `services` nem `code`, entao toda
 * fatura chegava como "Cobranca Cora" e sem externalReference. O Deep Sync casa a
 * fatura com o aluno pela descricao, e sem ela nenhum pagamento era reconhecido:
 * o cache do aluno era limpo e o financeiro mostrava "SEM COBRANCA".
 * Buscamos o detalhe de cada fatura para recuperar descricao e code.
 */
async function enrichCoraInvoices(env, items, environment) {
  return mapWithConcurrency(items, 8, async (item) => {
    const id = item.id || item.invoice_id || item.invoiceId;
    if (!id) return normalizeCoraPayment(item);
    try {
      const full = await coraJson(env, `/v2/invoices/${encodeURIComponent(id)}`, { method: "GET" }, environment);
      return normalizeCoraPayment({ ...item, ...full });
    } catch (err) {
      // Se o detalhe falhar, preservamos a fatura com os campos da listagem.
      return normalizeCoraPayment(item);
    }
  });
}

async function coraCancelPayment(env, paymentId, environment = "stage") {
  return coraJson(env, `/v2/invoices/${encodeURIComponent(paymentId)}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": crypto.randomUUID() }
  }, environment);
}

async function coraStagePayInvoice(env, invoiceId) {
  if (!invoiceId) throw new Error("invoiceId é obrigatório.");
  const paid = await coraJson(env, "/v2/invoices/pay", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ id: invoiceId })
  }, "stage");
  return { payment: normalizeCoraPayment(paid), raw: paid };
}

async function coraBalance(env, environment = "stage") {
  const balance = await coraJson(env, "/third-party/account/balance", { method: "GET" }, environment);
  return normalizeCoraBalance(balance);
}

function normalizeCoraBalance(balance) {
  const available = balance.available || balance.available_amount || balance.amount || balance.balance || 0;
  return {
    balance: currencyFromCoraAmount(available),
    raw: balance
  };
}

function normalizeCoraCustomerFromInvoice(invoice, fallbackCpf = "") {
  const customer = invoice.customer || invoice.payer || {};
  const doc = customer.document?.identity || customer.document || fallbackCpf;
  return {
    id: `cora_${String(doc || customer.name || "customer").replace(/\W/g, "")}`,
    name: customer.name || "Cliente Cora",
    cpfCnpj: doc,
    email: customer.email || ""
  };
}

function normalizeCoraStatus(status) {
  const state = String(status || "").toUpperCase();
  const map = {
    PAID: "RECEIVED",
    PAYMENT_CONFIRMED: "RECEIVED",
    OPEN: "PENDING",
    DRAFT: "PENDING",
    LATE: "OVERDUE",
    OVERDUE: "OVERDUE",
    CANCELED: "DELETED",
    CANCELLED: "DELETED"
  };
  return map[state] || state || "PENDING";
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function currencyFromCoraAmount(amount) {
  if (typeof amount === "string" && amount.includes(".")) return Number(amount);
  if (typeof amount === "string" && amount.includes(",")) return Number(amount.replace(".", "").replace(",", "."));
  const number = Number(amount || 0);
  if (!Number.isFinite(number)) return 0;
  return number / 100;
}

function normalizeCoraPayment(invoice) {
  const amount = firstDefined(invoice.total_amount, invoice.totalAmount, invoice.amount, invoice.services?.[0]?.amount, 0);
  const paymentOptions = invoice.payment_options || invoice.paymentOptions || invoice.payments || {};
  const pix = paymentOptions.pix || invoice.pix || {};
  const bankSlip = paymentOptions.bank_slip || paymentOptions.bankSlip || invoice.bank_slip || invoice.bankSlip || {};
  const forms = invoice.payment_forms || invoice.paymentForms || [];

  return {
    ...invoice,
    provider: "cora",
    id: invoice.id || invoice.invoice_id || invoice.invoiceId,
    customer: invoice.customer?.document?.identity || invoice.customer?.document || invoice.customer?.name || null,
    value: currencyFromCoraAmount(amount),
    netValue: currencyFromCoraAmount(amount),
    dueDate: invoice.payment_terms?.due_date || invoice.paymentTerms?.dueDate || invoice.due_date || invoice.dueDate,
    status: normalizeCoraStatus(invoice.status || invoice.state),
    description: invoice.services?.[0]?.description || invoice.services?.[0]?.name || invoice.service?.description || invoice.code || "Cobrança Cora",
    billingType: forms.includes("BANK_SLIP") ? "BOLETO" : "PIX",
    invoiceUrl: firstDefined(invoice.invoice_url, invoice.invoiceUrl, invoice.url, bankSlip.url, bankSlip.pdf_url, pix.url),
    bankSlipUrl: firstDefined(bankSlip.url, bankSlip.pdf_url, invoice.invoice_url, invoice.url),
    pixQrCode: firstDefined(pix.emv, pix.payload, pix.copy_paste, invoice.pixQrCode),
    pixQrCodeUrl: firstDefined(pix.encoded_image, pix.encodedImage, pix.image, invoice.pixQrCodeUrl),
    externalReference: invoice.code,
    dateCreated: invoice.created_at || invoice.createdAt || new Date().toISOString(),
    paymentDate: invoice.paid_at || invoice.paidAt || invoice.payment_date || invoice.paymentDate || null
  };
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
    const lastDailyRun = await env.RAE_STORAGE.get(`fin_daily_run:${todayStr}`);
    
    if (currentTimeStr >= sendTime && !lastDailyRun) {
      await processFinancialAutomation(env, todayStr, false, f);
      await env.RAE_STORAGE.put(`fin_daily_run:${todayStr}`, "done");
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
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rumo_ao_esporte_2026_registrations?key=${env.FIREBASE_API_KEY}&pageSize=500`);
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
        
      const alreadySent = await env.RAE_STORAGE.get(kvKey);
      if (alreadySent && !isTestForce) continue; 

      // DestinatÃ¡rio
      let phone = phoneRaw.replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;
      if (testMode) phone = testPhone;

      // Texto da Mensagem
      let message = "";
      const manualMsg = "\n\nPara regularizar seu pagamento, por favor, entre em contato via WhatsApp com a secretaria do Rumo ao Esporte ou utilize a Chave PIX da escola.";
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
        await env.RAE_STORAGE.put(kvKey, "true", { expirationTtl: 86400 * 30 }); // Protege por 30 dias na chave
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
  const isPaused = await env.RAE_STORAGE.get("mq:paused") === "true";
  if (isPaused) {
    console.log("[Queue] Processamento pausado manualmente.");
    return;
  }

  const list = await env.RAE_STORAGE.list({ prefix: "mq:pending:", limit: 20 });
  if (list.keys.length === 0) return;

  for (const key of list.keys) {
    const msgData = await env.RAE_STORAGE.get(key.name);
    if (!msgData) continue;

    const msg = JSON.parse(msgData);
    
    try {
      const result = await processMessage(msg, env);
      await logToFirestore(msg, result, env);
      await env.RAE_STORAGE.delete(key.name);
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
    const lastRun = await env.RAE_STORAGE.get("last_birthday_run");
    if (lastRun === todayStr && !force) return 0;

    // 4. Se chegou o horÃ¡rio (A menos que seja force)
    if (currentTimeStr >= sendTime || force) {
      console.log(`Iniciando automaÃ§Ã£o de aniversÃ¡rios para ${todayStr}... (Modo Teste: ${testMode}, Force: ${force})`);
      if (!force) await env.RAE_STORAGE.put("last_birthday_run", todayStr); // Marca como rodado apenas no fluxo auto

      // 5. Busca todos os alunos (limitando a 300 registros para seguranÃ§a)
      const registrationsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rumo_ao_esporte_2026_registrations?key=${env.FIREBASE_API_KEY}&pageSize=300`);
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
      const workerUrl = env.WORKER_PUBLIC_URL || "https://rumo-ao-esporte-whatsapp-proxy.rumoaoesporte.workers.dev";
      
      for (const student of bdayStudents) {
        const firstName = student.name.split(' ')[0];
        const baseText = `Parab\u00e9ns ${firstName}!\n\nO Rumo ao Esporte deseja a voc\u00ea um dia repleto de alegria, sa\u00fade e muitas conquistas. Que este novo ciclo seja brilhante!\n\nFeliz anivers\u00e1rio!`;
        
        const destino = testMode ? testPhone : student.phone;
        const textoFinal = testMode 
          ? `*[MODO TESTE AUTOM\u00c1TICO]*\n_Destinat\u00e1rio original: ${student.phone}_\n\n${baseText}`
          : baseText;

        // Tenta localizar o cartÃ£o prÃ©-renderizado (enviado pelo frontend)
        const customCardId = `bday_card_${student.id.replace(/-/g, '_')}`;
        const hasCustom = await env.RAE_STORAGE.get(`img:${customCardId}`);
        
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
  await env.RAE_STORAGE.put(key, JSON.stringify({
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

