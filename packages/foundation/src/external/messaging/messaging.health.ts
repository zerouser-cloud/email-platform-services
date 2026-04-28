import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { HEALTH } from '../health/health-constants';
import type { MessagingHealthIndicator as MessagingHealthIndicatorPort } from './messaging.interfaces';

/**
 * MessagingHealthIndicator — STUB body retained verbatim from the previous
 * tech-named class at `external/health/indicators/rabbitmq.health.ts`
 * (Phase 999.12.1 D-08 promotion to Symbol-DI under the canonical layer-name
 * axis). Body returns up({ message: HEALTH.STUB_MESSAGE }) because no
 * AMQP/amqplib client is wired yet — Phase 999.13 replaces the body with a
 * real PING (channel status check) per D-09 messaging convention lock.
 *
 * Class name + interface name intentionally identical (CONTEXT.md D-08 + RESEARCH
 * §"Open Question 3"): the interface lives in `messaging.interfaces.ts` and the
 * class in `messaging.health.ts`; TypeScript resolves them by file path. The
 * `MessagingHealthIndicatorPort` import alias above disambiguates inside this
 * file. The barrel re-exports the interface as a type-only export and the class
 * as a value (Symbol-DI provider binds the class via `useExisting`).
 */
@Injectable()
export class MessagingHealthIndicator implements MessagingHealthIndicatorPort {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    return indicator.up({ message: HEALTH.STUB_MESSAGE });
  }
}
