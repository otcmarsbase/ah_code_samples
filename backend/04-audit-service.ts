import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Enum for action types to ensure consistency
export enum AuditActionType {
  // Authentication actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  MFA_ENABLE = 'mfa_enable',
  MFA_DISABLE = 'mfa_disable',
  SESSION_EXPIRE = 'session_expire',
  API_KEY_GENERATE = 'api_key_generate',
  API_KEY_REVOKE = 'api_key_revoke',
  
  // CRUD operations
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_CREATE = 'bulk_create',
  BULK_UPDATE = 'bulk_update',
  BULK_DELETE = 'bulk_delete',
  IMPORT = 'import',
  EXPORT = 'export',
  
  // Workflow actions
  APPROVE = 'approve',
  REJECT = 'reject',
  SUBMIT = 'submit',
  REVIEW = 'review',
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  ASSIGN = 'assign',
  REASSIGN = 'reassign',
  
  // Financial actions
  PAYMENT = 'payment',
  PAYMENT_AUTHORIZE = 'payment_authorize',
  PAYMENT_CAPTURE = 'payment_capture',
  PAYMENT_REFUND = 'payment_refund',
  PAYMENT_DISPUTE = 'payment_dispute',
  TRANSFER = 'transfer',
  WITHDRAW = 'withdraw',
  DEPOSIT = 'deposit',
  BALANCE_ADJUST = 'balance_adjust',
  TOKEN_MINT = 'token_mint',
  TOKEN_BURN = 'token_burn',
  TOKEN_TRANSFER = 'token_transfer',
  
  // User management
  SETTINGS_CHANGE = 'settings_change',
  ROLE_CHANGE = 'role_change',
  ROLE_ASSIGN = 'role_assign',
  PERMISSION_CHANGE = 'permission_change',
  GROUP_ADD = 'group_add',
  GROUP_REMOVE = 'group_remove',
  
  // KYC/AML actions
  KYC_STATUS_CHANGE = 'kyc_status_change',
  KYC_DOCUMENT_UPLOAD = 'kyc_document_upload',
  KYC_DOCUMENT_VERIFY = 'kyc_document_verify',
  KYC_DOCUMENT_REJECT = 'kyc_document_reject',
  AML_CHECK = 'aml_check',
  AML_ALERT = 'aml_alert',
  
  // Referrals and marketing
  REFERRAL_LINK_CREATE = 'referral_link_create',
  REFERRAL_LINK_DISABLE = 'referral_link_disable',
  REFERRAL_CONVERSION = 'referral_conversion',
  COMMISSION_PAYOUT = 'commission_payout',
  CAMPAIGN_CREATE = 'campaign_create',
  CAMPAIGN_UPDATE = 'campaign_update',
  CAMPAIGN_DELETE = 'campaign_delete',
  
  // System actions
  API_CALL = 'api_call',
  SYSTEM_ERROR = 'system_error',
  SYSTEM_WARNING = 'system_warning',
  SYSTEM_INFO = 'system_info',
  BACKUP_CREATE = 'backup_create',
  BACKUP_RESTORE = 'backup_restore',
  MAINTENANCE_START = 'maintenance_start',
  MAINTENANCE_END = 'maintenance_end',
  AUDIT_LOG_VIEW = 'audit_log_view',
  AUDIT_LOG_EXPORT = 'audit_log_export',
  AUDIT_LOG_PURGE = 'audit_log_purge',
  
  // Data actions
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  SHARE = 'share',
  UNSHARE = 'unshare',
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  
  // Deal-specific actions
  DEAL_LAUNCH = 'deal_launch',
  DEAL_CLOSE = 'deal_close',
  DEAL_EXTEND = 'deal_extend',
  INVESTMENT_COMMIT = 'investment_commit',
  INVESTMENT_CANCEL = 'investment_cancel',
  INVESTMENT_COMPLETE = 'investment_complete',
  DOCUMENT_SIGN = 'document_sign',
}

// Enum for entity types
export enum AuditEntityType {
  // User-related entities
  USER = 'user',
  USER_GROUP = 'user_group',
  ROLE = 'role',
  PERMISSION = 'permission',
  API_KEY = 'api_key',
  SESSION = 'session',
  
  // Deal-related entities
  DEAL = 'deal',
  DEAL_STAGE = 'deal_stage',
  DEAL_TERM = 'deal_term',
  INVESTMENT = 'investment',
  INVESTMENT_TERM = 'investment_term',
  
  // Token-related entities
  TOKEN = 'token',
  TOKEN_HOLDER = 'token_holder',
  TOKEN_DISTRIBUTION = 'token_distribution',
  TOKEN_VESTING = 'token_vesting',
  
  // Legal entities
  ENTITY = 'entity',
  LEGAL_DOCUMENT = 'legal_document',
  CONTRACT = 'contract',
  AGREEMENT = 'agreement',
  
  // Marketing & referrals
  REFERRER = 'referrer',
  REFERRAL_LINK = 'referral_link',
  REFERRAL = 'referral',
  COMMISSION = 'commission',
  CAMPAIGN = 'campaign',
  
  // Financial entities
  PAYMENT = 'payment',
  TRANSACTION = 'transaction',
  INVOICE = 'invoice',
  BANK_ACCOUNT = 'bank_account',
  WALLET = 'wallet',
  
  // Content & documents
  DOCUMENT = 'document',
  FILE = 'file',
  TEMPLATE = 'template',
  SIGNATURE = 'signature',
  COMMENT = 'comment',
  MESSAGE = 'message',
  
  // System entities
  SETTINGS = 'settings',
  SYSTEM = 'system',
  AUDIT_LOG = 'audit_log',
  TENANT = 'tenant',
  API_ENDPOINT = 'api_endpoint',
  DATABASE = 'database',
  SCHEDULER = 'scheduler',
  JOB = 'job',
  
