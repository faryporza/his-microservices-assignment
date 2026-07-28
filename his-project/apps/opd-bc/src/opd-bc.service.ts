import { Injectable } from '@nestjs/common';

@Injectable()
export class OpdBcService {
  getHello(): string {
    return 'Hello World!';
  }
}
