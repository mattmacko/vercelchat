import { expect, test } from "../fixtures";
import { ArtifactPage } from "../pages/artifact";
import { ChatPage } from "../pages/chat";

function expectDefined<T>(
  value: T | null | undefined,
  entity = "value"
): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${entity} to be defined`);
  }
}

test.describe("Artifacts activity", () => {
  let chatPage: ChatPage;
  let artifactPage: ArtifactPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    artifactPage = new ArtifactPage(page);

    await chatPage.createNewChat();
  });

  test("Create a text artifact", async () => {
    test.fixme();
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    expect(artifactPage.artifact).toBeVisible();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    expect(assistantMessage.content).toBe(
      "A document was created and is now visible to the user."
    );

    await chatPage.hasChatIdInUrl();
  });

  test("Toggle artifact visibility", async () => {
    test.fixme();
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    expect(artifactPage.artifact).toBeVisible();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    expect(assistantMessage.content).toBe(
      "A document was created and is now visible to the user."
    );

    await artifactPage.closeArtifact();
    await chatPage.isElementNotVisible("artifact");
  });

  test("Send follow up message after generation", async () => {
    test.fixme();
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    expect(artifactPage.artifact).toBeVisible();

    const assistantMessage = await artifactPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    expect(assistantMessage.content).toBe(
      "A document was created and is now visible to the user."
    );

    await artifactPage.sendUserMessage("Thanks!");
    await artifactPage.isGenerationComplete();

    const secondAssistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(secondAssistantMessage, "second assistant message");
    expect(secondAssistantMessage.content).toBe("You're welcome!");
  });
});
