import { resolve, relative } from 'node:path';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const ROOT = resolve(import.meta.dirname, '../..');
const PORT = Number(process.env.MCP_PORT ?? 3333);

const server = new McpServer({
  name: 'wowolwin-repo-mcp',
  version: '1.0.0',
});

// Tool 1: Overview of the repository
server.tool(
  'get_repo_overview',
  'Provides a high-level summary of the Wowolwin game show codebase, architecture, surfaces, and completed features',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: `Wowolwin is a local 3-surface classroom game show web application for GEE008 Module 8 (Entrepreneurial Mind).
Surfaces:
1. Backbone (Presenter laptop): Controls the show, advances questions, views roster, triggers reveals, safety net deck.
2. Stage (Projector screen): Shows current question, survivor grid, 8-player bracket tree, Pera o Kahon suspense, HTML deck.
3. Player (Mobile phone): Players join via Windows hotspot, submit answers, see bout status, and pick Pera vs Kahon.

Architecture:
- Pure event-sourced state machine in src/game/machine.ts (ADR-0003: secrets never leaked before reveal).
- Server in src/server/show-server.ts (ADR-0004: strict auth guards on operator controls).
- Content in src/content/ (Taglish questions, prizes, TRIM deck slides).
- 306 automated vitest tests passing green.`,
        },
      ],
    };
  },
);

// Tool 2: Read any file in the repo
server.tool(
  'read_file',
  'Read the contents of a file in the Wowolwin repository',
  {
    path: z.string().describe('Relative path to the file from repository root (e.g. "src/game/machine.ts" or ".scratch/wowolwin/issues/08-fallback-and-rehearsal.md")'),
  },
  async ({ path: relPath }) => {
    try {
      const fullPath = resolve(ROOT, relPath);
      if (!fullPath.startsWith(ROOT)) {
        return { isError: true, content: [{ type: 'text', text: 'Access denied: path is outside repository.' }] };
      }
      if (!existsSync(fullPath)) {
        return { isError: true, content: [{ type: 'text', text: `File not found: ${relPath}` }] };
      }
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        return { isError: true, content: [{ type: 'text', text: `Path is a directory: ${relPath}. Use list_directory instead.` }] };
      }
      const content = readFileSync(fullPath, 'utf-8');
      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: 'text', text: `Error reading file: ${err.message}` }] };
    }
  },
);

// Tool 3: List files in a directory
server.tool(
  'list_directory',
  'List files and subdirectories in a folder within the repository',
  {
    path: z.string().default('').describe('Relative path to directory from repository root (default "" for root)'),
  },
  async ({ path: relPath }) => {
    try {
      const fullPath = resolve(ROOT, relPath);
      if (!fullPath.startsWith(ROOT)) {
        return { isError: true, content: [{ type: 'text', text: 'Access denied: path is outside repository.' }] };
      }
      if (!existsSync(fullPath)) {
        return { isError: true, content: [{ type: 'text', text: `Directory not found: ${relPath}` }] };
      }
      const entries = readdirSync(fullPath, { withFileTypes: true });
      const items = entries
        .filter((e) => e.name !== 'node_modules' && e.name !== '.git' && e.name !== 'dist')
        .map((e) => `${e.isDirectory() ? '[DIR] ' : '      '}${e.name}`);
      return {
        content: [{ type: 'text', text: items.join('\n') }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: 'text', text: `Error listing directory: ${err.message}` }] };
    }
  },
);

// Tool 4: Search code in repository
server.tool(
  'search_code',
  'Search for a text term across source code and markdown files in the repository',
  {
    query: z.string().describe('Search term or identifier to find'),
    folder: z.string().default('src').describe('Folder to search in (e.g. "src" or ".scratch" or "docs")'),
  },
  async ({ query, folder }) => {
    try {
      const searchDir = resolve(ROOT, folder);
      if (!searchDir.startsWith(ROOT) || !existsSync(searchDir)) {
        return { isError: true, content: [{ type: 'text', text: `Folder not found: ${folder}` }] };
      }

      const results: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
          const p = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            walk(p);
          } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.md') || p.endsWith('.css') || p.endsWith('.json')) {
            const content = readFileSync(p, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                const rel = relative(ROOT, p);
                results.push(`${rel}:${idx + 1}: ${line.trim()}`);
              }
            });
          }
        }
      };

      walk(searchDir);
      const text = results.length > 0 ? results.slice(0, 50).join('\n') : `No matches found for "${query}" in ${folder}.`;
      return {
        content: [{ type: 'text', text }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: 'text', text: `Error searching code: ${err.message}` }] };
    }
  },
);

// Setup Express with Streamable HTTP transport
const transport = new StreamableHTTPServerTransport();
await server.connect(transport);

const app = express();

// Enable CORS for web clients like Gemini
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.all(['/mcp', '/sse'], async (req, res) => {
  await transport.handleRequest(req, res);
});

app.use('/.well-known', (_req, res) => {
  res.status(404).json({ error: 'OAuth not required' });
});

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'wowolwin-repo-mcp',
    mcpEndpoint: '/mcp',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Wowolwin MCP Server] running on http://localhost:${PORT}`);
  console.log(`[Wowolwin MCP Server] MCP endpoint: http://localhost:${PORT}/mcp`);
});
