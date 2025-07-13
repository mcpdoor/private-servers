import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import { randomUUID } from "node:crypto";
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GoogleMapsService } from './service.js';
import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../../middleware/auth.middleware.js';
import { AuthService } from '../../middleware/auth.service.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { createSessionValidator } from '../../middleware/session.middleware.js';

dotenv.config({ path: '../../.env' });

// Create Express application
const app = express();
app.use(express.json());

// Initialize services
const mcpDoorId = 'google-maps';
const authMiddleware = createAuthMiddleware(mcpDoorId);
const authService = new AuthService(mcpDoorId);

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

const getServer = (gmApiKey: string) => {
  const server = new McpServer({
    name: 'mcp-server/google-maps',
    version: '0.1.0',
  }, { capabilities: { tools: {} } });

  // Initialize Google Maps service with the provided API key
  const googleMapsService = new GoogleMapsService(gmApiKey);

  // Register Google Maps tools
  server.tool(
    'maps_geocode',
    'Convert an address into geographic coordinates',
    {
      address: z.string().describe('The address to geocode')
    },
    async ({ address }): Promise<CallToolResult> => {
      const result = await googleMapsService.geocode(address);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_reverse_geocode',
    'Convert coordinates into an address',
    {
      latitude: z.number().describe('Latitude coordinate'),
      longitude: z.number().describe('Longitude coordinate')
    },
    async ({ latitude, longitude }): Promise<CallToolResult> => {
      const result = await googleMapsService.reverseGeocode(latitude, longitude);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_search_places',
    'Search for places using Google Places API',
    {
      query: z.string().describe('Search query'),
      location: z.object({
        latitude: z.number(),
        longitude: z.number()
      }).optional().describe('Optional center point for the search'),
      radius: z.number().optional().describe('Search radius in meters (max 50000)')
    },
    async ({ query, location, radius }): Promise<CallToolResult> => {
      const result = await googleMapsService.searchPlaces(query, location, radius);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_place_details',
    'Get detailed information about a specific place',
    {
      place_id: z.string().describe('The place ID to get details for')
    },
    async ({ place_id }): Promise<CallToolResult> => {
      const result = await googleMapsService.getPlaceDetails(place_id);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_distance_matrix',
    'Calculate travel distance and time for multiple origins and destinations',
    {
      origins: z.array(z.string()).describe('Array of origin addresses or coordinates'),
      destinations: z.array(z.string()).describe('Array of destination addresses or coordinates'),
      mode: z.enum(['driving', 'walking', 'bicycling', 'transit']).optional().describe('Travel mode')
    },
    async ({ origins, destinations, mode }): Promise<CallToolResult> => {
      const result = await googleMapsService.getDistanceMatrix(origins, destinations, mode);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_elevation',
    'Get elevation data for locations on the earth',
    {
      locations: z.array(z.object({
        latitude: z.number(),
        longitude: z.number()
      })).describe('Array of locations to get elevation for')
    },
    async ({ locations }): Promise<CallToolResult> => {
      const result = await googleMapsService.getElevation(locations);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  server.tool(
    'maps_directions',
    'Get directions between two points',
    {
      origin: z.string().describe('Starting point address or coordinates'),
      destination: z.string().describe('Ending point address or coordinates'),
      mode: z.enum(['driving', 'walking', 'bicycling', 'transit']).optional().describe('Travel mode')
    },
    async ({ origin, destination, mode }): Promise<CallToolResult> => {
      const result = await googleMapsService.getDirections(origin, destination, mode);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }],
        isError: !!result.error
      };
    }
  );

  return server;
};

//=============================================================================
// STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
//=============================================================================

// Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
app.all('/mcp', authMiddleware, async (req, res) => {
  console.log(`Received ${req.method} request to /mcp`);

  try {
    // Get the Google Maps API key from the request
    const gmApiKey = (req as any).externalApiKey;

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
      const server = getServer(gmApiKey);
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

app.get('/sse', authMiddleware, async (req, res) => {
  console.log('Received GET request to /sse (deprecated SSE transport)');
  const gmApiKey = (req as any).externalApiKey;
  const apiKey = req.query.apiKey as string;
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  // Store the API key with the transport
  (transport as any).apiKey = apiKey;
  (transport as any).gmApiKey = gmApiKey;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  const server = getServer(gmApiKey);
  await server.connect(transport);
});

const validateSession = createSessionValidator(transports, authService, 'gmApiKey');

app.post("/messages", validateSession, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId] as SSEServerTransport;
  await transport.handlePostMessage(req, res, req.body);
});

// Start the server
app.listen(8080, '0.0.0.0', () => {
  console.log(`Google Maps MCP server listening on port 8080`);
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
