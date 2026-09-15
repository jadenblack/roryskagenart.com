# Handoff prompt — Git ref plumbing fix — ⛔ SUPERSEDED, DO NOT RUN

> ⛔ **This prompt is superseded and must not be run.** Read
> [`DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`](./DIAGNOSIS_GIT_REF_PLUMBING_FIX.md) instead.
> **There is no defect on this machine and none in this repository** — the failure was produced by the
> agent tool's own sandbox, and the out-of-tree control test that settled it is recorded in that file.
> Its observations below are accurate; **its conclusion and all five ranked fixes are wrong**, and
> fix #5 (`git refs migrate`) **destroyed this repository's entire `.git`**. Kept for provenance only.
>
> **How to use:** copy everything from `## BEGIN PROMPT` to `## END PROMPT` into a fresh session.
> It is self-contained: the new session has not seen this conversation.
>
> Written 2026-09-15 11:25 America/Sao_Paulo, after the failure recurred across **three consecutive
> v3 sessions** (Phases 3.A and 3.B both had to be pushed by SHA). Every symptom below was observed
> directly in this repository on this machine.
>
> **Naming note:** this file carries no `V<version>` segment, unlike `PROMPT_V3_0_0_*`. The directory's
> other unversioned document (`BACKLOG_STUDIO_CMS.md`) follows the same logic. ⚠️ The original framing
> here — that this was "an environment defect that blocks release mechanics" — was **wrong**; it is an
> agent-sandbox limitation with a clean workaround (push by SHA), not a machine defect.
>
> ⚠️ **This is the one prompt in this directory that may modify `.git/`.** Read the hard constraints
> in §6 of the prompt before running anything.

---

## BEGIN PROMPT

You are working in the repository at
`C:\Users\jaden.black\dev.local\clients\roryskagen\roryskagenart.com` on Windows 10, under Git Bash.

### 1. The problem

For several sessions git has been unable to write new branch refs in this repository. The symptom is
precise and reproducible:

- `git checkout -b <new-branch>` appears to succeed and sets `.git/HEAD` to `ref: refs/heads/<new-branch>`,
  **but the ref file is never created** — the repo is left on an *unborn branch*.
- `git rev-parse HEAD` then fails with `fatal: ambiguous argument 'HEAD'`.
- `git status` reports **every file in the repository as staged `A`** (it is diffing against the empty
  tree). This looks catastrophic but is **not** data loss — it is the unborn-branch symptom.
- `git commit` on such a branch **does** write a real, persisting commit object into `.git/objects/`,
  but the branch ref vanishes again.
- The `.git/refs/heads/<dir>/` **directory itself disappears**. ⛔ The original claim here — *"Git does
  not remove empty directories, so something outside git is doing that"* — is **wrong**, and it is what
  sent three sessions chasing a filesystem filter. **Git does remove them:** after writing a ref it
  prunes the now-empty parent chain with `rmdir()`. Inside the agent sandbox that `rmdir()` **wrongly
  succeeds on a NON-EMPTY directory**, so it deletes the ref git just wrote *and* any sibling refs, and
  reports success. See `DIAGNOSIS_GIT_REF_PLUMBING_FIX.md` §3.
- Meanwhile the reflog entry for the commit **is** written and **does** survive, and `git log <sha>`,
  `git cat-file -p <sha>` and `git push origin <sha>:refs/heads/<branch>` all work perfectly.
- `.git/refs/remotes/origin/` is pruned the same way, so `git status` can report a false `[ahead N]`.

### 2. What is already established

`git commit` performs three *independent* writes:

| Write | Mechanism | Survives? |
| :--- | :--- | :--- |
| the object → `.git/objects/` | written once, immutable | ✅ always |
| the reflog → `.git/logs/…` | **appended** | ✅ yes |
| the branch ref → `.git/refs/heads/<branch>` | create `<name>.lock`, then **`rename()`** | ❌ **this is the one that fails** |

Only the third is a rename. ⛔ **The inference drawn from this — "a filesystem or antivirus filter
blocks `rename()` but permits appends" — is DISPROVEN.** A direct probe shows `os.rename` (new name)
and `os.replace` (over an existing file) **both succeed and persist** under `.git/refs/heads/`. The
real asymmetry is that **only the third write is followed by a directory prune**, and that prune is
what destroys it inside the sandbox. **The commit is never lost; only the pointer to it is** — that
part is correct.

### 3. New information that narrows the cause

