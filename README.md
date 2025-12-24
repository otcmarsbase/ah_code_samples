# AssetHaus Platform — Code Samples

Technical code samples for due diligence review. These files demonstrate core architecture patterns, security practices, and code quality standards used throughout the platform.

---

## Component Overview

| Component | Highlights |
|-----------|------------|
| **Smart Contracts** | OpenZeppelin standards, ReentrancyGuard, SafeERC20, UUPS upgradeable, batch limits, investor-only deposits |
| **Backend Services** | Repository pattern, batch queries, transaction safety, ILIKE escape, PII redaction |
| **API Layer** | Auth-based access control, input length limits, NaN protection, proper error handling |
| **Frontend** | Zod validation with superRefine, React Hook Form, TypeScript strict mode |
| **Audit System** | 80+ action types, anomaly detection, PII/secrets redaction, parameterized retention |

---

## Sample Files

```
code_samples/
├── backend/
│   ├── 01-auth-middleware.ts      # JWT authentication with Thirdweb
│   ├── 02-deal-repository.ts      # Data access layer with batch loading
│   ├── 03-deal-mapper.ts          # Domain object transformation
│   └── 04-audit-service.ts        # Comprehensive audit logging (1600+ lines)
├── smart-contracts/
│   ├── 01-InvestmentEscrow.sol    # Individual escrow with state machine
│   └── 02-TokenSale.sol           # UUPS upgradeable token sale
├── api-routes/
│   └── 01-deals-route.ts          # RESTful endpoint with access control
└── frontend/
    └── 01-entity-form.tsx         # Form component with validation
```

---

## Security Architecture

### Authentication & Authorization

```typescript
// JWT validation with step-by-step verification
const authResult = await thirdwebAuth.verifyJWT({ jwt: jwt.value });
if (!authResult.valid) {
  await logAuthAttempt({ outcome: AuditOutcome.FAILURE, reason: "Invalid JWT" });
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Role-based data filtering
const allowedStatuses = isAuthenticated ? ALL_STATUSES : PUBLIC_STATUSES;
```

### SQL Injection Prevention

```typescript
// Parameterized queries throughout
const result = await pool.query(
  'SELECT * FROM deals WHERE tenant_id = $1 AND status = $2',
  [tenantId, status]
);

// Allowlist validation for dynamic fields
const validGroupBy = VALID_GROUP_BY_FIELDS.has(groupBy) ? groupBy : 'action_type';

// Array parameters with proper PostgreSQL casting
if (tags && tags.length > 0) {
  params.push(tags);
  conditions.push(`d.tags && $${params.length}::text[]`);
}
```

### Optional vs Required Authentication

```typescript
// Required auth - logs failures, returns error responses
const authResult = await authenticateRequest();
if (authResult instanceof NextResponse) return authResult;

// Optional auth - silent fail for public endpoints, no audit noise
const authResult = await authenticateOptional();
const isUserAuthenticated = authResult !== null;
```

### Input Sanitization

```typescript
// Length limits prevent DoS via expensive ILIKE/filter queries
const search = (searchParams.get('search') || '').slice(0, 200) || null;
const tagsParam = (searchParams.get('tags') || '').slice(0, 500) || null;

// NaN protection for pagination
const limitRaw = parseInt(searchParams.get('limit') || '10', 10);
const limit = isNaN(limitRaw) ? 10 : Math.min(Math.max(limitRaw, 1), 100);

// ILIKE pattern injection prevention
const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
conditions.push(`d.title ILIKE $${params.length} ESCAPE '\\'`);
```

### Smart Contract Security

```solidity
contract InvestmentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ESCROW_DURATION = 30 days;
    uint256 public constant ADMIN_ACTION_DEADLINE = 14 days;

    // Only designated investor can deposit (AML compliance)
    function deposit(uint256 _amount) external payable nonReentrant {
        require(msg.sender == investor, "Only investor can deposit");
        require(status == Status.Active, "Escrow not active");
        require(block.timestamp < expirationTime, "Escrow expired");
        // ...
    }
}

contract TokenSale {
    uint256 public constant MAX_WHITELIST_BATCH = 100;

    // Batch limit prevents DoS via unbounded loops
    function addToUserWhitelist(address[] calldata users) external {
        require(users.length <= MAX_WHITELIST_BATCH, "Batch size exceeds limit");
        // ...
    }

    // Validate net payment after fee deduction
    function purchaseWithEscrow(...) external {
        uint256 netPayment = paymentAmount - platformFee;
        require(netPayment > 0, "Net payment is zero after fee deduction");
        // ...
    }
}
```

### Configurable Funding Modes

TokenSale supports two funding modes set at initialization:

```solidity
// immediateTransfer = true: Funds go directly to owner (no on-chain refunds)
// immediateTransfer = false: Vault mode - funds held until Successful state

function initialize(..., bool _immediateTransfer) external initializer {
    immediateTransfer = _immediateTransfer;
}

// Vault mode enables refunds if sale fails
function claimBack(address currency) external onlyState(State.Failed) {
    require(!immediateTransfer, "Refunds not available");
    uint256 refundAmount = paidAmount[msg.sender][currency];
    // Multi-currency refund support...
}
```

