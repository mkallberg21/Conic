import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DiscoveryService } from './discovery.service';
import { DiscoverySearchDto } from './dto/discovery.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BRAND, UserRole.AGENCY, UserRole.ADMIN)
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('search')
  @ApiOperation({ summary: 'Natural-language search for creators/athletes (ranked, explained, contact-masked)' })
  search(@Body() dto: DiscoverySearchDto) {
    return this.discoveryService.search(dto);
  }
}
