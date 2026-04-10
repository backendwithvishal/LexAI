# Implementation Plan: Admin Delete API

## Overview

Add four admin-only DELETE handlers to `admin.controller.js` and register their routes in `admin.routes.js`. All handlers follow the existing controller pattern: unscoped resource lookup, delete operation, audit log, `sendSuccess`/`sendError` response. Property-based tests use `fast-check` with `mongodb-memory-server`.

## Tasks

- [ ] 1. Pre-implementation existence check
  - Confirm no `DELETE /admin/contracts/:id`, `/organizations/:id`, `/analyses/:id`, or `/templates/:id` routes exist in `admin.routes.js`
  - Confirm no `deleteContract`, `deleteOrganization`, `deleteAnalysis`, or `deleteTemplate` exports exist in `admin.controller.js`
  - Document any findings; skip any endpoint that already exists
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implement `deleteContract` handler and route
  - [ ] 2.1 Add `deleteContract(req, res)` to `src/controllers/admin.controller.js`
    - `Contract.findById(req.params.id)` — no org-scope filter
    - Return 404 `NOT_FOUND` if missing
    - `Contract.findByIdAndDelete(id)`
    - `Organization.findByIdAndUpdate(contract.orgId, { $inc: { contractCount: -1 } })`
    - `auditService.log({ action: 'admin.contract.deleted', resourceType: 'Contract', resourceId: id, userId: req.user.userId, ip: req.ip, userAgent: req.headers['user-agent'] })`
    - `sendSuccess(res, { message: 'Contract permanently deleted.' })`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ] 2.2 Register route in `src/routes/admin.routes.js`
    - `router.delete('/contracts/:id', asyncWrapper(adminController.deleteContract))`
    - _Requirements: 2.7_
  - [ ]* 2.3 Write property test — Property 1: contract hard-delete removes the document
    - **Property 1: Contract hard-delete removes the document**
    - Generate arbitrary contract data with `fc.record`, create via `Contract.create`, call handler, assert `Contract.findById` returns `null`
    - `numRuns: 100`
    - **Validates: Requirements 2.3**
  - [ ]* 2.4 Write property test — Property 2: contract deletion decrements org contractCount
    - **Property 2: Contract deletion decrements org contractCount**
    - Generate org with random `contractCount` N, create a contract for that org, call handler, assert org `contractCount` equals N − 1
    - `numRuns: 100`
    - **Validates: Requirements 2.4**
  - [ ]* 2.5 Write property test — Property 9 (partial): audit log entry created for deleteContract
    - **Property 9: Every successful admin delete produces an audit log entry**
    - After calling `deleteContract`, assert `AuditLog` contains one entry with `action: 'admin.contract.deleted'`, correct `resourceType` and `resourceId`
    - `numRuns: 100`
    - **Validates: Requirements 2.5**

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement `deleteOrganization` handler and route
  - [ ] 4.1 Add `deleteOrganization(req, res)` to `src/controllers/admin.controller.js`
    - `Organization.findById(req.params.id)` — return 404 `NOT_FOUND` if missing
    - `Promise.all([ Contract.updateMany({ orgId: id }, { isDeleted: true, deletedAt: new Date() }), Analysis.deleteMany({ orgId: id }), User.updateMany({ organization: id }, { $unset: { organization: '' }, $set: { role: 'viewer' } }) ])`
    - `Organization.findByIdAndDelete(id)`
    - `auditService.log({ action: 'admin.organization.deleted', resourceType: 'Organization', resourceId: id, ... })`
    - `sendSuccess(res, { message: 'Organization deleted.' })`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ] 4.2 Register route in `src/routes/admin.routes.js`
    - `router.delete('/organizations/:id', asyncWrapper(adminController.deleteOrganization))`
    - _Requirements: 3.9_
  - [ ]* 4.3 Write property test — Property 3: org deletion soft-deletes all member contracts
    - **Property 3: Org deletion soft-deletes all member contracts**
    - Generate org with 1–20 contracts (`fc.integer({ min: 1, max: 20 })`), call handler, assert every contract has `isDeleted: true` and non-null `deletedAt`
    - `numRuns: 100`
    - **Validates: Requirements 3.3**
  - [ ]* 4.4 Write property test — Property 4: org deletion hard-deletes all member analyses
    - **Property 4: Org deletion hard-deletes all member analyses**
    - Generate org with 0–10 analyses, call handler, assert `Analysis.find({ orgId })` returns empty array
    - `numRuns: 100`
    - **Validates: Requirements 3.4**
  - [ ]* 4.5 Write property test — Property 5: org hard-delete removes the organization document
    - **Property 5: Org hard-delete removes the organization document**
    - Generate arbitrary org data, call handler, assert `Organization.findById` returns `null`
    - `numRuns: 100`
    - **Validates: Requirements 3.5**
  - [ ]* 4.6 Write property test — Property 6: org deletion clears all member user associations
    - **Property 6: Org deletion clears all member user associations**
    - Generate org with 1–10 member users, call handler, assert every user has `organization: null` (or unset) and `role: 'viewer'`
    - `numRuns: 100`
    - **Validates: Requirements 3.6**
  - [ ]* 4.7 Write property test — Property 9 (partial): audit log entry created for deleteOrganization
    - **Property 9: Every successful admin delete produces an audit log entry**
    - After calling `deleteOrganization`, assert `AuditLog` contains one entry with `action: 'admin.organization.deleted'`, correct `resourceType` and `resourceId`
    - `numRuns: 100`
    - **Validates: Requirements 3.7**

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement `deleteAnalysis` handler and route
  - [ ] 6.1 Add `deleteAnalysis(req, res)` to `src/controllers/admin.controller.js`
    - `Analysis.findById(req.params.id)` — no org-scope filter; return 404 `NOT_FOUND` if missing
    - `Analysis.findByIdAndDelete(id)`
    - `auditService.log({ action: 'admin.analysis.deleted', resourceType: 'Analysis', resourceId: id, ... })`
    - `sendSuccess(res, { message: 'Analysis permanently deleted.' })`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 6.2 Register route in `src/routes/admin.routes.js`
    - `router.delete('/analyses/:id', asyncWrapper(adminController.deleteAnalysis))`
    - _Requirements: 4.6_
  - [ ]* 6.3 Write property test — Property 7: analysis hard-delete removes the document
    - **Property 7: Analysis hard-delete removes the document**
    - Generate arbitrary analysis data, create via `Analysis.create`, call handler, assert `Analysis.findById` returns `null`
    - `numRuns: 100`
    - **Validates: Requirements 4.3**
  - [ ]* 6.4 Write property test — Property 9 (partial): audit log entry created for deleteAnalysis
    - **Property 9: Every successful admin delete produces an audit log entry**
    - After calling `deleteAnalysis`, assert `AuditLog` contains one entry with `action: 'admin.analysis.deleted'`, correct `resourceType` and `resourceId`
    - `numRuns: 100`
    - **Validates: Requirements 4.4**

