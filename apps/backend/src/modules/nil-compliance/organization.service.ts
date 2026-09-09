/**
 * Organization Hierarchy Service
 *
 * Completes Framework NIL's "multi-org hierarchy" gap: state associations →
 * schools → teams → athletes, with per-node roles (UserOrganizationRole) so a
 * single user can hold different roles in different nodes of the hierarchy.
 *
 * Endpoints:
 *   POST   /organizations           — create an organization (first node is ROOT)
 *   GET    /organizations           — list (paginated, filterable by type/status/parent)
 *   GET    /organizations/:id       — org detail + members + children
 *   PATCH  /organizations/:id       — update org fields
 *   POST   /organizations/:id/children — add a child org (builds the tree)
 *   GET    /organizations/:id/tree    — subtree including all descendants (recursive)
 *   GET    /organizations/:id/members — members of an org
 *   POST   /organizations/:id/members — add/remove a member with role
 *   GET    /organizations/:id/ancestors — path to root
 *
 * Org types:
 *   ROOT > STATE_ASSOC > CONFERENCE > SCHOOL > TEAM > (COLLECTIVE, OTHER)
 *
 * Membership: OrganizationMember joins User + Organization with a role, so the
 * same user can be ATHLETIC_DIRECTOR at a university and MEMBER at a team.
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { OrganizationDto, OrganizationMemberDto, OrganizationChildDto } from './dto/organization.dto';
import { OrganizationStatus, UserOrganizationRole, OrganizationMemberStatus } from '@prisma/client';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // ─── Organization CRUD ────────────────────────────────────────────────────────

  async createOrganization(callerId: string, dto: OrganizationDto) {
    // ROOT organizations are singletons — only one should exist.
    if (dto.type === 'ROOT') {
      const existing = await this.prisma.organization.count({ where: { type: 'ROOT' } });
      if (existing > 0) throw new BadRequestException('A ROOT organization already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        status: dto.status ?? OrganizationStatus.PENDING_VERIFICATION,
        parentId: dto.parentId,
        country: dto.country,
        state: dto.state,
        timezone: dto.timezone ?? 'America/Chicago',
        contactEmail: dto.contactEmail,
        description: dto.description,
        websiteUrl: dto.websiteUrl,
        scormLaunchBaseUrl: dto.scormLaunchBaseUrl,
        lmsOrgId: dto.lmsOrgId,
        defaultAllowedRoles: dto.defaultAllowedRoles ?? ['ATHLETE', 'CREATOR'],
      },
    });

    this.eventBus.emit(EVENTS.ORG_CREATED, { orgId: org.id, callerId });
    void this.auditService.log({ userId: callerId, action: 'ORG_CREATED', resource: 'Organization', resourceId: org.id });

    return org;
  }

  async listOrganizations(page = 1, take = 25, filters?: { type?: string; status?: string; parentId?: string; search?: string }) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    const where: Record<string, unknown> = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.parentId) where.parentId = filters.parentId;
    if (filters?.search) where.OR = [
      { name: { contains: filters.search } },
      { slug: { contains: filters.search } },
    ];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true, slug: true, type: true } },
          _count: { select: { children: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true, type: true } },
        children: { select: { id: true, name: true, slug: true, type: true, status: true } },
        members: {
          where: { status: { not: 'REMOVED' } },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { children: true, members: { where: { status: { not: 'REMOVED' } } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(callerId: string, id: string, dto: Partial<OrganizationDto>) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        status: dto.status,
        parentId: dto.parentId,
        country: dto.country,
        state: dto.state,
        timezone: dto.timezone,
        contactEmail: dto.contactEmail,
        description: dto.description,
        websiteUrl: dto.websiteUrl,
        scormLaunchBaseUrl: dto.scormLaunchBaseUrl,
        lmsOrgId: dto.lmsOrgId,
        defaultAllowedRoles: dto.defaultAllowedRoles,
      },
    });

    void this.auditService.log({ userId: callerId, action: 'ORG_UPDATED', resource: 'Organization', resourceId: id });
    return updated;
  }

  async addChildOrganization(callerId: string, parentId: string, dto: OrganizationChildDto) {
    const parent = await this.prisma.organization.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent organization not found');
    if (parent.type === 'ROOT' && dto.type === 'ROOT') throw new BadRequestException('ROOT cannot have a ROOT child');

    const child = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        status: dto.status ?? OrganizationStatus.PENDING_VERIFICATION,
        parentId,
        country: dto.country,
        state: dto.state,
        timezone: dto.timezone ?? parent.timezone,
        contactEmail: dto.contactEmail,
        description: dto.description,
        websiteUrl: dto.websiteUrl,
        scormLaunchBaseUrl: dto.scormLaunchBaseUrl,
        lmsOrgId: dto.lmsOrgId,
        defaultAllowedRoles: dto.defaultAllowedRoles ?? parent.defaultAllowedRoles,
      },
    });

    void this.auditService.log({ userId: callerId, action: 'ORG_CHILD_CREATED', resource: 'Organization', resourceId: child.id, newValue: { parentId } });
    return child;
  }

  // ─── Subtree / Ancestors ───────────────────────────────────────────────────────

  async getSubtree(orgId: string, depth = 3) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    // Recursive walk for descendants (materialized on the fly; fine for moderate
    // org trees. Switch to a materialized path / closure table if the tree gets deep.)
    const descendants = await this.recursivelyFetchChildren(orgId, depth);
    return { root: org, descendants };
  }

  private async recursivelyFetchChildren(parentId: string, depth: number): Promise<unknown[]> {
    if (depth <= 0) return [];
    const children = await this.prisma.organization.findMany({
      where: { parentId },
      include: {
        parent: { select: { id: true, name: true, slug: true, type: true } },
        _count: { select: { children: true } },
      },
      orderBy: { name: 'asc' },
    });
    const result: unknown[] = [];
    for (const child of children) {
      const subtree = await this.recursivelyFetchChildren(child.id, depth - 1);
      result.push({ ...child, descendants: subtree });
    }
    return result;
  }

  async getAncestors(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const path: { id: string; name: string; slug: string; type: string; parentId: string | null }[] = [];
    let current = org;
    while (current) {
      path.unshift({ id: current.id, name: current.name, slug: current.slug, type: current.type, parentId: current.parentId });
      current = current.parent;
    }
    return { orgId, path };
  }

  // ─── Members ───────────────────────────────────────────────────────────────────

  async listMembers(orgId: string, page = 1, take = 25) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
        where: { organizationId: orgId, status: { not: 'REMOVED' } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where: { organizationId: orgId, status: { not: 'REMOVED' } } }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async addMember(callerId: string, orgId: string, dto: OrganizationMemberDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const member = await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: dto.userId } },
      create: {
        organizationId: orgId,
        userId: dto.userId,
        role: dto.role ?? UserOrganizationRole.MEMBER,
        memberCode: dto.memberCode,
        notes: dto.notes,
      },
      update: {
        role: dto.role ?? UserOrganizationRole.MEMBER,
        memberCode: dto.memberCode,
        notes: dto.notes,
        leftAt: null,
        status: OrganizationMemberStatus.ACTIVE,
      },
    });

    void this.auditService.log({ userId: callerId, action: 'ORG_MEMBER_CREATED', resource: 'OrganizationMember', resourceId: member.id, newValue: { orgId, userId: dto.userId, role: dto.role ?? UserOrganizationRole.MEMBER } });
    return member;
  }

  async removeMember(callerId: string, orgId: string, userId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const member = await this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { status: OrganizationMemberStatus.REMOVED, leftAt: new Date() },
    });

    void this.auditService.log({ userId: callerId, action: 'ORG_MEMBER_REMOVED', resource: 'OrganizationMember', resourceId: member.id });
    return member;
  }
}
