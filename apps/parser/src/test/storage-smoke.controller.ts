import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import type { StoragePort } from '@email-platform/foundation/internal';
import { PARSER_STORAGE, PARSER_STORAGE_BUCKET } from '../parser.constants';
import { PUBLIC_STORAGE, PUBLIC_BUCKET } from '@email-platform/foundation';

const SMOKE_TEST_CONTENT_TYPE = 'text/plain';
const SMOKE_SIGNED_URL_EXPIRY_MS = 300_000; // 5 minutes

interface SmokeBucketEntry {
  readonly token: symbol;
  readonly bucket: string;
  readonly storage: StoragePort;
}

@Controller()
export class StorageSmokeController {
  private readonly buckets: SmokeBucketEntry[];

  constructor(
    @Inject(PARSER_STORAGE) private readonly parserStorage: StoragePort,
    @Inject(PUBLIC_STORAGE) private readonly publicStorage: StoragePort,
  ) {
    this.buckets = [
      { token: PARSER_STORAGE, bucket: PARSER_STORAGE_BUCKET, storage: this.parserStorage },
      { token: PUBLIC_STORAGE, bucket: PUBLIC_BUCKET, storage: this.publicStorage },
    ];
  }

  @GrpcMethod('ParserService', 'RunStorageSmoke')
  async runStorageSmoke(
    _request: CommonProto.Empty,
  ): Promise<ParserProto.StorageSmokeResponse> {
    const bucketResults = await Promise.all(
      this.buckets.map((entry) => this.runSmokeCycle(entry.storage, entry.bucket)),
    );
    return { buckets: bucketResults };
  }

  @GrpcMethod('ParserService', 'CleanupStorageSmoke')
  async cleanupStorageSmoke(
    request: ParserProto.CleanupSmokeRequest,
  ): Promise<ParserProto.CleanupSmokeResponse> {
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
  ): Promise<ParserProto.StorageSmokeBucketResult> {
    const testKey = `smoke-test-${Date.now()}.txt`;
    const testContent = Buffer.from(`smoke-test-payload-${Date.now()}`);
    const steps: ParserProto.StorageSmokeStepResult[] = [];

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
