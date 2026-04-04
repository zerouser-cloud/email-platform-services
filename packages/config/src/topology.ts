import { z } from 'zod';
import { SERVICE, ServiceId } from './catalog/services';

function buildTopologyShape() {
  const shape: Record<string, z.ZodType> = {};

  for (const svc of Object.values(SERVICE)) {
    shape[svc.envKeys.PORT] = z.coerce.number();
    if (svc.envKeys.GRPC_URL) {
      shape[svc.envKeys.GRPC_URL] = z.string().min(1);
    }
  }

  return shape;
}

export const TopologySchema = z.object(buildTopologyShape());

type PortEnvKeys = (typeof SERVICE)[ServiceId]['envKeys']['PORT'];
type GrpcUrlEnvKeys = NonNullable<(typeof SERVICE)[ServiceId]['envKeys']['GRPC_URL']>;

export type GlobalTopology = {
  [K in PortEnvKeys]: number;
} & {
  [K in GrpcUrlEnvKeys]: string;
};
