import { GitHubService } from "./githubService.js";

export class GitHubSyncAdapter {
  constructor(private githubService: GitHubService) {}

  async sync() {
    const issues = await this.githubService.getIssuesWithLabel('public:share');
    for (const issue of issues) {
      // Sync logic to Paperclip (or vice versa)
      console.log(`Syncing ${issue.title}`);
    }
  }
}
