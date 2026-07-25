import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { OpdBcModule } from './opd-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.OPD_PORT ?? 3000);
}
void bootstrap();
