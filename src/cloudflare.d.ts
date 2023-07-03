/**
 * @see https://developers.cloudflare.com/api/operations/pages-deployment-get-deployments
 */
export interface Deployments {
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: Deployment[];
  success: boolean;
  result_info: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
}

export interface Deployment {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: 'preview' | 'production';
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage: Stage;
  deployment_trigger: {
    type: 'ad_hoc';
    metadata: {
      branch: string;
      commit_hash: string;
      commit_message: string;

      commit_dirty: boolean;
    };
  };
  stages: Stage[];
  build_config: {
    build_command: string;
    destination_dir: string;
    root_dir: string;
    web_analytics_tag: null;
    web_analytics_token: null;
  } | null;
  source: {
    type: string | 'github';
    config: {
      owner: string;
      repo_name: string;
      production_branch: string;
      pr_comment_enabled: boolean;
    };
  } | null;
  env_vars: Record<string, string>;
  compatibility_flags: unknown[];
  build_image_major_version: number;
  usage_model: null;
  aliases: string[];
  is_skipped: boolean;
  production_branch: string;
}

interface Stage {
  name: 'build' | 'clone_repo' | 'deploy' | 'initialize' | 'queued';
  started_on: string | null;
  ended_on: string | null;
  status: 'active' | 'idle' | 'success';
}
