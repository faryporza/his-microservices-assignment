import { NestFactory } from '@nestjs/core';
import { OpdBcModule } from './opd-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(OpdBcModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
