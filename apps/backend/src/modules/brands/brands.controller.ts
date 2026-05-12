import { Controller, Get, Patch, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get('me')
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Get my brand profile' })
  async getMyBrand(@CurrentUser('id') userId: string) {
    return this.brandsService.findByUserId(userId);
  }

  @Get('me/stats')
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Get brand dashboard statistics' })
  async getStats(@CurrentUser() user: { id: string; brand?: { id: string } }) {
    const brand = await this.brandsService.findByUserId(user.id);
    return this.brandsService.getDashboardStats(brand.id);
  }

  @Patch('me')
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Update brand profile' })
  async update(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateBrandDto>,
  ) {
    return this.brandsService.update(userId, dto);
  }

  @Get(':id')
  @Roles(UserRole.BRAND, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get brand by ID' })
  async findOne(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }
}
