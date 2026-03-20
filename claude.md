@AGENTS.md
# Claude Code Instructions

## Before Starting Any Task
- Checkout main: `git checkout main`
- Pull latest: `git pull origin main`
- Create a fresh branch: `git checkout -b <type>/<short-description>`
- Branch naming: feat/, fix/, chore/, docs/
- Never commit directly to main or master
- Never start work on a stale branch

## During Task
- Commit after every meaningful change immediately
- Stage changes: `git add -A`
- Commit with a clear message: `git commit -m "<type>: <description>"`
- Push commits right away: `git push -u origin <branch-name>`
- Never leave work uncommitted

## After Task is Complete
- Run tests before creating PR
- Open a pull request: `gh pr create --title "<type>: <description>" --body "<what changed and why>"`
- Confirm the PR URL was created before finishing

## After PR is Merged
- Switch to main: `git checkout main`
- Pull latest: `git pull origin main`
- Delete stale branch: `git branch -d <branch-name>`
- Confirm clean state with `git status` before doing anything else

## Autonomy
- Do not ask for confirmation on routine git operations
- Do not pause for approval on branch creation, commits, pushes, or PRs
- Only stop and ask if something is ambiguous or destructive
