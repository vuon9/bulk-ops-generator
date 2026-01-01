# Releasing a New Version

This document outlines the process for releasing a new version of the Bulk Ops Generator.

## Creating a Release

1.  **Trigger the Release Workflow:**
    *   Navigate to the "Actions" tab in the GitHub repository.
    *   Select the "Release and Publish" workflow from the list.
    *   Click the "Run workflow" button, and then click the green "Run workflow" button in the dropdown. This will trigger the `release-please` action.

2.  **Review the Release Pull Request:**
    *   The `release-please` action will create a new pull request with a generated changelog and a new version number.
    *   Review the pull request to ensure the changelog is accurate and the version number is correct.
    *   If you need to change the version number, you can edit the title of the pull request. For example, to change a `patch` release to a `minor` release, change the version in the title from `1.2.4` to `1.3.0`.
    *   You can also edit the body of the pull request to amend the changelog.

3.  **Merge the Pull Request:**
    *   Once you are satisfied with the release pull request, merge it into the `main` branch.

## Publishing the Extension

1.  **Approve the Publish Job:**
    *   After the release pull request is merged, the `publish` job in the "Release and Publish" workflow will be triggered.
    *   This job requires manual approval. You will receive a notification to approve the job.
    *   Navigate to the workflow run for the release, and you will see a "Waiting for approval" status for the `publish` job.
    *   Click the "Review deployments" button and then "Approve and deploy" to publish the new version to the VSCode Marketplace.

2.  **(Placeholder) Publish to Open VSX Marketplace:**
    *   The workflow includes a placeholder step for publishing to the Open VSX Marketplace. This step is not yet implemented and will be skipped.
