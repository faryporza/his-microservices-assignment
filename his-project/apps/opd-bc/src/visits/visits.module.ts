import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './entities/visit.entity';
import { Patient } from '../patients/entities/patient.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { OpdRabbitMqModule } from '../messaging/opd-rabbitmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([Visit, Patient]), OpdRabbitMqModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
