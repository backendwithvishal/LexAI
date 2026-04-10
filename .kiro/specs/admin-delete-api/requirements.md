# Requirements Document

## Introduction

This feature extends the admin API surface with delete operations that are currently missing from the admin controller and routes. The existing admin API already supports `DELETE /admin/users/:id` (soft-deactivate), but has no delete endpoints for contracts, organizations, analyses, or templates. These new endpoints give platform administrators the ability to perform privileged delete operations that bypass normal org-scoped ownership checks — for example, force-deleting a contract from any org, tearing down an entire organization and its associated data, removing a stale analysis record, or deleting a global template that only admins can create.

All new endpoints follow the existing code style: `authenticate` + `authorize('admin')` + `rateLimiter('strict')` middleware chain, `asyncWrapper` for error propagation, `sendSuccess`/`sendError` response helpers, and audit log entries via `auditService.log`.

Before implementing any endpoint, the codebase MUST be checked to confirm the route does not already exist.

## Glossary

- **Admin_Controller**: `src/controllers/admin.controller.js` — handles all admin-only HTTP request logic
- **Admin_Router**: `src/routes/admin.routes.js` — mounts admin routes under `/api/v1/admin`
- **Admin_Service**: The service-layer functions called by the Admin_Controller (may be inline or delegated to existing services)
- **Audit_Service**: `src/services/audit.service.js` — writes immutable audit log entries
- **Contract**: A `Contract` model document representing a legal contract uploaded by an org member
- **Organization**: An `Organization` model document representing a multi-tenant workspace
- **Analysis**: An `Analysis` model document representing an AI analysis result for a contract version
- **Template**: A `Template` model document representing a reusable contract template (org-scoped or global)
- **Soft_Delete**: Setting `isDeleted: true` (or `isActive: false`) on a document rather than removing it from the database, preserving the audit trail
- **Hard_Delete**: Permanently removing a document from the database using `deleteOne` or `findByIdAndDelete`
- **Platform_Admin**: A user with `role: 'admin'` at the platform level, authenticated via JWT

## Requirements

### Requirement 1: Pre-Implementation Existence Check

**User Story:** As a Platform_Admin, I want the implementation to verify that each new delete endpoint does not already exist in the codebase, so that duplicate routes and handler conflicts are avoided.

#### Acceptance Criteria

1. THE Admin_Router SHALL be inspected for existing `DELETE` route registrations before any new route is added.
2. THE Admin_Controller SHALL be inspected for existing delete handler functions before any new handler is added.
3. IF a route or handler already exists, THEN THE implementation SHALL skip that endpoint and document the finding rather than creating a duplicate.

---

### Requirement 2: Admin Force-Delete Contract

**User Story:** As a Platform_Admin, I want to permanently delete any contract regardless of which org owns it, so that I can remove illegal, abusive, or test data from the platform.

#### Acceptance Criteria

1. WHEN a `DELETE /admin/contracts/:id` request is received with a valid Platform_Admin JWT, THE Admin_Controller SHALL locate the Contract document by `_id` without applying an org-scope filter.
2. IF the Contract document does not exist, THEN THE Admin_Controller SHALL return HTTP 404 with error code `NOT_FOUND`.
3. WHEN the Contract document is found, THE Admin_Controller SHALL permanently remove it from the database (hard delete).
4. WHEN the Contract is hard-deleted, THE Admin_Controller SHALL decrement the owning Organization's `contractCount` by 1.
5. WHEN the Contract is hard-deleted, THE Audit_Service SHALL record an entry with `action: 'admin.contract.deleted'`, `resourceType: 'Contract'`, and the contract's `_id` as `resourceId`.
6. WHEN the deletion succeeds, THE Admin_Controller SHALL return HTTP 200 with `message: 'Contract permanently deleted.'`.
7. THE `DELETE /admin/contracts/:id` route SHALL be protected by `authenticate`, `authorize('admin')`, and `rateLimiter('strict')` middleware.

---

### Requirement 3: Admin Delete Organization

**User Story:** As a Platform_Admin, I want to delete an organization and clean up its associated data, so that I can remove inactive, fraudulent, or test organizations from the platform.

#### Acceptance Criteria

