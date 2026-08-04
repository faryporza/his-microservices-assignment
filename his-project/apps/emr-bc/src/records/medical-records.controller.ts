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
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { CompleteTreatmentDto } from './dto/complete-treatment.dto';

@Controller('records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  create(@Body() createDto: CreateMedicalRecordDto) {
    return this.medicalRecordsService.create(createDto);
  }

  @Get()
  findAll() {
    return this.medicalRecordsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Get('visit/:visitId')
  findByVisitId(
    @Param('visitId', new ParseUUIDPipe({ version: '4' })) visitId: string,
  ) {
    return this.medicalRecordsService.findByVisitId(visitId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.update(id, updateDto);
  }

  @Patch(':id/complete')
  completeTreatment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() completeTreatmentDto: CompleteTreatmentDto,
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
