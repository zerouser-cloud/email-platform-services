import { Inject, Injectable } from '@nestjs/common';
import { type PrivateStoragePort } from '@email-platform/foundation';
import type { SmokeBucketResult, SmokeStepResult } from '../ports/inbound/run-storage-smoke.port';
import { PARSER_STORAGE, PARSER_STORAGE_BUCKET } from '../../parser.constants';

const SMOKE = {
  CONTENT_TYPE: 'text/plain',
  PAYLOAD_PREFIX: 'smoke-test-payload-',
  KEY_PREFIX: 'smoke-test-',
  EXT_PRIVATE: '.txt',
} as const;

const STEP = {
  UPLOAD: 'upload',
  EXISTS: 'exists',
  DOWNLOAD: 'download',
} as const;

@Injectable()
export class RunPrivateSmokeCycleUseCase {
  constructor(@Inject(PARSER_STORAGE) private readonly parserStorage: PrivateStoragePort) {}

  async execute(): Promise<SmokeBucketResult> {
    const testKey = `${SMOKE.KEY_PREFIX}${Date.now()}${SMOKE.EXT_PRIVATE}`;
    const testContent = Buffer.from(`${SMOKE.PAYLOAD_PREFIX}${Date.now()}`);
    const steps: SmokeStepResult[] = [];
    try {
      await this.parserStorage.upload(testKey, testContent, SMOKE.CONTENT_TYPE);
      steps.push({ step: STEP.UPLOAD, success: true, detail: '' });
      const found = await this.parserStorage.exists(testKey);
      steps.push({
        step: STEP.EXISTS,
        success: found,
        detail: found ? '' : 'not found after upload',
      });
      const downloaded = await this.parserStorage.download(testKey);
      const match = downloaded.equals(testContent);
      steps.push({
        step: STEP.DOWNLOAD,
        success: match,
        detail: match ? '' : 'content mismatch',
      });
    } catch (err) {
      steps.push({ step: STEP.UPLOAD, success: false, detail: String(err) });
    }
    return {
      bucket: PARSER_STORAGE_BUCKET,
      testKey,
      steps,
      allPassed: steps.every((s) => s.success),
      publicUrl: '',
    };
  }
}
