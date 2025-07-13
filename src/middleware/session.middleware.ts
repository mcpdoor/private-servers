import { Request, Response, NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

/**
 * Creates a session validation middleware for SSE transport endpoints.
 * @param transports The transports map (sessionId -> transport)
 * @param authService The AuthService instance for API key validation
 * @param apiKeyPropName The property name to attach the validated API key to the request (default: 'externalApiKey')
 */
export function createSessionValidator(
  transports: Record<string, any>,
  authService: { validateApiKey: (apiKey: string) => Promise<string | null> },
  apiKeyPropName: string = 'externalApiKey'
) {
  return async function validateSession(req: Request, res: Response, next: NextFunction) {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (!transport) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No transport found for sessionId',
        },
        id: null,
      });
    }
    if (!(transport instanceof SSEServerTransport)) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Session exists but uses a different transport protocol',
        },
        id: null,
      });
    }
    const apiKey = (transport as any).apiKey;
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Missing API key',
        },
        id: null,
      });
    }
    const externalApiKey = await authService.validateApiKey(apiKey);
    if (!externalApiKey) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid API key',
        },
        id: null,
      });
    }
    (req as any)[apiKeyPropName] = externalApiKey;
    next();
  };
} 