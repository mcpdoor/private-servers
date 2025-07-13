import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import axios, { AxiosInstance } from 'axios';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { FieldType, FieldOption, fieldRequiresOptions, getDefaultOptions } from './types.js';
import { createAuthMiddleware } from '../../middleware/auth.middleware.js';
import { AuthService } from '../../middleware/auth.service.js';
import dotenv from 'dotenv';
import { createSessionValidator } from '../../middleware/session.middleware.js';

dotenv.config({ path: '../../.env' });

// Express app
const app = express();
app.use(express.json());

const mcpServerId = 'airtable';
const validateAuth = createAuthMiddleware(mcpServerId);
const authService = new AuthService(mcpServerId);

// Airtable MCP Server logic
class AirtableServer {
  public server: McpServer;
  public axiosInstance: AxiosInstance;

  constructor(apiKey: string) {
    this.server = new McpServer(
      {
        name: 'airtable-server',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.axiosInstance = axios.create({
      baseURL: 'https://api.airtable.com/v0',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    this.registerTools();
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private validateField(field: FieldOption): FieldOption {
    const { type } = field;
    if (!fieldRequiresOptions(type as FieldType)) {
      const { options, ...rest } = field;
      return rest;
    }
    if (!field.options) {
      return {
        ...field,
        options: getDefaultOptions(type as FieldType),
      };
    }
    return field;
  }

  private registerTools() {
    // Register all tools from the manifest using .tool()
    this.server.tool(
      'list_bases',
      'List all accessible Airtable bases',
      {},
      async () => {
        const response = await this.axiosInstance.get('/meta/bases');
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.bases, null, 2) }],
        };
      }
    );
    this.server.tool(
      'list_tables',
      'List all tables in a base',
      {
        base_id: { type: 'string', description: 'ID of the base' },
      },
      async ({ base_id }) => {
        const response = await this.axiosInstance.get(`/meta/bases/${base_id}/tables`);
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.tables, null, 2) }],
        };
      }
    );
    this.server.tool(
      'create_table',
      'Create a new table in a base',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the new table' },
        description: { type: 'string', description: 'Description of the table' },
        fields: {
          type: 'array',
          description: 'Initial fields for the table',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the field' },
              type: { type: 'string', description: 'Type of the field' },
              description: { type: 'string', description: 'Description of the field' },
              options: { type: 'object', description: 'Field-specific options' },
            },
            required: ['name', 'type'],
          },
        },
      },
      async ({ base_id, table_name, description, fields }) => {
        const validatedFields = fields?.map((field: FieldOption) => this.validateField(field));
        const response = await this.axiosInstance.post(`/meta/bases/${base_id}/tables`, {
          name: table_name,
          description,
          fields: validatedFields,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'update_table',
      "Update a table's schema",
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_id: { type: 'string', description: 'ID of the table to update' },
        name: { type: 'string', description: 'New name for the table' },
        description: { type: 'string', description: 'New description for the table' },
      },
      async ({ base_id, table_id, name, description }) => {
        const response = await this.axiosInstance.patch(`/meta/bases/${base_id}/tables/${table_id}`, {
          name,
          description,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'create_field',
      'Create a new field in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_id: { type: 'string', description: 'ID of the table' },
        field: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the field' },
            type: { type: 'string', description: 'Type of the field' },
            description: { type: 'string', description: 'Description of the field' },
            options: { type: 'object', description: 'Field-specific options' },
          },
          required: ['name', 'type'],
        },
      },
      async ({ base_id, table_id, field }) => {
        const validatedField = this.validateField(field);
        const response = await this.axiosInstance.post(
          `/meta/bases/${base_id}/tables/${table_id}/fields`,
          validatedField
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'update_field',
      'Update a field in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_id: { type: 'string', description: 'ID of the table' },
        field_id: { type: 'string', description: 'ID of the field to update' },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'New name for the field' },
            description: { type: 'string', description: 'New description for the field' },
            options: { type: 'object', description: 'New field-specific options' },
          },
        },
      },
      async ({ base_id, table_id, field_id, updates }) => {
        const response = await this.axiosInstance.patch(
          `/meta/bases/${base_id}/tables/${table_id}/fields/${field_id}`,
          updates
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'list_records',
      'List records in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        max_records: { type: 'number', description: 'Maximum number of records to return' },
      },
      async ({ base_id, table_name, max_records }) => {
        const response = await this.axiosInstance.get(`/${base_id}/${table_name}`, {
          params: max_records ? { maxRecords: max_records } : undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.records, null, 2) }],
        };
      }
    );
    this.server.tool(
      'create_record',
      'Create a new record in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        fields: { type: 'object', description: 'Record fields as key-value pairs' },
      },
      async ({ base_id, table_name, fields }) => {
        const response = await this.axiosInstance.post(`/${base_id}/${table_name}`, {
          fields,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'update_record',
      'Update an existing record in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        record_id: { type: 'string', description: 'ID of the record to update' },
        fields: { type: 'object', description: 'Record fields to update as key-value pairs' },
      },
      async ({ base_id, table_name, record_id, fields }) => {
        const response = await this.axiosInstance.patch(
          `/${base_id}/${table_name}/${record_id}`,
          { fields }
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'delete_record',
      'Delete a record from a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        record_id: { type: 'string', description: 'ID of the record to delete' },
      },
      async ({ base_id, table_name, record_id }) => {
        const response = await this.axiosInstance.delete(
          `/${base_id}/${table_name}/${record_id}`
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
    this.server.tool(
      'search_records',
      'Search for records in a table',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        field_name: { type: 'string', description: 'Name of the field to search in' },
        value: { type: 'string', description: 'Value to search for' },
      },
      async ({ base_id, table_name, field_name, value }) => {
        const response = await this.axiosInstance.get(`/${base_id}/${table_name}`, {
          params: {
            filterByFormula: `{${field_name}} = "${value}"`,
          },
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.records, null, 2) }],
        };
      }
    );
    this.server.tool(
      'get_record',
      'Get a single record by its ID',
      {
        base_id: { type: 'string', description: 'ID of the base' },
        table_name: { type: 'string', description: 'Name of the table' },
        record_id: { type: 'string', description: 'ID of the record to retrieve' },
      },
      async ({ base_id, table_name, record_id }) => {
        const response = await this.axiosInstance.get(
          `/${base_id}/${table_name}/${record_id}`
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }
    );
  }
}

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

const getServer = (externalApiKey: string) => {
  return new AirtableServer(externalApiKey).server;
};

// STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
app.all('/mcp', validateAuth, async (req, res) => {
  try {
    const externalApiKey = (req as any).externalApiKey;
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        transport = existingTransport;
      } else {
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
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };
      const server = getServer(externalApiKey);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
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
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// SSE and /messages endpoints (deprecated transport, for compatibility)
app.get('/sse', validateAuth, async (req, res) => {
  const externalApiKey = (req as any).externalApiKey;
  const apiKey = req.query.apiKey as string;
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  (transport as any).apiKey = apiKey;
  (transport as any).externalApiKey = externalApiKey;
  res.on('close', () => {
    delete transports[transport.sessionId];
  });
  const server = getServer(externalApiKey);
  await server.connect(transport);
});

const validateSession = createSessionValidator(transports, authService, 'externalApiKey');

app.post('/messages', validateSession, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId] as SSEServerTransport;
  await transport.handlePostMessage(req, res, req.body);
});

// Start the server
app.listen(8080, '0.0.0.0', () => {
  console.log(`Airtable MCP server listening on port 8080`);
  console.log(`\n==============================================\nSUPPORTED TRANSPORT OPTIONS:\n\n1. Streamable Http(Protocol version: 2025-03-26)\n   Endpoint: /mcp\n   Methods: GET, POST, DELETE\n   Usage: \n     - Initialize with POST to /mcp\n     - Establish SSE stream with GET to /mcp\n     - Send requests with POST to /mcp\n     - Terminate session with DELETE to /mcp\n\n2. Http + SSE (Protocol version: 2024-11-05)\n   Endpoints: /sse (GET) and /messages (POST)\n   Usage:\n     - Establish SSE stream with GET to /sse\n     - Send requests with POST to /messages?sessionId=<id>\n==============================================\n`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      // ignore
    }
  }
  process.exit(0);
});
