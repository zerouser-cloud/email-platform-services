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
  KEY_PREFIX: 'smoke-test-',
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
    const ts = Date.now();
    const filename = `${SMOKE.KEY_PREFIX}${ts}${SMOKE.EXT_PUBLIC}`;
    const body = Readable.from(makeSmokePdf(`Smoke OK ${ts}`));
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
