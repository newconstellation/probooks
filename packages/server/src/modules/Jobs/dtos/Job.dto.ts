import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ToNumber } from '@/common/decorators/Validators';
import { parseBoolean } from '@/utils/parse-boolean';
import {
  JOB_STATUSES,
  JobStatus,
  LABOR_ENTRY_TYPES,
  LaborEntryType,
} from '../constants';

export class CommandJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ description: 'Job name', example: 'Kitchen remodel' })
  name: string;

  @ToNumber()
  @IsInt()
  @ApiProperty({ description: 'The client (customer) the job is for' })
  clientId: number;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  @ApiProperty({ enum: JOB_STATUSES, required: false })
  status?: JobStatus;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Billable rate per hour', required: false })
  hourlyRate?: number | null;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Billable rate per day', required: false })
  dayRate?: number | null;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value, false))
  @IsBoolean()
  @ApiProperty({ description: 'Whether overtime is billed', required: false })
  overtimeBillable?: boolean;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: 'Overtime rate per hour. Defaults to 1.5x the hourly rate.',
    required: false,
  })
  overtimeRate?: number | null;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false })
  deadline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiProperty({ required: false })
  notes?: string | null;
}

export class CreateJobDto extends CommandJobDto {}
export class EditJobDto extends CommandJobDto {}

export class GetJobsQueryDto {
  @IsOptional()
  @ToNumber()
  @IsInt()
  @ApiProperty({ required: false })
  clientId?: number;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  @ApiProperty({ enum: JOB_STATUSES, required: false })
  status?: JobStatus;
}

export class CommandLaborEntryDto {
  @IsDateString()
  @ApiProperty({ example: '2026-11-21' })
  date: string;

  @IsIn(LABOR_ENTRY_TYPES)
  @ApiProperty({ enum: LABOR_ENTRY_TYPES })
  entryType: LaborEntryType;

  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Regular hours, or days for a day-rate entry' })
  quantity: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({ description: 'Overtime hours', required: false })
  overtimeHours?: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: "Rate for this entry. Defaults to the job's rate.",
    required: false,
  })
  rate?: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: "Overtime rate. Defaults to the job's overtime rate.",
    required: false,
  })
  overtimeRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @ApiProperty({ required: false })
  description?: string | null;
}

export class CreateLaborEntryDto extends CommandLaborEntryDto {}
export class EditLaborEntryDto extends CommandLaborEntryDto {}
