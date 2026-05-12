import { Module } from '@nestjs/common';
import { FeatureStoreService } from './feature-store.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [FeatureStoreService],
  exports: [FeatureStoreService],
})
export class FeatureStoreModule {}
