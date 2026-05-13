import { Module } from '@nestjs/common';
import { DealRoomService } from './deal-room.service';
import { DealRoomController } from './deal-room.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [DealRoomService],
  controllers: [DealRoomController],
  exports: [DealRoomService],
})
export class DealRoomModule {}
