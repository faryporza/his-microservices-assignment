import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FinanceBcModule } from './finance-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.FINANCE_PORT ?? 3002);
}
void bootstrap();
