import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { OwnershipCodeVerifier } from './social-verifier';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [EmbeddingsModule],
  controllers: [ProfileController],
  providers: [ProfileService, OwnershipCodeVerifier],
  exports: [ProfileService],
})
export class ProfileModule {}
