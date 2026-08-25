import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ResourceType, Roles, UserRole } from '@app/common';
import { PatientsService } from '../services/patients.service';
import { CreatePatientDTO } from '../dto/create-patient.dto';
import { UpdatePatientDTO } from '../dto/update-patient.dto';

@ApiTags('Patients')
@ApiBearerAuth()
@ResourceType('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.NURSE)
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiCreatedResponse({ description: 'Patient successfully registered' })
  create(@Body() createPatientDto: CreatePatientDTO) {
    return this.patientsService.create(createPatientDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @ApiOperation({ summary: 'Retrieve all patients' })
  @ApiOkResponse({ description: 'List of all registered patients' })
  findAll() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @ApiOperation({ summary: 'Retrieve a patient by ID' })
  @ApiParam({
    name: 'id',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Patient record found' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.NURSE)
  @ApiOperation({ summary: 'Update patient details by ID' })
  @ApiParam({
    name: 'id',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Patient successfully updated' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updatePatientDto: UpdatePatientDTO,
  ) {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient by ID' })
  @ApiParam({
    name: 'id',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiNoContentResponse({ description: 'Patient successfully deleted' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  delete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.patientsService.delete(id);
  }
}
