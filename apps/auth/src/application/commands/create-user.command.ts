export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly role: string,
    public readonly organization: string,
    public readonly team: string,
  ) {}
}
