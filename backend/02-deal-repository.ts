import { PoolClient } from 'pg';
import { pool } from '..';
import { Deal, DealMedia, DealDocument, DealKeyTerm, DealFaq, DealToken } from '@/types';
import { getCurrentTenantId } from '../site-config';
import { DealQueryBuilder } from '../query-builders/deal-queries';
import { DealMapper } from '../mappers/deal-mapper';

/**
 * Filter options for deal queries
 */
interface DealFilterOptions {
  tenantId?: string;
  userId?: number;
  status?: string;
  search?: string;
  assetType?: string;
  tags?: string[];
  categories?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Related data types for type-safe queries
 */
interface RelatedData {
  media: Map<string, DealMedia[]>;
  documents: Map<string, DealDocument[]>;
  requiredDocuments: Map<string, DealDocument[]>;
  keyTerms: Map<string, DealKeyTerm[]>;
  faqs: Map<string, DealFaq[]>;
}

/**
 * Repository for Deal database operations
 *
 * Implements:
 * - Repository pattern for data access abstraction
 * - Transaction management for data integrity
 * - Batch queries to prevent N+1 problems
 * - Multi-tenant isolation
 * - Parameterized queries for SQL injection prevention
 */
export class DealRepository {
  /**
   * Get all deals matching the specified filters
   * Uses batch loading to avoid N+1 query problems
   */
  async getDeals(options: DealFilterOptions = {}): Promise<Deal[]> {
    const {
      tenantId,
      status,
      search,
      assetType,
      tags,
      categories,
      limit = 50,
      offset = 0
    } = options;

    const currentTenantId = tenantId || await getCurrentTenantId();

    // Build parameterized query
    const params: (string | number)[] = [currentTenantId];
    const conditions: string[] = ['d.tenant_id = $1'];

    if (status) {
      params.push(status);
      conditions.push(`d.status = $${params.length}`);
    }

    if (search) {
      // SECURITY: Escape ILIKE wildcards to prevent pattern injection
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
      params.push(`%${escapedSearch}%`);
      conditions.push(`(d.title ILIKE $${params.length} ESCAPE '\\' OR d.description ILIKE $${params.length} ESCAPE '\\')`);
    }

    if (assetType) {
      params.push(assetType);
      conditions.push(`d.asset_type = $${params.length}`);
    }

    // tags and categories are text[] arrays in PostgreSQL
    // Use && (overlap) operator with proper array casting
    if (tags && tags.length > 0) {
      params.push(tags as unknown as string);
      conditions.push(`d.tags && $${params.length}::text[]`);
    }

    if (categories && categories.length > 0) {
      params.push(categories as unknown as string);
      conditions.push(`d.categories && $${params.length}::text[]`);
    }

    // Build and execute main query
    const { query, params: finalParams } = DealQueryBuilder.buildFilterQuery(params, conditions);
    const paginatedQuery = DealQueryBuilder.addPagination(query, limit, offset);
    const result = await pool.query(paginatedQuery, finalParams);

    if (result.rows.length === 0) {
      return [];
    }

    // Extract deal IDs for batch loading
    const dealIds = result.rows.map(row => row.id);

    // Batch load all related data in parallel (prevents N+1)
    const relatedData = await this.batchLoadRelatedData(dealIds, currentTenantId);

    // Map results with related data
    return result.rows.map(row => DealMapper.mapFullDeal(row, {
      media: relatedData.media.get(row.id) || [],
      documents: relatedData.documents.get(row.id) || [],
      requiredDocuments: relatedData.requiredDocuments.get(row.id) || [],
      keyTerms: relatedData.keyTerms.get(row.id) || [],
      faqs: relatedData.faqs.get(row.id) || [],
    }));
  }

