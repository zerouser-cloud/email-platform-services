export interface StartParsingPort {
  execute(category: string): Promise<StartParsingResult>;
}

export interface StartParsingResult {
  id: string;
  status: string;
}
