import type { Knex } from 'knex';

/**
 * Adds a tax treatment tag to expenses, set when a receipt is captured:
 * fully deductible, 50% deductible (business meals) or personal.
 */
export async function up(knex: Knex) {
  if (await knex.schema.hasColumn('expenses_transactions', 'tax_treatment')) {
    return;
  }
  await knex.schema.alterTable('expenses_transactions', (table) => {
    table.string('tax_treatment', 32).nullable();
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('expenses_transactions', (table) => {
    table.dropColumn('tax_treatment');
  });
}