  /**
   * Batch load all related data for multiple deals in parallel
   * This prevents N+1 query problems by fetching all related data in 5 queries
   */
  private async batchLoadRelatedData(dealIds: string[], tenantId: string): Promise<RelatedData> {
    const [mediaRows, docsRows, reqDocsRows, termsRows, faqsRows] = await Promise.all([
      this.batchGetMedia(dealIds, tenantId),
      this.batchGetDocuments(dealIds, tenantId),
      this.batchGetRequiredDocuments(dealIds, tenantId),
      this.batchGetKeyTerms(dealIds, tenantId),
      this.batchGetFaqs(dealIds, tenantId),
    ]);

    // Group results by deal_id
    return {
      media: this.groupByDealId(mediaRows),
      documents: this.groupByDealId(docsRows),
      requiredDocuments: this.groupByDealId(reqDocsRows),
      keyTerms: this.groupByDealId(termsRows),
      faqs: this.groupByDealId(faqsRows),
    };
  }

  /**
   * Group array of items by deal_id into a Map
   */
  private groupByDealId<T extends { deal_id: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const existing = map.get(item.deal_id) || [];
      existing.push(item);
      map.set(item.deal_id, existing);
    }
    return map;
  }

  /**
   * Batch get media for multiple deals
   */
  private async batchGetMedia(dealIds: string[], tenantId: string): Promise<(DealMedia & { deal_id: string })[]> {
    const result = await pool.query(`
      SELECT
        deal_id,
        id,
        media_type as "mediaType",
        url,
        title,
        description,
        thumbnail_url as "thumbnailUrl",
        duration,
        display_order as "displayOrder"
      FROM deals_media
      WHERE deal_id = ANY($1) AND tenant_id = $2
      ORDER BY display_order ASC
    `, [dealIds, tenantId]);
    return result.rows;
  }

  /**
   * Batch get documents for multiple deals
   */
  private async batchGetDocuments(dealIds: string[], tenantId: string): Promise<(DealDocument & { deal_id: string })[]> {
    const result = await pool.query(`
      SELECT deal_id, id, name, description, url, type
      FROM deal_documents
      WHERE deal_id = ANY($1) AND tenant_id = $2
      ORDER BY id ASC
    `, [dealIds, tenantId]);
    return result.rows;
  }

  /**
   * Batch get required documents for multiple deals
   */
  private async batchGetRequiredDocuments(dealIds: string[], tenantId: string): Promise<(DealDocument & { deal_id: string })[]> {
    const result = await pool.query(`
      SELECT deal_id, id, name, description, url, is_mandatory as "isMandatory"
      FROM required_documents
      WHERE deal_id = ANY($1) AND tenant_id = $2
      ORDER BY id ASC
    `, [dealIds, tenantId]);
    return result.rows;
  }

  /**
   * Batch get key terms for multiple deals
   */
  private async batchGetKeyTerms(dealIds: string[], tenantId: string): Promise<(DealKeyTerm & { deal_id: string })[]> {
    const result = await pool.query(`
      SELECT
        deal_id,
        id,
        name,
        value,
        tooltip,
        category,
        display_order as "displayOrder",
        is_highlighted as "isHighlighted"
      FROM deal_key_terms
      WHERE deal_id = ANY($1) AND tenant_id = $2
      ORDER BY display_order ASC
    `, [dealIds, tenantId]);
    return result.rows;
  }

  /**
   * Batch get FAQs for multiple deals
   */
  private async batchGetFaqs(dealIds: string[], tenantId: string): Promise<(DealFaq & { deal_id: string })[]> {
    const result = await pool.query(`
      SELECT deal_id, id, question, answer
      FROM deal_faqs
      WHERE deal_id = ANY($1) AND tenant_id = $2
      ORDER BY id ASC
    `, [dealIds, tenantId]);
    return result.rows;
  }

  /**
   * Get a single deal by ID
   */
  async getDealById(id: string, tenantId?: string): Promise<Deal | null> {
    const currentTenantId = tenantId || await getCurrentTenantId();

    const result = await pool.query(`
      ${DealQueryBuilder.buildSelectQuery()}
      WHERE d.id = $1 AND d.tenant_id = $2
    `, [id, currentTenantId]);

    if (result.rows.length === 0) {
      return null;
    }

    // Load related data in parallel for single deal
    const dealIds = [id];
    const relatedData = await this.batchLoadRelatedData(dealIds, currentTenantId);
    const tokenResult = await this.getDealToken(id, currentTenantId);

    return DealMapper.mapFullDeal(result.rows[0], {
      media: relatedData.media.get(id) || [],
      documents: relatedData.documents.get(id) || [],
      requiredDocuments: relatedData.requiredDocuments.get(id) || [],
      keyTerms: relatedData.keyTerms.get(id) || [],
      faqs: relatedData.faqs.get(id) || [],
      token: tokenResult,
    });
  }

