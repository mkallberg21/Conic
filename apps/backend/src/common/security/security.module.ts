import { Global, Module } from '@nestjs/common';
import { SecurityTokenService } from './security-token.service';

@Global()
@Module({
  providers: [SecurityTokenService],
  exports: [SecurityTokenService],
})
export class SecurityModule {}
