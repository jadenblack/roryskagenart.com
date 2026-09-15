# Handoff prompt — Git ref plumbing fix

> **How to use:** copy everything from `## BEGIN PROMPT` to `## END PROMPT` into a fresh session.
> It is self-contained: the new session has not seen this conversation.
>
> Written 2026-09-15 11:25 America/Sao_Paulo, after the failure recurred across **three consecutive
> v3 sessions** (Phases 3.A and 3.B both had to be pushed by SHA). Every symptom below was observed
> directly in this repository on this machine.
>
> **Naming note:** this file carries no `V<version>` segment, unlike `PROMPT_V3_0_0_*`. It is not tied
> to a release — it is an **environment defect that blocks release mechanics themselves**, since every
> PR in this project is created by pushing a branch. The directory's other unversioned document
> (`BACKLOG_STUDIO_CMS.md`) follows the same logic.
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
- The `.git/refs/heads/<dir>/` **directory itself disappears**. Git does not remove empty directories,
  so something outside git is doing that.
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

Only the third is a rename. A filesystem or antivirus filter that **blocks `rename()` but permits
appends** produces exactly the asymmetry above — every part of the commit survives except its *name*.
**The commit is never lost; only the pointer to it is.**

### 3. New information that narrows the cause

The repository is **not** on a network share — it is a local NTFS path under `C:\Users\jaden.black\`.
**However, it was recently moved out of a Google Drive mounted directory**, and the failures have
continued since the move. That makes a **sync-client / antivirus filesystem filter** the prime suspect,
and raises the possibility that the path is still inside, or adjacent to, a reparse point, a synced
folder, or a directory some agent still monitors.

### 3.1 Evidence captured live, 2026-09-15 11:30 — while committing a PR in this repo

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

That asymmetry is the sharpest clue available: plain file creation under `.git/refs/heads/` **works
and persists**, while git's **create-`.lock`-then-`rename()`** path does not. It points at the
**rename step specifically** — not at the filesystem, the path, or `.git/` in general. Test `rename()`
directly (step 2) and treat that as the primary target.

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

⚠️ The failure is **intermittent**: refs were restored by hand at the end of the last session and are
currently intact. A clean `git rev-parse HEAD` today is therefore **not** evidence the defect is gone.
Run the step-1 diagnostics regardless — §3.1 is a live reproduction from this very session.

### 6. Hard constraints — not negotiable

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
- ⚠️ **Push by sha, never by branch name:** `git push origin <sha>:refs/heads/<branch>`.
- ⚠️ **Never push `main`.** Work on the existing `main` ref locally if you must, but push only a
  feature or `release/x.y.z` branch. Pushing `main` first makes GitHub refuse the subsequent PR
  ("No commits between main and release/x.y.z") and lands commits in production ahead of the gates —
  `v2.15.0` did exactly this.
- **Before any git surgery, copy uncommitted deliverables to a directory OUTSIDE the repo.**
- Do not reformat, re-lint or "tidy" anything. This session is about the git plumbing only. Leave the
  working tree as you found it, apart from the probe branch you create and delete.
- ⚠️ **`wayback/centraltexasmuralsbyroryskagen-20231217234521/` is currently UNTRACKED and NOT
  gitignored** (509 MB / 9,027 files). Never `git add` it — that would write 509 MB into git history
  permanently. See `PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md`.

Start with step 1 and show me the diagnostic output **before** you change anything.

## END PROMPT

---

## Related

- `memory/2026-09-15.md` — the full mechanism analysis, ranked candidate causes, and the ranked fix
  list this prompt is drawn from.
- `memory/MEMORY.md` — the condensed trap list, including the push-by-SHA workaround.
- [`PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md`](./PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md) — the other
  hand-off prompt from the same session. **Fix the ref plumbing first**: that prompt requires creating
  a branch and pushing it.
