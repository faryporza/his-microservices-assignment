import { Injectable } from '@nestjs/common';

@Injectable()
export class OpdHealthChecksService {
  getHello(): string {
    return 'Hello World!';
  }
}
