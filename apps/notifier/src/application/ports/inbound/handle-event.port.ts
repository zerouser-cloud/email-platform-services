export interface HandleEventPort {
  execute(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
