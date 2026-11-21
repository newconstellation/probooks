import type { Knex } from 'knex';

/**
 * Tax rate columns were created with knex's default decimal(8, 2), which
 * rounds real-world rates such as 8.875% to 8.88%. Widen them to four
 * decimal places so rates are stored exactly.
 */
const columns: Array<[string, string]> = [
  ['tax_rates', 'rate'],
  ['tax_rate_transactions', 'rate'],
  ['items_entries', 'tax_rate'],
  ['accounts_transactions', 'tax_rate'],
];

export async function up(knex: Knex) {
  for (const [tableName, column] of columns) {
    await knex.schema.alterTable(tableName, (table) => {
      table.decimal(column, 10, 4).unsigned().alter();
    });
  }
}

export async function down(knex: Knex) {
  for (const [tableName, column] of columns) {
    await knex.schema.alterTable(tableName, (table) => {
      table.decimal(column, 8, 2).unsigned().alter();
    });
  }
}
