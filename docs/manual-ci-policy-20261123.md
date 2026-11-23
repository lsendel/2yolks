# Manual CI proposal, not activated

This draft changes only ci.yml from automatic push/pull_request triggers to workflow_dispatch. Job commands and ubuntu-latest runner selection are unchanged. A manual run can still consume GitHub-hosted credits; no dispatch is approved or performed by this PR. A no-credit runner route must be separately verified before running it.

The policy commit carries GitHub's documented [skip ci] marker so push/pull_request checks do not start while proposing this change. A pending required check is not a pass and must not be bypassed.

No pull_request_target or workflow_run trigger exists in the inspected main. deploy.yml is unchanged: a push to main can still start deployment. Merging this policy needs a separate approval including that consequence. No backend code is included or pushed here. No merge, dispatch or deploy.
