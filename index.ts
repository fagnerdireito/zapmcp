import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
dotenv.config();

const server = new McpServer({
    name: "evolution-tools-server",
    version: "1.0.0",
    capabilities: { tools: {} }
});

// init express server
const app = express();

let transport: SSEServerTransport;

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: false,
    })
);

// tools básicas
server.tool(
    "hello",
    // parametros
    {name: z.string()}, 
    async ({name}) => {
        return {
            content: [{
                type: "text",
                text: `Hello ${name}`
            }]
        }
    }
);

// Evolution API Tools
server.tool(
    "envia_mensagem",
    {
        number: z.string().describe("Número do destinatário com DDI e DDD"),
        mensagem: z.string().describe("Texto da mensagem a ser enviada")
    },
    async ({number, mensagem}) => {
        const instancia = process.env.EVOLUTION_INSTANCIA;
        const apikey = process.env.EVOLUTION_APIKEY;
        const apiBase = process.env.EVOLUTION_API_BASE || "sua_url_evolution";

        try {
            const url = `https://${apiBase}/message/sendText/${instancia}`;
            const response = await axios.post(url, {
                number,
                text: mensagem,
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "apikey": apikey,
                },
            });

            return {
                content: [{
                    type: "text",
                    text: `Mensagem enviada com sucesso para ${number}.\nResposta: ${JSON.stringify(response.data)}`,
                }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Erro ao enviar mensagem: ${error.message}`,
                }]
            };
        }
    }
);

server.tool(
    "cria_grupo",
    {
        subject: z.string().describe("Nome do grupo"),
        description: z.string().optional().describe("Descrição do grupo"),
        participants: z.array(z.string()).describe("Participantes do grupo (números com DDI/DDD)")
    },
    async ({subject, description, participants}) => {
        const instancia = process.env.EVOLUTION_INSTANCIA;
        const apikey = process.env.EVOLUTION_APIKEY;
        const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

        try {
            const url = `https://${apiBase}/group/create/${instancia}`;
            const response = await axios.post(url, {
                subject,
                description,
                participants,
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
                }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Erro ao criar grupo: ${error.message}`,
                }]
            };
        }
    }
);

server.tool(
    "busca_grupos",
    {
        getParticipants: z.boolean().optional().default(false).describe("Listar participantes dos grupos?")
    },
    async ({getParticipants}) => {
        const instancia = process.env.EVOLUTION_INSTANCIA;
        const apikey = process.env.EVOLUTION_APIKEY;
        const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

        try {
            const url = `https://${apiBase}/group/fetchAllGroups/${instancia}?getParticipants=${getParticipants}`;
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
                }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Erro ao obter grupos: ${error.message}`,
                }]
            };
        }
    }
);

server.tool(
    "busca_participantes_grupo",
    {
        groupJid: z.string().describe("Identificador do grupo")
    },
    async ({groupJid}) => {
        const instancia = process.env.EVOLUTION_INSTANCIA;
        const apikey = process.env.EVOLUTION_APIKEY;
        const apiBase = process.env.EVOLUTION_API_BASE || "url_evolution";

        try {
            const url = `https://${apiBase}/group/participants/${instancia}?groupJid=${groupJid}`;
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
                }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Erro ao obter participantes: ${error.message}`,
                }]
            };
        }
    }
);

// rotas do express
app.get("/", (req, res) => {
    res.json({
        name: "evolution-tools-server",
        version: "1.0.0",
        status: "running",
        endpoints: {
            "/": "Server information (this response)",
            "/sse": "Server-Sent Events endpoint for MCP connection",
            "/messages": "POST endpoint for MCP messages",
        },
        tools: [
            { name: "hello", description: "Retorna seja bem vindo ao usuario" },
            { name: "envia_mensagem", description: "Envia mensagem de texto via API Evolution" },
            { name: "cria_grupo", description: "Cria um grupo via API Evolution" },
            { name: "busca_grupos", description: "Busca todos os grupos da instância" },
            { name: "busca_participantes_grupo", description: "Busca participantes específicos de um grupo" },
            { name: "send_to_manager", description: "Envia as informações do atendimento para o Gerente" },
            { name: "creating_lead_in_crm", description: "Cadastra os dados do lead capturados no atendimento" }
        ],
    });
});

app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server MCP is running on port ${PORT}`);
});