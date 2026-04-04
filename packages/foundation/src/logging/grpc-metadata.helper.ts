import { Metadata } from '@grpc/grpc-js';
import { ClsService } from 'nestjs-cls';
import { HEADER } from '../constants';

export function createGrpcMetadata(cls: ClsService): Metadata {
  const metadata = new Metadata();
  const correlationId = cls.getId();

  if (correlationId) {
    metadata.set(HEADER.CORRELATION_ID, correlationId);
  }

  return metadata;
}
