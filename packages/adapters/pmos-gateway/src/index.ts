export const type = "pmos_gateway";
export const label = "PM-OS Gateway";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# pmos_gateway agent configuration

Adapter: pmos_gateway

Use when:
- You want Paperclip to delegate complex/repetitive tasks to PM-OS recipes.
- You need deterministic DAG-based parallel execution with quality gates.
- Processing audio transcription, batch content, multi-step workflows.

Don't use when:
- The task is exploratory / creative (use claude_local or gemini_local).
- The task is a simple one-shot question (use a coding agent directly).

Core fields:
- url (string, required): PM-OS API base URL (e.g. http://localhost:8080)
- apiKey (string, required): PM-OS API key (X-Api-Key header)
- paperclipApiUrl (string, optional): Paperclip API URL for issue metadata lookup

Routing (how the adapter picks what to execute):
1. issue.metadata.recipe + issue.metadata.params (per-issue routing via Paperclip)
2. adapterConfig.recipe + adapterConfig.params (per-agent default recipe)
3. adapterConfig.intent OR adapterConfig.promptTemplate (Morgan ad-hoc planning)

The adapter polls PM-OS run status every 2s until completion or failure.
`;
