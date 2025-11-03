export const DEFAULT_CHAT_MODEL: string = "mistral/mistral-medium";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "mistral/mistral-medium",
    name: "Uncensored",
    description: "Maximally uncensored and truth seeking",
  },
];
