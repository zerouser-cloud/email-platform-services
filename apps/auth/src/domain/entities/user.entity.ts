export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly role: string,
    public readonly organization: string,
    public readonly team: string,
  ) {}
}
