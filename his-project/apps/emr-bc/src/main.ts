import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EmrBcModule } from './emr-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.EMR_PORT ?? 3001);
}
void bootstrap();
