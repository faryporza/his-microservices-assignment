import { NestFactory } from '@nestjs/core';
import { EmrBcModule } from './emr-bc.module';

async function bootstrap() {
  const app = await NestFactory.create(EmrBcModule);
  await app.listen(process.env.EMR_PORT ?? 3001);
}
void bootstrap();
