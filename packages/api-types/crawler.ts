/**
 * Crawler/Scraper integration types.
 * Defines the contract between external scrapers and the Light Story ingestion pipeline.
 */

export interface RawComicData {
  title: string;
  description: string;
  cover_url?: string;
  author?: string;
  chapters?: RawChapterData[];
  metadata?: Record<string, any>;
}

export interface RawChapterData {
  title: string;
  body: string;
  page_order?: number;
  created_at?: string;
}

export interface CrawlerIngestRequest {
  source: 'web' | 'api' | 'manual';
  items: RawComicData[];
  dry_run?: boolean; // If true, validate without writing
}

export interface CrawlerIngestResponse {
  queue_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  items_processed: number;
  items_failed: number;
  errors?: string[];
  created_at: string;
}

export interface CrawlerService {
  /**
   * Ingest raw comic data from external source.
   * @param request - Ingestion request with raw data
   * @returns Queue ID for tracking
   */
  ingest(request: CrawlerIngestRequest): Promise<CrawlerIngestResponse>;

  /**
   * Get ingestion status by queue ID.
   */
  getStatus(queueId: string): Promise<CrawlerIngestResponse>;

  /**
   * Validate raw data without writing to database.
   */
  validate(items: RawComicData[]): Promise<{ valid: boolean; errors: string[] }>;
}
