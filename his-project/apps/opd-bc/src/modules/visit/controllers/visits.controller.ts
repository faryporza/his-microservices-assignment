import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { VisitsService } from '../services/visits.service';
import { CreateVisitDTO } from '../dto/create-visit.dto';
import type { AuthenticatedUser } from '@app/common';

@ApiTags('Visits')
@ApiBearerAuth()
@ResourceType('visits')
@Controller()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post('visits')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.NURSE)
  @RequirePermission('visit:create')
  @ApiOperation({ summary: 'Create and open a new patient visit' })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Visit successfully created',
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
  create(
    @Body() createVisitDto: CreateVisitDTO,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.visitsService.create(createVisitDto, correlationId, traceId);
  }

  @Get('visits')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @RequirePermission('visit:read')
  @ApiOperation({ summary: 'Retrieve all visits' })
  @ApiSuccessResponse({ description: 'List of all visits' })
  findAll() {
    return this.visitsService.findAll();
  }

  @Get('visits/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @RequirePermission('visit:read')
  @CheckResourceOwnership('visit', 'id')
  @ApiOperation({ summary: 'Retrieve a visit by ID' })
  @ApiParam({
    name: 'id',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({ description: 'Visit record found' })
  @ApiNotFoundResponse({ description: 'Visit not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.visitsService.findOne(id, user)
      : this.visitsService.findOne(id);
  }

  @Get('patients/:patientId/visits')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @RequirePermission('visit:read')
  @CheckResourceOwnership('patient', 'patientId')
  @ApiOperation({ summary: 'Retrieve visits by patient ID' })
  @ApiParam({
    name: 'patientId',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({
    description: 'List of visits for the specified patient',
  })
  findByPatientId(
    @Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.visitsService.findByPatientId(patientId, user)
      : this.visitsService.findByPatientId(patientId);
  }
}
