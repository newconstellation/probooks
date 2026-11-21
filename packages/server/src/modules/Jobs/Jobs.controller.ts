import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { CustomerAction } from '@/modules/Customers/types/Customers.types';
import { SaleInvoiceAction } from '@/modules/SaleInvoices/SaleInvoice.types';
import { JobsService } from './Jobs.service';
import { JobInvoicing } from './JobInvoicing.service';
import {
  CreateJobDto,
  CreateLaborEntryDto,
  EditJobDto,
  EditLaborEntryDto,
  GetJobsQueryDto,
} from './dtos/Job.dto';

@Controller('jobs')
@ApiTags('Jobs')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobInvoicing: JobInvoicing,
  ) {}

  @Get()
  @RequirePermission(CustomerAction.View, AbilitySubject.Customer)
  @ApiOperation({ summary: 'List client jobs with their unbilled totals.' })
  getJobs(@Query() query: GetJobsQueryDto) {
    return this.jobsService.getJobs(query);
  }

  @Post()
  @RequirePermission(CustomerAction.Create, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Create a client job.' })
  createJob(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  @Put('labor/:entryId')
  @RequirePermission(CustomerAction.Edit, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Edit an unbilled labor entry.' })
  editLaborEntry(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: EditLaborEntryDto,
  ) {
    return this.jobsService.editLaborEntry(entryId, dto);
  }

  @Delete('labor/:entryId')
  @RequirePermission(CustomerAction.Edit, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Delete an unbilled labor entry.' })
  async deleteLaborEntry(@Param('entryId', ParseIntPipe) entryId: number) {
    await this.jobsService.deleteLaborEntry(entryId);
    return { id: entryId };
  }

  @Get(':id')
  @RequirePermission(CustomerAction.View, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Get a client job.' })
  getJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.getJob(id);
  }

  @Put(':id')
  @RequirePermission(CustomerAction.Edit, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Edit a client job.' })
  editJob(@Param('id', ParseIntPipe) id: number, @Body() dto: EditJobDto) {
    return this.jobsService.editJob(id, dto);
  }

  @Delete(':id')
  @RequirePermission(CustomerAction.Delete, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Delete a job that has no labor or expenses.' })
  async deleteJob(@Param('id', ParseIntPipe) id: number) {
    await this.jobsService.deleteJob(id);
    return { id };
  }

  @Get(':id/labor')
  @RequirePermission(CustomerAction.View, AbilitySubject.Customer)
  @ApiOperation({ summary: 'List the labor logged on a job.' })
  getLaborEntries(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.getLaborEntries(id);
  }

  @Post(':id/labor')
  @RequirePermission(CustomerAction.Edit, AbilitySubject.Customer)
  @ApiOperation({ summary: 'Log labor on a job.' })
  createLaborEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLaborEntryDto,
  ) {
    return this.jobsService.createLaborEntry(id, dto);
  }

  @Get(':id/expenses')
  @RequirePermission(CustomerAction.View, AbilitySubject.Customer)
  @ApiOperation({ summary: 'List the expenses billed to a job.' })
  getJobExpenses(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.getJobExpenses(id);
  }

  @Post(':id/invoice')
  @RequirePermission(SaleInvoiceAction.Create, AbilitySubject.SaleInvoice)
  @ApiOperation({
    summary:
      "Create a draft invoice for the job's unbilled labor and expenses.",
  })
  invoiceJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobInvoicing.invoiceJob(id);
  }
}
