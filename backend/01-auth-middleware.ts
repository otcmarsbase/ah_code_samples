import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'
import { thirdwebAuth, logAuthAttempt } from './auth'
import { AuditOutcome } from "@/lib/services/audit-service"

/**
 * Authenticated request payload returned on successful authentication
 */
export interface AuthenticatedRequest {
  userId: string;
  walletAddress: string;
  email?: string;
  roles: string[];
  tiers: string[];
  accreditationStatus: AccreditationStatus;
  tenantId: string;
  kycStatus?: string;
}

/**
 * User accreditation status types
 */
export type AccreditationStatus =
  | 'pending'
  | 'verified'
  | 'self_certified'
  | 'rejected'
  | 'not_accredited';

/**
 * Database user row type for type-safe queries
 */
interface UserRow {
  id: number;
  wallet_address: string;
  email: string | null;
  roles: string[] | null;
  tiers: string[] | null;
  accreditation_status: AccreditationStatus | null;
  tenant_id: string;
  kyc_status: string | null;
}

/**
 * SQL query for user lookup - explicit column selection for security and performance
 * Note: wallet_address has UNIQUE constraint across tenants (one wallet = one user)
 * For multi-tenant deployments where same wallet can exist in different tenants,
 * add tenant_id to WHERE clause: WHERE wallet_address = $1 AND tenant_id = $2
 */
const USER_SELECT_QUERY = `
  SELECT
    id,
    wallet_address,
    email,
    roles,
    tiers,
    accreditation_status,
    tenant_id,
    kyc_status
  FROM users
  WHERE wallet_address = $1
`;

/**
 * Authenticates an API request using JWT from cookies
 *
 * @returns AuthenticatedRequest on success, NextResponse with error on failure
 *
 * @example
 * ```typescript
 * const authResult = await authenticateRequest();
 * if (authResult instanceof NextResponse) {
 *   return authResult; // Return error response
 * }
 * const { userId, roles } = authResult;
 * ```
 */
export async function authenticateRequest(): Promise<AuthenticatedRequest | NextResponse> {
  const jwt = cookies().get("jwt");

  // Check for JWT presence
  if (!jwt?.value) {
    await logAuthAttempt({
      outcome: AuditOutcome.FAILURE,
      reason: "No JWT token found"
    });

    return NextResponse.json(
      { error: "Unauthorized", code: "NO_TOKEN" },
      { status: 401 }
    );
  }

  try {
    // Verify JWT with Thirdweb
    const authResult = await thirdwebAuth.verifyJWT({ jwt: jwt.value });

    if (!authResult.valid) {
      await logAuthAttempt({
        outcome: AuditOutcome.FAILURE,
        reason: "Invalid JWT token"
      });

      return NextResponse.json(
        { error: "Unauthorized", code: "INVALID_TOKEN" },
        { status: 401 }
      );
    }

    // Extract wallet address from JWT subject
    const walletAddress = authResult.parsedJWT.sub;

    if (!walletAddress) {
      await logAuthAttempt({
        outcome: AuditOutcome.FAILURE,
        reason: "No wallet address in JWT"
      });

      return NextResponse.json(
        { error: "Unauthorized", code: "NO_WALLET" },
        { status: 401 }
      );
    }

    // Lookup user in database with explicit column selection
    const userResult = await pool.query<UserRow>(USER_SELECT_QUERY, [walletAddress]);

    if (userResult.rows.length === 0) {
      await logAuthAttempt({
        walletAddress,
        outcome: AuditOutcome.FAILURE,
        reason: "User not found"
      });

      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];
    const userId = user.id.toString();

    // Log successful authentication
    await logAuthAttempt({
      userId,
      walletAddress,
      outcome: AuditOutcome.SUCCESS,
      reason: "Authenticated successfully"
    });

    // Return full authenticated request with user data
    return {
      userId,
      walletAddress,
      email: user.email ?? undefined,
      roles: user.roles ?? [],
      tiers: user.tiers ?? [],
      accreditationStatus: user.accreditation_status ?? 'not_accredited',
      tenantId: user.tenant_id,
      kycStatus: user.kyc_status ?? undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logAuthAttempt({
      outcome: AuditOutcome.FAILURE,
      reason: "Authentication error",
      additionalDetails: { error: errorMessage }
    });

    return NextResponse.json(
      { error: "Authentication error", code: "AUTH_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Type guard to check if auth result is successful
 */
export function isAuthenticated(
  result: AuthenticatedRequest | NextResponse
): result is AuthenticatedRequest {
  return !(result instanceof NextResponse);
}

/**
 * Optional authentication for public endpoints that have enhanced features for authenticated users.
 * Unlike authenticateRequest(), this does NOT log failures or return error responses.
 * Use this for endpoints like /api/deals that work for both public and authenticated users.
 *
 * @returns AuthenticatedRequest on success, null if not authenticated
 *
 * @example
 * ```typescript
 * const authResult = await authenticateOptional();
 * const isUserAuthenticated = authResult !== null;
 * const userId = authResult?.userId ?? null;
 * ```
 */
export async function authenticateOptional(): Promise<AuthenticatedRequest | null> {
  const jwt = cookies().get("jwt");

  // No JWT = not authenticated (no error, no logging)
  if (!jwt?.value) {
    return null;
  }

  try {
    const authResult = await thirdwebAuth.verifyJWT({ jwt: jwt.value });

    if (!authResult.valid) {
      return null; // Invalid token = not authenticated (silent fail for optional auth)
    }

    const walletAddress = authResult.parsedJWT.sub;
    if (!walletAddress) {
      return null;
    }

    const userResult = await pool.query<UserRow>(USER_SELECT_QUERY, [walletAddress]);
    if (userResult.rows.length === 0) {
      return null;
    }

    const user = userResult.rows[0];

    // Success - log only successful auth for optional endpoints
    await logAuthAttempt({
      userId: user.id.toString(),
      walletAddress,
      outcome: AuditOutcome.SUCCESS,
      reason: "Optional auth succeeded"
    });

    return {
      userId: user.id.toString(),
      walletAddress,
      email: user.email ?? undefined,
      roles: user.roles ?? [],
      tiers: user.tiers ?? [],
      accreditationStatus: user.accreditation_status ?? 'not_accredited',
      tenantId: user.tenant_id,
      kycStatus: user.kyc_status ?? undefined
    };
  } catch {
    // Any error = not authenticated (silent fail for optional auth)
    return null;
  }
}
