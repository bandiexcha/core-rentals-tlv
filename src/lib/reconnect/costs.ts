import type { CampaignChannel, CampaignCostEstimate } from "@/lib/reconnect/types";
import { WHATSAPP_IL_MARKETING_USD } from "@/lib/reconnect/whatsapp";

/** Gmail SMTP has no per-message Meta fee; ISP limits still apply. */
const EMAIL_UNIT_USD = 0;

export function estimateCampaignCost(
  channel: CampaignChannel,
  recipientCount: number
): CampaignCostEstimate {
  if (channel === "email") {
    return {
      currency: "USD",
      unitEstimate: EMAIL_UNIT_USD,
      recipientCount,
      estimatedTotal: 0,
      note:
        "Email via Gmail/Resend has no WhatsApp-style per-message Meta fee. Resend may bill separately if on a paid plan; Gmail is subject to daily sending limits (~100–500/day for consumer accounts). Estimated Meta/WhatsApp cost: $0.",
      source: "provider-policy",
    };
  }

  const unit = WHATSAPP_IL_MARKETING_USD;
  return {
    currency: "USD",
    unitEstimate: unit,
    recipientCount,
    estimatedTotal: Math.round(unit * recipientCount * 10000) / 10000,
    note: `Estimated Meta Cloud API marketing template cost for Israel market (~$${unit}/delivered message as of published 2026 rate cards). Charged only on provider-confirmed delivery. Actual invoice may differ by destination country mix. Requires approved template + funded Meta billing.`,
    source: "meta-rate-card-israel-marketing-approx",
  };
}
