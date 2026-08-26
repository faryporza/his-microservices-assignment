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
  ApiNoContentResponse,
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
  ApiStandardErrorResponse,
  ApiSuccessResponse,
  UserRole,
} from '@app/common';
import { PatientsService } from '../services/patients.service';
import { CreatePatientDTO } from '../dto/create-patient.dto';
import { UpdatePatientDTO } from '../dto/update-patient.dto';
import type { AuthenticatedUser } from '@app/common';

@ApiTags('Patients')
@ApiBearerAuth()
@ResourceType('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.NURSE)
  @RequirePermission('patient:create')
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Patient successfully registered',
  })
  @ApiStandardErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  create(@Body() createPatientDto: CreatePatientDTO) {
    return this.patientsService.create(createPatientDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @RequirePermission('patient:read')
  @ApiOperation({ summary: 'Retrieve all patients' })
  @ApiSuccessResponse({ description: 'List of all registered patients' })
  findAll() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @RequirePermission('patient:read')
  @CheckResourceOwnership('patient', 'id')
  @ApiOperation({ summary: 'Retrieve a patient by ID' })
  @ApiParam({
    name: 'id',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({ description: 'Patient record found' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user
      ? this.patientsService.findOne(id, user)
      : this.patientsService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.NURSE)
  @RequirePermission('patient:update')
  @ApiOperation({ summary: 'Update patient details by ID' })
  @ApiParam({
    name: 'id',
    description: 'Patient UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiSuccessResponse({ description: 'Patient successfully updated' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updatePatientDto: UpdatePatientDTO,
  ) {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @RequirePermission('patient:delete')
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
