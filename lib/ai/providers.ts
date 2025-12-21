import { gateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const { artifactModel, chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "mistral/mistral-large-3": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "mistral/mistral-large-3": gateway.languageModel(
          "mistral/mistral-large-3"
        ),
        "title-model": gateway.languageModel("mistral/mistral-large-3"),
        "artifact-model": gateway.languageModel("mistral/mistral-large-3"),
      },
    });
