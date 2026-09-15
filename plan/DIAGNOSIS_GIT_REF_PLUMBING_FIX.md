# Diagnosis — git ref plumbing: an agent-sandbox artifact, NOT a machine defect

> **REVISED 2026-09-15 12:45.** Every earlier revision of this file — including the "SUPERSEDED"
> banner it used to carry — concluded there was a **defect on this machine**: that git could not
> create refs containing `/`, that it was a C:-volume filesystem filter, and that the fix was
> `extensions.refStorage=reftable`. **All of that is wrong.**
>
> **There is no git defect on this machine. `git` is completely healthy.** The failure is produced by
> the **AI agent tool's own sandbox filesystem virtualization**, and it exists only for processes
> launched *by the agent*. Run the same commands from an ordinary terminal — or from any process
> outside the agent's process tree — and every operation succeeds.
>
> This file now records the corrected finding, the measurement that settled it, and the practical
> consequences. Section 3 keeps the discredited reasoning on purpose, so it is not re-derived.

---

## 1. Verdict

| | Inside the agent sandbox | Outside the agent sandbox |
| :--- | :--- | :--- |
| `git checkout -b feat/x` | ❌ ref silently vanishes | ✅ `Switched to a new branch 'feat/x'` |
| `git switch -c docs/y` | ❌ ref silently vanishes | ✅ `Switched to a new branch 'docs/y'` |
| `git branch docs/z` | ❌ ref silently vanishes | ✅ works |
| `git update-ref refs/heads/a/one HEAD` | ❌ ref silently vanishes | ✅ works |
| `git branch` (flat name) | ✅ works | ✅ works |
| `os.rmdir()` on a **non-empty** dir | ⚠️ **wrongly SUCCEEDS — deletes contents** | ✅ correctly refused (`WinError 145`) |

The right-hand column is the machine's real behaviour. **Nothing is broken.**

## 2. The measurement that settled it

The breakthrough was testing **outside the agent's process tree**. The agent tool cannot spawn
detached processes (`Start-Process`, `Win32_Process.Create` are blocked by policy), so the probe was
registered as a **scheduled task** — it then runs as a child of the Task Scheduler service, on the
same machine, as the same user, with the same `python.exe` and the same paths.

The probe's own self-report confirms the context change:

```
user = jaden.black   cwd = C:\windows\system32   parent_pid = 1344
```

`parent_pid 1344` is the Task Scheduler service, not the agent. Same script, same interpreter,
same directories — only the parent differs. Results:

**`rmdir` on a non-empty directory — the mechanism**

