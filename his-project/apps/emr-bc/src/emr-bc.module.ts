import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '@nestjs/microservices';
import { EmrBcController } from './emr-bc.controller';
import { EmrBcService } from './emr-bc.service';
import { MedicalRecordsModule } from './records/medical-records.module';
import { CommonModule } from '@app/common';
import { RmqService } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get<string>('POSTGRES_USERNAME', 'postgres'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'postgres'),
        database: configService.get<string>('EMR_DATABASE', 'emr_db'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'RMQ_CLIENT',
        imports: [CommonModule],
        inject: [RmqService],
        useFactory: (rmqService: RmqService) =>
          rmqService.createClientOptions(),
      },
    ]),
    CommonModule,
    MedicalRecordsModule,
  ],
  controllers: [EmrBcController],
  providers: [EmrBcService],
})
export class EmrBcModule {}
