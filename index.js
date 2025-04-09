"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require("zod");
const dotenv = require("dotenv");
const cors_1 = __importDefault(require("cors"));
dotenv.config();
const server = new mcp_js_1.McpServer({
    name: "evolution-tools-server",
    version: "1.0.0",
    capabilities: { tools: {} }
});
// init express server
const app = (0, express_1.default)();
let transport;
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
}));
// tools
server.tool("hello", 
// parametros
{ name: z.string() }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ name }) {
    return {
        content: [{
                type: "text",
                text: `Hello ${name}`
            }]
    };
}));
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
app.get("/sse", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    transport = new sse_js_1.SSEServerTransport("/messages", res);
    yield server.connect(transport);
}));
app.post("/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield transport.handlePostMessage(req, res);
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server MCP is running on port ${PORT}`);
});
