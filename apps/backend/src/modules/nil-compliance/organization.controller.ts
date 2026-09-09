/**
 * Organization Hierarchy Controller
 * Exposes the org hierarchy endpoints under /v1/organizations
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Roles,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationDto, OrganizationMemberDto, OrganizationChildDto } from './dto/organization.dto';
import { UserRole } from '@prisma/client';

@Controller('v1/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ─── Organization CRUD ───────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  createOrganization(@CurrentUser() user: { userId: string }, @Body() dto: OrganizationDto) {
    return this.orgService.createOrganization(user.userId, dto);
  }

  @Get()
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  listOrganizations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
  ) {
    return this.orgService.listOrganizations(page, take, { type, status, parentId, search });
  }

  @Get(':id')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  getOrganization(@Param('id') id: string) {
    return this.orgService.getOrganization(id);
  }

  @Patch(':id')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  updateOrganization(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: Partial<OrganizationDto>,
  ) {
    return this.orgService.updateOrganization(user.userId, id, dto);
  }

  @Post(':parentId/children')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  addChild(@CurrentUser() user: { userId: string }, @Param('parentId') parentId: string, @Body() dto: OrganizationChildDto) {
    return this.orgService.addChildOrganization(user.userId, parentId, dto);
  }

  // ─── Hierarchy traversal ─────────────────────────────────────────────────────

  @Get(':id/tree')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  getSubtree(@Param('id') id: string, @Query('depth', new DefaultValuePipe(3), ParseIntPipe) depth: number) {
    return this.orgService.getSubtree(id, depth);
  }

  @Get(':id/ancestors')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  getAncestors(@Param('id') id: string) {
    return this.orgService.getAncestors(id);
  }

  // ─── Members ──────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  listMembers(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
  ) {
    return this.orgService.listMembers(id, page, take);
  }

  @Post(':id/members')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  addMember(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: OrganizationMemberDto,
  ) {
    return this.orgService.addMember(user.userId, id, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  removeMember(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Param('userId') userId: string) {
    return this.orgService.removeMember(user.userId, id, userId);
  }
}
