import { Module } from '@nestjs/common';
import { CardHistoryService } from './card-history.service';

@Module({
  providers: [CardHistoryService],
  exports: [CardHistoryService],
})
export class HistoryModule {}
