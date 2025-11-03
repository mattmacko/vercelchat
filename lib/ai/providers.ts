import { gateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "mistral/mistral-medium": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "mistral/mistral-medium": gateway.languageModel(
          "mistral/mistral-medium"
        ),
        "title-model": gateway.languageModel("mistral/mistral-medium"),
        "artifact-model": gateway.languageModel("mistral/mistral-medium"),
      },
    });
