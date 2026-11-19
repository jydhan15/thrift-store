const AIProvider = require("./AIProvider");
class OpenAIProvider extends AIProvider {
  async generateJson(systemPrompt, userPayload) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPayload }] }),
    });
    if (!res.ok) throw new Error("provider status " + res.status);
    return JSON.parse((await res.json()).choices[0].message.content);
  }
}
module.exports = OpenAIProvider;
