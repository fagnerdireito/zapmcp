
const express = require("express");
const bodyParser = require("body-parser");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

// Esquemas de validação com Zod
const schemas = {
  toolInputs: {
    enviaMensagem: z.object({
      number: z.string(),
      mensagem: z.string(),
    }),
    criaGrupo: z.object({
      subject: z.string(),
      description: z.string().optional(),
      participants: z.array(z.string()),
    }),
    buscaGrupos: z.object({
      getParticipants: z.boolean().optional().default(false),
    }),
    buscaParticipantesGrupo: z.object({
      groupJid: z.string(),
    }),
  },
};

// Definições das ferramentas (tools)
const TOOL_DEFINITIONS = [
  {
    name: "envia_mensagem",
    description: "Envia mensagem de texto via API Evolution",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "string", description: "Número do destinatário com DDI e DDD" },
        mensagem: { type: "string", description: "Texto da mensagem a ser enviada" },
      },
      required: ["number", "mensagem"],
    },
  },
  {
    name: "cria_grupo",
    description: "Cria um grupo via API Evolution",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Nome do grupo" },
        description: { type: "string", description: "Descrição do grupo" },
        participants: {
          type: "array",
          items: { type: "string" },
          description: "Participantes do grupo (números com DDI/DDD)"
        },
      },
      required: ["subject", "participants"],
    },
  },
  {
    name: "busca_grupos",
    description: "Busca todos os grupos da instância com opção de listar participantes.",
    inputSchema: {
      type: "object",
      properties: {
        getParticipants: {
          type: "boolean",
          description: "Listar participantes dos grupos?",
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: "busca_participantes_grupo",
    description: "Busca participantes específicos de um grupo pela instância.",
    inputSchema: {
      type: "object",
      properties: {
        groupJid: { type: "string", description: "Identificador do grupo" },
      },
      required: ["groupJid"],
    },
  },
];

// Handlers das ferramentas
const toolHandlers = {
  envia_mensagem: async (args) => {
    const parsed = schemas.toolInputs.enviaMensagem.parse(args);
    const { EVOLUTION_INSTANCIA, EVOLUTION_APIKEY, EVOLUTION_API_BASE = "sua_url_evolution" } = process.env;
    const url = `http://${EVOLUTION_API_BASE}/message/sendText/${EVOLUTION_INSTANCIA}`;
    const response = await axios.post(url, {
      number: parsed.number,
      text: parsed.mensagem,
    }, {
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_APIKEY },
    });
    return { content: [{ type: "text", text: `Mensagem enviada com sucesso para ${parsed.number}.\nResposta: ${JSON.stringify(response.data)}` }] };
  },
  cria_grupo: async (args) => {
    const parsed = schemas.toolInputs.criaGrupo.parse(args);
    const { EVOLUTION_INSTANCIA, EVOLUTION_APIKEY, EVOLUTION_API_BASE = "url_evolution" } = process.env;
    const url = `http://${EVOLUTION_API_BASE}/group/create/${EVOLUTION_INSTANCIA}`;
    const response = await axios.post(url, {
      subject: parsed.subject,
      description: parsed.description,
      participants: parsed.participants,
    }, {
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_APIKEY },
    });
    return { content: [{ type: "text", text: `Grupo criado com sucesso!\nResposta: ${JSON.stringify(response.data)}` }] };
  },
  busca_grupos: async (args) => {
    const parsed = schemas.toolInputs.buscaGrupos.parse(args);
    const { EVOLUTION_INSTANCIA, EVOLUTION_APIKEY, EVOLUTION_API_BASE = "url_evolution" } = process.env;
    const url = `http://${EVOLUTION_API_BASE}/group/fetchAllGroups/${EVOLUTION_INSTANCIA}?getParticipants=${parsed.getParticipants}`;
    try {
      const response = await axios.get(url, {
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_APIKEY },
      });
      return { content: [{ type: "text", text: `Grupos obtidos com sucesso:\n${JSON.stringify(response.data, null, 2)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Erro ao obter grupos: ${error.message}` }] };
    }
  },
  busca_participantes_grupo: async (args) => {
    const parsed = schemas.toolInputs.buscaParticipantesGrupo.parse(args);
    const { EVOLUTION_INSTANCIA, EVOLUTION_APIKEY, EVOLUTION_API_BASE = "url_evolution" } = process.env;
    const url = `http://${EVOLUTION_API_BASE}/group/participants/${EVOLUTION_INSTANCIA}?groupJid=${parsed.groupJid}`;
    try {
      const response = await axios.get(url, {
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_APIKEY },
      });
      return { content: [{ type: "text", text: `Participantes obtidos com sucesso:\n${JSON.stringify(response.data, null, 2)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Erro ao obter participantes: ${error.message}` }] };
    }
  },
};

// Inicialização do servidor MCP
const server = new Server({ name: "evolution-tools-server", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers[name];
  if (!handler) throw new Error(`Tool Desconhecida: ${name}`);
  return await handler(args);
});

// Servidor HTTP com SSE
const app = express();
app.use(bodyParser.json());
const transports = {};
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => { delete transports[transport.sessionId]; });
  await server.connect(transport);
});
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) return res.status(400).send("Transporte não encontrado para sessionId fornecido.");
  await transport.handlePostMessage(req, res);
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Evolution MCP Server rodando com SSE em http://localhost:${PORT}`));