---

## Architecture Patterns

### Repository Pattern with Batch Loading

Solves N+1 query problem through parallel data fetching:

```typescript
private async batchLoadRelatedData(dealIds: string[], tenantId: string): Promise<RelatedData> {
  const [media, docs, terms, faqs] = await Promise.all([
    this.batchGetMedia(dealIds, tenantId),
    this.batchGetDocuments(dealIds, tenantId),
    this.batchGetKeyTerms(dealIds, tenantId),
    this.batchGetFaqs(dealIds, tenantId),
  ]);

  return {
    media: this.groupByDealId(media),
    documents: this.groupByDealId(docs),
    // O(1) lookup per deal
  };
}
```

### Progressive Data Mapping

Flexible data loading based on use case:

```typescript
// Load only what's needed
const basicDeal = DealMapper.mapBasicDeal(row);           // Core fields
const withInvestment = DealMapper.mapDealWithInvestment(row);  // + Investment
const withPool = DealMapper.mapDealWithPool(row);         // + Pool config
const fullDeal = DealMapper.mapFullDeal(row, options);    // All data
```

### Transaction Management

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO deals ...', [...]);
  await client.query('INSERT INTO deal_media ...', [...]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

## Audit & Compliance

### Action Type Coverage

```typescript
export enum AuditActionType {
  // Authentication (10 types)
  LOGIN, LOGOUT, PASSWORD_CHANGE, MFA_ENABLE, API_KEY_GENERATE, ...

  // Financial (13 types)
  PAYMENT, TOKEN_MINT, TOKEN_BURN, TRANSFER, WITHDRAW, ...

  // KYC/AML (6 types)
  KYC_STATUS_CHANGE, AML_CHECK, AML_ALERT, ...

  // Deal Operations (8 types)
  DEAL_LAUNCH, DEAL_CLOSE, INVESTMENT_COMMIT, DOCUMENT_SIGN, ...
}
```

### PII & Secrets Redaction

Audit logs automatically redact sensitive data before storage:

```typescript
const REDACT_FIELDS = new Set([
  'jwt', 'token', 'accessToken', 'refreshToken', 'password',
  'apiKey', 'secret', 'ssn', 'creditCard', 'cvv'
]);

const MASK_FIELDS = new Set([
  'email', 'phone', 'walletAddress', 'firstName', 'lastName',
  'address', 'dateOfBirth', 'ipAddress'
]);

function redactAuditDetails(details: Record<string, unknown>): Record<string, unknown> {
  // REDACT_FIELDS → "[REDACTED]"
  // MASK_FIELDS → partial mask (e.g., "jo***@***.com")
  // Recursively processes nested objects
}
```

### Anomaly Detection

- Suspicious login patterns (multiple failures → success)
- Unusual activity volume per user
- Access from new IP addresses
- Time-based pattern analysis

### Compliance Reporting

- Security audit reports
- Access control reports
- Data modification tracking
- Retention policy enforcement

```typescript
// Parameterized retention cleanup (prevents SQL injection)
public async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const result = await this.pool.query(
    `DELETE FROM audit_logs WHERE timestamp < NOW() - ($1 * INTERVAL '1 day')`,
    [safeDays]
  );
  return result.rowCount ?? 0;
}
```

---

## TypeScript Quality

| Metric | Status |
|--------|--------|
| Strict Mode | Enabled |
| Explicit Types | All interfaces defined |
| Type Guards | Used for runtime narrowing |
| No `any` | Typed alternatives used |

### Example: Typed Audit Details

```typescript
export interface AuthenticationDetails {
  method?: 'jwt' | 'api_key' | 'oauth' | 'wallet';
  provider?: string;
  mfaUsed?: boolean;
}

export interface TransactionDetails {
  amount?: number;
  currency?: string;
  txHash?: string;
}

export type AuditDetails =
  | AuthenticationDetails
  | TransactionDetails
  | Record<string, unknown>;
```

---

## Multi-Tenant Isolation

All data access enforces tenant boundaries:

```typescript
// Every query includes tenant context
const deals = await DealService.getDeals({
  tenantId,  // Required
  status,
  currentUserId
});

// Repository layer enforces isolation
WHERE d.tenant_id = $1 AND ...
```

---

## Test Coverage

| Component | Coverage | Framework |
|-----------|----------|-----------|
| Smart Contracts | 95%+ | Hardhat + Chai |
| Backend Services | 80%+ | Jest |
| API Routes | 80%+ | Jest + Supertest |
| Frontend | 75%+ | Jest + RTL |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind |
| Backend | Node.js, TypeScript, PostgreSQL |
| Blockchain | Solidity 0.8.20, OpenZeppelin, Hardhat |
| Auth | Thirdweb, JWT |
| Validation | Zod, React Hook Form |

---

## Contact

Technical inquiries: tech@asset.haus
