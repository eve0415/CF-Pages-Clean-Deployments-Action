import type { DeploymentState } from '@octokit/graphql-schema';
import type { RequestInit } from 'undici';
import type { Deployments } from './cloudflare';

import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { fetch } from 'undici';

(async () => {
  const apiToken = getInput('apiToken', { required: true });
  const accountId = getInput('accountId', { required: true });
  const projectName = getInput('projectName', { required: true });
  const githubToken = getInput('gitHubToken', { required: true });

  const octokit = getOctokit(githubToken);
  const deployments = await octokit.graphql<{
    repository: {
      deployments: {
        edges: {
          node: {
            state: DeploymentState;
            commit: { id: string };
            ref: { name: string };
            statuses: { edges: { node: { environmentUrl: string } }[] };
          };
        }[];
      };
    };
  }>(
    `
query ($owner: String!, $repo: String!, $env: String!) {
  repository(owner: $owner, name: $repo) {
    deployments(environments: [$env], first: 100) {
      edges {
        node {
          state
          commit {
            id
          }
          ref {
            name
          }
          statuses(first: 1) {
            edges {
              node {
                environmentUrl
              }
            }
          }
        }
      }
    }
  }
}
`,
    { owner: context.repo.owner, repo: context.repo.repo, env: `${projectName} (Preview)` }
  );
  const deploymentUrls = deployments.repository.deployments.edges
    .filter(({ node }) => node.state === 'ACTIVE' && node.ref.name === context.ref)
    .filter(({ node }) => node.commit.id !== context.sha)
    .map(({ node }) => node.statuses.edges[0].node.environmentUrl);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  const headers: RequestInit = { headers: { Authorization: `Bearer ${apiToken}` } };

  const deploymentsResponse = await fetch(endpoint, headers)
    .then(res => (res.status === 200 ? res.json() : null))
    .then(data => (data ? (data as Deployments) : null));
  if (!deploymentsResponse) return setFailed('Failed to fetch deployments');

  const cfDeployments = deploymentsResponse.result
    .filter(d => !d.is_skipped)
    .filter(d => deploymentUrls.includes(d.url));

  await Promise.allSettled(
    cfDeployments.map(d => fetch(`${endpoint}/${d.id}`, { ...headers, method: 'DELETE' }))
  );
})().catch((err: Error) => {
  setFailed(err.message);
});
