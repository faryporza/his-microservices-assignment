import { Injectable } from '@nestjs/common';

@Injectable()
export class FinanceBcService {
  getHello(): string {
    return 'Hello World!';
  }
}
