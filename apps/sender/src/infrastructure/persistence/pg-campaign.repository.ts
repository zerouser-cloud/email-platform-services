import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { CampaignRepositoryPort } from '../../application/ports/outbound/campaign-repository.port';
import type { Campaign } from '../../domain/entities/campaign.entity';
import { campaigns } from './schema/campaigns.schema';
import { CampaignMapper } from './campaign.mapper';

@Injectable()
export class PgCampaignRepository implements CampaignRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async findById(id: string): Promise<Campaign | null> {
    const rows = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return CampaignMapper.toDomain(row);
  }

  async save(campaign: Campaign): Promise<void> {
    await this.db
      .insert(campaigns)
      .values(CampaignMapper.toPersistence(campaign))
      .onConflictDoUpdate({
        target: campaigns.id,
        set: {
          name: campaign.name,
          status: campaign.status,
          updatedAt: new Date(),
        },
      });
  }
}
