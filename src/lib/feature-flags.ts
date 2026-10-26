/**
 * Feature flags for risky CRM / Orchestra surfaces.
 * Defaults keep the public inquiry journey unchanged when unset.
 */
export const FEATURE_FLAGS = {
  /** Persist full CRM lead records alongside legacy inquiry storage. */
  durableLeads:
    process.env.FEATURE_DURABLE_LEADS !== "0" &&
    process.env.FEATURE_DURABLE_LEADS !== "false",

  /** Expose /admin/crm when password is also configured. */
  crmAdmin:
    process.env.FEATURE_CRM_ADMIN !== "0" &&
    process.env.FEATURE_CRM_ADMIN !== "false",

  /** Enable /api/orchestra/* when ORCHESTRA_API_KEY is set. */
  orchestraApi:
    process.env.FEATURE_ORCHESTRA_API !== "0" &&
    process.env.FEATURE_ORCHESTRA_API !== "false",

  /** Campaign landing pages (always on in build; flag for soft disable). */
  campaignPages:
    process.env.FEATURE_CAMPAIGN_PAGES !== "0" &&
    process.env.FEATURE_CAMPAIGN_PAGES !== "false",
} as const;
