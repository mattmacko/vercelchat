import type { UserType } from "@/app/(auth)/auth";
import { FREE_LIFETIME_MESSAGE_LIMIT } from "@/lib/billing/config";
import type { ChatModel } from "./models";

type Entitlements = {
  maxLifetimeMessages: number | null;
  availableChatModelIds: ChatModel["id"][];
};

const defaultChatModels: ChatModel["id"][] = [
  "chat-model",
  "chat-model-reasoning",
];

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxLifetimeMessages: FREE_LIFETIME_MESSAGE_LIMIT,
    availableChatModelIds: defaultChatModels,
  },

  /*
   * For users with an account
   */
  regular: {
    maxLifetimeMessages: FREE_LIFETIME_MESSAGE_LIMIT,
    availableChatModelIds: defaultChatModels,
  },

  /*
   * For users with an account and a paid membership
   */
  pro: {
    maxLifetimeMessages: null,
    availableChatModelIds: defaultChatModels,
  },
};
