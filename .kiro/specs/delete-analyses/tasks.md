# Implementation Plan: delete-analyses

## Overview

Implement hard delete (permanent removal) for analysis records. Changes touch four files: the analysis validator (two new Joi schemas), the analysis service (two new functions), the analysis controller (two new handlers), and the analysis router (two new DELETE routes). No model changes are needed.

## Tasks

- [ ] 1. Add delete Joi validator schemas
  - Add `export const deleteAnalysis` schema validating `id` as 24-char hex ObjectId in `src/validators/analysis.validator.js`
  - Add `export const deleteByContract` schema validating `contractId` as 24-char hex ObjectId
  - Both schemas target `req.params` (not `req.body`)
  - _Requirements: 1.7, 2.6_

  - [ ]* 1.1 Write property test for invalid ObjectId returns 400 (Property 4)
    - **Property 4: Invalid ObjectId parameter returns 400**
    - **Validates: Requirements 1.7, 2.6**
    - Generate arbitrary strings that are not 24-char hex using `fc.string()` filtered
    - Send as path param to both delete routes via supertest
    - Assert HTTP 400 every time

- [ ] 2. Implement `deleteAnalysis` service function
  - Add `export async function deleteAnalysis(analysisId, orgId, userId)` to `src/services/analysis.service.js`
  - `findOne({ _id: analysisId, orgId })` — fetch doc to read `cacheKey` and confirm existence
  - Throw `AppError('Analysis not found.', 404, 'NOT_FOUND')` if result is null
  - `deleteOne({ _id: analysisId, orgId })` — permanently remove from MongoDB
  - If `doc.cacheKey` exists, call `redis.del(REDIS_KEYS.analysis(doc.cacheKey))`; swallow Redis errors (non-fatal, log with `logger.warn`)
  - Call `auditService.log({ orgId, userId, action: 'analysis.deleted', resourceType: 'Analysis', resourceId: analysisId })`
  - Return `{ analysisId }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.1 Write property test for permanent deletion invariant (Property 1)
    - **Property 1: Permanent deletion invariant**
    - **Validates: Requirements 1.2, 2.2**
    - Generate random valid `analysisId` ObjectId strings
    - Seed a mock Analysis doc; call `deleteAnalysis`; assert `findOne({ _id: analysisId })` returns null

  - [ ]* 2.2 Write property test for cache invalidation on delete (Property 2)
    - **Property 2: Cache invalidation on delete**
    - **Validates: Requirements 1.4, 2.3**
    - Generate random `cacheKey` strings; pre-populate mock Redis; call `deleteAnalysis`
    - Assert `redis.get(REDIS_KEYS.analysis(cacheKey))` returns null after deletion

  - [ ]* 2.3 Write property test for org isolation (Property 3)
    - **Property 3: Org isolation — cross-org delete returns NOT_FOUND**
    - **Validates: Requirements 1.3, 3.1, 3.2**
    - Generate distinct `orgIdA` and `orgIdB`; seed analysis belonging to `orgIdA`
    - Call `deleteAnalysis(analysisId, orgIdB, userId)`; assert `NOT_FOUND` AppError is thrown

  - [ ]* 2.4 Write unit tests for `deleteAnalysis`
    - Test: audit service called with `analysis.deleted` action
    - Test: Redis `del` failure is swallowed and does not throw
    - Test: returns `{ analysisId }` on success
    - _Requirements: 1.1, 1.4, 1.5_

- [ ] 3. Implement `deleteAnalysesByContract` service function
  - Add `export async function deleteAnalysesByContract(contractId, orgId, userId)` to `src/services/analysis.service.js`
  - `find({ contractId, orgId }).select('_id cacheKey').lean()` — collect docs before deletion
  - `deleteMany({ contractId, orgId })` — permanently remove all matching documents
  - For each `cacheKey` in collected docs: `redis.del(REDIS_KEYS.analysis(cacheKey))`; swallow Redis errors
  - Call `auditService.log({ orgId, userId, action: 'analysis.bulk_deleted', resourceType: 'Analysis', metadata: { contractId, deletedCount: docs.length } })`
  - Return `{ deletedCount: docs.length }`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [ ]* 3.1 Write unit tests for `deleteAnalysesByContract`
    - Test: zero matching analyses returns `{ deletedCount: 0 }` without error
    - Test: audit service called once with `analysis.bulk_deleted` and correct count
    - Test: all cacheKeys are deleted from Redis
    - _Requirements: 2.4, 2.7_

- [ ] 4. Checkpoint — Ensure all service-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add controller handlers for delete operations
  - Add `export async function deleteAnalysis(req, res)` to `src/controllers/analysis.controller.js`
    - Calls `analysisService.deleteAnalysis(req.params.id, req.orgId, req.user.userId)`
    - Returns `sendSuccess(res, { message: 'Analysis deleted.', data: { analysisId: req.params.id } })`
  - Add `export async function deleteAnalysesByContract(req, res)` to `src/controllers/analysis.controller.js`
    - Calls `analysisService.deleteAnalysesByContract(req.params.contractId, req.orgId, req.user.userId)`
    - Returns `sendSuccess(res, { message: \`${count} analysis/analyses deleted.\`, data: { deletedCount: count } })`
  - _Requirements: 1.1, 2.1_

  - [ ]* 5.1 Write unit tests for delete controller handlers
    - Test: `deleteAnalysis` returns 200 with correct shape (mocked service)
    - Test: `deleteAnalysesByContract` returns 200 with `deletedCount` (mocked service)
    - _Requirements: 1.1, 2.1_

- [ ] 6. Register DELETE routes in the analysis router
  - Import new validator schemas and controller handlers in `src/routes/analysis.routes.js`
  - Add `DELETE /analyses/contract/:contractId` route BEFORE `/:id` (to avoid Express matching "contract" as an ObjectId)
    - Middleware chain: `authorize('admin', 'manager'), validate(analysisValidator.deleteByContract, 'params'), asyncWrapper(analysisController.deleteAnalysesByContract)`
  - Add `DELETE /analyses/:id` route
    - Middleware chain: `authorize('admin', 'manager'), validate(analysisValidator.deleteAnalysis, 'params'), asyncWrapper(analysisController.deleteAnalysis)`
  - _Requirements: 1.6, 1.7, 2.5, 2.6_

  - [ ]* 6.1 Write integration tests for RBAC on delete routes
    - Test: viewer role → 403 on `DELETE /analyses/:id`
    - Test: viewer role → 403 on `DELETE /analyses/contract/:contractId`
    - Test: manager role → 200 on both routes (mocked service)
    - _Requirements: 1.6, 2.5_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `contract/:contractId` route MUST be declared before `/:id` in the router
- Redis errors during cache invalidation are intentionally non-fatal
- No model changes needed — hard delete physically removes documents
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
