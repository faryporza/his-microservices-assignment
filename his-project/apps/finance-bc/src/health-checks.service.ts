import { Injectable } from '@nestjs/common';

@Injectable()
export class FinanceHealthChecksService {
  getHello(): string {
    return 'Hello World!';
  }
}
