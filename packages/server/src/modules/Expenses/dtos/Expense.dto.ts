import { ToNumber } from '@/common/decorators/Validators';
import { parseBoolean } from '@/utils/parse-boolean';
import { ApiProperty } from '@nestjs/swagger';
import {
  EXPENSE_RECEIPT_TAGS,
  EXPENSE_TAX_TREATMENTS,
  ExpenseReceiptTag,
  ExpenseTaxTreatment,
} from '../constants';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class AttachmentDto {
  @IsString()
  key: string;
}

export class ExpenseCategoryDto {
  @IsInt()
  @IsNotEmpty()
  @ApiProperty({ example: 1, description: 'The index of the expense category' })
  index: number;

  @IsNotEmpty()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    example: 1,
    description: 'The expense account id of the expense category',
  })
  expenseAccountId: number;

  @ToNumber()
  @IsNumber()
  @IsOptional()
  @ApiProperty({
    example: 100,
    description: 'The amount of the expense category',
  })
  amount?: number;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  @ApiProperty({
    example: 'This is a description',
    description: 'The description of the expense category',
  })
  description?: string;

  @IsBoolean()
  @Transform(({ value }) => parseBoolean(value, false))
  @IsOptional()
  @ApiProperty({
    example: true,
    description: 'The landed cost of the expense category',
  })
  landedCost?: boolean;

  @ToNumber()
  @IsInt()
  @IsOptional()
  @ApiProperty({
    example: 1,
    description: 'The project id of the expense category',
  })
  projectId?: number;
}

export class CommandExpenseDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  @ApiProperty({
    description: 'The reference number of the expense',
    example: 'INV-123456',
  })
  referenceNo?: string;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The payment date of the expense',
    example: '2021-01-01',
  })
  paymentDate: Date;

  @IsNotEmpty()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    description: 'The payment account id of the expense',
    example: 1,
  })
  paymentAccountId: number;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  @ApiProperty({
    description: 'The description of the expense',
    example: 'This is a description',
  })
  description?: string;

  @IsOptional()
  @IsIn([...EXPENSE_TAX_TREATMENTS, null])
  @ApiProperty({
    description:
      'How the expense counts for income tax: fully deductible, 50% deductible business meals, or personal.',
    enum: EXPENSE_TAX_TREATMENTS,
    required: false,
    nullable: true,
    example: ExpenseTaxTreatment.Deductible,
  })
  taxTreatment?: ExpenseTaxTreatment | null;

  @IsOptional()
  @IsIn([...EXPENSE_RECEIPT_TAGS, null])
  @ApiProperty({
    description:
      'Quick tag picked when the receipt was captured (meals, parking, rideshare...). Sets the tax treatment when none is given.',
    enum: EXPENSE_RECEIPT_TAGS,
    required: false,
    nullable: true,
    example: ExpenseReceiptTag.Parking,
  })
  receiptTag?: ExpenseReceiptTag | null;

  @IsOptional()
  @Transform((param) => parseBoolean(param.value, false))
  @IsBoolean()
  @ApiProperty({
    description: 'Whether a customer or job will pay this expense back',
    required: false,
    example: false,
  })
  reimbursable?: boolean;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    description: 'The customer or job that will reimburse the expense',
    required: false,
    nullable: true,
    example: 1,
  })
  reimburseCustomerId?: number | null;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    description:
      'The invoice to bill the expense on. The expense is added as a line item and its receipt is attached to the invoice.',
    required: false,
    nullable: true,
    example: 1,
  })
  reimburseInvoiceId?: number | null;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    description: 'The client job the expense is billed to',
    required: false,
    nullable: true,
    example: 1,
  })
  projectId?: number | null;

  @ToNumber()
  @IsNumber()
  @IsOptional()
  @ApiProperty({ description: 'The exchange rate of the expense', example: 1 })
  exchangeRate?: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  @IsISO4217CurrencyCode()
  @ApiProperty({
    description: 'The currency code of the expense',
    example: 'USD',
  })
  currencyCode?: string;

  @IsBoolean()
  @Transform(({ value }) => parseBoolean(value, false))
  @IsOptional()
  @ApiProperty({
    description: 'The publish status of the expense',
    example: true,
  })
  publish?: boolean;

  @IsOptional()
  @ToNumber()
  @IsInt()
  @ApiProperty({
    description: 'The payee id of the expense',
    example: 1,
  })
  payeeId?: number;

  @ToNumber()
  @IsInt()
  @IsOptional()
  @ApiProperty({
    description: 'The branch id of the expense',
    example: 1,
  })
  branchId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseCategoryDto)
  @ApiProperty({
    description: 'The categories of the expense',
    example: [
      {
        index: 1,
        expenseAccountId: 1,
        amount: 100,
        description: 'This is a description',
        landedCost: true,
        projectId: 1,
      },
    ],
  })
  categories: ExpenseCategoryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  @ApiProperty({
    description: 'The attachments of the expense',
    example: [
      {
        key: '123456',
      },
    ],
  })
  attachments?: AttachmentDto[];
}

export class CreateExpenseDto extends CommandExpenseDto {}
export class EditExpenseDto extends CommandExpenseDto {}
