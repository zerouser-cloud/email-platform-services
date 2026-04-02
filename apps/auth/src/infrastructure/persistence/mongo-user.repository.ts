import { Injectable, NotImplementedException } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';

@Injectable()
export class MongoUserRepository implements UserRepositoryPort {
  async findByEmail(_email: string): Promise<User | null> {
    throw new NotImplementedException(
      'MongoUserRepository.findByEmail not yet implemented',
    );
  }

  async save(_user: User): Promise<void> {
    throw new NotImplementedException(
      'MongoUserRepository.save not yet implemented',
    );
  }
}
