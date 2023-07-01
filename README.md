# CF-Pages-Clean-Deployments-Action

GitHub Action to delete Cloudflare Pages deployment which are preview. Also mark GitHub Deployments as `INACTIVE`.

## Usage

This action is mostly meant to be used with [Cloudflare Pages GitHub Action](https://github.com/cloudflare/pages-action).

Example:

```yml
on: 
  push:
  delete:

permissions:
  contents: read
  deployments: write

jobs:
  publish:
    runs-on: ubuntu-latest
    name: Publish to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      # Run a build step here if your project requires

      - name: Publish to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: YOUR_ACCOUNT_ID
          projectName: YOUR_PROJECT_NAME
          directory: YOUR_BUILD_OUTPUT_DIRECTORY
          # Optional: Enable this if you want to have GitHub Deployments triggered
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          # Optional: Switch what branch you are publishing to.
          # By default this will be the branch which triggered this workflow
          branch: main
          # Optional: Change the working directory
          workingDirectory: my-site
          # Optional: Change the Wrangler version, allows you to point to a specific version or a tag such as `beta`
          wranglerVersion: '3'

  clean:
    runs-on: ubuntu-latest
    name: Clean up deployments
    steps:
      - name: Publish to Cloudflare Pages
        uses: eve0415/cf-pages-clean-deployments-action@v0
        with:
          # Copy paste from the previous step (cloudflare/pages-action@v1)
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: YOUR_ACCOUNT_ID
          projectName: YOUR_PROJECT_NAME
```

### How to get necessary information

Please read [Get account ID](https://github.com/cloudflare/pages-action#get-account-id) and [Generate an API Token](https://github.com/cloudflare/pages-action#generate-an-api-token) for more information.
