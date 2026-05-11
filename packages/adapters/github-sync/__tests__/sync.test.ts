import { GitHubSyncAdapter } from "../src/index.js";
import { GitHubService, GitHubIssue } from "../src/githubService.js";
import { vi, describe, it, expect } from 'vitest';

describe("GitHubSyncAdapter", () => {
  it("should sync issues with label public:share", async () => {
    const mockService = {
      getIssuesWithLabel: vi.fn().mockResolvedValue([{ title: 'Test Issue', labels: [{ name: 'public:share' }] }]),
      createIssue: vi.fn()
    } as unknown as GitHubService;

    const adapter = new GitHubSyncAdapter(mockService);
    await adapter.sync();
    
    expect(mockService.getIssuesWithLabel).toHaveBeenCalledWith('public:share');
  });
});