1. WHEN a `DELETE /admin/organizations/:id` request is received with a valid Platform_Admin JWT, THE Admin_Controller SHALL locate the Organization document by `_id`.
2. IF the Organization document does not exist, THEN THE Admin_Controller SHALL return HTTP 404 with error code `NOT_FOUND`.
3. WHEN the Organization is found, THE Admin_Controller SHALL soft-delete all Contract documents belonging to that org by setting `isDeleted: true` and `deletedAt` to the current timestamp.
4. WHEN the Organization is found, THE Admin_Controller SHALL delete all Analysis documents belonging to that org.
5. WHEN the Organization is found, THE Admin_Controller SHALL delete the Organization document itself.
6. WHEN the Organization is found, THE Admin_Controller SHALL clear the `organization` field on all User documents that were members of that org and reset their `role` to `'viewer'`.
7. WHEN the deletion cascade completes, THE Audit_Service SHALL record an entry with `action: 'admin.organization.deleted'`, `resourceType: 'Organization'`, and the org's `_id` as `resourceId`.
8. WHEN the deletion succeeds, THE Admin_Controller SHALL return HTTP 200 with `message: 'Organization deleted.'`.
9. THE `DELETE /admin/organizations/:id` route SHALL be protected by `authenticate`, `authorize('admin')`, and `rateLimiter('strict')` middleware.

---

### Requirement 4: Admin Delete Analysis

**User Story:** As a Platform_Admin, I want to delete a specific analysis record regardless of which org owns it, so that I can remove corrupted, failed, or duplicate analysis documents.

#### Acceptance Criteria

1. WHEN a `DELETE /admin/analyses/:id` request is received with a valid Platform_Admin JWT, THE Admin_Controller SHALL locate the Analysis document by `_id` without applying an org-scope filter.
2. IF the Analysis document does not exist, THEN THE Admin_Controller SHALL return HTTP 404 with error code `NOT_FOUND`.
3. WHEN the Analysis document is found, THE Admin_Controller SHALL permanently remove it from the database (hard delete).
4. WHEN the Analysis is hard-deleted, THE Audit_Service SHALL record an entry with `action: 'admin.analysis.deleted'`, `resourceType: 'Analysis'`, and the analysis's `_id` as `resourceId`.
5. WHEN the deletion succeeds, THE Admin_Controller SHALL return HTTP 200 with `message: 'Analysis permanently deleted.'`.
6. THE `DELETE /admin/analyses/:id` route SHALL be protected by `authenticate`, `authorize('admin')`, and `rateLimiter('strict')` middleware.

---

### Requirement 5: Admin Delete Template

**User Story:** As a Platform_Admin, I want to delete any template including global templates, so that I can remove outdated or incorrect platform-wide templates that org-level users cannot delete.

#### Acceptance Criteria

1. WHEN a `DELETE /admin/templates/:id` request is received with a valid Platform_Admin JWT, THE Admin_Controller SHALL locate the Template document by `_id` without applying an org-scope or `isGlobal` filter.
2. IF the Template document does not exist or is already inactive, THEN THE Admin_Controller SHALL return HTTP 404 with error code `NOT_FOUND`.
3. WHEN the Template document is found, THE Admin_Controller SHALL soft-delete it by setting `isActive: false`.
4. WHEN the Template is soft-deleted, THE Audit_Service SHALL record an entry with `action: 'admin.template.deleted'`, `resourceType: 'Template'`, and the template's `_id` as `resourceId`.
5. WHEN the deletion succeeds, THE Admin_Controller SHALL return HTTP 200 with `message: 'Template deleted.'`.
6. THE `DELETE /admin/templates/:id` route SHALL be protected by `authenticate`, `authorize('admin')`, and `rateLimiter('strict')` middleware.

---

### Requirement 6: Consistent Error Handling

**User Story:** As a Platform_Admin, I want all admin delete endpoints to return consistent, machine-readable error responses, so that API consumers and dashboards can handle failures predictably.

#### Acceptance Criteria

1. IF a request to any admin delete endpoint is made without a valid JWT, THEN THE Admin_Router SHALL return HTTP 401 with error code `UNAUTHORIZED`.
2. IF a request to any admin delete endpoint is made by a user whose role is not `'admin'`, THEN THE Admin_Router SHALL return HTTP 403 with error code `FORBIDDEN`.
3. IF a request to any admin delete endpoint exceeds the strict rate limit, THEN THE Admin_Router SHALL return HTTP 429.
4. IF an unexpected server error occurs during any admin delete operation, THEN THE Admin_Controller SHALL propagate the error to the global error handler via `asyncWrapper`, which SHALL return HTTP 500 with error code `INTERNAL_ERROR`.
5. THE Admin_Controller SHALL use `sendSuccess` and `sendError` from `src/utils/apiResponse.js` for all responses, consistent with the existing admin controller style.