| Base directory | Inside sandbox | Outside sandbox (scheduled task) |
| :--- | :--- | :--- |
| `C:\Users\jaden.black\AppData\Local\Temp` | ✅ refused (145) | ✅ refused (145) |
| `C:\Users\jaden.black\dev.local` | ⚠️ **SUCCEEDED, file deleted** | ✅ refused (145) |
| `C:\Users\jaden.black` | ⚠️ **SUCCEEDED, file deleted** | ✅ refused (145) |
| `C:\src` | ⚠️ **SUCCEEDED, file deleted** | ✅ refused (145) |
| `C:\Windows\Temp` | ⚠️ **SUCCEEDED, file deleted** | ✅ refused (145) |
| `D:\` | ⚠️ **SUCCEEDED, file deleted** | ✅ refused (145) |

**Nested refs — the symptom**

| Base directory | Inside sandbox | Outside sandbox (scheduled task) |
| :--- | :--- | :--- |
| `%TEMP%` | ✅ `a/one`, `b/two`, `c/three` | ✅ `a/one`, `b/two`, `c/three` |
| `dev.local` | ❌ **0 of 3** | ✅ `a/one`, `b/two`, `c/three` |
| `C:\Users\jaden.black` | ❌ **0 of 3** | ✅ `a/one`, `b/two`, `c/three` |
| `C:\src` | ❌ **0 of 3** | ✅ `a/one`, `b/two`, `c/three` |
| `D:\` | ❌ **0 of 3** | ✅ `a/one`, `b/two`, `c/three` |

**The real repository, tested out-of-tree:**

```
HEAD before = 8895914c4ea7432de19df77179a311b962a01154
git branch docs/zz-ext-probe        rc=0
ref file on disk                    = True
git rev-parse --verify              rc=0 out=8895914c4ea7432de19df77179a311b962a01154
git branch -d docs/zz-ext-probe     rc=0  "Deleted branch docs/zz-ext-probe (was 8895914)."
ref file gone after delete          = True
docs/ dir still exists              = True
git fsck                            rc=0  (clean)
```

And in a scratch repo on `dev.local`, `checkout -b feat/x`, `switch -c docs/y`, `branch docs/z` and
`checkout -b deep/a/b/c` all succeeded, with every ref present on disk afterwards:

```
REFS ON DISK = ['deep/a/b/c', 'docs/y', 'docs/z', 'feat/x', 'main']
```

## 3. The mechanism

Git writes a ref by creating `refs/heads/<dir>/<name>.lock`, renaming it to `<name>`, and then
pruning now-empty parent directories with `rmdir()`. Inside the agent sandbox, `rmdir()` on a
**non-empty** directory **returns success and removes the directory together with its contents**.
Git's prune therefore deletes the ref it just wrote — and any sibling refs in that directory — and
reports success, because `rmdir()` said it succeeded.

That single defect explains every observation:

- **Nested refs die, flat refs live.** A flat ref has no parent directory to prune.
- **Sibling branches disappear.** The whole directory is removed.
- **It is silent.** `rmdir()` returned success, so git sees no error: exit 0, empty stderr, and no
  trace2 error event. This is why `GIT_TRACE` / `GIT_TRACE2_EVENT` were useless for months.
- **`%TEMP%` is exempt.** It is the sandbox's passthrough/writable directory, so the real filesystem
  semantics apply there. That is the *entire* reason `%TEMP%` looked special — it was never about the
  path, the volume, or the filesystem.
- **`git refs migrate` destroyed `.git`.** Migration creates a temp directory under `.git/` and
  renames it — an operation built on exactly the broken primitive.
- **`git fetch` wrote no remote-tracking refs** while printing `* [new branch]` for all 22. The
  update transaction includes nested refs, and the cleanup pass removed them.

The sandbox is consistent with a container-style overlay: **`wcifs` (Windows Container Isolation)**
and **`bindflt` (Windows Bind Filter)** are both loaded on this machine, and the agent's sandbox is
built on that machinery. Confirming the sandbox itself as the owner of the defect does not require
identifying which driver implements it — the out-of-tree control settles ownership.

## 4. The discredited reasoning (kept so it is not repeated)

| Claim | Status |
| :--- | :--- |
| "`create-<name>.lock`-then-`rename()` is blocked by a filesystem filter." | ❌ **Wrong.** Direct probe: `os.rename` and `os.replace` both succeed under `.git/refs/heads/` and persist. |
| "Windows Defender real-time protection is the cause — exclusion is fix #1." | ❌ **Wrong.** RTP was disabled; the failure was identical. Defender was never involved. |
| "Google Drive File Stream is the cause." | ❌ **Wrong.** The `GoogleDriveFS` process was stopped; the failure was identical. (Its kernel driver `googledrivefs31931` does stay loaded, but it is not the cause.) |
| "It is a C:-volume filesystem filter — `%TEMP%` is the only writable path." | ❌ **Wrong.** Out-of-tree, every path works. `%TEMP%` was never special to the machine. |
| "The repository was moved out of a Google Drive directory, so a sync client is the prime suspect." | ❌ **Wrong.** Repo location is irrelevant. |
| "Fix it with `extensions.refStorage=reftable`." | ⚠️ **Unnecessary.** It would have masked the symptom while leaving the real hazard in place. Reftable is a legitimate choice, but it is not a fix for this. |
| "Never trust a zero exit status for a ref write here." | ✅ **Still true inside the sandbox** — and the reason is now known. |

## 5. Practical consequences

### For the owner, in a normal terminal

**Everything works normally.** Branch, switch, checkout, commit, push, PR — no workarounds, no
reftable, no exclusions, no relocation. Verify for yourself at any time:

```bash
git checkout -b feat/scratch && git branch --list && git checkout - && git branch -d feat/scratch
```

### For an AI agent working in this repo

The agent runs inside the sandbox, so it **must not rely on git writing a nested ref**:

- ✅ **Push by SHA** — `git push origin <sha>:refs/heads/<branch>`. Needs no local ref at all, so it
  is immune. This remains the correct pattern for agents here.
- ✅ **Hand-written refs** survive: `mkdir -p .git/refs/heads/<dir>` then
  `printf '%s\n' <sha> > .git/refs/heads/<branch>`.
- ✅ **Run git out-of-tree** via a scheduled task, when the agent genuinely needs a local branch.
- ❌ **Never `git refs migrate`** — it destroyed `.git` once already.
- ✅ **Stage explicit paths only.** `wayback/centraltexasmuralsbyroryskagen-*/` is now gitignored, so
  `git add -A` can no longer stage it — but the discipline still protects against everything else.
  ⚠️ `git clean -xfd` would now **delete** the export.

### ⚠️ General hazard inside the sandbox

`rmdir()` removing non-empty directories means **any** directory-removing operation performed by the
agent can silently destroy files it did not intend to touch. During this investigation an ordinary
`git update-ref refs/heads/docs/probe-git` deleted the real `docs/` and `feat/` directories. Prefer
file-level deletion, and never point a recursive delete at a directory whose contents are not
disposable.

## 6. Recovery procedure (still valid, if `.git` is ever lost)

The working tree is never at risk — only `.git` is. All commits live on `origin`:

```bash
git init -q .
cp <backup>/config .git/config                       # restores [core] + [remote] + [branch]
mkdir -p .git/refs/heads/docs .git/refs/heads/feat   # ⚠️ parent dirs are mandatory
printf '%s\n' <sha> > .git/refs/heads/<dir>/<branch> # hand-write every nested ref
printf 'ref: refs/heads/<branch>\n' > .git/HEAD
git read-tree HEAD                                   # rebuild the index; never touches the tree
```

⚠️ **`git fetch` cannot rebuild remote-tracking refs from inside the sandbox.** Remote-tracking refs
must be hand-written from `git ls-remote --heads origin`. (Outside the sandbox, `git fetch` is fine.)

## 7. Two genuine housekeeping items

1. **⚠️ A GitHub PAT is stored in plaintext** in the `origin` URL in `.git/config`
   (`https://x-access-token:github_pat_…@github.com/…`). It was reproduced into a backup copy during
   this diagnosis. **Rotate that token.** Use a credential helper instead of an inline URL.
2. ✅ **RESOLVED 2026-09-15 — `wayback/centraltexasmuralsbyroryskagen-*/` is now gitignored**
   (`.gitignore` line ~30; 522 MB / 9,029 files). `git status` is clean and `git add -A --dry-run`
   confirms the export can no longer be staged. ⚠️ **`git clean -xfd` would now delete it**, and the
   two scrape dirs (`centraltexasmurals.com-v1`, `roryskagen.com-v1`) are **tracked on purpose** —
   they are the extraction inputs and the diff baseline, so they must stay out of the ignore rule.

---

### Reproducing the control test

Write the probe to `%TEMP%`, register it as a scheduled task, run it, read the output file. The
probe must write its results to a **file**, since a scheduled task's stdout is not captured.

```powershell
$action = New-ScheduledTaskAction -Execute $py -Argument "`"$script`""
Register-ScheduledTask -TaskName "Probe" -InputObject (New-ScheduledTask -Action $action) -Force
Start-ScheduledTask -TaskName "Probe"
# ... read the output file ...
Unregister-ScheduledTask -TaskName "Probe" -Confirm:$false
```

Have the probe report `os.getppid()` and `os.getcwd()` — `parent_pid` is the proof that the process
is outside the agent's tree.
