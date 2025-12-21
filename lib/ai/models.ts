export const DEFAULT_CHAT_MODEL: string = "mistral/mistral-large-3";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "mistral/mistral-large-3",
    name: "Uncensored",
    description: "Maximally uncensored and truth seeking",
  },
];