  // KYC/AML entities
  KYC_DOCUMENT = 'kyc_document',
  KYC_VERIFICATION = 'kyc_verification',
  AML_CHECK = 'aml_check',
  RISK_ASSESSMENT = 'risk_assessment',
}

// Enum for audit outcomes
export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
  WARNING = 'warning',
  ERROR = 'error',
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled',
  DENIED = 'denied',
  EXPIRED = 'expired',
  PARTIAL = 'partial',
  UNKNOWN = 'unknown',
}

/**
 * Typed detail structures for common audit events
 * Provides type safety instead of Record<string, any>
 */
export interface AuthenticationDetails {
  method?: 'jwt' | 'api_key' | 'oauth' | 'wallet';
  provider?: string;
  mfaUsed?: boolean;
}

export interface TransactionDetails {
  amount?: number;
  currency?: string;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
}

export interface EntityChangeDetails {
  fieldName?: string;
  tableName?: string;
  recordCount?: number;
}

/** Union type for structured audit details */
export type AuditDetails =
  | AuthenticationDetails
  | TransactionDetails
  | EntityChangeDetails
  | Record<string, unknown>;

/** Change tracking with proper typing */
export interface FieldChange {
  oldValue?: unknown;
  newValue?: unknown;
}

// Interface for audit log entry
export interface AuditLogEntry {
  id?: string;
  timestamp?: Date;
  userId?: string;
  userEmail?: string;          // Store email for better readability
  userName?: string;           // Store name for better readability
  actionType: AuditActionType;
  actionCategory?: string;     // Grouping of related actions
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;         // Descriptive name of the entity
  secondaryEntityType?: AuditEntityType; // For actions involving two entities
  secondaryEntityId?: string;
  secondaryEntityName?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;           // Geo-location data if available
  deviceId?: string;           // Device identifier if available
  sessionId?: string;          // Session identifier if applicable
  details?: AuditDetails;      // Typed audit details
  changes?: Record<string, FieldChange>;  // Track specific field changes
  duration?: number;           // How long the action took in ms
  outcome: AuditOutcome;
  errorMessage?: string;       // If outcome was FAILURE or ERROR
  severity?: 'low' | 'medium' | 'high' | 'critical'; // Risk level
  tenantId?: string;
  sourceSystem?: string;       // Origin system if in a microservice architecture
  correlationId?: string;      // For tracking related events
  tags?: string[];             // Custom tags for filtering/grouping
}

// Log query parameters interface
export interface AuditLogQueryParams {
  userId?: string;
  userEmail?: string;
  userName?: string;
  actionType?: AuditActionType | AuditActionType[];
  actionCategory?: string | string[];
  entityType?: AuditEntityType | AuditEntityType[];
  entityId?: string;
  entityName?: string;
  secondaryEntityType?: AuditEntityType;
  secondaryEntityId?: string;
  startDate?: Date;
  endDate?: Date;
  outcome?: AuditOutcome | AuditOutcome[];
  severity?: ('low' | 'medium' | 'high' | 'critical')[];
  ipAddress?: string;
  location?: string;
  deviceId?: string;
  sessionId?: string;
  tenantId?: string;
  sourceSystem?: string;
  correlationId?: string;
  tags?: string | string[];
  search?: string;             // Full-text search across multiple fields
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  groupBy?: string;            // Group results by a specific field
  includeDetails?: boolean;    // Whether to include full details objects
  includeChanges?: boolean;    // Whether to include field changes
}

/** Fields that should NEVER be logged (security-critical) */
const REDACT_FIELDS = new Set([
  'jwt', 'token', 'accessToken', 'refreshToken', 'apiKey', 'apiSecret',
  'password', 'passwordHash', 'secret', 'privateKey', 'signingKey',
  'ssn', 'socialSecurityNumber', 'taxId', 'passport', 'driversLicense',
  'creditCard', 'cardNumber', 'cvv', 'bankAccount', 'routingNumber'
]);

/** Fields that should be partially masked (PII but useful for debugging) */
const MASK_FIELDS = new Set([
  'email', 'phone', 'phoneNumber', 'walletAddress', 'address',
  'firstName', 'lastName', 'fullName', 'dateOfBirth', 'dob'
]);

/**
 * Redact sensitive fields from audit details to prevent PII/secrets exposure
 * @param details - Raw audit details object
 * @returns Sanitized details safe for storage
 */
function redactAuditDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details || typeof details !== 'object') return details;

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();

    // Completely redact security-critical fields
    if (REDACT_FIELDS.has(key) || REDACT_FIELDS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
      continue;
    }

    // Partially mask PII fields
    if (MASK_FIELDS.has(key) || MASK_FIELDS.has(lowerKey)) {
      if (typeof value === 'string' && value.length > 4) {
        redacted[key] = value.slice(0, 2) + '***' + value.slice(-2);
      } else {
        redacted[key] = '[MASKED]';
      }
      continue;
    }

    // Recursively handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactAuditDetails(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Service for handling audit logging throughout the application
 */
