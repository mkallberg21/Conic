import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
  TemplateQueryDto,
} from './dto/contract-templates.dto';

@Injectable()
export class ContractTemplatesService {
  private readonly logger = new Logger(ContractTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateContractTemplateDto, userId: string) {
    const template = await this.prisma.contractTemplate.create({
      data: {
        ...dto,
        createdBy: userId,
        usageCount: 0,
      },
    });
    await this.auditService.log({
      userId,
      action: 'contract_template.created',
      resource: 'ContractTemplate',
      resourceId: template.id,
      metadata: { name: dto.name, category: dto.category },
    });
    return template;
  }

  async update(id: string, dto: UpdateContractTemplateDto, userId: string) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.createdBy !== userId) {
      // Only ADMIN can edit others' templates — caller should pre-screen role
      throw new ForbiddenException('Not authorized to edit this template');
    }
    return this.prisma.contractTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (!isAdmin && template.createdBy !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    await this.prisma.contractTemplate.delete({ where: { id } });
    await this.auditService.log({
      userId,
      action: 'contract_template.deleted',
      resource: 'ContractTemplate',
      resourceId: id,
    });
  }

  async findAll(query: TemplateQueryDto, userId: string) {
    const where: Record<string, unknown> = {
      OR: [{ isPublic: true }, { createdBy: userId }],
    };
    if (query.category) where['category'] = query.category;
    if (query.isNilTemplate !== undefined) where['isNilTemplate'] = query.isNilTemplate;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }
    return this.prisma.contractTemplate.findMany({
      where,
      orderBy: { usageCount: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (!template.isPublic && template.createdBy !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    return template;
  }

  async useTemplate(id: string) {
    return this.prisma.contractTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  async generateAiSuggestions(templateId: string, context: string) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    const contractAiUrl = this.config.get<string>('ai.contractAiUrl');
    const internalSecret = this.config.get<string>('ai.internalSecret');

    const res = await fetch(`${contractAiUrl}/suggest-clauses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret ?? '',
      },
      body: JSON.stringify({
        template_content: template.content,
        category: template.category,
        context,
        is_nil_template: template.isNilTemplate,
      }),
    });

    if (!res.ok) {
      this.logger.warn(`AI clause suggestion failed for template ${templateId}`);
      return { suggestions: [] };
    }
    return res.json();
  }
}
