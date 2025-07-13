export class AuthService {
  constructor(mcpServerId: string) {}
  async validateApiKey(apiKey: string): Promise<string | null> {
    // Stub: always allow in open source version
    return null;
  }
} 