import { Module } from '@nestjs/common';
import { FeatureStoreService } from './feature-store.service';
import { FeatureStoreController } from './feature-store.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FeatureStoreController],
  providers: [FeatureStoreService],
  exports: [FeatureStoreService],
})
export class FeatureStoreModule {}
