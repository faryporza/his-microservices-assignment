import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission, ResourceType, Roles, UserRole } from '@app/common';
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
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @RequirePermission('medical-record:create')
  @ApiOperation({ summary: 'Create a new medical record' })
  @ApiCreatedResponse({ description: 'Medical record successfully created' })
  create(@Body() createDto: CreateMedicalRecordDTO) {
    return this.medicalRecordsService.create(createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @RequirePermission('medical-record:read')
  @ApiOperation({ summary: 'Retrieve all medical records' })
  @ApiOkResponse({ description: 'List of all medical records' })
  findAll() {
    return this.medicalRecordsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @ApiOperation({ summary: 'Retrieve a medical record by ID' })
  @ApiParam({
    name: 'id',
    description: 'Medical Record UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Medical record found' })
  @ApiNotFoundResponse({ description: 'Medical record not found' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Get('visit/:visitId')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @ApiOperation({ summary: 'Retrieve medical records by visit ID' })
  @ApiParam({
    name: 'visitId',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'List of medical records for the visit' })
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
  ) {
    return this.medicalRecordsService.findByVisitId(visitId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
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
  @ApiOkResponse({ description: 'Medical record successfully updated' })
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
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
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
  @ApiOkResponse({ description: 'Treatment completed successfully' })
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
