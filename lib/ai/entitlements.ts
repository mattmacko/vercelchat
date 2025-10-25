import type { UserType } from "@/app/(auth)/auth";
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
    maxLifetimeMessages: 5,
    availableChatModelIds: defaultChatModels,
  },

  /*
   * For users with an account
   */
  regular: {
    maxLifetimeMessages: 5,
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
