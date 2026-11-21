import { Knex } from 'knex';

/**
 * Adds the receipt quick tag and the reimbursement link (customer or job, and
 * optionally the invoice the expense was billed on) to expenses.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('expenses_transactions', (table) => {
    table.string('receipt_tag', 32).nullable();
    table.boolean('reimbursable').notNullable().defaultTo(false);
    table.integer('reimburse_customer_id').unsigned().nullable();
    table.integer('reimburse_invoice_id').unsigned().nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('expenses_transactions', (table) => {
    table.dropColumn('receipt_tag');
    table.dropColumn('reimbursable');
    table.dropColumn('reimburse_customer_id');
    table.dropColumn('reimburse_invoice_id');
  });
}