export class AuditService {
  private pool: Pool;
  private static instance: AuditService;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get the singleton instance of AuditService
   */
  public static getInstance(pool: Pool): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService(pool);
    }
    return AuditService.instance;
  }

  /**
   * Log an action to the audit logs
   */
  public async log(entry: AuditLogEntry): Promise<string> {
    try {
      const {
        userId,
        actionType,
        entityType,
        entityId,
        ipAddress,
        userAgent,
        details,
        outcome,
        tenantId,
      } = entry;

      const result = await this.pool.query(
        `INSERT INTO audit_logs (
          id, 
          user_id, 
          action_type, 
          entity_type, 
          entity_id, 
          ip_address, 
          user_agent, 
          details, 
          outcome, 
          tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          uuidv4(),
          userId,
          actionType,
          entityType,
          entityId,
          ipAddress,
          userAgent,
          // SECURITY: Redact sensitive fields before storing
          details ? JSON.stringify(redactAuditDetails(details as Record<string, unknown>)) : null,
          outcome,
          tenantId,
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      // In production, integrate with structured logging (Winston, Pino, etc.)
      // Audit failures should be captured but not break application flow
      // Example: logger.error('audit.write.failed', { error, entry })
      return '';
    }
  }

  /**
   * Extract client IP from request headers
   * Handles x-forwarded-for format: "client, proxy1, proxy2"
   */
  private extractClientIp(req: NextRequest): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // x-forwarded-for is comma-separated; first IP is the client
      const firstIp = forwardedFor.split(',')[0]?.trim();
      if (firstIp) return firstIp;
    }
    return req.headers.get('x-real-ip') || 'unknown';
  }

  /**
   * Create an audit log entry from a request object
   */
  public async logFromRequest(
    req: NextRequest,
    userId: string | undefined,
    actionType: AuditActionType,
    entityType: AuditEntityType,
    entityId: string | undefined,
    details: AuditDetails | undefined,
    outcome: AuditOutcome,
    tenantId: string | undefined
  ): Promise<string> {
    const ipAddress = this.extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    return this.log({
      userId,
      actionType,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      details,
      outcome,
      tenantId,
    });
  }

  /**
   * Query audit logs with various filters
   */
  public async query(params: AuditLogQueryParams): Promise<{ logs: any[], total: number }> {
    try {
      const {
        userId,
        userEmail,
        userName,
        actionType,
        actionCategory,
        entityType,
        entityId,
        entityName,
        secondaryEntityType,
        secondaryEntityId,
        startDate,
        endDate,
        outcome,
        severity,
        ipAddress,
        location,
        deviceId,
        sessionId,
        tenantId,
        sourceSystem,
        correlationId,
        tags,
        search,
        limit = 50,
        offset = 0,
        orderBy = 'timestamp',
        orderDirection = 'DESC',
        includeDetails = true,
        includeChanges = true,
      } = params;

      // Build the where clause
      let whereClause = '';
      const queryParams: any[] = [];
      const conditions: string[] = [];

      // Helper function to handle array parameters
      const addArrayCondition = (field: string, values: any[] | any, operator = 'IN') => {
        if (!values) return;
        
        const array = Array.isArray(values) ? values : [values];
        if (array.length === 0) return;
        
        if (array.length === 1) {
          queryParams.push(array[0]);
          conditions.push(`${field} = $${queryParams.length}`);
        } else {
          queryParams.push(array);
          conditions.push(`${field} ${operator} ($${queryParams.length}::text[])`);
        }
      };
      
      // User filters
      if (userId) {
        queryParams.push(userId);
        conditions.push(`user_id = $${queryParams.length}`);
      }
      
      if (userEmail) {
        queryParams.push(userEmail);
        conditions.push(`user_email = $${queryParams.length}`);
      }
      
      if (userName) {
        queryParams.push(`%${userName}%`);
        conditions.push(`user_name ILIKE $${queryParams.length}`);
      }
      
      // Action filters
      addArrayCondition('action_type', actionType);
      
      if (actionCategory) {
        addArrayCondition('action_category', actionCategory);
      }
      
      // Entity filters
      addArrayCondition('entity_type', entityType);
      
      if (entityId) {
        queryParams.push(entityId);
        conditions.push(`entity_id = $${queryParams.length}`);
      }
      
      if (entityName) {
        queryParams.push(`%${entityName}%`);
        conditions.push(`entity_name ILIKE $${queryParams.length}`);
      }
      
      // Secondary entity filters
      if (secondaryEntityType) {
        queryParams.push(secondaryEntityType);
        conditions.push(`secondary_entity_type = $${queryParams.length}`);
      }
      
      if (secondaryEntityId) {
        queryParams.push(secondaryEntityId);
        conditions.push(`secondary_entity_id = $${queryParams.length}`);
      }
      
      // Time range filters
      if (startDate) {
        queryParams.push(startDate);
        conditions.push(`timestamp >= $${queryParams.length}`);
      }
      
      if (endDate) {
        queryParams.push(endDate);
        conditions.push(`timestamp <= $${queryParams.length}`);
      }
      
      // Outcome and severity filters
      addArrayCondition('outcome', outcome);
      addArrayCondition('severity', severity);
      
      // Technical info filters
      if (ipAddress) {
        queryParams.push(ipAddress);
        conditions.push(`ip_address = $${queryParams.length}`);
      }
      
      if (location) {
        queryParams.push(`%${location}%`);
        conditions.push(`location ILIKE $${queryParams.length}`);
      }
      
      if (deviceId) {
        queryParams.push(deviceId);
        conditions.push(`device_id = $${queryParams.length}`);
      }
      
      if (sessionId) {
        queryParams.push(sessionId);
        conditions.push(`session_id = $${queryParams.length}`);
      }
      
      // System context filters
      if (tenantId) {
        queryParams.push(tenantId);
        conditions.push(`tenant_id = $${queryParams.length}`);
      }
      
      if (sourceSystem) {
        queryParams.push(sourceSystem);
        conditions.push(`source_system = $${queryParams.length}`);
      }
      
      if (correlationId) {
        queryParams.push(correlationId);
        conditions.push(`correlation_id = $${queryParams.length}`);
      }
      
      // Tag filters
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        queryParams.push(tagArray);
        conditions.push(`tags && $${queryParams.length}::text[]`);
      }
      
      // Full-text search
      if (search) {
        queryParams.push(`%${search}%`);
        conditions.push(`(
          coalesce(user_name, '') ILIKE $${queryParams.length} OR
          coalesce(user_email, '') ILIKE $${queryParams.length} OR
          coalesce(entity_name, '') ILIKE $${queryParams.length} OR
          coalesce(secondary_entity_name, '') ILIKE $${queryParams.length} OR
          coalesce(details::text, '') ILIKE $${queryParams.length} OR
          coalesce(error_message, '') ILIKE $${queryParams.length}
        )`);
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total, 10);

      // Validate order by field
      const validOrderByFields = [
        'timestamp', 'user_id', 'user_name', 'user_email', 
        'action_type', 'action_category', 'entity_type', 'entity_name',
        'outcome', 'severity', 'ip_address', 'created_at', 'duration'
      ];
      
      const validOrderBy = validOrderByFields.includes(orderBy)
        ? orderBy
        : 'timestamp';
      
      const validOrderDirection = ['ASC', 'DESC'].includes(orderDirection)
        ? orderDirection
        : 'DESC';

      queryParams.push(limit);
      queryParams.push(offset);
      
      // Build field list based on include parameters
      const detailsField = includeDetails ? 'details' : 'NULL AS details';
      const changesField = includeChanges ? 'changes' : 'NULL AS changes';

      const query = `
        SELECT 
          id, 
          timestamp, 
          user_id, 
          user_name,
          user_email,
          action_type, 
          action_category,
          entity_type, 
          entity_id, 
          entity_name,
          secondary_entity_type,
          secondary_entity_id,
          secondary_entity_name,
          ip_address, 
          user_agent, 
          location,
          device_id,
          session_id,
          ${detailsField}, 
          ${changesField},
          duration,
          outcome, 
          error_message,
          severity,
          tenant_id, 
          source_system,
          correlation_id,
          tags,
          created_at
        FROM audit_logs 
        ${whereClause} 
        ORDER BY ${validOrderBy} ${validOrderDirection}
        LIMIT $${queryParams.length - 1} 
        OFFSET $${queryParams.length}
      `;

      const result = await this.pool.query(query, queryParams);

      // Process results
      const logs = result.rows.map(row => {
        // Convert string array representation to JavaScript array if needed
        if (row.tags && typeof row.tags === 'string') {
          try {
            row.tags = JSON.parse(row.tags);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        // Parse JSON fields if they are strings
        if (row.details && typeof row.details === 'string') {
          try {
            row.details = JSON.parse(row.details);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        if (row.changes && typeof row.changes === 'string') {
          try {
            row.changes = JSON.parse(row.changes);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        return row;
      });

      return {
        logs,
        total,
      };
    } catch (error) {
      // Production: logger.error('audit.query.failed', { error, params })
      return {
        logs: [],
        total: 0,
      };
    }
  }

  /**
   * Get comprehensive summary statistics for audit logs
   */
  public async getSummaryStats(params: { tenantId?: string, startDate?: Date, endDate?: Date } = {}): Promise<any> {
    try {
      const { tenantId, startDate, endDate } = params;
      const queryParams: any[] = [];
      const conditions: string[] = [];
      
      if (tenantId) {
        queryParams.push(tenantId);
        conditions.push(`tenant_id = $${queryParams.length}`);
      }
      
      if (startDate) {
        queryParams.push(startDate);
        conditions.push(`timestamp >= $${queryParams.length}`);
      }
      
      if (endDate) {
        queryParams.push(endDate);
        conditions.push(`timestamp <= $${queryParams.length}`);
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

      // Get action type statistics
      const actionTypeQuery = `
        SELECT 
          action_type, 
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM audit_logs
        ${whereClause}
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 10
      `;
      
      // Get entity type statistics
      const entityTypeQuery = `
        SELECT 
          entity_type, 
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM audit_logs
        ${whereClause}
        GROUP BY entity_type
        ORDER BY count DESC
        LIMIT 10
      `;
      
      // Get outcome statistics
      const outcomeQuery = `
        SELECT 
          outcome, 
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM audit_logs
        ${whereClause}
        GROUP BY outcome
        ORDER BY count DESC
      `;
      
      // Get user statistics
      const userQuery = `
        SELECT 
          user_id,
          user_name,
          user_email,
          COUNT(*) as count,
          MAX(timestamp) as last_activity
        FROM audit_logs
        ${whereClause}
        GROUP BY user_id, user_name, user_email
        ORDER BY count DESC
        LIMIT 10
      `;
      
      // Get time-based statistics (activity by hour of day)
      const timeQuery = `
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour_of_day,
          COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY hour_of_day
        ORDER BY hour_of_day
      `;
      
      // Get success/failure ratio
      const successRateQuery = `
        SELECT
          COUNT(*) FILTER (WHERE outcome = 'success') as success_count,
          COUNT(*) FILTER (WHERE outcome = 'failure' OR outcome = 'error') as failure_count,
          CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE outcome = 'success')::numeric / COUNT(*)::numeric) * 100, 2)
            ELSE 0
          END as success_percentage
        FROM audit_logs
        ${whereClause}
      `;
      
      // Get recent errors
      const recentErrorsQuery = `
        SELECT 
          id,
          timestamp,
          user_id,
          user_name,
          action_type,
          entity_type,
          entity_id,
          error_message,
          severity
        FROM audit_logs
        WHERE (outcome = 'failure' OR outcome = 'error')
        ${whereClause ? `AND ${conditions.join(' AND ')}` : ''}
        ORDER BY timestamp DESC
        LIMIT 10
      `;

      // Execute all queries in parallel
      const [
        actionTypeResult,
        entityTypeResult,
        outcomeResult,
        userResult,
        timeResult,
        successRateResult,
        recentErrorsResult
      ] = await Promise.all([
        this.pool.query(actionTypeQuery, queryParams),
        this.pool.query(entityTypeQuery, queryParams),
        this.pool.query(outcomeQuery, queryParams),
        this.pool.query(userQuery, queryParams),
        this.pool.query(timeQuery, queryParams),
        this.pool.query(successRateQuery, queryParams),
        this.pool.query(recentErrorsQuery, whereClause ? queryParams : [])
      ]);
      
      // Format and return the comprehensive statistics
      return {
        topActions: actionTypeResult.rows,
        topEntities: entityTypeResult.rows,
        outcomes: outcomeResult.rows,
        topUsers: userResult.rows,
        activityByHour: timeResult.rows,
        successRate: successRateResult.rows[0],
        recentErrors: recentErrorsResult.rows
      };
    } catch (error) {
      // Production: logger.error('audit.summary.failed', { error, params })
      return {
        topActions: [],
        topEntities: [],
        outcomes: [],
        topUsers: [],
        activityByHour: [],
        successRate: { success_count: 0, failure_count: 0, success_percentage: 0 },
        recentErrors: []
      };
    }
  }

  /**
   * Get detailed activity for a specific user with enhanced information
   */
  public async getUserActivity(userId: string, options: {
    limit?: number,
    startDate?: Date,
    endDate?: Date,
    includeDetails?: boolean
  } = {}): Promise<any> {
    try {
      const { 
        limit = 10, 
        startDate, 
        endDate,
        includeDetails = false 
      } = options;
      
      const queryParams: any[] = [userId];
      const conditions: string[] = ['user_id = $1'];
      
      if (startDate) {
        queryParams.push(startDate);
        conditions.push(`timestamp >= $${queryParams.length}`);
      }
      
      if (endDate) {
        queryParams.push(endDate);
        conditions.push(`timestamp <= $${queryParams.length}`);
      }
      
      // Get recent activity
      const activityQuery = `
        SELECT 
          id, 
          timestamp, 
          user_id,
          user_name,
          user_email,
          action_type, 
          action_category,
          entity_type, 
          entity_id, 
          entity_name,
          ip_address,
          location,
          outcome,
          severity,
          ${includeDetails ? 'details,' : ''}
          error_message
        FROM audit_logs
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${queryParams.length + 1}
      `;
      
      queryParams.push(limit);
      const activityResult = await this.pool.query(activityQuery, queryParams);
      
      // Get summary statistics for this user
      const statsQuery = `
        SELECT
          COUNT(*) as total_actions,
          COUNT(DISTINCT entity_id) as total_entities,
          COUNT(*) FILTER (WHERE outcome = 'success') as successful_actions,
          COUNT(*) FILTER (WHERE outcome = 'failure' OR outcome = 'error') as failed_actions,
          MAX(timestamp) as last_activity,
          MIN(timestamp) as first_activity
        FROM audit_logs
        WHERE user_id = $1
      `;
      
      const statsResult = await this.pool.query(statsQuery, [userId]);
      
      // Get top actions by this user
      const topActionsQuery = `
        SELECT
          action_type,
          COUNT(*) as count
        FROM audit_logs
        WHERE user_id = $1
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 5
      `;
      
      const topActionsResult = await this.pool.query(topActionsQuery, [userId]);
      
      // Get distinct IP addresses used
      const ipAddressesQuery = `
        SELECT DISTINCT
          ip_address,
          MAX(timestamp) as last_used
        FROM audit_logs
        WHERE user_id = $1 AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY last_used DESC
        LIMIT 5
      `;
      
      const ipAddressesResult = await this.pool.query(ipAddressesQuery, [userId]);
      
      // Return comprehensive user activity information
      return {
        activity: activityResult.rows,
        stats: statsResult.rows[0] || {
          total_actions: 0,
          total_entities: 0,
          successful_actions: 0,
          failed_actions: 0,
          last_activity: null,
          first_activity: null
        },
        topActions: topActionsResult.rows,
        ipAddresses: ipAddressesResult.rows
      };
    } catch (error) {
      // Production: logger.error('audit.user_activity.failed', { error, userId })
      return {
        activity: [],
        stats: {
          total_actions: 0,
          total_entities: 0,
          successful_actions: 0,
          failed_actions: 0,
          last_activity: null,
          first_activity: null
        },
        topActions: [],
        ipAddresses: []
      };
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   * @param retentionDays Number of days to keep logs for (must be positive integer)
   */
  public async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      // SECURITY: Validate input and use parameterized interval (no string interpolation)
      const safeDays = Math.max(1, Math.floor(retentionDays));

      const result = await this.pool.query(
        `DELETE FROM audit_logs
         WHERE timestamp < NOW() - ($1 * INTERVAL '1 day')
         RETURNING id`,
        [safeDays]
      );

      return result.rowCount ?? 0;
    } catch (error) {
      // Production: logger.error('audit.cleanup.failed', { error, retentionDays })
      return 0;
    }
  }

  /**
   * Detect anomalies in audit logs
   * This method identifies unusual patterns or suspicious activities
   */
  public async detectAnomalies(params: {
    tenantId?: string,
    lookbackPeriod?: number, // in days
    sensitivityLevel?: 'low' | 'medium' | 'high'
  } = {}): Promise<any> {
    try {
      const { 
        tenantId, 
        lookbackPeriod = 7, // Default to 7 days
        sensitivityLevel = 'medium' 
      } = params;
      
      const queryParams: any[] = [];
      const conditions: string[] = [];
      
      // Set time window
      queryParams.push(lookbackPeriod);
      conditions.push(`timestamp >= NOW() - INTERVAL '${lookbackPeriod} days'`);
      
      if (tenantId) {
        queryParams.push(tenantId);
        conditions.push(`tenant_id = $${queryParams.length}`);
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Set threshold based on sensitivity level
      const thresholdMultiplier = sensitivityLevel === 'low' ? 3 :
                                sensitivityLevel === 'medium' ? 2 : 1.5;
      
      // 1. Unusual login patterns (multiple failures followed by success)
      const loginAnomalyQuery = `
        WITH login_attempts AS (
          SELECT 
            user_id, 
            ip_address, 
            timestamp, 
            outcome,
            LAG(outcome, 1) OVER (PARTITION BY user_id ORDER BY timestamp) as prev_outcome,
            LAG(outcome, 2) OVER (PARTITION BY user_id ORDER BY timestamp) as prev_outcome2
          FROM audit_logs
          WHERE action_type = 'login'
          ${whereClause ? `AND ${conditions.join(' AND ')}` : ''}
        )
        SELECT 
          user_id, 
          ip_address, 
          timestamp,
          'suspicious_login_pattern' as anomaly_type,
          'Multiple failed logins followed by success' as description,
          'high' as risk_level
        FROM login_attempts
        WHERE outcome = 'success' 
        AND (prev_outcome = 'failure' OR prev_outcome = 'error')
        AND (prev_outcome2 = 'failure' OR prev_outcome2 = 'error')
      `;
      
      // 2. Unusual volume of activity for users
      const unusualVolumeQuery = `
        WITH user_daily_activity AS (
          SELECT 
            user_id,
            DATE(timestamp) as activity_date,
            COUNT(*) as daily_count
          FROM audit_logs
          ${whereClause}
          GROUP BY user_id, DATE(timestamp)
        ),
        user_stats AS (
          SELECT
            user_id,
            AVG(daily_count) as avg_daily_actions,
            STDDEV(daily_count) as stddev_daily_actions
          FROM user_daily_activity
          GROUP BY user_id
          HAVING COUNT(*) >= 3 -- Need at least 3 days of data
        )
        SELECT
          a.user_id,
          a.activity_date,
          a.daily_count,
          s.avg_daily_actions,
          'unusual_activity_volume' as anomaly_type,
          'Activity volume exceeds typical patterns' as description,
          CASE 
            WHEN a.daily_count > s.avg_daily_actions + (s.stddev_daily_actions * ${thresholdMultiplier} * 2) THEN 'high'
            WHEN a.daily_count > s.avg_daily_actions + (s.stddev_daily_actions * ${thresholdMultiplier}) THEN 'medium'
            ELSE 'low'
          END as risk_level
        FROM user_daily_activity a
        JOIN user_stats s ON a.user_id = s.user_id
        WHERE a.daily_count > s.avg_daily_actions + (s.stddev_daily_actions * ${thresholdMultiplier})
        ORDER BY risk_level DESC, a.daily_count DESC
      `;
      
      // 3. Access from unusual locations or IPs
      const unusualLocationQuery = `
        WITH user_ip_stats AS (
          SELECT
            user_id,
            ip_address,
            COUNT(*) as usage_count,
            MAX(timestamp) as last_used
          FROM audit_logs
          ${whereClause}
          GROUP BY user_id, ip_address
        ),
        user_ip_rank AS (
          SELECT
            user_id,
            ip_address,
            usage_count,
            last_used,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY usage_count DESC) as ip_rank
          FROM user_ip_stats
        )
        SELECT
          l.user_id,
          l.ip_address,
          l.timestamp,
          l.action_type,
          'unusual_location_access' as anomaly_type,
          'Access from rarely used IP address' as description,
          CASE
            WHEN r.ip_rank > 5 THEN 'high'
            WHEN r.ip_rank > 3 THEN 'medium'
            ELSE 'low'
          END as risk_level
        FROM audit_logs l
        JOIN user_ip_rank r ON l.user_id = r.user_id AND l.ip_address = r.ip_address
        WHERE r.ip_rank > 2
        AND l.timestamp >= NOW() - INTERVAL '1 day'
        ${whereClause ? `AND ${conditions.slice(1).join(' AND ')}` : ''}
        ORDER BY risk_level DESC, l.timestamp DESC
      `;
      
      // Execute all anomaly detection queries in parallel
      const [loginAnomalies, volumeAnomalies, locationAnomalies] = await Promise.all([
        this.pool.query(loginAnomalyQuery),
        this.pool.query(unusualVolumeQuery),
        this.pool.query(unusualLocationQuery)
      ]);
      
      return {
        loginAnomalies: loginAnomalies.rows,
        volumeAnomalies: volumeAnomalies.rows,
        locationAnomalies: locationAnomalies.rows,
        totalAnomalies: loginAnomalies.rowCount + volumeAnomalies.rowCount + locationAnomalies.rowCount,
        timestamp: new Date(),
        sensitivityLevel
      };
    } catch (error) {
      // Production: logger.error('audit.anomaly_detection.failed', { error, params })
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        loginAnomalies: [],
        volumeAnomalies: [],
        locationAnomalies: [],
        totalAnomalies: 0,
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }
  
  /**
   * Get audit trail for a specific entity
   */
  /**
   * Analyze trends in audit logs over time
   * This helps identify patterns and changes in system usage
   */
  /** Valid groupBy fields for trend analysis (SQL injection prevention) */
  private static readonly VALID_GROUP_BY_FIELDS = new Set([
    'action_type', 'entity_type', 'outcome', 'user_id'
  ]);

  public async analyzeTrends(params: {
    tenantId?: string,
    timeUnit?: 'hour' | 'day' | 'week' | 'month',
    startDate?: Date,
    endDate?: Date,
    groupBy?: 'action_type' | 'entity_type' | 'outcome' | 'user_id'
  } = {}): Promise<{
    trends: Record<string, unknown>[];
    categories: string[];
    timeUnit: string;
    groupBy: string;
    startDate: Date;
    endDate: Date;
    error?: string;
  }> {
    try {
      const {
        tenantId,
        timeUnit = 'day',
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
        endDate = new Date(),
        groupBy = 'action_type'
      } = params;

      // SECURITY: Validate groupBy against allowlist to prevent SQL injection
      const validGroupBy = AuditService.VALID_GROUP_BY_FIELDS.has(groupBy)
        ? groupBy
        : 'action_type';

      const queryParams: (Date | string)[] = [startDate, endDate];
      let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2';

      if (tenantId) {
        queryParams.push(tenantId);
        whereClause += ` AND tenant_id = $${queryParams.length}`;
      }

      // Create the appropriate time truncation based on the selected time unit
      let timeFunction: string;
      switch(timeUnit) {
        case 'hour':
          timeFunction = "DATE_TRUNC('hour', timestamp)";
          break;
        case 'week':
          timeFunction = "DATE_TRUNC('week', timestamp)";
          break;
        case 'month':
          timeFunction = "DATE_TRUNC('month', timestamp)";
          break;
        case 'day':
        default:
          timeFunction = "DATE_TRUNC('day', timestamp)";
          break;
      }

      // Build query for trend analysis (validGroupBy is from allowlist, safe to interpolate)
      const query = `
        SELECT
          ${timeFunction} as time_period,
          ${validGroupBy},
          COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY time_period, ${validGroupBy}
        ORDER BY time_period, ${validGroupBy}
      `;
      
      const result = await this.pool.query(query, queryParams);
      
      // Transform results for easier visualization and analysis
      const timeMap = new Map();
      const categorySet = new Set();
      
      result.rows.forEach(row => {
        const timePeriod = row.time_period.toISOString();
        const category = row[validGroupBy];
        
        categorySet.add(category);
        
        if (!timeMap.has(timePeriod)) {
          timeMap.set(timePeriod, { time_period: timePeriod });
        }
        
        const timeObj = timeMap.get(timePeriod);
        timeObj[category] = row.count;
      });
      
      // Convert map to array for final result
      const timeData = Array.from(timeMap.values());
      const categories = Array.from(categorySet);
      
      return {
        trends: timeData,
        categories,
        timeUnit,
        groupBy: validGroupBy,
        startDate,
        endDate
      };
    } catch (error) {
      // Production: logger.error('audit.trends.failed', { error, params })
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        trends: [],
        categories: [],
        timeUnit: params.timeUnit || 'day',
        groupBy: params.groupBy || 'action_type',
        startDate: params.startDate || new Date(),
        endDate: params.endDate || new Date(),
        error: errorMessage
      };
    }
  }
  
  /**
   * Generate a compliance report for a given time period
   */
  public async generateComplianceReport(params: {
    tenantId?: string,
    reportType?: 'security' | 'activity' | 'access' | 'changes',
    startDate?: Date,
    endDate?: Date,
    format?: 'json' | 'csv'
  } = {}): Promise<any> {
    try {
      const { 
        tenantId, 
        reportType = 'activity',
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
        endDate = new Date(),
        format = 'json'
      } = params;
      
      const queryParams: any[] = [startDate, endDate];
      let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2';
      
      if (tenantId) {
        queryParams.push(tenantId);
        whereClause += ` AND tenant_id = $${queryParams.length}`;
      }
      
      // Define query based on report type
      let query: string;
      switch (reportType) {
        case 'security':
          // Security report focuses on authentication and access control events
          query = `
            SELECT
              id,
              timestamp,
              tenant_id,
              user_id,
              user_name,
              action_type,
              entity_type,
              entity_id,
              ip_address,
              location,
              outcome,
              error_message,
              severity
            FROM audit_logs
            ${whereClause}
            AND (action_category = 'authentication' OR action_category = 'authorization')
            ORDER BY timestamp DESC
          `;
          break;
          
        case 'access':
          // Access report focuses on data access patterns
          query = `
            SELECT
              id,
              timestamp,
              tenant_id,
              user_id,
              user_name,
              action_type,
              entity_type,
              entity_id,
              entity_name,
              ip_address,
              outcome
            FROM audit_logs
            ${whereClause}
            AND action_type IN ('read', 'view', 'export', 'download', 'query', 'search')
            ORDER BY timestamp DESC
          `;
          break;
          
        case 'changes':
          // Changes report focuses on data modifications
          query = `
            SELECT
              id,
              timestamp,
              tenant_id,
              user_id,
              user_name,
              action_type,
              entity_type,
              entity_id,
              entity_name,
              changes,
              previous_state,
              outcome
            FROM audit_logs
            ${whereClause}
            AND action_type IN ('create', 'update', 'delete', 'modify', 'archive', 'restore')
            ORDER BY timestamp DESC
          `;
          break;
          
        case 'activity':
        default:
          // General activity report
          query = `
            SELECT
              id,
              timestamp,
              tenant_id,
              user_id,
              user_name,
              action_type,
              action_category,
              entity_type,
              entity_id,
              outcome
            FROM audit_logs
            ${whereClause}
            ORDER BY timestamp DESC
          `;
          break;
      }
      
      const result = await this.pool.query(query, queryParams);
      
      // Process results for readability
      const processedRows = result.rows.map(row => {
        // Parse JSON fields if they exist
        if (row.changes && typeof row.changes === 'string') {
          try {
            row.changes = JSON.parse(row.changes);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        if (row.previous_state && typeof row.previous_state === 'string') {
          try {
            row.previous_state = JSON.parse(row.previous_state);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        return row;
      });
      
      // Generate summary statistics
      const totalEvents = processedRows.length;
      const uniqueUsers = new Set(processedRows.map(row => row.user_id)).size;
      const byOutcome: Record<string, number> = {};
      const byActionType: Record<string, number> = {};
      const byEntityType: Record<string, number> = {};
      
      processedRows.forEach(row => {
        // Count by outcome
        if (row.outcome && typeof row.outcome === 'string') {
          byOutcome[row.outcome] = (byOutcome[row.outcome] || 0) + 1;
        }
        
        // Count by action type
        if (row.action_type && typeof row.action_type === 'string') {
          byActionType[row.action_type] = (byActionType[row.action_type] || 0) + 1;
        }
        
        // Count by entity type
        if (row.entity_type && typeof row.entity_type === 'string') {
          byEntityType[row.entity_type] = (byEntityType[row.entity_type] || 0) + 1;
        }
      });
      
      // Format based on requested format
      if (format === 'csv') {
        // Simple CSV string generation (in real implementation, use a proper CSV library)
        // First get all possible headers
        const headers = new Set<string>();
        processedRows.forEach(row => {
          Object.keys(row).forEach(key => headers.add(key));
        });
        
        const headerRow = Array.from(headers).join(',');
        const dataRows = processedRows.map(row => {
          return Array.from(headers).map(header => {
            const value = row[header as keyof typeof row];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
            return String(value).replace(/"/g, '""');
          }).join(',');
        });
        
        return {
          format: 'csv',
          content: [headerRow, ...dataRows].join('\n'),
          summary: {
            totalEvents,
            uniqueUsers,
            byOutcome,
            byActionType,
            byEntityType
          },
          reportType,
          startDate,
          endDate
        };
      } else {
        // JSON format
        return {
          format: 'json',
          reportType,
          startDate,
          endDate,
          summary: {
            totalEvents,
            uniqueUsers,
            byOutcome,
            byActionType,
            byEntityType
          },
          data: processedRows
        };
      }
    } catch (error) {
      // Production: logger.error('audit.compliance_report.failed', { error, params })
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: errorMessage,
        reportType: params.reportType || 'activity',
        startDate: params.startDate,
        endDate: params.endDate
      };
    }
  }
  
  /**
   * Find related entities based on audit logs
   * This helps discover relationships between entities
   */
  public async findRelatedEntities(params: {
    entityType: AuditEntityType,
    entityId: string,
    depth?: number,
    maxResults?: number
  }): Promise<any> {
    try {
      const { 
        entityType, 
        entityId, 
        depth = 1, // How many degrees of separation to analyze
        maxResults = 20
      } = params;
      
      // First-degree relationships: directly related entities
      const firstDegreeQuery = `
        WITH primary_events AS (
          SELECT DISTINCT 
            id,
            user_id,
            entity_type as source_type,
            entity_id as source_id,
            secondary_entity_type as target_type,
            secondary_entity_id as target_id,
            action_type,
            timestamp
          FROM audit_logs
          WHERE 
            (entity_type = $1 AND entity_id = $2 AND secondary_entity_type IS NOT NULL AND secondary_entity_id IS NOT NULL) OR
            (secondary_entity_type = $1 AND secondary_entity_id = $2 AND entity_type IS NOT NULL AND entity_id IS NOT NULL)
        ),
        related_entities AS (
          SELECT 
            CASE 
              WHEN source_type = $1 AND source_id = $2 THEN target_type
              ELSE source_type
            END as related_entity_type,
            CASE
              WHEN source_type = $1 AND source_id = $2 THEN target_id
              ELSE source_id
            END as related_entity_id,
            COUNT(*) as relation_strength,
            MAX(timestamp) as last_relation,
            1 as degree
          FROM primary_events
          GROUP BY related_entity_type, related_entity_id
        )
        SELECT * FROM related_entities
        ORDER BY relation_strength DESC, last_relation DESC
        LIMIT $3
      `;
      
      const result = await this.pool.query(firstDegreeQuery, [entityType, entityId, maxResults]);
      
      // If depth > 1, we would recursively find second-degree relationships
      // This simple implementation only handles first-degree relationships
      // A more complex implementation would use a recursive CTE to handle deeper relationships
      
      return {
        sourceEntity: {
          type: entityType,
          id: entityId
        },
        relatedEntities: result.rows,
        totalFound: result.rowCount
      };
    } catch (error) {
      // Production: logger.error('audit.related_entities.failed', { error, params })
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        sourceEntity: {
          type: params.entityType,
          id: params.entityId
        },
        relatedEntities: [],
        totalFound: 0,
        error: errorMessage
      };
    }
  }
  
  public async getEntityAuditTrail(params: {
    entityType: AuditEntityType,
    entityId: string,
    includeDetails?: boolean,
    limit?: number
  }): Promise<any[]> {
    try {
      const { 
        entityType, 
        entityId, 
        includeDetails = true,
        limit = 50 
      } = params;
      
      const detailsField = includeDetails ? 'details' : 'NULL AS details';
      
      const query = `
        SELECT
          id,
          timestamp,
          user_id,
          user_name,
          action_type,
          ${detailsField},
          changes,
          outcome,
          error_message
        FROM audit_logs
        WHERE (
          (entity_type = $1 AND entity_id = $2) OR
          (secondary_entity_type = $1 AND secondary_entity_id = $2)
        )
        ORDER BY timestamp DESC
        LIMIT $3
      `;
      
      const result = await this.pool.query(query, [entityType, entityId, limit]);
      
      // Process results to parse JSON fields
      return result.rows.map(row => {
        if (row.details && typeof row.details === 'string') {
          try {
            row.details = JSON.parse(row.details);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        if (row.changes && typeof row.changes === 'string') {
          try {
            row.changes = JSON.parse(row.changes);
          } catch (e) {
            // If parsing fails, leave as is
          }
        }
        
        return row;
      });
    } catch (error) {
      // Production: logger.error('audit.entity_trail.failed', { error, params })
      return [];
    }
  }
} 