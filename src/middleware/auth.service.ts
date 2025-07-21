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
  ext_api_key: string | null;
  ext_api_key_iv: string | null;
  mcp_server_id: string;
}

export class AuthService {
  private readonly supabase;
  private apiKeysById: Map<string, ApiKey> = new Map();
  private apiKeysByKey: Map<string, ApiKey> = new Map();
  private initialized = false;
  private mcpServerId: string;
  private encryptionKey: Uint8Array;

  constructor(mcpServerId: string) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.mcpServerId = mcpServerId;

    const base64Key = process.env.ENCRYPTION_KEY;
    if (!base64Key) throw new Error("ENCRYPTION_KEY not set");

    this.encryptionKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    if (this.encryptionKey.length !== 32) {
      throw new Error("ENCRYPTION_KEY must decode to 32 bytes (AES-256)");
    }
  }

  private async initialize() {
    if (this.initialized) return;

    const { data: apiKeys, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('active', true)
      .eq('mcp_server_id', this.mcpServerId);

    if (error) {
      console.error('Error fetching API keys:', error);
      return;
    }

    apiKeys.forEach(key => {
      this.apiKeysById.set(key.id, key);
      this.apiKeysByKey.set(key.key, key);
    });

    this.supabase
      .channel('api_keys_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_keys',
        },
        (payload) => {
          let keyData: ApiKey | undefined;
          if (payload.eventType === 'DELETE') {
            keyData = payload.old as ApiKey;
            if (keyData) {
              const cached = this.apiKeysById.get(keyData.id);
              if (cached) {
                this.apiKeysByKey.delete(cached.key);
              }
              this.apiKeysById.delete(keyData.id);
              console.log(`API key deleted: id=${keyData.id}, key=${cached ? cached.key : 'unknown'}`);
            }
          } else {
            keyData = payload.new as ApiKey;
            if (keyData) {
              if (keyData.active) {
                this.apiKeysById.set(keyData.id, keyData);
                this.apiKeysByKey.set(keyData.key, keyData);
                console.log(`API key updated: id=${keyData.id}, key=${keyData.key}`);
              } else {
                this.apiKeysById.delete(keyData.id);
                this.apiKeysByKey.delete(keyData.key);
                console.log(`API key deactivated: id=${keyData.id}, key=${keyData.key}`);
              }
            }
          }
        }
      )
      .subscribe();

    this.initialized = true;
  }

  private async decryptExtApiKey(ciphertext: string, iv: string): Promise<string> {
    const ctBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.encryptionKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      cryptoKey,
      ctBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  async validateApiKey(apiKey: string): Promise<string | null> {
    try {
      await this.initialize();

      console.log(this.apiKeysByKey);
      const keyData = this.apiKeysByKey.get(apiKey);
      if (!keyData) return null;

      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return null;

      if (keyData.usage_count >= keyData.rate_limit) return null;

      await this.supabase
        .from('api_keys')
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: keyData.usage_count + 1
        })
        .eq('id', keyData.id);

      if (keyData.ext_api_key && keyData.ext_api_key_iv) {
        return await this.decryptExtApiKey(keyData.ext_api_key, keyData.ext_api_key_iv);
      }

      return null;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }
}
