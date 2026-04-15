const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

exports.askClaude = onCall({ secrets: [anthropicKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in to use Ask AI.");
  }

  const { messages, systemContext } = request.data;

  if (!Array.isArray(messages) || !systemContext) {
    throw new HttpsError("invalid-argument", "messages and systemContext are required.");
  }

  const client = new Anthropic({ apiKey: anthropicKey.value() });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemContext,
    messages,
  });

  return { content: response.content[0].text };
});
