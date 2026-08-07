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
import { PatientsService } from '../services/patients.service';
import { CreatePatientDTO } from '../dto/create-patient.dto';
import { UpdatePatientDTO } from '../dto/update-patient.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // เปิด endpoint สำหรับสร้าง patient ใหม่
  @Post()
  create(@Body() createPatientDto: CreatePatientDTO) {
    return this.patientsService.create(createPatientDto);
  }

  // เปิด endpoint สำหรับดึงข้อมูล patient ทั้งหมด
  @Get()
  findAll() {
    return this.patientsService.findAll();
  }

  // เปิด endpoint สำหรับดึงข้อมูล patient ตาม id
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updatePatientDto: UpdatePatientDTO,
  ) {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.patientsService.delete(id);
  }
}
