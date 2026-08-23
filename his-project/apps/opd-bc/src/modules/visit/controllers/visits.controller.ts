import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ResourceType } from '@app/common';
import { VisitsService } from '../services/visits.service';
import { CreateVisitDTO } from '../dto/create-visit.dto';

@ApiTags('Visits')
@ResourceType('visits')
@Controller()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post('visits')
  @ApiOperation({ summary: 'Create and open a new patient visit' })
  @ApiCreatedResponse({ description: 'Visit successfully created' })
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
  @ApiOperation({ summary: 'Retrieve all visits' })
  @ApiOkResponse({ description: 'List of all visits' })
  findAll() {
    return this.visitsService.findAll();
  }

  @Get('visits/:id')
  @ApiOperation({ summary: 'Retrieve a visit by ID' })
  @ApiParam({
    name: 'id',
    description: 'Visit UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Visit record found' })
  @ApiNotFoundResponse({ description: 'Visit not found' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.visitsService.findOne(id);
  }

  @Get('patients/:patientId/visits')
  @ApiOperation({ summary: 'Retrieve visits by patient ID' })
  @ApiParam({
    name: 'patientId',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'List of visits for the specified patient' })
  findByPatientId(
    @Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
  ) {
    return this.visitsService.findByPatientId(patientId);
  }
}
