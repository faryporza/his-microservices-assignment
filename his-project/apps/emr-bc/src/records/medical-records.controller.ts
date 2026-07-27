import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

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
  findOne(@Param('id') id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Get('visit/:visitId')
  findByVisitId(@Param('visitId') visitId: string) {
    return this.medicalRecordsService.findByVisitId(visitId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateMedicalRecordDto) {
    return this.medicalRecordsService.update(id, updateDto);
  }
}
