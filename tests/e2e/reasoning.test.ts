import { expect, test } from "../fixtures";
import { ChatPage } from "../pages/chat";

function expectDefined<T>(
  value: T | null | undefined,
  entity = "value"
): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${entity} to be defined`);
  }
}

test.describe("chat activity without reasoning", () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ curieContext }) => {
    chatPage = new ChatPage(curieContext.page);
    await chatPage.createNewChat();
  });

  test("Curie can send message and generate response", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    expect(assistantMessage.content).toBe("It's just blue duh!");
    expect(assistantMessage.reasoning).toBeNull();
    await expect(
      assistantMessage.element.getByTestId("message-reasoning")
    ).not.toBeVisible();
  });

  test("Curie does not see reasoning controls", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    await expect(
      assistantMessage.element.getByTestId("message-reasoning")
    ).not.toBeVisible();
    await expect(
      assistantMessage.element.getByTestId("message-reasoning-toggle")
    ).not.toBeVisible();
  });

  test("Curie can edit message and resubmit", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(assistantMessage, "assistant message");
    await expect(
      assistantMessage.element.getByTestId("message-reasoning")
    ).not.toBeVisible();

    const userMessage = await chatPage.getRecentUserMessage();

    await userMessage.edit("Why is grass green?");
    await chatPage.isGenerationComplete();

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    expectDefined(updatedAssistantMessage, "updated assistant message");

    expect(updatedAssistantMessage.content).toBe("It's just green duh!");
    expect(updatedAssistantMessage.reasoning).toBeNull();
    await expect(
      updatedAssistantMessage.element.getByTestId("message-reasoning")
    ).not.toBeVisible();
  });
});
