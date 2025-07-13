import { Request, Response, NextFunction } from 'express';

enum AuthMode {
  local = 'local',
  remote = 'remote',
}

const AUTH_MODE = process.env.AUTH_MODE || AuthMode.local;

export function createAuthMiddleware(_: string) {
  if (AUTH_MODE === AuthMode.remote) {
    return function remoteAuth(req: Request, res: Response, next: NextFunction) {
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
      // API key presence is checked, but no implementation details are exposed
      next();
    };
  } else {
    // Local mode: set externalApiKey from env if present
    return function localAuth(req: Request, res: Response, next: NextFunction) {
      const localApiKey = process.env.MCPDOOR_LOCAL_API_KEY;
      if (localApiKey) {
        (req as any).externalApiKey = localApiKey;
      }
      next();
    };
  }
} 