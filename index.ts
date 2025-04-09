import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
import cors from "cors";
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

// tools
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
)
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