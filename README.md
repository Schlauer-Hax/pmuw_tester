# pmuw_tester

This is a small program to test if your group project for PMUW (a uni project)
is getting max points.

## Usage

1. Clone the repository.
2. Create a `.env` file in the root directory with your GitLab token
   ```
   GITLAB_TOKEN=your_token_here
   ```
3. deno run --allow-env --allow-net index.ts <project_name>
   - If you want to check all projects, just run
     `deno run --allow-env --allow-net index.ts`
   - If you want to check a specific project, replace `<project_name>` with the
     name of the project you want to check.
4. The program will output the results of the checks.

```
Checking project <redactedname> (<redactedid>)
Checking <redactedfdnumber>, Schlauer-Hax (23 commits)
❌ Has 50 commits (23/50)
✅ Has own > max(commits)/2 (23/17.5)
❌ Has 20% refactoring commits (1/4.6000000000000005)
✅ Has 20% test commits (6/4.6000000000000005)
✅ Has CI status for 30% of commits (23/6.8999999999999995)
❌ Has 2 merge commits (0/2)
```

## Requirements
- Deno
- GitLab token with read access to the group projects
- The projects must be in a group named "projects" (you can change this in the code if needed)

