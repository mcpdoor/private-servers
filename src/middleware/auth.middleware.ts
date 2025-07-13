import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';

export function createAuthMiddleware(mcpServerId: string) {
  const authService = new AuthService(mcpServerId);

  return async function validateAuth(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.query.apiKey as string;
    
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

    // Validate the API key (returns ext_api_key or null)
    const externalApiKey = await authService.validateApiKey(apiKey);
    
    // If the API key is invalid (not found or expired or over rate limit), fail
    if (externalApiKey === undefined) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid API key',
        },
        id: null,
      });
    }

    // Only set externalApiKey if present (for providers like Google Maps)
    if (externalApiKey) {
      (req as any).externalApiKey = externalApiKey;
    }
    next();
  }
} 