- [ ] 7. Implement `deleteTemplate` handler and route
  - [ ] 7.1 Add `deleteTemplate(req, res)` to `src/controllers/admin.controller.js`
    - `Template.findOne({ _id: req.params.id, isActive: true })` — return 404 `NOT_FOUND` if missing or already inactive
    - `Template.findByIdAndUpdate(id, { isActive: false })`
    - `auditService.log({ action: 'admin.template.deleted', resourceType: 'Template', resourceId: id, ... })`
    - `sendSuccess(res, { message: 'Template deleted.' })`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 7.2 Register route in `src/routes/admin.routes.js`
    - `router.delete('/templates/:id', asyncWrapper(adminController.deleteTemplate))`
    - _Requirements: 5.6_
  - [ ]* 7.3 Write property test — Property 8: template soft-delete sets isActive to false
    - **Property 8: Template soft-delete sets isActive to false**
    - Generate active templates with varying fields (`fc.record`), call handler, assert `template.isActive === false`
    - `numRuns: 100`
    - **Validates: Requirements 5.3**
  - [ ]* 7.4 Write property test — Property 9 (partial): audit log entry created for deleteTemplate
    - **Property 9: Every successful admin delete produces an audit log entry**
    - After calling `deleteTemplate`, assert `AuditLog` contains one entry with `action: 'admin.template.deleted'`, correct `resourceType` and `resourceId`
    - `numRuns: 100`
    - **Validates: Requirements 5.4**

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All four routes inherit `authenticate`, `authorize('admin')`, and `rateLimiter('strict')` from the existing router-level `router.use(...)` — no per-route middleware needed
- Property tests use `fast-check` + `mongodb-memory-server`, consistent with the existing Jest setup in `jest.config.cjs`
- `auditService.log` swallows its own errors — a failed audit write will never cause a delete to fail
- The org cascade is not atomic; a DB error mid-cascade will leave partial state. This is an accepted trade-off per the design
