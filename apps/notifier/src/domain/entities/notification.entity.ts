export class Notification {
  constructor(
    public readonly id: string,
    public readonly eventType: string,
    public readonly payload: string,
    public readonly sentAt: Date | null,
  ) {}
}
