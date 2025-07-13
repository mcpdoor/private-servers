import { createClient } from '@supabase/supabase-js';

interface ApiKey {
  id: string;
  user_id: string;
  key: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  active: boolean;
  rate_limit: number;
  ext_api_key: string;
  mcp_server_id: string;
}

export class AuthService {
  private readonly supabase;
  private apiKeysCache: Map<string, ApiKey> = new Map();
  private initialized = false;
  private mcpServerId: string;

  constructor(mcpServerId: string) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.mcpServerId = mcpServerId;
  }

  private async initialize() {
    if (this.initialized) return;

    // Initial fetch of all active API keys
    const { data: apiKeys, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('active', true)
      .eq('mcp_server_id', this.mcpServerId);

    if (error) {
      console.error('Error fetching API keys:', error);
      return;
    }

    // Populate cache
    apiKeys.forEach(key => this.apiKeysCache.set(key.key, key));

    // Subscribe to changes
    this.supabase
      .channel('api_keys_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_keys',
          filter: `mcp_server_id=eq.${this.mcpServerId}`
        },
        (payload) => {
          const key = payload.new as ApiKey;
          if (payload.eventType === 'DELETE') {
            this.apiKeysCache.delete(key.key);
          } else {
            if (key.active) {
              this.apiKeysCache.set(key.key, key);
            } else {
              this.apiKeysCache.delete(key.key);
            }
          }
        }
      )
      .subscribe();

    this.initialized = true;
  }

  async validateApiKey(apiKey: string): Promise<string | null> {
    try {
      await this.initialize();

      const keyData = this.apiKeysCache.get(apiKey);
      if (!keyData) {
        return null;
      }

      // Check if key is expired
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        return null;
      }

      // Check rate limit
      if (keyData.usage_count >= keyData.rate_limit) {
        return null;
      }

      // Update usage statistics
      await this.supabase
        .from('api_keys')
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: keyData.usage_count + 1
        })
        .eq('id', keyData.id);

      return keyData.ext_api_key;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }
} 