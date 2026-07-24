import { NestFactory } from '@nestjs/core';
import { FinanceBcModule } from './finance-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(FinanceBcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
