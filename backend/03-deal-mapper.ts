import { Deal, DealMedia, DealDocument, DealKeyTerm, DealFaq, DealToken } from '@/types';

/**
 * Database row types for type-safe mapping
 */
interface DealRow {
  id: string;
  title: string;
  description: string;
  status: string;
  reviewStatus?: string;
  createdAt: Date;
  updatedAt: Date;
  applicationDeadline?: Date;
  directParticipation?: boolean;
  applicationAmount?: number;
  applicationCount?: number;
  brokerApproved?: boolean;
  brokerApprovedAt?: Date;
  brokerApprovedBy?: string;
  brokerNotes?: string;
  assetType?: string;
  financingOptions?: Record<string, unknown>;
  tags?: string[];
  categories?: string[];
  investorUpdatesEnabled?: boolean;
  investorForumEnabled?: boolean;
  investorDashboardUrl?: string;
  legalEntityId?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  tokenId?: string;
  networkValuation?: number;
  issuerId?: string;
  treasuryAddress?: string;
  // Nested investment fields (from JOIN)
  'investment.type'?: string;
  'investment.round'?: string;
  'investment.amount'?: number;
  'investment.minimumInvestment'?: number;
  'investment.targetReturn'?: string;
  'investment.networkValuation'?: number;
  // Nested issuer fields (from JOIN)
  'issuer.id'?: string;
  'issuer.name'?: string;
  'issuer.description'?: string;
  'issuer.website'?: string;
  'issuer.contactEmail'?: string;
  // Nested pool fields (from JOIN)
  'pool.target'?: number;
  'pool.minInvestment'?: number;
  'pool.maxInvestment'?: number;
  'pool.amount'?: number;
  'pool.investorCount'?: number;
  'pool.status'?: string;
  'pool.startDate'?: Date;
  'pool.closeDate'?: Date;
  'pool.network'?: string;
  'pool.currency'?: string;
  'pool.contractAddress'?: string;
  'pool.contractExplorerUrl'?: string;
  // Nested terms fields (from JOIN)
  'terms.carry'?: string;
  'terms.estimatedFees'?: string;
  'terms.unlockPeriod'?: string;
  // Nested token fields (from JOIN)
  'token.id'?: string;
  'token.symbol'?: string;
  'token.name'?: string;
  'token.totalSupply'?: number;
  'token.initialPrice'?: number;
  'token.currentPrice'?: number;
  'token.lastValuationDate'?: Date;
  'token.network'?: string;
  'token.contractAddress'?: string;
  'token.explorerUrl'?: string;
  'token.decimals'?: number;
  'token.tokenType'?: string;
}

/**
 * Options for mapping full deal with related data
 */
interface MapFullDealOptions {
  media?: DealMedia[];
  documents?: DealDocument[];
  requiredDocuments?: DealDocument[];
  keyTerms?: DealKeyTerm[];
  faqs?: DealFaq[];
  token?: DealToken | null;
}

/**
 * Data mapper for transforming database rows to Deal domain objects
 *
 * Implements progressive mapping pattern:
 * - mapBasicDeal: Core deal fields only
 * - mapDealWithInvestment: + investment data
 * - mapDealWithPool: + pool configuration
 * - mapDealWithTerms: + deal terms
 * - mapDealWithIssuer: + issuer information
 * - mapDealWithToken: + token data
 * - mapFullDeal: All data including related entities
 */
