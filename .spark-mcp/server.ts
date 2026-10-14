import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function resolveSafePath(relativePath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error("Access denied: Path traversal outside project root is blocked.");
  }
  return resolved;
}

function createProjectMcpServer() {
  const server = new McpServer({
    name: "project-workspace-mcp",
    version: "1.0.0",
  });

  server.tool(
    "list_project_files",
    "List files and directories inside the project root.",
    {
      dirPath: z.string().default(".").describe("Relative directory path from project root"),
    },
    async ({ dirPath }) => {
      const targetDir = resolveSafePath(dirPath);
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const formatted = entries
        .filter((e) => !["node_modules", ".git", ".next", ".spark-mcp"].includes(e.name))
        .map((e) => `${e.isDirectory() ? "[DIR] " : "[FILE]"} ${e.name}`)
        .join("\n");
      return { content: [{ type: "text", text: formatted || "Directory is empty." }] };
    }
  );

  server.tool(
    "get_file_tree",
    "Recursively inspect the project directory structure up to a given depth to view the entire hierarchy.",
    {
      subDir: z.string().default(".").describe("Subfolder to start from"),
      maxDepth: z.number().default(3).describe("Maximum directory depth to traverse"),
    },
    async ({ subDir, maxDepth }) => {
      const startPath = resolveSafePath(subDir);
      const lines: string[] = [];

      async function walk(currentDir: string, currentDepth: number) {
        if (currentDepth > maxDepth) return;
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (["node_modules", ".git", ".next", ".spark-mcp", "dist", "build"].includes(entry.name)) continue;
          const relative = path.relative(PROJECT_ROOT, path.join(currentDir, entry.name));
          const indent = "  ".repeat(currentDepth);
          lines.push(`${indent}${entry.isDirectory() ? "[DIR] " : "[FILE] "}${relative}`);
          if (entry.isDirectory()) {
            await walk(path.join(currentDir, entry.name), currentDepth + 1);
          }
        }
      }

      await walk(startPath, 0);
      return { content: [{ type: "text", text: lines.join("\n") || "Directory is empty." }] };
    }
  );

  server.tool(
    "read_project_file",
    "Read the full contents of a file in the project directory.",
    {
      filePath: z.string().describe("Relative file path from project root"),
    },
    async ({ filePath }) => {
      const targetFile = resolveSafePath(filePath);
      const content = await fs.readFile(targetFile, "utf-8");
      return { content: [{ type: "text", text: content }] };
    }
  );

  server.tool(
    "modify_project_file",
    "Create a new file, overwrite a file, or replace a code block in an existing file.",
    {
      filePath: z.string().describe("Relative file path from project root"),
      mode: z.enum(["overwrite", "replace_block"]),
      searchBlock: z.string().optional(),
      newContent: z.string(),
    },
    async ({ filePath, mode, searchBlock, newContent }) => {
      const targetFile = resolveSafePath(filePath);
      await fs.mkdir(path.dirname(targetFile), { recursive: true });

      if (mode === "replace_block") {
        if (!searchBlock) throw new Error("searchBlock is required when mode is 'replace_block'.");
        const existing = await fs.readFile(targetFile, "utf-8");
        if (!existing.includes(searchBlock)) {
          throw new Error("searchBlock not found in target file.");
        }
        await fs.writeFile(targetFile, existing.replace(searchBlock, newContent), "utf-8");
        return { content: [{ type: "text", text: `Successfully patched ${filePath}` }] };
      }

      await fs.writeFile(targetFile, newContent, "utf-8");
      return { content: [{ type: "text", text: `Successfully wrote ${filePath}` }] };
    }
  );

  server.tool(
    "analyze_project",
    "Run diagnostics like git status, typecheck, lint, or search.",
    {
      action: z.enum(["git_status", "git_diff", "typecheck", "lint", "test", "ripgrep"]),
      query: z.string().optional(),
    },
    async ({ action, query }) => {
      let cmd = "";
      let args: string[] = [];

      switch (action) {
        case "git_status": cmd = "git"; args = ["status", "--short"]; break;
        case "git_diff": cmd = "git"; args = ["diff"]; break;
        case "typecheck": cmd = "npx"; args = ["tsc", "--noEmit"]; break;
        case "lint": cmd = "npm"; args = ["run", "lint"]; break;
        case "test": cmd = "npm"; args = ["test"]; break;
        case "ripgrep":
          if (!query) throw new Error("Provide a 'query' for ripgrep.");
          cmd = "rg";
          args = ["--line-number", "--max-count=50", query, "."];
          break;
      }

      try {
        const { stdout, stderr } = await execFileAsync(cmd, args, { cwd: PROJECT_ROOT, timeout: 30000 });
        return { content: [{ type: "text", text: stdout || stderr || "Completed with no output." }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.stdout || ""}\n${err.stderr || err.message}` }] };
      }
    }
  );

  server.tool(
    "execute_command",
    "Run arbitrary terminal/shell commands in the project root directory (e.g. npm install, git log, npx prisma, etc.).",
    {
      command: z.string().describe("Terminal command to run"),
      timeoutSeconds: z.number().default(45).describe("Command timeout in seconds"),
    },
    async ({ command, timeoutSeconds }) => {
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: PROJECT_ROOT,
          timeout: timeoutSeconds * 1000,
          maxBuffer: 1024 * 1024 * 4,
          env: { ...process.env, CI: "true" },
        });
        const output = (stdout || stderr || "Command completed with no output.").trim();
        return {
          content: [{ type: "text", text: output.slice(0, 15000) }],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Exit Code ${err.code ?? 1}\nOutput:\n${(err.stdout || "").slice(-2000)}\nErrors:\n${(err.stderr || err.message).slice(-2000)}`,
            },
          ],
        };
      }
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// CORS headers for MCP clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Session registry for Streamable HTTP
const transports = new Map<string, StreamableHTTPServerTransport>();

const handleMcpPost = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // Create new session
  const server = createProjectMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) transports.delete(transport.sessionId);
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }
};

const handleMcpGetOrDelete = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }
  res.status(400).send("Session ID required or session expired.");
};

// Mount handlers on both / and /mcp
app.post("/", handleMcpPost);
app.post("/mcp", handleMcpPost);
app.get("/", handleMcpGetOrDelete);
app.get("/mcp", handleMcpGetOrDelete);
app.delete("/", handleMcpGetOrDelete);
app.delete("/mcp", handleMcpGetOrDelete);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`MCP server active on port ${PORT}`);
  console.log(`Directory locked to: ${PROJECT_ROOT}`);
});