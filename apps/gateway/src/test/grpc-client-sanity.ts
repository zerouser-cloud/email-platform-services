/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions */
// Intentional unused locals — typecheck probe only, never imported at runtime.
/**
 * GRPC-01 sanity probe. This file is compiled by tsc but never imported at runtime.
 * It exercises each typed client facade so that method-name typos or wrong request
 * types surface as build errors. Keep expectations matched to the ts-proto generated
 * interfaces in packages/contracts/src/generated/.
 *
 * DO NOT import this file from any runtime module.
 */
import type { CallOpts, Promisified } from '@email-platform/foundation';
import type { AudienceClient } from '../infrastructure/clients/audience';
import type { NotifierClient } from '../infrastructure/clients/notifier';
import type {
  AuthProto,
  SenderProto,
  ParserProto,
  AudienceProto,
  NotifierProto,
  CommonProto,
} from '@email-platform/contracts';

// Positive compile cases — must typecheck.
export async function _probePositive(
  auth: Promisified<AuthProto.AuthServiceClient>,
  sender: Promisified<SenderProto.SenderServiceClient>,
  parser: Promisified<ParserProto.ParserServiceClient>,
  audience: AudienceClient,
  notifier: NotifierClient,
): Promise<void> {
  const opts: CallOpts = { deadlineMs: 2000 };

  // Promisified<T> preserves the original ts-proto signature `(req, meta?: Metadata) => Promise<R>`.
  // The runtime Proxy accepts CallOpts as second arg (transparently overriding deadline metadata),
  // but the public TYPE still requires Metadata. Future foundation refinement may widen the typed
  // second-arg to `Metadata | CallOpts`. For the type probe today, omit the second arg.
  const _tokens: AuthProto.TokenPair = await auth.login(
    { email: '', password: '' } as AuthProto.LoginRequest,
  );
  void _tokens;
  void opts;

  // Promisified<T>: see comment above re: Metadata vs CallOpts asymmetry. Drop second arg.
  const _campaigns: SenderProto.CampaignList = await sender.listCampaigns(
    {} as SenderProto.ListCampaignsRequest,
  );
  void _campaigns;

  const _tasks: ParserProto.ParserTaskList = await parser.listTasks(
    {} as ParserProto.ListParserTasksRequest,
  );
  void _tasks;

  const _groups: AudienceProto.GroupList = await audience.listGroups(
    {} as AudienceProto.ListGroupsRequest,
  );
  void _groups;

  const _smoke: NotifierProto.StorageSmokeResponse = await notifier.runStorageSmoke(
    {} as CommonProto.Empty,
  );
  void _smoke;
}

// Negative compile cases — guarded with @ts-expect-error so tsc passes iff the error is real.
export function _probeNegative(audience: AudienceClient): void {
  // @ts-expect-error nonExistentMethod does not exist on AudienceClient (GRPC-01)
  audience.nonExistentMethod({});

  // @ts-expect-error listRecipients does not accept { wrongField } (GRPC-01)
  void audience.listRecipients({ wrongField: 1 });
}
