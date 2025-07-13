import {
    WebSearchResponse,
    LocalPoiResponse,
    LocalDescriptionsResponse,
    SearchParams
  } from './types.js';
  
  export class BraveSearchService {
    private apiKey: string;
    private baseUrl = 'https://api.search.brave.com/res/v1';
  
    constructor(apiKey: string) {
      this.apiKey = apiKey;
    }
  
    private getHeaders() {
      return {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      };
    }
  
    async webSearch(params: SearchParams) {
      try {
        const url = new URL(`${this.baseUrl}/web/search`);
        
        // Add query parameters
        url.searchParams.append('q', params.q);
        if (params.country) url.searchParams.append('country', params.country);
        if (params.search_lang) url.searchParams.append('search_lang', params.search_lang);
        if (params.ui_lang) url.searchParams.append('ui_lang', params.ui_lang);
        if (params.count) url.searchParams.append('count', params.count.toString());
        if (params.offset) url.searchParams.append('offset', params.offset.toString());
        if (params.safesearch) url.searchParams.append('safesearch', params.safesearch);
        if (params.freshness) url.searchParams.append('freshness', params.freshness);
        if (params.text_decorations !== undefined) url.searchParams.append('text_decorations', params.text_decorations.toString());
        if (params.spellcheck !== undefined) url.searchParams.append('spellcheck', params.spellcheck.toString());
        if (params.result_filter) url.searchParams.append('result_filter', params.result_filter);
        if (params.goggles_id) url.searchParams.append('goggles_id', params.goggles_id);
        if (params.units) url.searchParams.append('units', params.units);
        if (params.extra_snippets !== undefined) url.searchParams.append('extra_snippets', params.extra_snippets.toString());
        if (params.summary !== undefined) url.searchParams.append('summary', params.summary.toString());
  
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: this.getHeaders(),
        });
  
        if (!response.ok) {
          return {
            error: `Web search failed: ${response.status} ${response.statusText}`
          };
        }
  
        const data = await response.json() as WebSearchResponse;
        return data;
      } catch (error) {
        return {
          error: `Web search request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  
    async newsSearch(query: string, count?: number, freshness?: string, country?: string) {
      const params: SearchParams = {
        q: query,
        result_filter: 'news',
        count: count || 10,
        freshness: freshness as any,
        country
      };
      
      return this.webSearch(params);
    }
  
    async imageSearch(query: string, count?: number, country?: string) {
      const params: SearchParams = {
        q: query,
        result_filter: 'images',
        count: count || 10,
        country
      };
      
      return this.webSearch(params);
    }
  
    async videoSearch(query: string, count?: number, country?: string) {
      const params: SearchParams = {
        q: query,
        result_filter: 'videos',
        count: count || 10,
        country
      };
      
      return this.webSearch(params);
    }
  
    async localPoiSearch(ids: string[]) {
      try {
        const url = new URL(`${this.baseUrl}/local/pois`);
        
        // Add multiple IDs as separate parameters
        ids.forEach(id => url.searchParams.append('ids', id));
  
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: this.getHeaders(),
        });
  
        if (!response.ok) {
          return {
            error: `Local POI search failed: ${response.status} ${response.statusText}`
          };
        }
  
        const data = await response.json() as LocalPoiResponse;
        return data;
      } catch (error) {
        return {
          error: `Local POI search request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  
    async localDescriptions(ids: string[]) {
      try {
        const url = new URL(`${this.baseUrl}/local/descriptions`);
        
        // Add multiple IDs as separate parameters
        ids.forEach(id => url.searchParams.append('ids', id));
  
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: this.getHeaders(),
        });
  
        if (!response.ok) {
          return {
            error: `Local descriptions request failed: ${response.status} ${response.statusText}`
          };
        }
  
        const data = await response.json() as LocalDescriptionsResponse;
        return data;
      } catch (error) {
        return {
          error: `Local descriptions request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  
    async searchWithGoggles(query: string, gogglesId: string, count?: number) {
      const params: SearchParams = {
        q: query,
        goggles_id: gogglesId,
        count: count || 10
      };
      
      return this.webSearch(params);
    }
  
    // Convenience method to get location IDs from a location-based search
    async getLocationIds(query: string): Promise<string[]> {
      const result = await this.webSearch({ q: query });
      
      if ('error' in result) {
        return [];
      }
  
      const locations = result.locations?.results || [];
      return locations
        .filter(location => location.id)
        .map(location => location.id!);
    }
  }