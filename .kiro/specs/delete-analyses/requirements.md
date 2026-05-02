# Requirements Document

## Introduction

This feature adds delete functionality for AI analysis records in the LexAI platform. Users with sufficient permissions (admin or manager role) can delete a single analysis by ID or bulk-delete all analyses associated with a specific contract. Deletion is permanent — documents are physically removed from MongoDB. The feature integrates with the existing authentication, RBAC, org-isolation, audit logging, and Redis cache invalidation infrastructure already in place.

## Glossary

- **Analysis**: A MongoDB document in the `analyses` collection representing an AI-generated risk analysis for a specific contract version.
- **Analysis_Service**: The `src/services/analysis.service.js` module responsible for all analysis business logic.
- **Analysis_Controller**: The `src/controllers/analysis.controller.js` module that handles HTTP request/response for analysis endpoints.
- **Analysis_Router**: The `src/routes/analysis.routes.js` Express router mounted at `/api/v1/analyses`.
- **Org**: An organization record that scopes all resources; every analysis belongs to exactly one org via `orgId`.
- **Hard_Delete**: Permanently removing a document from MongoDB using `deleteOne` or `deleteMany`. The document cannot be recovered after this operation.
- **Cache_Key**: The Redis key derived from a content hash that stores a completed analysis result; must be invalidated on delete.
- **Audit_Service**: The `src/services/audit.service.js` module that writes immutable audit log entries.
- **RBAC**: Role-based access control enforced by the `authorize` middleware; roles are `admin`, `manager`, and `viewer`.

---

## Requirements

### Requirement 1: Delete a Single Analysis

**User Story:** As a manager or admin, I want to delete a specific analysis by its ID, so that I can remove outdated or erroneous analysis results from the system.

#### Acceptance Criteria

1. WHEN a `DELETE /analyses/:id` request is received with a valid analysis ID, THE Analysis_Controller SHALL call the Analysis_Service to permanently delete the analysis and return HTTP 200 with a success message.
2. WHEN the Analysis_Service deletes an analysis, THE Analysis_Service SHALL permanently remove the document from MongoDB using `deleteOne`.
3. WHEN the analysis to be deleted does not exist or belongs to a different org, THE Analysis_Service SHALL throw a `NOT_FOUND` AppError with HTTP status 404.
4. WHEN an analysis is successfully deleted and a `cacheKey` is present on the document, THE Analysis_Service SHALL delete the corresponding Redis cache entry using the `cacheKey`.
5. WHEN an analysis is successfully deleted, THE Audit_Service SHALL record an `analysis.deleted` audit log entry containing `orgId`, `userId`, and `analysisId`.
6. WHILE a user's role is `viewer`, THE Analysis_Router SHALL reject `DELETE /analyses/:id` requests with HTTP 403 before the request reaches the Analysis_Controller.
7. IF the `:id` path parameter is not a valid 24-character hex MongoDB ObjectId, THEN THE Analysis_Router SHALL return HTTP 400 before the request reaches the Analysis_Controller.

---

### Requirement 2: Delete All Analyses for a Contract

**User Story:** As a manager or admin, I want to delete all analyses associated with a specific contract, so that I can clean up analysis history when a contract is removed or reset.

#### Acceptance Criteria

1. WHEN a `DELETE /analyses/contract/:contractId` request is received with a valid contract ID, THE Analysis_Controller SHALL call the Analysis_Service to permanently delete all analyses for that contract within the requesting org and return HTTP 200 with the count of deleted analyses.
2. WHEN the Analysis_Service bulk-deletes analyses for a contract, THE Analysis_Service SHALL permanently remove all matching documents from MongoDB using a single `deleteMany` operation.
3. WHEN bulk-deleting analyses for a contract, THE Analysis_Service SHALL collect all `cacheKey` values from the affected documents before deleting them and delete each corresponding Redis cache entry.
4. WHEN bulk-deleting analyses for a contract, THE Audit_Service SHALL record a single `analysis.bulk_deleted` audit log entry containing `orgId`, `userId`, `contractId`, and the count of deleted analyses.
5. WHILE a user's role is `viewer`, THE Analysis_Router SHALL reject `DELETE /analyses/contract/:contractId` requests with HTTP 403 before the request reaches the Analysis_Controller.
6. IF the `:contractId` path parameter is not a valid 24-character hex MongoDB ObjectId, THEN THE Analysis_Router SHALL return HTTP 400 before the request reaches the Analysis_Controller.
7. WHEN no analyses exist for the given contract and org, THE Analysis_Service SHALL return a deleted count of 0 without throwing an error.

---

### Requirement 3: Org Isolation for Delete Operations

**User Story:** As a platform operator, I want delete operations to be strictly scoped to the requesting user's org, so that one org cannot delete another org's analysis data.

#### Acceptance Criteria

1. THE Analysis_Service SHALL include `orgId` from the authenticated request in every MongoDB query used for delete operations, ensuring cross-org access is structurally impossible.
2. WHEN a delete request targets an analysis whose `orgId` does not match the requesting user's `orgId`, THE Analysis_Service SHALL treat the analysis as not found and throw a `NOT_FOUND` AppError with HTTP status 404.

---

### Requirement 4: No Model Changes Required

**User Story:** As a developer, I want the delete implementation to use the existing Analysis model without adding soft-delete fields, keeping the schema clean.

#### Acceptance Criteria

1. THE Analysis model SHALL NOT require any new fields for this feature — deletion is permanent via `deleteOne` / `deleteMany`.
2. Existing `getAnalysis` and `getAnalysesByContract` queries require no changes since deleted documents are physically gone.
