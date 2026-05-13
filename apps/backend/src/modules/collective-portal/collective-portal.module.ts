import { Module } from '@nestjs/common';
import { CollectivePortalService } from './collective-portal.service';
import { CollectivePortalController } from './collective-portal.controller';

@Module({
  providers: [CollectivePortalService],
  controllers: [CollectivePortalController],
  exports: [CollectivePortalService],
})
export class CollectivePortalModule {}
