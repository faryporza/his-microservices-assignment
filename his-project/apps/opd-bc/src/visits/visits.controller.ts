import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
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
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.visitsService.findOne(id);
  }

  @Get('patients/:patientId/visits') // เปิด endpoint สำหรับดึงข้อมูล visit ตาม patientId
  findByPatientId(
    @Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
  ) {
    return this.visitsService.findByPatientId(patientId);
  }
}
