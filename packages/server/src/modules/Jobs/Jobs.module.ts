import { Module } from '@nestjs/common';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { SaleInvoicesModule } from '../SaleInvoices/SaleInvoices.module';
import { ItemsModule } from '../Items/Items.module';
import { ReimbursableExpensesModule } from '../ReimbursableExpenses/ReimbursableExpenses.module';
import { Job } from './models/Job.model';
import { JobLaborEntry } from './models/JobLaborEntry.model';
import { JobsService } from './Jobs.service';
import { JobInvoicing } from './JobInvoicing.service';
import { JobsController } from './Jobs.controller';
import { JobsSubscriber } from './Jobs.subscriber';

const models = [RegisterTenancyModel(Job), RegisterTenancyModel(JobLaborEntry)];

@Module({
  imports: [
    SaleInvoicesModule,
    ItemsModule,
    ReimbursableExpensesModule,
    ...models,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobInvoicing, JobsSubscriber],
  exports: [JobsService, ...models],
})
export class JobsModule {}
