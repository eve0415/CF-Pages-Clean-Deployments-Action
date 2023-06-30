import type { DeploymentState } from '@octokit/graphql-schema';
import type { RequestInit } from 'undici';
import type { Deployments } from './cloudflare';

import { env } from 'process';
import { inspect } from 'util';

import { debug, getInput, info, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { fetch } from 'undici';

(async () => {
  const apiToken = getInput('apiToken', { required: true });
  const accountId = getInput('accountId', { required: true });
  const projectName = getInput('projectName', { required: true });
  const githubToken = getInput('gitHubToken', { required: true });
  const githubBranch = env.GITHUB_HEAD_REF ?? env.GITHUB_REF_NAME ?? context.ref;

  const octokit = getOctokit(githubToken);
  const deployments = await octokit.graphql<{
    repository: {
      deployments: {
        edges: {
          node: {
            id: string;
            state: DeploymentState;
            commit: { id: string };
            ref: { name: string };
            statuses: { edges: { node: { environmentUrl: string; logUrl: string } }[] };
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
          id
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
                logUrl
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
    .filter(({ node }) => node.state === 'ACTIVE' && node.ref.name === githubBranch)
    .filter(({ node }) => node.commit.id !== context.sha)
    .map(({ node }) => node.statuses.edges[0].node.environmentUrl);
  if (!deploymentUrls.length) return info('No deployments found');
  debug(`Found deployments: ${deploymentUrls.join(', ')}`);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  const headers: RequestInit = { headers: { Authorization: `Bearer ${apiToken}` } };

  const deploymentsResponse = await fetch(endpoint, headers)
    .then(res => (res.status === 200 ? res.json() : null))
    .then(data => (data ? (data as Deployments) : null));
  if (!deploymentsResponse) return setFailed('Failed to fetch deployments');

  const cfDeployments = deploymentsResponse.result
    .filter(d => !d.is_skipped)
    .filter(d => deploymentUrls.includes(d.url));
  if (!cfDeployments.length) return info('No deployments to delete');
  debug(`Found Cloudflare deployments: ${cfDeployments.map(d => d.url).join(', ')}`);

  for await (const d of cfDeployments) {
    info(`Deleting deployment ${d.url}`);
    const res = await fetch(`${endpoint}/${d.id}/preview`, { ...headers, method: 'DELETE' });
    if (res.status === 200) {
      const deployment = deployments.repository.deployments.edges.find(
        ({ node }) => node.statuses.edges[0].node.environmentUrl === d.url
      );
      if (deployment) {
        await octokit.graphql(
          `
mutation ($id: ID!, $environmentUrl: URI!, $logUrl: URI!) {
  createDeploymentStatus(
    id: $id
    environmentUrl: $environmentUrl
    logUrl: $logUrl
    state: "INACTIVE"
  )
}
          `,
          {
            id: deployment.node.id,
            environmentUrl: d.url,
            logUrl: deployment.node.statuses.edges[0].node.logUrl,
            headers: { accept: 'application/vnd.github.flash-preview+json' },
          }
        );
      }
    }
  }

  await Promise.allSettled(
    cfDeployments.map(d => fetch(`${endpoint}/${d.id}`, { ...headers, method: 'DELETE' }))
  );
})().catch((err: Error) => {
  setFailed(err.message);
});
