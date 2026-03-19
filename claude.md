@AGENTS.md
# Claude Code Instructions

## Git Workflow (Always Follow This)
- Never commit directly to main or master
- Create a feature branch before making changes
- Branch naming: feat/, fix/, chore/, docs/
- After completing any task:
  1. Stage changes: `git add -A`
  2. Commit with a clear message: `git commit -m "<type>: <description>"`
  3. Push the branch: `git push -u origin <branch-name>`
  4. Open a pull request: `gh pr create --title "<type>: <description>" --body "<what changed and why>"`
- Confirm the PR URL was created before finishing


