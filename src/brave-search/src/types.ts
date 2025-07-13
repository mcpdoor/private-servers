export interface BraveSearchResponse {
    type: string;
    query: {
      original: string;
      show_strict_warning: boolean;
      altered?: string;
      safesearch: boolean;
      is_navigational: boolean;
      is_news_breaking: boolean;
      local_decision: string;
      local_locations_idx: number;
      is_trending: boolean;
      is_news: boolean;
      news_freshness: string;
      is_entity?: boolean;
      entity_id?: string;
      postal_code?: string;
      country?: string;
      bad_results: boolean;
      should_fallback: boolean;
      city?: string;
      header_country?: string;
      more_results_available: boolean;
      custom_location_label?: string;
      state?: string;
    };
  }
  
  export interface WebSearchResponse extends BraveSearchResponse {
    web?: {
      type: string;
      results: WebResult[];
      family_friendly: boolean;
    };
    news?: {
      type: string;
      results: NewsResult[];
    };
    videos?: {
      type: string;
      results: VideoResult[];
    };
    images?: {
      type: string;
      results: ImageResult[];
    };
    locations?: {
      type: string;
      results: LocationResult[];
    };
    infobox?: {
      type: string;
      subtype: string;
      content: string;
      title: string;
      url: string;
      image_url?: string;
    };
    faq?: {
      type: string;
      results: FaqResult[];
    };
    discussions?: {
      type: string;
      results: DiscussionResult[];
    };
  }
  
  export interface WebResult {
    type: string;
    title: string;
    url: string;
    description: string;
    date?: string;
    extra_snippets?: string[];
    subtype?: string;
    deeplinks?: {
      name: string;
      snippet?: string;
      url: string;
    }[];
    favicon?: string;
    thumbnail?: {
      src: string;
      original?: string;
      logo?: boolean;
    };
    language?: string;
    family_friendly?: boolean;
    page_age?: string;
    page_fetched?: string;
    profile?: {
      name: string;
      url: string;
      long_name: string;
      img: string;
    };
    meta_url?: {
      scheme: string;
      netloc: string;
      hostname: string;
      favicon: string;
      path: string;
    };
    age?: string;
    content_type?: string;
  }
  
  export interface NewsResult {
    type: string;
    meta_url?: {
      scheme: string;
      netloc: string;
      hostname: string;
      favicon: string;
      path: string;
    };
    title: string;
    url: string;
    description: string;
    page_age?: string;
    page_fetched?: string;
    family_friendly: boolean;
    breaking?: boolean;
    age?: string;
    thumbnail?: {
      src: string;
    };
  }
  
  export interface VideoResult {
    type: string;
    url: string;
    title: string;
    description?: string;
    age?: string;
    page_age?: string;
    meta_url?: {
      scheme: string;
      netloc: string;
      hostname: string;
      favicon: string;
      path: string;
    };
    thumbnail?: {
      src: string;
      height?: number;
      width?: number;
    };
    uploader?: string;
    publisher?: string;
    duration?: string;
    views?: number;
    video_url?: string;
  }
  
  export interface ImageResult {
    type: string;
    title: string;
    url: string;
    image_url: string;
    thumbnail_url: string;
    height: number;
    width: number;
    source: string;
    properties?: string[];
  }
  
  export interface LocationResult {
    type: string;
    title: string;
    url?: string;
    description?: string;
    coordinates?: [number, number];
    postal_address?: {
      country_code: string;
      country: string;
      region: string;
      locality: string;
      street_address: string;
      postal_code: string;
    };
    contact?: {
      telephone?: string;
      email?: string;
    };
    rating?: {
      ratingValue: number;
      reviewCount: number;
      maxValue: number;
      minValue: number;
    };
    opening_hours?: string;
    local_map?: {
      center: [number, number];
      zoom: number;
    };
    reviews?: string[];
    price_range?: string;
    id?: string;
  }
  
  export interface FaqResult {
    type: string;
    question: string;
    answer: string;
    title: string;
    url: string;
  }
  
  export interface DiscussionResult {
    type: string;
    data: {
      forum: string;
      num_answers: number;
      score: string;
      title: string;
      question: string;
      top_comment: string;
    };
  }
  
  // Local POI Search API Response
  export interface LocalPoiResponse {
    results: LocalPoi[];
  }
  
  export interface LocalPoi {
    id: string;
    title: string;
    description?: string;
    url?: string;
    coordinates?: [number, number];
    postal_address?: {
      country_code: string;
      country: string;
      region: string;
      locality: string;
      street_address: string;
      postal_code: string;
    };
    contact?: {
      telephone?: string;
      email?: string;
      website?: string;
    };
    rating?: {
      ratingValue: number;
      reviewCount: number;
      maxValue: number;
      minValue: number;
    };
    opening_hours?: string;
    price_range?: string;
    images?: string[];
    reviews?: Array<{
      rating: number;
      review_text: string;
      author: string;
      date: string;
    }>;
    categories?: string[];
  }
  
  // Local Descriptions API Response  
  export interface LocalDescriptionsResponse {
    results: LocalDescription[];
  }
  
  export interface LocalDescription {
    id: string;
    description: string;
    generated_by: string;
  }
  
  // Search parameters
  export interface SearchParams {
    q: string;
    country?: string;
    search_lang?: string;
    ui_lang?: string;
    count?: number;
    offset?: number;
    safesearch?: 'strict' | 'moderate' | 'off';
    freshness?: 'pd' | 'pw' | 'pm' | 'py';
    text_decorations?: boolean;
    spellcheck?: boolean;
    result_filter?: 'web' | 'news' | 'images' | 'videos';
    goggles_id?: string;
    units?: 'metric' | 'imperial';
    extra_snippets?: boolean;
    summary?: boolean;
  }
  