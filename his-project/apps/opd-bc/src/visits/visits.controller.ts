import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';

@Controller()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post('visits') // เปิด endpoint สำหรับสร้าง visit ใหม่
  create(@Body() createVisitDto: CreateVisitDto) {
    return this.visitsService.create(createVisitDto);
  }

  @Get('visits') // เปิด endpoint สำหรับดึงข้อมูล visit ทั้งหมด
  findAll() {
    return this.visitsService.findAll();
  }

  @Get('visits/:id') // เปิด endpoint สำหรับดึงข้อมูล visit ตาม id
  findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Get('patients/:patientId/visits') // เปิด endpoint สำหรับดึงข้อมูล visit ตาม patientId
  findByPatientId(@Param('patientId') patientId: string) {
    return this.visitsService.findByPatientId(patientId);
  }
}
