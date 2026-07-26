import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // เปิด endpoint สำหรับสร้าง patient ใหม่
  @Post()
  create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(createPatientDto);
  }

  // เปิด endpoint สำหรับดึงข้อมูล patient ทั้งหมด
  @Get()
  findAll() {
    return this.patientsService.findAll();
  }

  // เปิด endpoint สำหรับดึงข้อมูล patient ตาม id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }
}
