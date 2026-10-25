#!/usr/bin/env python3
"""PR 자동화(PM·세션 공용). 토큰을 아끼려고 반복 작업을 한 번의 호출로 처리한다.

사용:
  python3 tools/pm/prs.py status              브랜치 앞섬/뒤처짐, 열린 PR, CI 상태를 한 줄씩
  python3 tools/pm/prs.py open BRANCH [제목]   PR이 없으면 만든다(번호 출력)
  python3 tools/pm/prs.py merge-ready         CI 통과·병합 가능한 열린 PR을 모두 머지
  python3 tools/pm/prs.py ship BRANCH [제목] [--wait 분]   열고, CI를 기다렸다가, 머지(충돌/실패는 보고)
gh CLI(REST만 사용)가 필요하다. main 직접 푸시는 하지 않는다.
"""
import json, subprocess, sys, time

REPO = "gc8134choi/admissions-2030"
WATCH = ["dev/portal", "dev/portal-policy", "research/materials", "data/verify-curriculum"]
BODY = ("🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n"
        "https://claude.ai/code/session_01Uwe9zE97T6R52Mv8q3Wcix")


def gh(*args, check=True):
    r = subprocess.run(["gh", "api", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[:300])
    try:
        return json.loads(r.stdout) if r.stdout.strip() else None
    except json.JSONDecodeError:
        return r.stdout


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()


def open_prs():
    return gh(f"repos/{REPO}/pulls?state=open&per_page=50") or []


def ci_state(pr):
    sha = pr["head"]["sha"]
    runs = gh(f"repos/{REPO}/commits/{sha}/check-runs")["check_runs"]
    if not runs:
        return "none"
    if any(r["conclusion"] == "failure" for r in runs):
        return "failure"
    if all(r["conclusion"] == "success" for r in runs):
        return "success"
    return "pending"


def mergeable(pr):
    # mergeable은 계산 중이면 null이라 한 번 더 읽는다.
    for _ in range(5):
        d = gh(f"repos/{REPO}/pulls/{pr['number']}")
        if d["mergeable"] is not None:
            return d["mergeable"]
        time.sleep(3)
    return None


def cmd_status():
    git("fetch", "-q", "origin", "+refs/heads/main:refs/remotes/origin/main")
    for b in WATCH:
        git("fetch", "-q", "origin", f"+refs/heads/{b}:refs/remotes/origin/{b}")
        ahead = git("rev-list", "--count", f"origin/main..origin/{b}")
        behind = git("rev-list", "--count", f"origin/{b}..origin/main")
        last = git("log", "-1", "--format=%h %ar %s", f"origin/{b}")[:70]
        print(f"{b}: ahead={ahead} behind={behind} | {last}")
    for pr in open_prs():
        print(f"PR#{pr['number']} {pr['head']['ref']} ci={ci_state(pr)} mergeable={mergeable(pr)} | {pr['title'][:50]}")


def find_pr(branch):
    for pr in open_prs():
        if pr["head"]["ref"] == branch:
            return pr
    return None


def cmd_open(branch, title=None):
    pr = find_pr(branch)
    if pr:
        print(f"exists #{pr['number']}")
        return pr
    title = title or branch
    d = gh("-X", "POST", f"repos/{REPO}/pulls", "-f", f"head={branch}", "-f", "base=main",
           "-f", f"title={title}", "-f", f"body={BODY}")
    print(f"opened #{d['number']}")
    return d


def merge(pr):
    d = gh("-X", "PUT", f"repos/{REPO}/pulls/{pr['number']}/merge", "-f", "merge_method=merge", check=False)
    ok = isinstance(d, dict) and d.get("merged")
    print(f"#{pr['number']} merged={ok}" + ("" if ok else f" ({d})"))
    return ok


def cmd_merge_ready():
    for pr in open_prs():
        if "hold" in [l["name"] for l in pr.get("labels", [])]:
            print(f"#{pr['number']} hold")
            continue
        st, m = ci_state(pr), mergeable(pr)
        if st == "success" and m:
            merge(pr)
        else:
            print(f"#{pr['number']} skip ci={st} mergeable={m}")


def cmd_ship(branch, title=None, wait=12):
    pr = cmd_open(branch, title)
    pr = find_pr(branch) or pr
    n = pr["number"]
    deadline = time.time() + wait * 60
    while time.time() < deadline:
        d = gh(f"repos/{REPO}/pulls/{n}")
        if d.get("merged"):
            print(f"#{n} merged=True (automerge)", flush=True)
            return 0
        if d["state"] != "open":
            print(f"#{n} closed without merge", flush=True)
            return 4
        cur = find_pr(branch) or pr
        m = d["mergeable"]
        if m is False:
            print(f"#{n} CONFLICT: origin/main을 합쳐야 해요", flush=True)
            return 2
        st = ci_state(cur)
        if st == "failure":
            print(f"#{n} CI-FAILED", flush=True)
            return 3
        if st == "success" and m:
            # automerge가 곧 머지하지만, 늦으면 직접 머지한다(이미 머지됐으면 위에서 종료).
            time.sleep(8)
            d = gh(f"repos/{REPO}/pulls/{n}")
            if d.get("merged"):
                print(f"#{n} merged=True (automerge)", flush=True)
                return 0
            return 0 if merge(cur) else 4
        time.sleep(10)
    print(f"#{n} TIMEOUT({wait}분)", flush=True)
    return 5


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    c = argv[1]
    if c == "status":
        cmd_status()
    elif c == "open":
        cmd_open(argv[2], argv[3] if len(argv) > 3 else None)
    elif c == "merge-ready":
        cmd_merge_ready()
    elif c == "ship":
        wait = 12
        args = [a for a in argv[2:]]
        if "--wait" in args:
            i = args.index("--wait")
            wait = int(args[i + 1])
            del args[i:i + 2]
        return cmd_ship(args[0], args[1] if len(args) > 1 else None, wait)
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
