import { $ } from "bun";
import process from "process";

const args = process.argv.slice(2);

const VERSION_FLAGS = [
    "--major",
    "--minor",
    "--patch",
] as const;

type VersionType = typeof VERSION_FLAGS[number];

const versionType: VersionType =
    (args.find((arg) =>
        VERSION_FLAGS.includes(arg as VersionType)
    ) as VersionType | undefined) ?? "--patch";

const nonInteractive = args.includes("--non-interactive");

const MAIN_BRANCH = "main";

async function git(
    strings: TemplateStringsArray,
    ...values: string[]
): Promise<string> {
    return (await $(strings, ...values)).text().trim();
}

async function run(
    strings: TemplateStringsArray,
    ...values: string[]
): Promise<void> {
    await $(strings, ...values);
}

async function confirm(message: string): Promise<boolean> {
    if (nonInteractive) {
        return true;
    }

    const answer = prompt(`${message} [y/N]`);

    return answer?.trim().toLowerCase() === "y";
}

function calculateNextVersion(
    currentVersion: string,
    type: VersionType,
): string {
    const parts = currentVersion.split(".");

    if (parts.length !== 3) {
        throw new Error(
            `Invalid package version: ${currentVersion}`,
        );
    }

    const [major, minor, patch] = parts.map(Number);

    if (
        !Number.isInteger(major) ||
        !Number.isInteger(minor) ||
        !Number.isInteger(patch)
    ) {
        throw new Error(
            `Invalid package version: ${currentVersion}`,
        );
    }

    switch (type) {
        case "--major":
            return `${major + 1}.0.0`;

        case "--minor":
            return `${major}.${minor + 1}.0`;

        case "--patch":
            return `${major}.${minor}.${patch + 1}`;
    }
}

async function getPackageJson() {
    const file = Bun.file("./package.json");

    if (!(await file.exists())) {
        throw new Error("package.json not found.");
    }

    return await file.json();
}

async function updatePackageVersion(
    version: string,
): Promise<void> {
    const file = Bun.file("./package.json");
    const content = await file.text();

    const packageJson = JSON.parse(content);

    packageJson.version = version;

    await Bun.write(
        file,
        JSON.stringify(packageJson, null, 4) + "\n",
    );
}

async function ensureCleanWorkingTree(): Promise<void> {
    const status = await git`git status --porcelain`;

    if (status) {
        throw new Error(
            "Working tree is not clean. Commit or stash your changes first.",
        );
    }
}

async function getCurrentBranch(): Promise<string> {
    return await git`git branch --show-current`;
}

async function ensureMainBranch(): Promise<void> {
    const branch = await getCurrentBranch();

    if (branch !== MAIN_BRANCH) {
        throw new Error(
            `Expected branch "${MAIN_BRANCH}", currently on "${branch}".`,
        );
    }
}

async function mergeCurrentBranchIntoMain(
    sourceBranch: string,
): Promise<void> {
    console.log();
    console.log(`Merging ${sourceBranch} → ${MAIN_BRANCH}`);
    console.log();

    await run`git fetch origin`;

    console.log("Updating main...");
    await run`git checkout ${MAIN_BRANCH}`;
    await run`git pull --ff-only origin ${MAIN_BRANCH}`;

    console.log(`Merging ${sourceBranch}...`);

    try {
        await run`git merge ${sourceBranch}`;
    } catch {
        console.error();
        console.error("Merge failed.");
        console.error();
        console.error(
            "Resolve the merge conflict manually, then run the release again.",
        );
        console.error();

        process.exit(1);
    }
}

async function tagExists(tag: string): Promise<boolean> {
    const result = await $`git tag -l ${tag}`.text();

    return result.trim() === tag;
}

async function main() {
    console.log();
    console.log("HighTex Template Release");
    console.log("========================");
    console.log();

    const initialBranch = await getCurrentBranch();

    if (!initialBranch) {
        throw new Error(
            "Unable to determine current Git branch.",
        );
    }

    await ensureCleanWorkingTree();


    await run`git fetch origin --tags`;


    if (initialBranch !== MAIN_BRANCH) {
        console.log(`Current branch : ${initialBranch}`);
        console.log(`Release branch : ${MAIN_BRANCH}`);
        console.log();
        console.log(
            `This release will merge "${initialBranch}" into "${MAIN_BRANCH}".`,
        );
        console.log();
    }


    let packageJson = await getPackageJson();

    const currentVersion = packageJson.version;

    if (typeof currentVersion !== "string") {
        throw new Error(
            "package.json version must be a string.",
        );
    }

    let nextVersion = calculateNextVersion(
        currentVersion,
        versionType,
    );

    const tag = `v${nextVersion}`;

    console.log(`Current version : ${currentVersion}`);
    console.log(`Version bump    : ${versionType}`);
    console.log(`Next version    : ${nextVersion}`);
    console.log(`Git tag         : ${tag}`);
    console.log();


    if (await tagExists(tag)) {
        throw new Error(
            `Git tag "${tag}" already exists.`,
        );
    }


    const operation =
        initialBranch === MAIN_BRANCH
            ? `Release ${nextVersion} from main?`
            : `Merge ${initialBranch} into main and release ${nextVersion}?`;

    if (!(await confirm(operation))) {
        console.log();
        console.log("Release cancelled.");
        return;
    }


    if (initialBranch !== MAIN_BRANCH) {
        await mergeCurrentBranchIntoMain(initialBranch);


        packageJson = await getPackageJson();

        const mergedVersion = packageJson.version;

        if (typeof mergedVersion !== "string") {
            throw new Error(
                "package.json version must be a string.",
            );
        }

        nextVersion = calculateNextVersion(
            mergedVersion,
            versionType,
        );
    }

    await ensureMainBranch();
    await ensureCleanWorkingTree();

    const finalTag = `v${nextVersion}`;

  
    if (await tagExists(finalTag)) {
        throw new Error(
            `Git tag "${finalTag}" already exists.`,
        );
    }

    packageJson = await getPackageJson();

    const finalCurrentVersion = packageJson.version;

    console.log();
    console.log("Release");
    console.log("-------");
    console.log(`Branch  : main`);
    console.log(`Current : ${finalCurrentVersion}`);
    console.log(`Next    : ${nextVersion}`);
    console.log(`Tag     : ${finalTag}`);
    console.log();


    console.log("Updating package.json...");

    await updatePackageVersion(nextVersion);


    const changedFiles = await git`git status --porcelain`;

    if (!changedFiles) {
        throw new Error(
            "package.json was not changed.",
        );
    }


    console.log("Creating commit...");

    await run`git add package.json`;

    await run`git commit -m ${`chore: release ${nextVersion}`}`;

    console.log(`Creating tag ${finalTag}...`);

    await run`git tag -a ${finalTag} -m ${`Release ${nextVersion}`}`;

    console.log("Pushing main...");

    await run`git push origin ${MAIN_BRANCH}`;

 
    console.log(`Pushing ${finalTag}...`);

    await run`git push origin ${finalTag}`;

    console.log();
    console.log("Release completed.");
    console.log();
    console.log(`Version : ${nextVersion}`);
    console.log(`Tag     : ${finalTag}`);
    console.log();
}

main().catch((error) => {
    console.error();
    console.error("Release failed.");
    console.error();

    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error(error);
    }

    process.exit(1);
});