import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Readable } from 'node:stream';
import { NotifierProto, CommonProto } from '@email-platform/contracts';
import {
  type NamespacedStoragePort,
  SHARED_REPORTS,
  PUBLIC_BUCKET,
} from '@email-platform/foundation';

const SMOKE = {
  PAYLOAD_PREFIX: 'smoke-test-payload-',
  KEY_PREFIX: 'smoke-test-',
  EXT: '.txt',
  STATUS_OK: 200,
} as const;

const STEP = {
  UPLOAD: 'upload',
  EXISTS: 'exists',
  PUBLIC_GET: 'public-get',
} as const;

@Controller()
export class StorageSmokeController {
  constructor(@Inject(SHARED_REPORTS) private readonly publicReports: NamespacedStoragePort) {}

  @GrpcMethod('NotifierService', 'RunStorageSmoke')
  async runStorageSmoke(_request: CommonProto.Empty): Promise<NotifierProto.StorageSmokeResponse> {
    const result = await this.runPublicCycle();
    return { buckets: [result] };
  }

  @GrpcMethod('NotifierService', 'CleanupStorageSmoke')
  async cleanupStorageSmoke(
    request: NotifierProto.CleanupSmokeRequest,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    if (request.bucket !== PUBLIC_BUCKET) {
      return { success: false, detail: `Unknown bucket: ${request.bucket}` };
    }
    try {
      await this.publicReports.delete(request.key);
      return { success: true, detail: '' };
    } catch (err) {
      return { success: false, detail: String(err) };
    }
  }

  private async runPublicCycle(): Promise<NotifierProto.StorageSmokeBucketResult> {
    const filename = `${SMOKE.KEY_PREFIX}${Date.now()}${SMOKE.EXT}`;
    const body = Readable.from(Buffer.from(`${SMOKE.PAYLOAD_PREFIX}${Date.now()}`));
    const steps: NotifierProto.StorageSmokeStepResult[] = [];
    let producedKey = '';
    let producedUrl = '';
    try {
      const { url, key } = await this.publicReports.upload(filename, body);
      producedKey = key;
      producedUrl = url;
      steps.push({ step: STEP.UPLOAD, success: true, detail: key });
      const found = await this.publicReports.exists(key);
      steps.push({ step: STEP.EXISTS, success: found, detail: '' });
      const res = await fetch(url);
      const ok = res.status === SMOKE.STATUS_OK;
      steps.push({
        step: STEP.PUBLIC_GET,
        success: ok,
        detail: ok ? '' : `status=${res.status}`,
      });
    } catch (err) {
      steps.push({ step: STEP.UPLOAD, success: false, detail: String(err) });
    }
    return {
      bucket: PUBLIC_BUCKET,
      testKey: producedKey,
      steps,
      allPassed: steps.every((s) => s.success),
      publicUrl: producedUrl,
    };
  }
}
