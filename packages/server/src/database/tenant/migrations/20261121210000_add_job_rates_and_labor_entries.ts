import { Knex } from 'knex';

/**
 * Turns the dormant projects table into client jobs (rates and overtime
 * settings) and adds the labor log billed on each job.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('projects', (table) => {
    table.decimal('hourly_rate', 13, 3).nullable();
    table.decimal('day_rate', 13, 3).nullable();
    table.boolean('overtime_billable').notNullable().defaultTo(false);
    table.decimal('overtime_rate', 13, 3).nullable();
    table.text('notes').nullable();
  });
  await knex.schema.createTable('job_labor_entries', (table) => {
    table.increments('id');
    table.integer('project_id').unsigned().notNullable().index();
    table.date('date').notNullable();
    table.string('entry_type', 16).notNullable();
    table.decimal('quantity', 13, 3).notNullable().defaultTo(0);
    table.decimal('overtime_hours', 13, 3).notNullable().defaultTo(0);
    table.decimal('rate', 13, 3).notNullable().defaultTo(0);
    table.decimal('overtime_rate', 13, 3).notNullable().defaultTo(0);
    table.string('description', 1000).nullable();
    table.integer('invoice_id').unsigned().nullable().index();
    table.timestamps();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('job_labor_entries');
  await knex.schema.table('projects', (table) => {
    table.dropColumn('hourly_rate');
    table.dropColumn('day_rate');
    table.dropColumn('overtime_billable');
    table.dropColumn('overtime_rate');
    table.dropColumn('notes');
  });
}
