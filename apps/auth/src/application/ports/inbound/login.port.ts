export interface LoginPort {
  execute(email: string, password: string): Promise<LoginResult>;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}
