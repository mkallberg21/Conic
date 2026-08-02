import { Module } from '@nestjs/common';
import { DealRoomService } from './deal-room.service';
import { DealRoomController } from './deal-room.controller';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [AiModule, EmailModule],
  providers: [DealRoomService],
  controllers: [DealRoomController],
  exports: [DealRoomService],
})
export class DealRoomModule {}
