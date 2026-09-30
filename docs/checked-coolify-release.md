# Checked Coolify release adoption

This release path deploys a successful default-branch push from `CI Build`, pins its full SHA in Coolify, waits for that specific deployment to finish, checks its revision and probes public database readiness. PR CI and manually dispatched CI cannot trigger production. Superseded default-branch revisions are skipped. It supports the current `master` branch; when standardizing on `main`, update CI's push branch and repository integrations together.

It is inactive until repository variable `COOLIFY_RELEASE_ENABLED=true`. Do not enable that variable until all of the following are verified:

1. Adopt the actual serving application in Coolify with its existing database, uploads volume, environment and routing preserved. The September 30 audit found a healthy legacy container without a matching current resource and a separate exited resource with failed deployments. Existing secret names do not prove their values point to the serving resource.
2. Verify `COOLIFY_URL`, `COOLIFY_TOKEN` and `COOLIFY_APP_UUID` against the correct adopted resource. Keep credentials private. Use a trusted HTTPS origin, without `/api/v1` in the URL. The release script validates repository, branch, Dockerfile build pack and `https://sealsend.app` before writing anything.
3. Disable the adopted resource's direct Git auto-deploy and previews. Keep the old manual deploy and build/push workflows disabled. This workflow must own production deployment.
4. Create a fresh database backup, preserve uploads and a matching immutable rollback image, and verify recovery on isolated resources. Preserve the application's test-only payment/communication flags and cleanup gates.
5. Enable source-commit inclusion in Coolify. The image accepts `SOURCE_COMMIT` and health reports only a valid full SHA, or null when unavailable. Rehearse release polling against the installed Coolify version; the release script requires both the completed deployment and public health to report the verified SHA. This is not proof of authenticated workflows or provider delivery.
6. Protect the default branch with appropriate required CI checks. Direct default-branch pushes also fire CI; enforcing merges requires branch protection.
7. Enable the adoption variable only after the resource is verified. A subsequent checked code merge can exercise the full automatic release path. Documentation-only changes can be excluded by the existing CI path filters.

The first iteration builds the verified SHA through Coolify's Dockerfile build pack. It does not claim byte-identical promotion of a CI-built image. Moving builds to GHCR and promoting immutable image digests is a follow-up that must preserve public build-time configuration and registry access.

On failure, do not rerun blindly or reset data. Inspect the returned deployment and record whether the prior image remains healthy. Restore the previous immutable image and source pin through the verified rollback procedure if required. The script does not reverse migrations or automatically restore a database.

Local validation: `node --test tests/coolify-release.test.mjs`. These tests mock the API and never contact production.
