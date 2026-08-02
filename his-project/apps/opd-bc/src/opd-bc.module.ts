import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { OpdBcController } from './opd-bc.controller';
import { OpdBcService } from './opd-bc.service';
import { PatientsModule } from './patients/patients.module';
import { VisitsModule } from './visits/visits.module';
import { CommonModule } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createPostgresOptions(configService, 'OPD_DATABASE'),
    }),
    CommonModule,
    PatientsModule,
    VisitsModule,
  ],
  controllers: [OpdBcController],
  providers: [OpdBcService],
})
export class OpdBcModule {}
