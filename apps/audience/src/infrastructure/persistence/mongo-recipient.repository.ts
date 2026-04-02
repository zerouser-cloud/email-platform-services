import { Injectable, NotImplementedException } from '@nestjs/common';
import { Recipient } from '../../domain/entities/recipient.entity';
import { RecipientRepositoryPort } from '../../application/ports/outbound/recipient-repository.port';

@Injectable()
export class MongoRecipientRepository implements RecipientRepositoryPort {
  async findById(_id: string): Promise<Recipient | null> {
    throw new NotImplementedException(
      'MongoRecipientRepository.findById not yet implemented',
    );
  }

  async save(_recipient: Recipient): Promise<void> {
    throw new NotImplementedException(
      'MongoRecipientRepository.save not yet implemented',
    );
  }
}
