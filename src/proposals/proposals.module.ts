import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { SmartContractEventsPollingService } from './pooling.service';
import { ScheduleModule } from '@nestjs/schedule';

// need to import ScheduleModule.forRoot() to enable the scheduler engine
// so that decorators like @Interval() actually work.
// also register provider to create an instance of this service and manage it.
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ProposalsController],
  providers: [ProposalsService, SmartContractEventsPollingService],
})
export class ProposalsModule {}
