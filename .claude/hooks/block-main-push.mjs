#!/usr/bin/env node
// PreToolUse hook for Bash: stops Claude from pushing to main/master or force-pushing.
// Exit code 2 blocks the command; the message on stderr is shown to Claude.
import { execSync } from 'node:child_process';

const PROTECTED = ['main', 'master'];

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let command = '';
try {
  command = JSON.parse(raw)?.tool_input?.command ?? '';
} catch {
  process.exit(0); // not our business if the input is unreadable
}

// Look at every "git push" in the command, also in chains like "a && git push".
const pushes = command
  .split(/&&|\|\||;|\n/)
  .map((part) => part.trim())
  .filter((part) => /(^|\s)git\s+(-C\s+\S+\s+)?push(\s|$)/.test(part));

if (pushes.length === 0) process.exit(0);

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function block(reason) {
  console.error(
    `Blocked: ${reason}\n` +
      'Work on a feature branch (e.g. feat/<topic>) and push only that branch. ' +
      'Falko merges into main himself after review.',
  );
  process.exit(2);
}

for (const push of pushes) {
  const args = push.split(/\s+/).slice(push.split(/\s+/).indexOf('push') + 1);

  if (args.some((a) => a === '--force' || a === '-f' || a.startsWith('--force-with-lease') || a.startsWith('+'))) {
    block('force pushes are not allowed.');
  }
  if (args.some((a) => a === '--all' || a === '--mirror')) {
    block('pushing all branches is not allowed.');
  }

  // Refspecs like "main", "HEAD:main", "feature:refs/heads/master".
  const refs = args.filter((a) => !a.startsWith('-')).slice(1); // first non-flag is the remote
  const targets = refs.map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  if (targets.some((t) => PROTECTED.includes(t))) {
    block(`pushing to ${targets.find((t) => PROTECTED.includes(t))} is not allowed.`);
  }

  // "git push" or "git push origin" without a refspec pushes the current branch.
  if (refs.length === 0 && PROTECTED.includes(currentBranch())) {
    block(`you are on ${currentBranch()}, so this would push to it.`);
  }
}

process.exit(0);
