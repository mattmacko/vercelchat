import useSWR from "swr";
import type { BillingLimitsResponse } from "@/lib/billing/config";
import { fetcher } from "@/lib/utils";

export function useBillingLimits() {
  return useSWR<BillingLimitsResponse>("/api/billing/limits", fetcher, {
    revalidateOnFocus: true,
  });
}
