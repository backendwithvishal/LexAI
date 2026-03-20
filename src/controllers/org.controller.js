/**
 * Organization Controller
 *
 * Thin HTTP layer for org creation, member management, and invitation handling.
 * All business logic (plan limits, role checks, member counts) lives in org.service.js.
 * Audit logs are written here (not in the service) since they need req.ip.
 */

import * as orgService from '../services/org.service.js';
import * as invitationService from '../services/invitation.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';
import * as auditService from '../services/audit.service.js';

/** POST /orgs — create a new organization (user becomes owner + admin) */
export async function createOrg(req, res) {
    const org = await orgService.createOrganization(req.user.userId, req.body);

    // Log org creation for compliance — includes IP for security auditing
    await auditService.log({
        orgId: org._id,
        userId: req.user.userId,
        action: 'org.created',
        resourceType: 'Organization',
        resourceId: org._id,
        ipAddress: req.ip,
    });

    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        data: {
            // Return only the summary — not the full members array
            org: { id: org._id, name: org.name, slug: org.slug, plan: org.plan, memberCount: org.members.length },
        },
    });
}

/** GET /orgs/:orgId — get org details with populated member names */
export async function getOrg(req, res) {
    // Service verifies the requester is actually a member of this org
    const org = await orgService.getOrganization(req.params.orgId, req.user.userId);
    sendSuccess(res, { data: { org } });
}

/** PATCH /orgs/:orgId — update org name (admin/manager only) */
export async function updateOrg(req, res) {
    const org = await orgService.updateOrganization(req.params.orgId, req.user.userId, req.body);
    sendSuccess(res, { data: { org } });
}

/** POST /orgs/:orgId/invite — send a team invitation email */
export async function inviteMember(req, res) {
    const invitation = await invitationService.createInvitation(req.params.orgId, req.user.userId, req.body);

    // Audit the invitation — useful for tracking who invited whom
    await auditService.log({
        orgId: req.params.orgId,
        userId: req.user.userId,
        action: 'org.member.invited',
        resourceType: 'Invitation',
        resourceId: invitation._id,
        metadata: { email: req.body.email, role: req.body.role },
        ipAddress: req.ip,
    });

    sendSuccess(res, {
        message: `Invitation sent to ${req.body.email}`,
        data: { invitationId: invitation._id, expiresAt: invitation.expiresAt },
    });
}

/** POST /orgs/:orgId/invite/accept — accept an invitation (creates account if new user) */
export async function acceptInvite(req, res) {
    const result = await invitationService.acceptInvitation(req.params.orgId, req.body);
    sendSuccess(res, { message: 'Invitation accepted. Your account has been created.', data: result });
}

/** PATCH /orgs/:orgId/members/:userId/role — change a member's role (admin only) */
export async function changeMemberRole(req, res) {
    // Service prevents admins from changing their own role
    await orgService.changeMemberRole(req.params.orgId, req.params.userId, req.body.role, req.user.userId);
    sendSuccess(res, { message: 'Member role updated successfully.' });
}

/** DELETE /orgs/:orgId/members/:userId — remove a member from the org */
export async function removeMember(req, res) {
    await orgService.removeMember(req.params.orgId, req.params.userId, req.user.userId);

    await auditService.log({
        orgId: req.params.orgId,
        userId: req.user.userId,
        action: 'org.member.removed',
        resourceType: 'User',
        resourceId: req.params.userId,
        ipAddress: req.ip,
    });

    sendSuccess(res, { message: 'Member removed from organization.' });
}
