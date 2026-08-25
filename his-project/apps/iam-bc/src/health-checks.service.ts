import { Injectable } from '@nestjs/common';

@Injectable()
export class IamHealthChecksService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'iam-bc',
      timestamp: new Date().toISOString(),
    };
  }
}
