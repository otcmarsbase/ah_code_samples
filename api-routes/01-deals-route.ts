import { NextRequest, NextResponse } from 'next/server'
import { DealService } from '@/lib/services/deal-service'
import { getCurrentTenantId } from '@/lib/db/tenant'
import { authenticateRequest } from '@/lib/auth'
import { Deal } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Authenticated request payload (matches auth middleware export)
 */
interface AuthenticatedRequest {
  userId: string;
  walletAddress: string;
  roles?: string[];
  tenantId?: string;
}

/**
 * Valid deal statuses for type-safe filtering
 */
export type DealStatus =
  | 'draft'
  | 'active'
  | 'ended'
  | 'cancelled'
  | 'application'
  | 'upcoming'
  | 'pending'
  | 'closed'
  | 'completed'
  | 'funded';

/** Statuses available for PUBLIC (unauthenticated) visibility - excludes 'draft', 'pending', 'cancelled' */
const PUBLIC_VISIBLE_STATUSES = new Set<DealStatus>([
  'active', 'upcoming', 'ended', 'closed', 'funded', 'application', 'completed'
]);

/** Default statuses when no filter specified */
const DEFAULT_STATUSES: readonly DealStatus[] = [
  'active', 'upcoming', 'ended', 'completed', 'closed'
] as const;

/** All valid status values for validation */
const ALL_VALID_STATUSES = new Set<DealStatus>([
  'draft', 'active', 'ended', 'cancelled', 'application',
  'upcoming', 'pending', 'closed', 'completed', 'funded'
]);

/**
 * Type guard to check if auth result is successful
 */
function isAuthenticated(
  result: AuthenticatedRequest | NextResponse
): result is AuthenticatedRequest {
  return !(result instanceof NextResponse);
}

/**
 * Parse and validate status parameter from query string
 * @param statusParam - Comma-separated status values
 * @param isUserAuthenticated - Whether request is authenticated (allows more statuses)
 */
function parseStatusParam(
  statusParam: string | null,
  isUserAuthenticated: boolean
): DealStatus[] | null {
  if (!statusParam) return null;

  const allowedStatuses = isUserAuthenticated
    ? ALL_VALID_STATUSES
    : PUBLIC_VISIBLE_STATUSES;

  const statuses = statusParam
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter((s): s is DealStatus => allowedStatuses.has(s as DealStatus));

  return statuses.length > 0 ? statuses : null;
}

/**
 * Deduplicate deals by ID
 */
function deduplicateDeals(deals: Deal[]): Deal[] {
  const dealsMap = new Map<string, Deal>();
  deals.forEach(deal => dealsMap.set(deal.id, deal));
  return Array.from(dealsMap.values());
}

/**
 * GET /api/deals
 *
 * Retrieves deals with optional filtering by status, search, asset type, tags.
 * Supports authentication for group-based access control.
 *
 * Query Parameters:
 * - status: comma-separated list of deal statuses
 * - search: text search in title/description
 * - assetType: filter by asset type
 * - tokenId: filter by associated token
 * - userId: filter by user's deals
 * - tags: comma-separated list of tags
 * - limit: pagination limit (default: 10)
 * - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate request (optional - unauthenticated users see public deals only)
    const authResult = await authenticateRequest();
    const isUserAuthenticated = isAuthenticated(authResult);
    const authenticatedUserId = isUserAuthenticated ? authResult.userId : null;

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get('status');
    // SECURITY: Limit input length to prevent DoS via expensive ILIKE/filter queries
    const search = (searchParams.get('search') || '').slice(0, 200) || null;
    const assetType = searchParams.get('assetType');
    const tokenId = searchParams.get('tokenId');
    const userIdParam = searchParams.get('userId');
    const tagsParam = (searchParams.get('tags') || '').slice(0, 500) || null;
    // Parse pagination with NaN protection
    const limitRaw = parseInt(searchParams.get('limit') || '10', 10);
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);
    const limit = isNaN(limitRaw) ? 10 : Math.min(Math.max(limitRaw, 1), 100);
    const offset = isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0);

    // SECURITY: userId filter requires authentication and must match the authenticated user
    // This prevents users from querying other users' deal participation
    if (userIdParam) {
      if (!isUserAuthenticated) {
        return NextResponse.json(
          { success: false, error: 'Authentication required for user-specific queries' },
          { status: 401 }
        );
      }
      if (userIdParam !== authenticatedUserId) {
        return NextResponse.json(
          { success: false, error: 'Cannot query deals for other users' },
          { status: 403 }
        );
      }
    }

    // Parse and validate status filter (respects auth state for allowed statuses)
    const statusArray = parseStatusParam(statusParam, isUserAuthenticated);

    // Parse tags
    const tags = tagsParam?.split(',').map(t => t.trim()).filter(Boolean);

    // Get tenant context
    const tenantId = await getCurrentTenantId();

    let deals: Deal[];

    // Route to appropriate service method based on query parameters
    if (tokenId) {
      // Search by token ID (public endpoint, but only shows public-status deals)
      deals = await DealService.getDealsByTokenId(tokenId, tenantId);
      // Filter to public statuses if unauthenticated
      if (!isUserAuthenticated) {
        deals = deals.filter(d => PUBLIC_VISIBLE_STATUSES.has(d.status as DealStatus));
      }
    } else if (statusArray && statusArray.length > 0) {
      // Filter by status(es) - already validated against allowed statuses
      if (statusArray.length === 1) {
        deals = await DealService.getDealsByStatus(statusArray[0], tenantId);
      } else {
        // Fetch multiple statuses in parallel and deduplicate
        const dealsByStatus = await Promise.all(
          statusArray.map(status => DealService.getDealsByStatus(status, tenantId))
        );
        deals = deduplicateDeals(dealsByStatus.flat());
      }
    } else if (userIdParam && authenticatedUserId) {
      // Get authenticated user's own deals (already validated above)
      deals = await DealService.getUserDeals(parseInt(authenticatedUserId, 10), tenantId, limit, offset);
    } else {
      // Default: get deals with filters
      // Use public-safe defaults for unauthenticated requests
      const safeStatuses: DealStatus[] = isUserAuthenticated
        ? (statusArray ?? [...DEFAULT_STATUSES])
        : [...DEFAULT_STATUSES].filter(s => PUBLIC_VISIBLE_STATUSES.has(s));

      deals = await DealService.getDeals({
        tenantId,
        status: safeStatuses,
        search: search || undefined,
        assetType: assetType || undefined,
        tags,
        limit,
        offset,
        currentUserId: authenticatedUserId ? parseInt(authenticatedUserId, 10) : null
      });
    }

    return NextResponse.json({
      success: true,
      deals,
      meta: {
        count: deals.length,
        limit,
        offset,
        authenticated: isUserAuthenticated
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch deals',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
