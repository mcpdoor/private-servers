import { Request, Response, NextFunction } from 'express';

export function createSessionValidator(
  transports: Record<string, any>,
  authService: { validateApiKey: (apiKey: string) => Promise<string | null> },
  apiKeyPropName: string = 'externalApiKey'
) {
  return async function validateSession(req: Request, res: Response, next: NextFunction) {
    next();
  };
} 