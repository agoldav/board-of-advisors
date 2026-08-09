/** What an advisor is allowed to reason from. */
export type AdvisorScope =
  | "financial_statements"
  | "business_profile"
  | "contracts"
  | "hr"
  | "marketing";

/**
 * Advisor configuration (D-034): shared board framing lives in the profile
 * prefix; only the per-advisor delta lives here. `version` is stored on every
 * recommendation the advisor produces (D-035), so bump it on every edit.
 */
export interface AdvisorConfig {
  id: string;
  version: string;
  name: string;
  expertise: string;
  can_see: AdvisorScope[];
  not_my_job: string[];
  persona: string;
}
