import { Global, Module } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { EmailModule } from '../../common/email/email.module';

// Global so agreement/marketplace flows can inject TwoFactorService for the
// influencer-verification gate without re-importing the module everywhere.
@Global()
@Module({
  imports: [EmailModule],
  providers: [TwoFactorService],
  controllers: [TwoFactorController],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