  /**
   * Create a new deal with related data in a transaction
   */
  async createDeal(deal: Partial<Deal>, tenantId?: string): Promise<Deal> {
    const currentTenantId = tenantId || await getCurrentTenantId();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert main deal record
      const dealResult = await client.query(`
        INSERT INTO deals (
          tenant_id, title, description, status, application_deadline,
          application_amount, direct_participation, investment_type,
          investment_amount, target_return, carry, estimated_fees,
          unlock_period, pool_target, pool_min_investment, pool_max_investment,
          pool_amount, pool_investor_count, pool_status, pool_close_date,
          pool_network, pool_currency, pool_contract_address,
          pool_contract_explorer_url, issuer_id, asset_type, financing_options,
          tags, categories, investor_updates_enabled, investor_forum_enabled,
          investor_dashboard_url, legal_entity_id, logo_url, cover_image_url,
          token_id, ttw_enabled, ttw_start_date, ttw_end_date, treasury_address,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, NOW(), NOW()
        ) RETURNING id
      `, [
        currentTenantId,
        deal.title ?? '',
        deal.description ?? '',
        deal.status ?? 'draft',
        deal.applicationDeadline ?? null,
        deal.applicationAmount ?? null,
        deal.directParticipation ?? false,
        deal.investment?.type ?? null,
        deal.investment?.amount ?? null,
        deal.investment?.targetReturn ?? null,
        deal.terms?.carry ?? null,
        deal.terms?.estimatedFees ?? null,
        deal.terms?.unlockPeriod ?? null,
        deal.pool?.target ?? null,
        deal.pool?.minInvestment ?? null,
        deal.pool?.maxInvestment ?? null,
        deal.pool?.amount ?? null,
        deal.pool?.investorCount ?? 0,
        deal.pool?.status ?? 'open',
        deal.pool?.closeDate ?? null,
        deal.pool?.network ?? null,
        deal.pool?.currency ?? 'USD',
        deal.pool?.contractAddress ?? null,
        deal.pool?.contractExplorerUrl ?? null,
        deal.issuerId ?? null,
        deal.assetType ?? null,
        deal.financingOptions ?? {},
        deal.tags ?? [],
        deal.categories ?? [],
        deal.investorUpdatesEnabled ?? false,
        deal.investorForumEnabled ?? false,
        deal.investorDashboardUrl ?? null,
        deal.legalEntityId ?? null,
        deal.logoUrl ?? null,
        deal.coverImageUrl ?? null,
        deal.tokenId ?? null,
        deal.ttw?.enabled ?? false,
        deal.ttw?.startDate ?? null,
        deal.ttw?.endDate ?? null,
        deal.treasuryAddress ?? null
      ]);

      const dealId = dealResult.rows[0].id;

      // Insert related data in parallel
      await Promise.all([
        this.insertKeyTerms(client, dealId, deal.keyTerms ?? [], currentTenantId),
        this.insertFaqs(client, dealId, deal.faqs ?? [], currentTenantId),
        this.insertDocuments(client, dealId, deal.documents ?? [], currentTenantId),
        this.insertRequiredDocuments(client, dealId, deal.requiredDocuments ?? [], currentTenantId),
        this.insertMedia(client, dealId, deal.media ?? [], currentTenantId),
      ]);

      await client.query('COMMIT');

      // Return the newly created deal
      const createdDeal = await this.getDealById(dealId, currentTenantId);
      if (!createdDeal) {
        throw new Error('Failed to retrieve created deal');
      }
      return createdDeal;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get token data associated with a deal
   */
  private async getDealToken(dealId: string, tenantId: string): Promise<DealToken | null> {
    const result = await pool.query(`
      SELECT
        t.id, t.symbol, t.name, t.total_supply as "totalSupply",
        t.initial_price as "initialPrice", t.current_price as "currentPrice",
        t.network, t.contract_address as "contractAddress",
        t.explorer_url as "explorerUrl", t.decimals, t.token_type as "tokenType",
        t.metadata
      FROM tokens t
      JOIN deals d ON d.token_id = t.id
      WHERE d.id = $1 AND t.tenant_id = $2
    `, [dealId, tenantId]);

    return result.rows[0] || null;
  }

  /**
   * Insert key terms for a deal
   */
  private async insertKeyTerms(
    client: PoolClient,
    dealId: string,
    keyTerms: DealKeyTerm[],
    tenantId: string
  ): Promise<void> {
    if (keyTerms.length === 0) return;

    const values = keyTerms.map((term, i) => {
      const base = i * 8;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    }).join(', ');

    const params = keyTerms.flatMap(term => [
      tenantId,
      dealId,
      term.name,
      term.value,
      term.tooltip ?? null,
      term.category ?? null,
      term.displayOrder ?? 0,
      term.isHighlighted ?? false
    ]);

    await client.query(`
      INSERT INTO deal_key_terms (
        tenant_id, deal_id, name, value, tooltip, category, display_order, is_highlighted
      ) VALUES ${values}
    `, params);
  }

  /**
   * Insert FAQs for a deal
   */
  private async insertFaqs(
    client: PoolClient,
    dealId: string,
    faqs: DealFaq[],
    tenantId: string
  ): Promise<void> {
    if (faqs.length === 0) return;

    const values = faqs.map((_, i) => {
      const base = i * 4;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    }).join(', ');

    const params = faqs.flatMap(faq => [tenantId, dealId, faq.question, faq.answer]);

    await client.query(`
      INSERT INTO deal_faqs (tenant_id, deal_id, question, answer) VALUES ${values}
    `, params);
  }

  /**
   * Insert documents for a deal
   */
  private async insertDocuments(
    client: PoolClient,
    dealId: string,
    documents: DealDocument[],
    tenantId: string
  ): Promise<void> {
    if (documents.length === 0) return;

    const values = documents.map((_, i) => {
      const base = i * 6;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    }).join(', ');

    const params = documents.flatMap(doc => [
      tenantId, dealId, doc.name, doc.description ?? null, doc.url, doc.type ?? null
    ]);

    await client.query(`
      INSERT INTO deal_documents (tenant_id, deal_id, name, description, url, type) VALUES ${values}
    `, params);
  }

  /**
   * Insert required documents for a deal
   */
  private async insertRequiredDocuments(
    client: PoolClient,
    dealId: string,
    documents: DealDocument[],
    tenantId: string
  ): Promise<void> {
    if (documents.length === 0) return;

    const values = documents.map((_, i) => {
      const base = i * 6;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    }).join(', ');

    const params = documents.flatMap(doc => [
      tenantId, dealId, doc.name, doc.description ?? null, doc.url, doc.isMandatory ?? true
    ]);

    await client.query(`
      INSERT INTO required_documents (tenant_id, deal_id, name, description, url, is_mandatory) VALUES ${values}
    `, params);
  }

  /**
   * Insert media items for a deal
   */
  private async insertMedia(
    client: PoolClient,
    dealId: string,
    media: DealMedia[],
    tenantId: string
  ): Promise<void> {
    if (media.length === 0) return;

    const values = media.map((_, i) => {
      const base = i * 9;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
    }).join(', ');

    const params = media.flatMap((item, index) => [
      tenantId,
      dealId,
      item.mediaType,
      item.url,
      item.title ?? null,
      item.description ?? null,
      item.thumbnailUrl ?? null,
      item.duration ?? null,
      item.displayOrder ?? index
    ]);

    await client.query(`
      INSERT INTO deals_media (
        tenant_id, deal_id, media_type, url, title, description, thumbnail_url, duration, display_order
      ) VALUES ${values}
    `, params);
  }
}

/** Singleton instance for application-wide use */
export const dealRepository = new DealRepository();
