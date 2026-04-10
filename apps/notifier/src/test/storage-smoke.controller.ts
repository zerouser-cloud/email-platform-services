import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { NotifierProto, CommonProto } from '@email-platform/contracts';
import type { StoragePort } from '@email-platform/foundation/internal';
import { REPORTS_STORAGE, REPORTS_BUCKET } from '@email-platform/foundation';

const SMOKE_TEST_CONTENT_TYPE = 'text/plain';
const SMOKE_SIGNED_URL_EXPIRY_MS = 300_000; // 5 minutes

interface SmokeBucketEntry {
  readonly bucket: string;
  readonly storage: StoragePort;
}

@Controller()
export class StorageSmokeController {
  private readonly buckets: SmokeBucketEntry[];

  constructor(
    @Inject(REPORTS_STORAGE) private readonly reportsStorage: StoragePort,
  ) {
    this.buckets = [
      { bucket: REPORTS_BUCKET, storage: this.reportsStorage },
    ];
  }

  @GrpcMethod('NotifierService', 'RunStorageSmoke')
  async runStorageSmoke(
    _request: CommonProto.Empty,
  ): Promise<NotifierProto.StorageSmokeResponse> {
    const bucketResults = await Promise.all(
      this.buckets.map((entry) => this.runSmokeCycle(entry.storage, entry.bucket)),
    );
    return { buckets: bucketResults };
  }

  @GrpcMethod('NotifierService', 'CleanupStorageSmoke')
  async cleanupStorageSmoke(
    request: NotifierProto.CleanupSmokeRequest,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    const entry = this.buckets.find((b) => b.bucket === request.bucket);
    if (!entry) {
      return { success: false, detail: `Unknown bucket: ${request.bucket}` };
    }
    try {
      await entry.storage.delete(request.key);
      return { success: true, detail: '' };
    } catch (err) {
      return { success: false, detail: String(err) };
    }
  }

  private async runSmokeCycle(
    storage: StoragePort,
    bucket: string,
  ): Promise<NotifierProto.StorageSmokeBucketResult> {
    const testKey = `smoke-test-${Date.now()}.txt`;
    const testContent = Buffer.from(`smoke-test-payload-${Date.now()}`);
    const steps: NotifierProto.StorageSmokeStepResult[] = [];

    // Step 1: upload
    try {
      await storage.upload(testKey, testContent, SMOKE_TEST_CONTENT_TYPE);
      steps.push({ step: 'upload', success: true, detail: '' });
    } catch (err) {
      steps.push({ step: 'upload', success: false, detail: String(err) });
      return { bucket, testKey, steps, allPassed: false };
    }

    // Step 2: exists
    try {
      const found = await storage.exists(testKey);
      steps.push({
        step: 'exists',
        success: found,
        detail: found ? '' : 'exists returned false after upload',
      });
    } catch (err) {
      steps.push({ step: 'exists', success: false, detail: String(err) });
    }

    // Step 3: download + content comparison
    try {
      const downloaded = await storage.download(testKey);
      const match = downloaded.equals(testContent);
      steps.push({
        step: 'download',
        success: match,
        detail: match ? '' : 'content mismatch',
      });
    } catch (err) {
      steps.push({ step: 'download', success: false, detail: String(err) });
    }

    // Step 4: getSignedUrl
    try {
      const url = await storage.getSignedUrl(testKey, SMOKE_SIGNED_URL_EXPIRY_MS);
      steps.push({
        step: 'getSignedUrl',
        success: url.length > 0,
        detail: url,
      });
    } catch (err) {
      steps.push({ step: 'getSignedUrl', success: false, detail: String(err) });
    }

    const allPassed = steps.every((s) => s.success);
    return { bucket, testKey, steps, allPassed };
  }
}
