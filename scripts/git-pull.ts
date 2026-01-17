import { getUncachableGitHubClient } from '../server/lib/github';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'medassist-app';

async function main() {
  const branch = process.argv[2] || 'main';
  
  console.log(`\n📥 Pulling latest from GitHub (${branch} branch)...\n`);

  const octokit = await getUncachableGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✅ Authenticated as: ${user.login}\n`);

  const { data: ref } = await octokit.git.getRef({
    owner: user.login,
    repo: REPO_NAME,
    ref: `heads/${branch}`,
  });

  console.log(`📌 Latest commit on ${branch}: ${ref.object.sha}\n`);

  const { data: commit } = await octokit.git.getCommit({
    owner: user.login,
    repo: REPO_NAME,
    commit_sha: ref.object.sha,
  });

  console.log(`📝 Commit message: ${commit.message}`);
  console.log(`👤 Author: ${commit.author.name}`);
  console.log(`📅 Date: ${commit.author.date}\n`);

  const { data: tree } = await octokit.git.getTree({
    owner: user.login,
    repo: REPO_NAME,
    tree_sha: commit.tree.sha,
    recursive: 'true',
  });

  console.log(`📂 Downloading ${tree.tree.length} files...\n`);

  let downloaded = 0;
  let skipped = 0;

  for (const item of tree.tree) {
    if (item.type !== 'blob' || !item.path) continue;

    if (item.path.startsWith('scripts/')) {
      skipped++;
      continue;
    }

    try {
      const { data: blob } = await octokit.git.getBlob({
        owner: user.login,
        repo: REPO_NAME,
        file_sha: item.sha!,
      });

      const content = Buffer.from(blob.content, 'base64');
      const filePath = path.join(process.cwd(), item.path);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content);
      downloaded++;

      if (downloaded % 10 === 0) {
        console.log(`   Downloaded ${downloaded} files...`);
      }
    } catch (error) {
      console.log(`   ⚠️ Could not download: ${item.path}`);
    }
  }

  console.log(`\n✅ Pull complete!`);
  console.log(`   Downloaded: ${downloaded} files`);
  console.log(`   Skipped: ${skipped} files (scripts)\n`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
