import { Injectable } from '@nestjs/common';

@Injectable()
export class EmrHealthChecksService {
  getHello(): string {
    return 'Hello World!';
  }
}