The repository is **not** on a network share — it is a local NTFS path under `C:\Users\jaden.black\`.
**However, it was recently moved out of a Google Drive mounted directory**, and the failures have
continued since the move. That makes a **sync-client / antivirus filesystem filter** the prime suspect,
and raises the possibility that the path is still inside, or adjacent to, a reparse point, a synced
folder, or a directory some agent still monitors.

### 3.1 Evidence captured live, 2026-09-15 11:30 — while committing a PR in this repo

> ⚠️ **RESOLVED — READ
> [`DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`](./DIAGNOSIS_GIT_REF_PLUMBING_FIX.md) BEFORE ACTING ON ANY OF
> THIS PROMPT.**
>
> **There is no defect on this machine, and none in this repository. `git` is completely healthy.**
> Every premise in this prompt — §3.1's `rename()` conclusion, §3's fix list, and the "prime suspect"
> reasoning in §2 — is **wrong**, and so is the earlier revision of this banner that replaced
> `rename()` with "git cannot create refs containing `/`".
>
> **The failure is produced by the AI agent tool's own sandbox filesystem virtualization, and exists
> only for processes the agent launches.** Inside the sandbox, `rmdir()` on a **non-empty** directory
> wrongly **succeeds and deletes the directory's contents**. Git writes the ref, then prunes the
> parent directory with `rmdir()`, which silently deletes the ref it just wrote — and any sibling
> refs — and returns success, so git reports exit 0 with no error and emits no trace event.
> That is the entire defect.
>
> The proof is an out-of-tree control test: the identical probe, run as a **scheduled task**
> (`parent_pid = 1344`, the Task Scheduler service) instead of as a child of the agent, shows
> `rmdir` correctly refusing non-empty directories on **every** path, and nested refs created
> successfully on **every** path. In this repository, out-of-tree,
> `git branch docs/zz-ext-probe` created, verified, and deleted a nested ref cleanly, with
> `git fsck` clean and all five real branches intact. `git checkout -b feat/x`,
> `git switch -c docs/y` and `git checkout -b deep/a/b/c` all succeed.
>
> **Consequences:**
> - Fixes #1–#5 in §3 are all unnecessary. Defender and Google Drive were tested and cleared;
>   `%TEMP%` is not special to the machine — it is merely the sandbox's passthrough directory.
> - **Never run `git refs migrate` here.** It destroyed this repository's entire `.git` once, because
>   migration is built on the same broken primitive. It is not a fix.
> - **For a human in a normal terminal: nothing is wrong.** Branch, commit, push and PR normally.
> - **For an agent: push by SHA** (`git push origin <sha>:refs/heads/<branch>`) or hand-write the ref
>   — and never rely on git creating a nested ref from inside the sandbox.
> - ⚠️ **General sandbox hazard:** any directory-removing operation the agent performs can silently
>   delete non-empty directories. During this investigation an ordinary
>   `git update-ref refs/heads/docs/probe-git` destroyed the real `docs/` and `feat/` ref directories.

The defect reproduced **while the hand-off prompts in this directory were being committed**, which
sharpens the diagnosis considerably:

```console
$ git update-ref refs/heads/docs/v3-handoff-prompts e869ce7
update-ref OK                                     # <-- exit code 0, no error printed
$ git rev-parse docs/v3-handoff-prompts
fatal: ambiguous argument 'docs/v3-handoff-prompts': unknown revision
$ ls .git/refs/heads/docs/
ls: cannot access '.git/refs/heads/docs/': No such file or directory
```

Three things follow, and all three matter:

1. **The failure is SILENT.** `git update-ref` returned **exit 0** and printed nothing. Do not trust a
   zero exit status anywhere in this diagnosis — **verify every ref write with `git rev-parse` or
   `ls`**, not with the command's own exit code.
2. **The ref directory is created and then removed**, and on the `update-ref` path **no reflog is
   written at all** — unlike the `commit` path, which *does* leave a reflog behind. So the reflog is a
   recovery route for a lost *commit object*, but **not** for a lost *ref creation*.
3. **A direct file write survives where git's own ref write does not.** Immediately afterwards this
   was written by hand and was still present minutes later:

   ```bash
   mkdir -p .git/refs/heads/docs
   printf '%s\n' e869ce7 > .git/refs/heads/docs/v3-handoff-prompts
   git rev-parse docs/v3-handoff-prompts      # -> e869ce7   OK, and it persisted
   ```

That asymmetry is real and is the sharpest clue available — but it does **not** mean `rename()` is
blocked. A direct probe proved `os.rename` (to a new name) and `os.replace` (over an existing file)
both **succeed and persist** under `.git/refs/heads/`, and a hand-made empty directory there survives
indefinitely. What the asymmetry actually shows is narrower and stranger: **git's own ref write is
the only thing that fails, and it fails only when the ref name contains a `/`.** The
`create-<name>.lock`-then-`rename()` step is fine; what breaks is the combination of *creating a
directory* and *renaming into it*. See the diagnosis file for the full evidence table.

⚠️ **Red herring — do not chase this.** `GIT_INDEX_FILE` set to an MSYS-style path (`/c/Users/...`)
fails with `Unable to create '...lock': No such file or directory`, while the `C:/Users/...` form works
fine. That is a **path-form quirk in git's lockfile handling, unrelated to the ref bug.** It was hit
during this diagnosis and cost a detour. Use the `C:/` form.

### 4. Your task — diagnose read-only first, change nothing until step 3

**Step 1 — diagnostics.** Run and report the output of each:

- `git --version` and `which -a git` — is a PortableGit build ahead of any system git on `PATH`?
- `fsutil reparsepoint query "C:\Users\jaden.black\dev.local"`, then the repo root, then
  `C:\Users\jaden.black` — is any of them a reparse point / junction / symlink?
- `cmd //c dir /AL "C:\Users\jaden.black\dev.local"` and the repo root — list any junctions.
- `git config --list --show-origin | grep -Ei 'fsmonitor|untrackedcache|core\.hookspath|core\.fsync'`
- `ls -la .git/hooks/ | grep -v '\.sample$'` — report any **non-sample** hook.
- `git config --get extensions.refStorage` and `git config --get extensions.objectFormat`.
- Whether Google Drive, OneDrive, Dropbox or any backup agent still covers this path or a parent of
  it. Check `C:\Users\jaden.black\AppData\Local\Google\DriveFS\` for a leftover mount, and whether
  `GoogleDriveFS.exe` / `OneDrive.exe` are running.

**Step 2 — reproduce with tracing, so the error is not swallowed.** In one terminal start a watcher:

```bash
while true; do ls -la .git/refs/heads/ 2>&1; sleep 0.2; done
```

In another, run `GIT_TRACE=1 git branch tmp-ref-probe`, then `GIT_TRACE=1 git commit --allow-empty -m probe`
on a scratch branch. Capture and report the trace, any `rename` error, and what the watcher saw. Clean
up the probe branch afterwards.

**Step 3 — apply the durable fix.** Ranked, cheapest and most likely first. After each, **re-test by
creating a throwaway branch and committing to it**, and report whether the ref survives:

1. Add a Windows Defender exclusion for the repo root:
   `Add-MpPreference -ExclusionPath "C:\Users\jaden.black\dev.local\clients\roryskagen\roryskagenart.com"`
   (needs an elevated PowerShell — if you cannot elevate, output the exact command for me to run).
2. If a sync client still covers the path, remove the repo (preferably `dev.local`) from its sync
   scope, and confirm the leftover `DriveFS` mount is gone.
3. Disable git's filesystem caches, which also use rename-heavy bookkeeping:
   `git config core.fsmonitor false` and `git config core.untrackedCache false`.
4. If the repo root is itself a reparse point, or lives under one, **relocate to a plain local
   directory outside any sync root** — e.g. `C:\src\roryskagenart.com` — and re-test. Confirm with
   `fsutil reparsepoint query` that the new location is a real directory.
5. **Last resort:** eliminate loose refs. On Git 2.45+, `git config extensions.refStorage reftable`
   (or a fresh `git init --ref-format=reftable`) keeps all refs in one file under `.git/reftable/`, so
   a blocked rename under `refs/heads/` becomes structurally impossible. Check `git --version` first.
   Do this **on a clone**, verify, and only then switch the working repo — it is newer and less
   battle-tested than loose refs.

**Step 4 — report**, in order: (i) which diagnostic actually caught the cause; (ii) which fix you
applied; (iii) the evidence that new refs now persist (the probe branch's ref file content, plus a
successful `git rev-parse HEAD`); (iv) anything you could not rule out.

### 5. Verified state of this repository (2026-09-15)

| Fact | Value |
| :--- | :--- |
| `.git/HEAD` | `ref: refs/heads/feat/v3-phase-3b-media-path` — currently **healthy** |
| `git rev-parse HEAD` | `8895914` (resolves correctly) |
| Refs present | `main`, `docs/v3-roadmap-rebaseline`, `docs/v3-handoff-prompts`\*, `feat/v3-phase-3a-extraction`, `feat/v3-phase-3b-media-path` |
| Open PRs | #23, #24, #25, **#26** — all gates green, **all deliberately unmerged** |
| Latest release | **v2.16.0** |

\* **Hand-written** via `mkdir -p` + `printf` — see §3.1. `git update-ref` refused to create it.

⚠️ The failure is **not intermittent and not a machine fault** — it is **scoped to processes launched by
the agent tool**. A clean `git rev-parse HEAD` today is genuine, and so is a failing one: the two
measurements come from different process contexts. Do **not** run the step-1/step-3 diagnostics below;
they were all completed and every candidate was cleared. Read the diagnosis file instead.

### 6. Hard constraints — not negotiable

> **Scope note (2026-09-15 12:45).** Every constraint below applies **only to git operations the agent
> performs inside its own sandbox**. A human in a normal terminal has none of these limitations —
> branch, switch, commit, push and PR normally. The agent must still obey all of them.

- ⚠️ **Never run `git checkout`, `git switch`, `git reset --hard` or `git clean` while `HEAD` is
  unborn.** A checkout from an unborn-HEAD branch in this repo once **deleted nine tracked
  `plan/*.md` files**. If you find yourself on an unborn branch, stop and fix the ref first.
- ⚠️ **Recovery procedure when a ref goes missing again.** The reflog survives. Read the sha from
  `.git/logs/refs/heads/<branch>` (last line, second column — the new-sha), then:

  ```bash
  mkdir -p .git/refs/heads/<dir>            # mandatory — the parent dir is pruned too
  printf '%s\n' <sha> > .git/refs/heads/<branch>
  ```

  A bare `printf >` fails with "No such file or directory" when the directory is gone.
- ⚠️ **Never run `git refs migrate` in this environment.** It failed the same way as everything else
  and **left the repository with no `.git` at all** (2026-09-15; see the diagnosis file §6). Recovery
  was `git init` + `git fetch` + hand-written refs + `git read-tree HEAD`. It is **not** a fix for
  anything, because there is nothing to fix.
- ⚠️ **Any `git` ref operation on a name containing `/` may destroy the entire parent directory**,
  including sibling refs that were previously healthy. Plain `git update-ref` calls wiped `docs/` and
  `feat/` this way. Prefer flat branch names, or write nested refs by hand.
- ⚠️ **`git fetch` silently writes nothing** when the refspec includes nested refs — the whole update
  transaction rolls back, even though git still prints `* [new branch] …` for every branch. Rebuild
  remote-tracking refs by hand from `git ls-remote --heads origin`.
- ⚠️ **General sandbox hazard — any directory-removing operation can silently delete a NON-EMPTY
  directory and its contents.** Inside the sandbox `rmdir()` wrongly succeeds on non-empty
  directories; that is the root cause of everything above. Never point a recursive delete at a
  directory whose contents are not disposable, and prefer file-level deletion.
- ⚠️ **Rotate the GitHub PAT in `.git/config`.** The `origin` URL carries a plaintext
  `github_pat_…` token; it was copied into a backup during this diagnosis.
- ⚠️ **Push by sha, never by branch name:** `git push origin <sha>:refs/heads/<branch>`.
- ⚠️ **Never push `main`.** Work on the existing `main` ref locally if you must, but push only a
  feature or `release/x.y.z` branch. Pushing `main` first makes GitHub refuse the subsequent PR
  ("No commits between main and release/x.y.z") and lands commits in production ahead of the gates —
  `v2.15.0` did exactly this.
- **Before any git surgery, copy uncommitted deliverables to a directory OUTSIDE the repo.**
- Do not reformat, re-lint or "tidy" anything. This session is about the git plumbing only. Leave the
  working tree as you found it, apart from the probe branch you create and delete.
- ✅ **`wayback/centraltexasmuralsbyroryskagen-*/` is now GITIGNORED** (added 2026-09-15; 522 MB /
  9,029 files). `git add -A` can no longer stage it. ⚠️ `git clean -xfd` would now **delete** it. See
  `PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md` §8.

Start with step 1 and show me the diagnostic output **before** you change anything.

## END PROMPT

---

## Related

- ⭐ [`DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`](./DIAGNOSIS_GIT_REF_PLUMBING_FIX.md) — **the authoritative
  document. Read this one.** It states the verdict, the in-sandbox vs out-of-tree measurements, the
  real mechanism, the validated recovery procedure, and a table of every discredited theory.
- `memory/2026-09-15.md` — the session log, including the original (now superseded) mechanism analysis
  and the correction appended at 12:45.
- `memory/MEMORY.md` — the condensed trap list, including the push-by-SHA workaround.
- [`PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md`](./PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md) — the other
  hand-off prompt from the same session. ⛔ **Its old instruction to "fix the ref plumbing first" is
  obsolete** — there is nothing to fix. That prompt only needs the agent to **push by SHA**.
