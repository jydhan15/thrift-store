class AIProvider {
  constructor() { if (new.target === AIProvider) throw new Error("AIProvider is abstract"); }
  async generateJson(systemPrompt, userPayload) { throw new Error("not implemented"); } // -> parsed object
}
module.exports = AIProvider;
