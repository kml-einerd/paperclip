export interface GitHubIssue {
  id: number;
  title: string;
  body: string;
  labels: { name: string }[];
  html_url: string;
}

export class GitHubService {
  constructor(private token: string, private repo: string) {}

  async getIssuesWithLabel(label: string): Promise<GitHubIssue[]> {
    // Implement using 'gh api' or octokit
    return [];
  }

  async createIssue(title: string, body: string, labels: string[]): Promise<GitHubIssue> {
    // Implement creation
    return {} as GitHubIssue;
  }
}
