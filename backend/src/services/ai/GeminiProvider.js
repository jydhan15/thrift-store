const AIProvider = require("./AIProvider");
class GeminiProvider extends AIProvider {
  async generateJson(systemPrompt, userPayload) {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    const res = await fetch(url, {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPayload }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 600, temperature: 0.3 },
      }),
    });
    if (!res.ok) throw new Error("provider status " + res.status);
    const j = await res.json();
    return JSON.parse(j.candidates[0].content.parts[0].text);
  }
}
module.exports = GeminiProvider;
