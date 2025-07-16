import { CommitSchema, Gitlab, CommitStatusSchema } from 'https://esm.sh/@gitbeaker/rest?dts';

import "jsr:@std/dotenv/load";

function booleanMessage(message: string, value: boolean): string {
    return value ? `✅ ${message}` : `❌ ${message}`;
}

function greaterMessage(message: string, value: number, threshold: number) {
    return booleanMessage(`${message} (${value}/${threshold})`, value >= threshold);
}

function b64DecodeUnicode(str: string) {
    return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

const projectName = Deno.args[ 0 ];
const paranoidMode = Deno.args[ 1 ];
if (paranoidMode) {
    console.log("Running in Paranoid Mode. Only considering commits with all success.")
}

const token = Deno.env.get('GITLAB_TOKEN');
if (!token) {
    throw new Error('GITLAB_TOKEN is not set in the environment variables');
}
const api = new Gitlab({
    token: token,
    host: "https://git-ce.rwth-aachen.de/"
});

const allgroups = await api.Groups.all({ search: "hs-fulda-programmiermethoden_und_werkzeuge" });
const projectsGroup = allgroups.find(group => group.path === "projects");
if (!projectsGroup) {
    throw new Error('Group "projects" not found');
}
const projects = await api.Groups.allProjects(projectsGroup.id);
const filteredProjects = projects.filter(p => projectName ? p.name.includes(projectName) : true);

for (const project of filteredProjects) {
    console.log(`\n\nChecking project ${project.name} (${project.id})`);
    try {
        const teamFile = await api.RepositoryFiles.show(project.id, "team.csv", project.default_branch);

        const team: Record<string, string> = Object.fromEntries(b64DecodeUnicode(teamFile.content).split('\n').map(line => line.split(',').map(x => x.trim())));

        const commits = await api.Commits.all(project.id, { refName: project.default_branch });
        if (!commits || commits.length === 0) {
            console.log("❌ No commits found");
            continue;
        }
        const firstCommitDiff = await api.Commits.showDiff(project.id, commits.filter(c => Object.keys(team).includes(c.author_name)).at(-1)!.id);
        console.log(booleanMessage("First commit was .gitlab-ci.yml", firstCommitDiff.some(diff => diff.new_path === ".gitlab-ci.yml")));

        const commitsPerMember = Object.groupBy(commits, c => team[ c.author_name ]);
        for (const [ member, memberCommits ] of Object.entries(commitsPerMember)) {
            if (member === "undefined") {
                console.log("❌ No member found for commit author", memberCommits![ 0 ].author_name);
                continue;
            }
            if (!memberCommits || memberCommits.length === 0) {
                console.log(`❌ No commits found for ${member}`);
                continue;
            }
            console.log(`Checking ${member}, ${memberCommits[ 0 ].author_name} (${memberCommits.length} commits)`);
            let withoutMergeCommits = memberCommits.filter(c => c.parent_ids?.length === 1);

            const commitStatuses: { commit: CommitSchema, statuses: | CommitStatusSchema[] }[] = []
            for (const commit of withoutMergeCommits) {
                const statuses = await api.Commits.allStatuses(project.id, commit.id);
                commitStatuses.push({ commit, statuses })
            }
            console.log(greaterMessage(`Has CI status for 30% of commits`, commitStatuses.filter(x => x.statuses.length > 0).length, withoutMergeCommits.length * 0.3))
            const successCommits = commitStatuses.filter(x => x.statuses.length > 0 && x.statuses.every(y => y.status === 'success'))
            console.log(greaterMessage(`Has success CI status for 50 commits`, successCommits.length, 50))
            if (paranoidMode) {
                withoutMergeCommits = successCommits.map(x => x.commit);
            }
            console.log(greaterMessage(`Has 50 commits`, withoutMergeCommits?.length, 50));
            const maxCommits = (Math.max(...Object.values(commitsPerMember).map(c => c?.length ?? 0)) / 2);
            console.log(greaterMessage(`Has own > max(commits)/2`, withoutMergeCommits.length, maxCommits));
            const refactoringCommits = withoutMergeCommits.filter(c => c.title.toLowerCase().includes("refactoring: ")).length;
            console.log(greaterMessage(`Has 20% refactoring commits`, refactoringCommits, withoutMergeCommits.length * 0.2));

            let testCommits = 0;
            for (const commit of withoutMergeCommits) {
                if (!commit.title.includes("refactoring: ")) {
                    const diff = await api.Commits.showDiff(project.id, commit.id);
                    if (diff.some(d => d.new_path.match(/(test_.*\..*)|(.*Test.*)/))) {
                        testCommits++;
                    }
                }
            }
            console.log(greaterMessage(`Has 20% test commits`, testCommits, withoutMergeCommits.length * 0.2));

            const mergeCommits = memberCommits.filter(c => (c.parent_ids?.length ?? 0) > 1);
            console.log(greaterMessage(`Has 2 merge commits`, mergeCommits.length, 2));

            console.log();
        }
    } catch (error) {
        console.error(`❌ Error checking project ${project.name} (${project.id}):`, error);
    }
}
Deno.exit(0);