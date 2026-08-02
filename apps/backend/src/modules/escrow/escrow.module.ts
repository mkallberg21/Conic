import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { EscrowProvider } from './escrow.provider';

@Module({
  providers: [EscrowService, EscrowProvider],
  controllers: [EscrowController],
  exports: [EscrowService],
})
export class EscrowModule {}
