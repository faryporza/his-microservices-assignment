import { Injectable } from '@nestjs/common';

@Injectable()
export class EmrBcService {
  getHello(): string {
    return 'Hello World!';
  }
}