export class DealMapper {
  /**
   * Map database row to basic Deal object (core fields only)
   */
  static mapBasicDeal(row: DealRow): Partial<Deal> {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      reviewStatus: row.reviewStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      applicationDeadline: row.applicationDeadline,
      directParticipation: row.directParticipation,
      applicationAmount: row.applicationAmount,
      applicationCount: row.applicationCount,
      brokerApproved: row.brokerApproved,
      brokerApprovedAt: row.brokerApprovedAt,
      brokerApprovedBy: row.brokerApprovedBy,
      brokerNotes: row.brokerNotes,
      assetType: row.assetType,
      financingOptions: row.financingOptions,
      tags: row.tags,
      categories: row.categories,
      investorUpdatesEnabled: row.investorUpdatesEnabled,
      investorForumEnabled: row.investorForumEnabled,
      investorDashboardUrl: row.investorDashboardUrl,
      legalEntityId: row.legalEntityId,
      logoUrl: row.logoUrl,
      coverImageUrl: row.coverImageUrl,
      tokenId: row.tokenId,
      networkValuation: row.networkValuation,
      issuerId: row.issuerId,
      treasuryAddress: row.treasuryAddress,
    };
  }

  /**
   * Map database row to Deal with investment data
   * Note: Issuer mapping is handled by mapDealWithIssuer to avoid duplication
   */
  static mapDealWithInvestment(row: DealRow): Partial<Deal> {
    const deal = this.mapBasicDeal(row);

    const hasInvestmentData =
      row['investment.type'] ||
      row['investment.amount'] ||
      row['investment.round'] ||
      row['investment.targetReturn'];

    if (hasInvestmentData) {
      deal.investment = {
        type: row['investment.type'] ?? '',
        round: row['investment.round'] ?? '',
        amount: row['investment.amount'] ?? 0,
        minimumInvestment: row['investment.minimumInvestment'] ?? 0,
        targetReturn: row['investment.targetReturn'],
        networkValuation: row['investment.networkValuation'],
      };
    }

    return deal;
  }

  /**
   * Map database row to Deal with pool configuration
   */
  static mapDealWithPool(row: DealRow): Partial<Deal> {
    const deal = this.mapDealWithInvestment(row);

    const hasPoolData =
      row['pool.target'] ||
      row['pool.minInvestment'] ||
      row['pool.status'];

    if (hasPoolData) {
      deal.pool = {
        target: row['pool.target'] ?? 0,
        minInvestment: row['pool.minInvestment'] ?? 0,
        maxInvestment: row['pool.maxInvestment'],
        amount: row['pool.amount'] ?? 0,
        investorCount: row['pool.investorCount'] ?? 0,
        status: row['pool.status'] ?? 'open',
        startDate: row['pool.startDate'],
        closeDate: row['pool.closeDate'],
        network: row['pool.network'] ?? '',
        currency: row['pool.currency'] ?? 'usdc',
        contractAddress: row['pool.contractAddress'],
        contractExplorerUrl: row['pool.contractExplorerUrl'],
      };
    }

    return deal;
  }

  /**
   * Map database row to Deal with terms data
   */
  static mapDealWithTerms(row: DealRow): Partial<Deal> {
    const deal = this.mapDealWithPool(row);

    const hasTermsData =
      row['terms.carry'] ||
      row['terms.estimatedFees'] ||
      row['terms.unlockPeriod'];

    if (hasTermsData) {
      deal.terms = {
        carry: row['terms.carry'],
        estimatedFees: row['terms.estimatedFees'],
        unlockPeriod: row['terms.unlockPeriod'],
      };
    }

    return deal;
  }

  /**
   * Map database row to Deal with issuer information
   */
  static mapDealWithIssuer(row: DealRow): Partial<Deal> {
    const deal = this.mapDealWithTerms(row);

    const hasIssuerData = row['issuer.id'] || row['issuer.name'];

    if (hasIssuerData) {
      deal.legalEntityId = row['issuer.id'] ?? '';
      deal.issuer = {
        id: row['issuer.id'] ?? '',
        name: row['issuer.name'] ?? '',
        company: row['issuer.name'] ?? '',
        bio: row['issuer.description'],
        website: row['issuer.website'],
        email: row['issuer.contactEmail'],
        mode: 'existing'
      };
    }

    return deal;
  }

  /**
   * Map database row to Deal with token data
   */
  static mapDealWithToken(row: DealRow): Partial<Deal> {
    const deal = this.mapDealWithIssuer(row);

    const hasTokenData = row['token.id'] || row['token.symbol'];

    if (hasTokenData) {
      deal.token = {
        id: row['token.id'],
        symbol: row['token.symbol'],
        name: row['token.name'],
        totalSupply: row['token.totalSupply'],
        initialPrice: row['token.initialPrice'],
        currentPrice: row['token.currentPrice'],
        lastValuationDate: row['token.lastValuationDate'],
        network: row['token.network'],
        contractAddress: row['token.contractAddress'],
        explorerUrl: row['token.explorerUrl'],
        decimals: row['token.decimals'],
        tokenType: row['token.tokenType'],
      };
    }

    return deal;
  }

  /**
   * Map database row to full Deal with all related entities
   */
  static mapFullDeal(row: DealRow, options: MapFullDealOptions = {}): Deal {
    const {
      media = [],
      documents = [],
      requiredDocuments = [],
      keyTerms = [],
      faqs = [],
      token = null
    } = options;

    const deal = this.mapDealWithToken(row) as Deal;

    if (media.length > 0) {
      deal.media = media.map(item => ({
        id: item.id,
        mediaType: item.mediaType,
        url: item.url,
        title: item.title,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        displayOrder: item.displayOrder,
      }));
    }

    if (documents.length > 0) {
      deal.documents = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        url: doc.url,
        type: doc.type,
      }));
    }

    if (requiredDocuments.length > 0) {
      deal.requiredDocuments = requiredDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        url: doc.url,
        isMandatory: doc.isMandatory,
      }));
    }

    if (keyTerms.length > 0) {
      deal.keyTerms = keyTerms.map(term => ({
        id: term.id,
        name: term.name,
        value: term.value,
        tooltip: term.tooltip,
        category: term.category,
        displayOrder: term.displayOrder,
        isHighlighted: term.isHighlighted,
      }));
    }

    if (faqs.length > 0) {
      deal.faqs = faqs.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
      }));
    }

    if (token) {
      deal.token = {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        totalSupply: token.totalSupply,
        initialPrice: token.initialPrice,
        currentPrice: token.currentPrice,
        network: token.network,
        contractAddress: token.contractAddress,
        explorerUrl: token.explorerUrl,
        decimals: token.decimals,
        tokenType: token.tokenType,
        metadata: token.metadata,
      };
    }

    return deal;
  }
}
