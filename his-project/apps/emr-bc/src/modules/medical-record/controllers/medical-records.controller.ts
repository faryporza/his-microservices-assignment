import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CheckResourceOwnership,
  CurrentUser,
  RequirePermission,
  ResourceType,
  Roles,
  ApiSuccessResponse,
  UserRole,
} from '@app/common';
import type { AuthenticatedUser } from '@app/common';
import { MedicalRecordsService } from '../services/medical-records.service';
import { CreateMedicalRecordDTO } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDTO } from '../dto/update-medical-record.dto';
import { CompleteTreatmentDTO } from '../dto/complete-treatment.dto';

@ApiTags('Medical Records')
@ApiBearerAuth()
@ResourceType('medical-records')
@Controller('records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @RequirePermission('medical-record:create')
  @ApiOperation({ summary: 'Create a new medical record' })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Medical record successfully created',
  })
  create(@Body() createDto: CreateMedicalRecordDTO) {
    return this.medicalRecordsService.create(createDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @RequirePermission('medical-record:read')
  @ApiOperation({ summary: 'Retrieve all medical records' })
  @ApiSuccessResponse({ description: 'List of all medical records' })
  findAll() {
    return this.medicalRecordsService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @RequirePermission('medical-record:read')
  @CheckResourceOwnership('medical_record', 'id')
  @ApiOperation({ summary: 'Retrieve a medical record by ID' })
  @ApiParam({
    name: 'id',
    description: 'Medical Record UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({ description: 'Medical record found' })
  @ApiNotFoundResponse({ description: 'Medical record not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.medicalRecordsService.findOne(id, user)
      : this.medicalRecordsService.findOne(id);
  }

  @Get('visit/:visitId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @RequirePermission('medical-record:read')
  @CheckResourceOwnership('medical_record', 'visitId')
  @ApiOperation({ summary: 'Retrieve medical records by visit ID' })
  @ApiParam({
    name: 'visitId',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({
    description: 'List of medical records for the visit',
  })
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.medicalRecordsService.findByVisitId(visitId, user)
      : this.medicalRecordsService.findByVisitId(visitId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @RequirePermission('medical-record:update')
  @ApiOperation({ summary: 'Update a medical record by ID' })
  @ApiParam({
    name: 'id',
    description: 'Medical Record UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'x-correlation-id',
    description: 'Correlation ID for distributed tracing',
    required: false,
  })
  @ApiHeader({
    name: 'x-trace-id',
    description: 'Trace ID for distributed tracing',
    required: false,
  })
  @ApiSuccessResponse({ description: 'Medical record successfully updated' })
  @ApiNotFoundResponse({ description: 'Medical record not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateMedicalRecordDTO,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.medicalRecordsService.update(
      id,
      updateDto,
      correlationId,
      traceId,
    );
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @RequirePermission('medical-record:update')
  @ApiOperation({
    summary: 'Complete medical treatment and trigger billing event',
  })
  @ApiParam({
    name: 'id',
    description: 'Medical Record UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'x-correlation-id',
    description: 'Correlation ID for distributed tracing',
    required: false,
  })
  @ApiHeader({
    name: 'x-trace-id',
    description: 'Trace ID for distributed tracing',
    required: false,
  })
  @ApiSuccessResponse({ description: 'Treatment completed successfully' })
  @ApiNotFoundResponse({ description: 'Medical record not found' })
  completeTreatment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() completeTreatmentDto: CompleteTreatmentDTO,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.medicalRecordsService.completeTreatment(
      id,
      completeTreatmentDto,
      correlationId,
      traceId,
    );
  }
}
