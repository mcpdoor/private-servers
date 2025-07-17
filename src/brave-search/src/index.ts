import 'dotenv/config';
import express from 'express';
import { randomUUID } from "node:crypto";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BraveSearchService } from './service.js';
import { createAuthMiddleware } from '../../middleware/auth.middleware.js';
import { AuthService } from '../../middleware/auth.service.js';
import dotenv from 'dotenv';
import { createSessionValidator } from '../../middleware/session.middleware.js';

dotenv.config({ path: '../../.env' });

// Create Express application
const app = express();
app.use(express.json());

// Initialize services
const mcpServerId = 'brave-search';
const validateAuth = createAuthMiddleware(mcpServerId);
const authService = new AuthService(mcpServerId);

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

const getServer = (externalApiKey: string) => {
  const server = new McpServer({
    name: 'mcp-server/brave-search',
    version: '0.1.0',
  }, { capabilities: { tools: {} } });

  // Initialize Brave Search service with the provided API key
  const braveSearchService = new BraveSearchService(externalApiKey);

  // Register Brave Search tools
  server.tool(
    'brave_web_search',
    'Search the web using Brave Search API',
    {
      query: z.string().describe('The search query'),
      country: z.string().optional().describe('Country code for search region (e.g., "US", "FR")'),
      count: z.number().min(1).max(20).optional().describe('Number of results to return (max 20, default 10)'),
      offset: z.number().min(0).optional().describe('Number of results to skip'),
      safesearch: z.enum(['strict', 'moderate', 'off']).optional().describe('Safe search setting'),
      freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('Freshness filter (past day, week, month, year)'),
      extra_snippets: z.boolean().optional().describe('Include extra text snippets'),
      summary: z.boolean().optional().describe('Include AI-generated summary')
    },
    async ({ query, country, count, offset, safesearch, freshness, extra_snippets, summary }): Promise<CallToolResult> => {
      const result = await braveSearchService.webSearch({
        q: query,
        country,
        count,
        offset,
        safesearch,
        freshness,
        extra_snippets,
        summary
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_news_search',
    'Search for news using Brave Search API',
    {
      query: z.string().describe('The news search query'),
      count: z.number().min(1).max(20).optional().describe('Number of results to return (max 20, default 10)'),
      freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('Freshness filter (past day, week, month, year)'),
      country: z.string().optional().describe('Country code for search region')
    },
    async ({ query, count, freshness, country }): Promise<CallToolResult> => {
      const result = await braveSearchService.newsSearch(query, count, freshness, country);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_image_search',
    'Search for images using Brave Search API',
    {
      query: z.string().describe('The image search query'),
      count: z.number().min(1).max(20).optional().describe('Number of results to return (max 20, default 10)'),
      country: z.string().optional().describe('Country code for search region')
    },
    async ({ query, count, country }): Promise<CallToolResult> => {
      const result = await braveSearchService.imageSearch(query, count, country);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_video_search',
    'Search for videos using Brave Search API',
    {
      query: z.string().describe('The video search query'),
      count: z.number().min(1).max(20).optional().describe('Number of results to return (max 20, default 10)'),
      country: z.string().optional().describe('Country code for search region')
    },
    async ({ query, count, country }): Promise<CallToolResult> => {
      const result = await braveSearchService.videoSearch(query, count, country);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_local_search',
    'Get detailed information about local points of interest',
    {
      ids: z.array(z.string()).describe('Array of location IDs obtained from web search results')
    },
    async ({ ids }): Promise<CallToolResult> => {
      const result = await braveSearchService.localPoiSearch(ids);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_local_descriptions',
    'Get AI-generated descriptions for local points of interest',
    {
      ids: z.array(z.string()).describe('Array of location IDs obtained from web search results')
    },
    async ({ ids }): Promise<CallToolResult> => {
      const result = await braveSearchService.localDescriptions(ids);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_search_with_goggles',
    'Search using Brave Search Goggles for customized ranking',
    {
      query: z.string().describe('The search query'),
      goggles_id: z.string().describe('Goggles ID or URL for custom ranking'),
      count: z.number().min(1).max(20).optional().describe('Number of results to return (max 20, default 10)')
    },
    async ({ query, goggles_id, count }): Promise<CallToolResult> => {
      const result = await braveSearchService.searchWithGoggles(query, goggles_id, count);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!('error' in result)
      };
    }
  );

  server.tool(
    'brave_get_location_ids',
    'Extract location IDs from a location-based search to use with local search tools',
    {
      query: z.string().describe('Location-based search query (e.g., "restaurants in Paris")')
    },
    async ({ query }): Promise<CallToolResult> => {
      const locationIds = await braveSearchService.getLocationIds(query);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            query,
            location_ids: locationIds,
            count: locationIds.length,
            message: locationIds.length > 0 
              ? "Use these IDs with brave_local_search or brave_local_descriptions tools"
              : "No location IDs found in search results"
          }, null, 2)
        }]
      };
    }
  );

  return server;
};

//=============================================================================
// STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
//=============================================================================

// Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
app.all('/mcp', validateAuth, async (req, res) => {
  console.log(`Received ${req.method} request to /mcp`);

  try {
    // Get the Brave Search API key from the request
    const externalApiKey = (req as any).externalApiKey;

    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Check if the transport is of the correct type
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        // Reuse existing transport
        transport = existingTransport;
      } else {
        // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session exists but uses a different transport protocol',
          },
          id: null,
        });
        return;
      }
    } else if (req.method === 'POST') {
      // Create new transport for initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server with the current API key
      const server = getServer(externalApiKey);
      await server.connect(transport);

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      // Invalid request - no session ID for non-POST request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with the transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

//=============================================================================
// DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
//=============================================================================

app.get('/sse', validateAuth, async (req, res) => {
  console.log('Received GET request to /sse (deprecated SSE transport)');
  const externalApiKey = (req as any).externalApiKey;
  const apiKey = req.query.apiKey as string;
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  // Store the API key with the transport
  (transport as any).apiKey = apiKey;
  (transport as any).externalApiKey = externalApiKey;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  const server = getServer(externalApiKey);
  await server.connect(transport);
});

// Middleware to validate session and API key
const validateSession = createSessionValidator(transports, authService, 'externalApiKey');

app.post("/messages", validateSession, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId] as SSEServerTransport;
  await transport.handlePostMessage(req, res, req.body);
});

// Start the server
app.listen(8080, '0.0.0.0', () => {
  console.log(`Brave Search MCP server listening on port 8080`);
  console.log(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable Http(Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage: 
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. Http + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>

==============================================
AVAILABLE BRAVE SEARCH TOOLS:

- brave_web_search: General web search
- brave_news_search: News articles search
- brave_image_search: Image search
- brave_video_search: Video search
- brave_local_search: Local POI details
- brave_local_descriptions: AI descriptions for POI
- brave_search_with_goggles: Custom ranking search
- brave_get_location_ids: Extract location IDs

==============================================
`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log('Server shutdown complete');
  process.exit(0);
});