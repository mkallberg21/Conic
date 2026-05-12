import { Module } from '@nestjs/common';
import { AgentProfileService } from './agent-profile.service';
import { AgentProfileController } from './agent-profile.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { EventBusModule } from '../../events/event-bus.module';

@Module({
  imports: [PrismaModule, AuditModule, EventBusModule],
  providers: [AgentProfileService],
  controllers: [AgentProfileController],
  exports: [AgentProfileService],
})
export class AgentProfileModule {}
