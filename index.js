const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { HttpSseServerTransport } = require("@modelcontextprotocol/sdk/server/http-sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");
const axios = require("axios");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");

dotenv.config();

// Esquemas de validação com Zod (mantidos do seu código original)
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

// Definições das ferramentas (tools) - mantidas do seu código original
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

// Handlers das ferramentas (mantidos do seu código original)
const toolHandlers = {
  envia_mensagem: async (args) => {
    const parsed = schemas.toolInputs.enviaMensagem.parse(args);

    const instancia = process.env.EVOLUTION_INSTANCIA;
    const apikey = process.env.EVOLUTION_APIKEY;
    const apiBase = process.env.EVOLUTION_API_BASE || "sua_url_evolution";

    const url = `http://${apiBase}/message/sendText/${instancia}`;
    const response = await axios.post(url, {
      number: parsed.number,
      text: parsed.mensagem,
    }, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apikey,
      },
    });

    return {
      content: [{
        type: "text",
        text: `Mensagem enviada com sucesso para ${parsed.number}.\nResposta: ${JSON.stringify(response.data)}`,
      }],
    };
  },

  cria_grupo: async (args) => {
    const parsed = schemas.toolInputs.criaGrupo.parse(args);

    const instancia = process.env.EVOLUTION_INSTANCIA;
    const apikey = process.env.EVOLUTION_APIKEY;
    const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

    const url = `http://${apiBase}/group/create/${instancia}`;
    const response = await axios.post(url, {
      subject: parsed.subject,
      description: parsed.description,
      participants: parsed.participants,
    }, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apikey,
      },
    });

    return {
      content: [{
        type: "text",
        text: `Grupo criado com sucesso!\nResposta: ${JSON.stringify(response.data)}`,
      }],
    };
  },

  busca_grupos: async (args) => {
    const parsed = schemas.toolInputs.buscaGrupos.parse(args);

    const instancia = process.env.EVOLUTION_INSTANCIA;
    const apikey = process.env.EVOLUTION_APIKEY;
    const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

    const url = `http://${apiBase}/group/fetchAllGroups/${instancia}?getParticipants=${parsed.getParticipants}`;

    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "apikey": apikey,
        },
      });

      return {
        content: [{
          type: "text",
          text: `Grupos obtidos com sucesso:\n${JSON.stringify(response.data, null, 2)}`,
        }],
      };
    } catch (error) {
      console.error("Erro na chamada API Evolution:", error);
      return {
        content: [{
          type: "text",
          text: `Erro ao obter grupos: ${error.message}`,
        }],
      };
    }
  },

  busca_participantes_grupo: async (args) => {
    const parsed = schemas.toolInputs.buscaParticipantesGrupo.parse(args);

    const instancia = process.env.EVOLUTION_INSTANCIA;
    const apikey = process.env.EVOLUTION_APIKEY;
    const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

    const url = `http://${apiBase}/group/participants/${instancia}?groupJid=${parsed.groupJid}`;

    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "apikey": apikey,
        },
      });

      return {
        content: [{
          type: "text",
          text: `Participantes obtidos com sucesso:\n${JSON.stringify(response.data, null, 2)}`,
        }],
      };
    } catch (error) {
      console.error("Erro na chamada API Evolution:", error);
      return {
        content: [{
          type: "text",
          text: `Erro ao obter participantes: ${error.message}`,
        }],
      };
    }
  },
};

// Instância do servidor MPC
const server = new Server(
  { name: "evolution-tools-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Handlers das requisições MPC
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("Ferramenta requisitada pelo cliente");
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = toolHandlers[name];
    if (!handler) throw new Error(`Tool Desconhecida: ${name}`);
    return await handler(args);
  } catch (error) {
    console.error(`Erro executando a tool ${name}:`, error);
    throw error;
  }
});

// Configuração Express para o servidor HTTP
const app = express();
app.use(cors());
app.use(express.json());

// Rota de verificação de status
app.get('/status', (req, res) => {
  res.json({ status: 'online', version: '1.0.0' });
});

// Função principal para iniciar o servidor HTTP com SSE
async function main() {
  const port = process.env.PORT || 3000;
  
  // Criar e configurar o transporte HTTP com SSE
  const transport = new HttpSseServerTransport({
    path: "/mcp", // Caminho base para o endpoint MCP
  });
  
  // Conectar o servidor MPC ao transporte HTTP
  await server.connect(transport);
  
  // Montar o middleware do transporte no Express
  app.use(transport.middleware);
  
  // Iniciar o servidor HTTP
  app.listen(port, () => {
    console.log(`Servidor MCP HTTP/SSE rodando na porta ${port}`);
    console.log(`Endpoint MCP disponível em: http://localhost:${port}/mcp`);
  });
}

// Execução principal
main().catch((error) => {
  console.error("Erro Fatal:", error);
  process.exit(1);
});