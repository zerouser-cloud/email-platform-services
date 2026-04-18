import { Injectable } from '@nestjs/common';

@Injectable()
export class HashPasswordUseCase {
  async execute(_plainPassword: string): Promise<string> {
    throw new Error('HashPasswordUseCase not yet implemented');
  }
}
