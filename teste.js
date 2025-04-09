import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import cors from "cors";

const server: McpServer = new McpServer({
  name: "sakamoto server",
  version: "1.0.0",
});

let transport: SSEServerTransport;

app.get("/sse", async (req: Request<{}, any, any, any>, res: Response<any, Record<string, any>): Promise<void> => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

server.tool(
  {
    name: "send_to_manager",
    paramsSchema: { content: z.string() },
    cb: async ({ content }: { content: string }): Promise<{}> => ({
      content: [{ type: "text", text: `Olá gerente! Segue aqui as informações do atendimento. ${content}` }],
    })
  }
);

server.tool(
  {
    name: "creating_lead_in_crm",
    paramsSchema: { name: z.string(), surname: z.string(), phone: z.string(), notes: z.string() },
    cb: async ({ name, surname, phone, notes }: { name: string, surname: string, phone: string, notes: string }): Promise<{}> => ({
      content: [{ type: "text", text: `${name} ${surname} com o telefone ${phone}. Obs: ${notes}` }],
    })
  }
);

const app: Express = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  })
);

app.get("/", (req: Request<any, any, any, any>, res: Response<any, Record<string, any>): void => {
  res.json({
    name: "Sakamoto Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "/": "Server information (this response)",
      "/sse": "Server-Sent Events endpoint for MCP connection",
      "/messages": "POST endpoint for MCP messages",
    },
    tools: [
      { name: "send_to_manager", description: "Envia as informações do atendimento para o Gerente" },
      { name: "creating_lead_in_crm", description: "Cadastra os dados do lead capturados no atendimento" }
    ],
  });
});