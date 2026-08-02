import { Global, Module } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { EngagementController } from './engagement.controller';
import { GeoService } from './geo.service';

// Global so ProfileService can inject GeoService to blur a location into
// approximate coordinates on profile update.
@Global()
@Module({
  providers: [EngagementService, GeoService],
  controllers: [EngagementController],
  exports: [EngagementService, GeoService],
})
export class EngagementModule {}
