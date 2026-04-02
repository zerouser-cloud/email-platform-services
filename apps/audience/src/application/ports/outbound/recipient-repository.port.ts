import { Recipient } from '../../../domain/entities/recipient.entity';

export interface RecipientRepositoryPort {
  findById(id: string): Promise<Recipient | null>;
  save(recipient: Recipient): Promise<void>;
}
