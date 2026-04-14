import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Readable } from 'node:stream';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import {
  type NamespacedStoragePort,
  type PrivateStoragePort,
  SHARED_REPORTS,
  PUBLIC_BUCKET,
} from '@email-platform/foundation';
import { PARSER_STORAGE, PARSER_STORAGE_BUCKET } from '../parser.constants';

const SMOKE = {
  CONTENT_TYPE: 'text/plain',
  PAYLOAD_PREFIX: 'smoke-test-payload-',
  KEY_PREFIX: 'smoke-test-',
  EXT_PRIVATE: '.txt',
  EXT_PUBLIC: '.pdf',
  STATUS_OK: 200,
} as const;

// Build a minimal renderable PDF 1.1 — single page with one line of text.
// Used in public smoke so the file opens in browser PDF viewer (namespace
// `reports` is bound to content-type application/pdf — see CONTEXT.md D-12).
function makeSmokePdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 50 100 Td (${text}) Tj ET`;
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>',
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
  ];
  const offsets: number[] = [0];
  let buf = Buffer.from('%PDF-1.1\n');
  for (let i = 0; i < objs.length; i++) {
    offsets.push(buf.length);
    buf = Buffer.concat([buf, Buffer.from(`${i + 1} 0 obj\n${objs[i]}\nendobj\n`)]);
  }
  const xrefAt = buf.length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.concat([buf, Buffer.from(xref)]);
}

const STEP = {
  UPLOAD: 'upload',
  EXISTS: 'exists',
  DOWNLOAD: 'download',
  PUBLIC_GET: 'public-get',
} as const;

@Controller()
export class StorageSmokeController {
  constructor(
    @Inject(PARSER_STORAGE) private readonly parserStorage: PrivateStoragePort,
    @Inject(SHARED_REPORTS) private readonly publicReports: NamespacedStoragePort,
  ) {}

  @GrpcMethod('ParserService', 'RunStorageSmoke')
  async runStorageSmoke(_request: CommonProto.Empty): Promise<ParserProto.StorageSmokeResponse> {
    const [privateResult, publicResult] = await Promise.all([
      this.runPrivateCycle(),
      this.runPublicCycle(),
    ]);
    return { buckets: [privateResult, publicResult] };
  }

  @GrpcMethod('ParserService', 'CleanupStorageSmoke')
  async cleanupStorageSmoke(
    request: ParserProto.CleanupSmokeRequest,
  ): Promise<ParserProto.CleanupSmokeResponse> {
    try {
      if (request.bucket === PARSER_STORAGE_BUCKET) {
        await this.parserStorage.delete(request.key);
        return { success: true, detail: '' };
      }
      if (request.bucket === PUBLIC_BUCKET) {
        await this.publicReports.delete(request.key);
        return { success: true, detail: '' };
      }
      return { success: false, detail: `Unknown bucket: ${request.bucket}` };
    } catch (err) {
      return { success: false, detail: String(err) };
    }
  }

  private async runPrivateCycle(): Promise<ParserProto.StorageSmokeBucketResult> {
    const testKey = `${SMOKE.KEY_PREFIX}${Date.now()}${SMOKE.EXT_PRIVATE}`;
    const testContent = Buffer.from(`${SMOKE.PAYLOAD_PREFIX}${Date.now()}`);
    const steps: ParserProto.StorageSmokeStepResult[] = [];
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

  private async runPublicCycle(): Promise<ParserProto.StorageSmokeBucketResult> {
    const ts = Date.now();
    const filename = `${SMOKE.KEY_PREFIX}${ts}${SMOKE.EXT_PUBLIC}`;
    const body = Readable.from(makeSmokePdf(`Smoke OK ${ts}`));
    const steps: ParserProto.StorageSmokeStepResult[] = [];
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
