import { Module } from '@nestjs/common';
import { SaleInvoicesModule } from '../SaleInvoices/SaleInvoices.module';
import { ItemsModule } from '../Items/Items.module';
import { AccountsModule } from '../Accounts/Accounts.module';
import { ReimbursableExpenseInvoicing } from './ReimbursableExpenseInvoicing.service';
import { ReimbursableExpensesSubscriber } from './ReimbursableExpenses.subscriber';

@Module({
  imports: [SaleInvoicesModule, ItemsModule, AccountsModule],
  providers: [ReimbursableExpenseInvoicing, ReimbursableExpensesSubscriber],
  exports: [ReimbursableExpenseInvoicing],
})
export class ReimbursableExpensesModule {}
