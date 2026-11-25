#!/usr/bin/env bash
# UFO 站点一键发布
#
#   ./deploy.sh <提交信息>            提交并推送，等部署完成
#   ./deploy.sh <提交信息> --no-wait  推完就返回
#   ./deploy.sh <提交信息> --ssh      强制走 SSH（跳过 HTTPS）
#   ./deploy.sh <提交信息> --https    强制走 HTTPS（失败不回落）
#   ./deploy.sh --status              只看两条通道的连通性与权限，不推送
#
# 通道（同一沙箱实测，含 5 次稳定性采样）：
#   SSH over 443 复用   1.2–1.6s   稳定命中，默认通道
#   HTTPS + PAT         1.0s / 20s 超时    忽快忽慢，5 次里 2 成功 3 卡死
#   SSH over 22         被阻断
#   Contents API        1.3–2.2s   **workflow 文件专用**，稳定
#
# 为什么不走 HTTPS 推代码：单独看 info/refs 只要 0.6s、TLS 握手 0.18s，
# 但一进 POST /git-receive-pack 传 pack 就卡 —— 同一 IP 上 body 传输
# 到 4 秒仍没走完（响应头秒回、body 不动）。强制 HTTP/1.1 只能救回一半
# （5 次里 2 次成功）。这是链路上对大流量包的干扰，与令牌无关。
# 原脚本写的“TLS 中断”是同一现象，只是当时没定位到 HTTP/2 这一层。
#
# 所以：代码走 SSH（稳、1.3s），workflow 文件走 Contents API（稳、2s），
# 两者都不经过“大流量 HTTPS”。HTTPS 保留为 --https 手动选项。
#
# 凭据查找顺序（均不落盘、不进 argv）：
#   $GH_TOKEN / $GITHUB_TOKEN  →  ~/.config/ufo/github-token  →  gh auth token
#
# workflow 走 API 需要 classic PAT，scopes：
#   repo, workflow, admin:repo_hook, delete_repo

set -uo pipefail

REPO="${UFO_REPO:-/tmp/ufo-repo}"
SITE="${UFO_SITE:-https://ufo-eea.pages.dev}"
SLUG="${UFO_SLUG:-ufodollar/ufo}"
TOKEN_FILE="${UFO_TOKEN_FILE:-$HOME/.config/ufo/github-token}"
MAX_WAIT="${UFO_MAX_WAIT:-180}"
WAIT=1
FORCE=""
MODE="deploy"
MSG=""

for arg in "$@"; do
  case "$arg" in
    --no-wait) WAIT=0 ;;
    --ssh)     FORCE="ssh" ;;
    --https)   FORCE="https" ;;
    --status)  MODE="status" ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    *)         MSG="$arg" ;;
  esac
done

die()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
info() { printf '\033[36m· %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }

NEW_TOKEN_URL="https://github.com/settings/tokens/new?scopes=repo,workflow,admin:repo_hook,delete_repo&description=ufo-deploy"

[ -d "$REPO/.git" ] || die "仓库不存在：$REPO（用 UFO_REPO=/path 指定）"
cd "$REPO" || die "无法进入 $REPO"

# ---------------- 凭据 ----------------
TOKEN=""; TOKEN_SRC=""
if [ -n "${GH_TOKEN:-}" ]; then        TOKEN="$GH_TOKEN";        TOKEN_SRC="\$GH_TOKEN"
elif [ -n "${GITHUB_TOKEN:-}" ]; then  TOKEN="$GITHUB_TOKEN";    TOKEN_SRC="\$GITHUB_TOKEN"
elif [ -s "$TOKEN_FILE" ]; then        TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"; TOKEN_SRC="$TOKEN_FILE"
elif command -v gh >/dev/null 2>&1; then
  TOKEN="$(gh auth token 2>/dev/null || true)"
  [ -n "$TOKEN" ] && TOKEN_SRC="gh auth token"
fi

TOKEN_KIND=""
if [ -n "$TOKEN" ]; then
  case "$TOKEN" in
    ghp_*|gho_*|ghu_*|ghs_*|ghr_*) TOKEN_KIND="classic" ;;
    github_pat_*)                  TOKEN_KIND="fine-grained" ;;
    *)                             TOKEN_KIND="unknown" ;;
  esac
fi

# classic token 能直接从响应头读到 scopes；fine-grained 读不到，交给 push 结果判定
SCOPES=""
if [ "$TOKEN_KIND" = "classic" ]; then
  SCOPES=$(curl -sSI -m 12 -H "Authorization: Bearer $TOKEN" https://api.github.com/user 2>/dev/null \
           | tr -d '\r' | awk 'tolower($1)=="x-oauth-scopes:"{ $1=""; sub(/^ +/,""); print; exit }')
fi

# 1 = 有（classic 且含 workflow）；2 = 无法判定（fine-grained）；0 = 明确没有
if [ "$TOKEN_KIND" = "fine-grained" ]; then
  WF_SCOPE=2
elif [ "$TOKEN_KIND" = "classic" ]; then
  WF_SCOPE=0
  case " $SCOPES " in *" workflow "*) WF_SCOPE=1 ;; esac
else
  WF_SCOPE=0
fi

# ---------------- 接口地址 ----------------
API="https://api.github.com/repos/${SLUG}"
API_H=(-H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json"
       -H "X-GitHub-Api-Version: 2022-11-28")

# ---------------- --status ----------------
if [ "$MODE" = "status" ]; then
  echo
  info "凭据"
  if [ -n "$TOKEN" ]; then
    ok "PAT 已找到   来源 $TOKEN_SRC   类型 $TOKEN_KIND"
    [ -n "$SCOPES" ] && info "scopes: $SCOPES"
    case "$WF_SCOPE" in
      1) ok "可推送 workflow 文件" ;;
      2) warn "fine-grained token：能否推 workflow 取决于仓库权限里勾了 Workflows: write" ;;
      0) warn "缺 workflow scope —— 推 .github/workflows/* 会被拒绝" ;;
    esac
    printf '  换令牌：%s\n' "$NEW_TOKEN_URL"
  else
    warn "没有 PAT，只能走 SSH（推不了 workflow，权限仅限本仓库）"
    printf '  生成：%s\n' "$NEW_TOKEN_URL"
    printf '  写入：printf %%s "ghp_xxx" > %s && chmod 600 %s\n' "$TOKEN_FILE" "$TOKEN_FILE"
  fi

  echo
  info "通道"
  t0=$(date +%s%N)
  code=$(curl -sS -o /dev/null -m 12 -w '%{http_code}' https://api.github.com/rate_limit 2>/dev/null || echo 000)
  t1=$(date +%s%N)
  [ "$code" = "200" ] && ok "api.github.com   200   $(( (t1-t0)/1000000 ))ms" || warn "api.github.com   $code"

  t0=$(date +%s%N)
  if GIT_TERMINAL_PROMPT=0 timeout 20 git ls-remote "https://github.com/${SLUG}.git" HEAD >/dev/null 2>&1; then
    t1=$(date +%s%N)
    ok "HTTPS 读可达     $(( (t1-t0)/1000000 ))ms   （写通道不可靠，见下）"
  else
    warn "HTTPS 不可达"
  fi

  t0=$(date +%s%N)
  if ssh -o ConnectTimeout=10 -T git@github.com >/dev/null 2>&1 || [ $? = 1 ]; then
    t1=$(date +%s%N); ok "SSH 443 可达     $(( (t1-t0)/1000000 ))ms   ← 代码默认通道"
  else
    warn "SSH 443 不可达"
  fi

  if [ -n "$TOKEN" ]; then
    t0=$(date +%s%N)
    code=$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "${API_H[@]}" \
           "$API/git/ref/heads/main" 2>/dev/null || echo 000)
    t1=$(date +%s%N)
    [ "$code" = "200" ] \
      && ok "仓库 API 可写    $(( (t1-t0)/1000000 ))ms   ← workflow 专用通道" \
      || warn "仓库 API 返回 $code（workflow 提交会失败）"
  fi

  echo
  info "本地"
  printf '  %s  %s  %s\n' "$REPO" "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)"
  AHEAD=$(git rev-list --count HEAD --not --remotes 2>/dev/null || echo '?')
  printf '  未推送提交：%s\n' "$AHEAD"
  exit 0
fi

# ---------------- 部署完成判据 ----------------
# Cloudflare Pages 不返回 last-modified / etag，只能看首页引用的 asset 文件名；
# 前端代码变一次，Vite 的 hash 文件名就变一次。
sig() {
  curl -s --max-time 15 -H 'Cache-Control: no-cache' "$SITE/?cb=$RANDOM" 2>/dev/null \
    | grep -o '/assets/[A-Za-z0-9._-]*' | sort -u | md5sum | cut -c1-12
}

BEFORE=$(sig)
info "基线签名 ${BEFORE:-读取失败}  ($SITE)"

# ---------------- 提交 ----------------
# BASE 是上一次推送的位置：后面用它算「这次到底动了什么」，
# 既覆盖本次新提交，也覆盖之前攒下没推的提交。
BASE=$(git rev-parse origin/main 2>/dev/null || echo '')
git add -A
HAS_STAGED=0
git diff --cached --quiet || HAS_STAGED=1
AHEAD=$(git rev-list --count HEAD --not --remotes 2>/dev/null || echo 0)

if [ "$HAS_STAGED" = 0 ] && [ "$AHEAD" = 0 ]; then
  ok "没有待发布的改动"
  exit 0
fi

if [ "$HAS_STAGED" = 1 ]; then
  [ -n "$MSG" ] || MSG="deploy: $(date '+%Y-%m-%d %H:%M')"
  git commit -q -m "$MSG" || die "提交失败"
  ok "已提交  $MSG"
fi

# ---------------- workflow 文件：走 Contents API ----------------
# git push 带 workflow 文件时，Deploy Key 必被拒；就算是 PAT，也要先传完整个
# pack 才拒。而 HTTPS 传 pack 在这条链路上不稳定（见文件头）。所以这里改成
# 逐文件 PUT —— 请求体只有几 KB，实测 1.3–2.2s，稳定。
WF_FILES=$(git diff --name-only --diff-filter=ACMR origin/main..HEAD 2>/dev/null \
           | grep -E '^\.github/workflows/' || true)

# 返回 HTTP 状态码；调用方判 200/201
api_put_file() {
  local path="$1" enc sha body
  enc=$(base64 -w0 < "$path")
  # 已存在则必须带 sha，否则 422
  sha=$(curl -sS -m 15 "${API_H[@]}" "$API/contents/${path}?ref=main" 2>/dev/null \
        | python3 -c 'import sys,json
try:
    d = json.load(sys.stdin)
    print(d.get("sha","") if isinstance(d, dict) else "")
except Exception:
    print("")')
  body=$(python3 -c 'import json,sys
b = {"message": "ci: sync " + sys.argv[3] + " from local", "content": sys.argv[1], "branch": "main"}
if sys.argv[2]:
    b["sha"] = sys.argv[2]
print(json.dumps(b))' "$enc" "$sha" "$(basename "$path")")
  curl -sS -m 25 -X PUT "${API_H[@]}" -d "$body" \
       "$API/contents/${path}" -o /tmp/ufo-api.json -w '%{http_code}'
}

if [ -n "$WF_FILES" ]; then
  if [ -z "$TOKEN" ] || [ "$WF_SCOPE" = 0 ]; then
    warn "本次要推 workflow 文件，但当前凭据没有 workflow 权限："
    printf '%s\n' "$WF_FILES" | sed 's/^/    /'
    if [ -n "$TOKEN" ]; then
      printf '\n  当前：%s（%s）%s\n' "$TOKEN_KIND" "$TOKEN_SRC" "${SCOPES:+  scopes: $SCOPES}"
    else
      printf '\n  当前：无 PAT，仅 Deploy Key —— 它永远推不了 workflow。\n'
    fi
    printf '\n  需要一个带 workflow 的 classic PAT：\n  %s\n' "$NEW_TOKEN_URL"
    printf '\n  写入后重跑（令牌只落本地文件，不进 git）：\n'
    printf '    printf %%s "ghp_xxx" > %s && chmod 600 %s\n' "$TOKEN_FILE" "$TOKEN_FILE"
    exit 3
  fi

  info "workflow 文件走 Contents API（${#WF_FILES} 个）…"
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    code=$(api_put_file "$f")
    case "$code" in
      200|201) ok "  $f  [$code]" ;;
      *)  warn "  $f  [$code]"
          python3 -c 'import json;d=json.load(open("/tmp/ufo-api.json"));print("   ",d.get("message",""))' 2>/dev/null
          die "workflow 提交失败 —— 若提示 workflow scope，换令牌后重试" ;;
    esac
  done <<< "$WF_FILES"

  # 远程已经有这些文件了。本地 commit 若只含 workflow，rebase 会把它当作
  # 空改动自动丢弃；若还含代码，代码部分保留。
  info "同步本地到远程（rebase）…"
  git fetch -q origin main
  if ! git rebase origin/main >/tmp/ufo-rebase.log 2>&1; then
    git rebase --abort 2>/dev/null
    tail -5 /tmp/ufo-rebase.log | sed 's/^/    /'
    die "workflow 已提交到远程，但本地 rebase 冲突。远程是最新的，请手动 git pull --rebase"
  fi
  ok "  rebase 完成  HEAD=$(git rev-parse --short HEAD)"
fi

# ---------------- 推送代码 ----------------
ASKPASS=""
cleanup() { [ -n "$ASKPASS" ] && rm -f "$ASKPASS"; }
trap cleanup EXIT

make_askpass() {
  ASKPASS=$(mktemp)
  cat > "$ASKPASS" <<'AP'
#!/bin/sh
case "$1" in
  *[Uu]sername*) printf '%s\n' "x-access-token" ;;
  *[Pp]assword*) printf '%s\n' "$UFO_GH_TOKEN" ;;
esac
AP
  chmod 700 "$ASKPASS"
}

# 只用于 --https 手动指定。必须关掉 HTTP/2：默认协议下 POST pack 会被卡死，
# 换成 HTTP/1.1 能救回一部分，但仍不如 SSH 稳。
push_https() {
  make_askpass
  GIT_ASKPASS="$ASKPASS" UFO_GH_TOKEN="$TOKEN" GIT_TERMINAL_PROMPT=0 \
    timeout 60 git -c credential.helper= -c protocol.version=2 \
      -c http.version=HTTP/1.1 -c http.extraHeader=Expect: \
      push "https://github.com/${SLUG}.git" HEAD:main >/tmp/ufo-push.log 2>&1
}

push_ssh() {
  local url
  url=$(git config --get remote.origin.url)
  case "$url" in
    https://*) git remote set-url origin "git@github.com:${SLUG}.git" ;;
  esac
  GIT_TERMINAL_PROMPT=0 timeout 90 git push origin HEAD:main >/tmp/ufo-push.log 2>&1
}

pushed=0; PUSH_MODE=""

if [ "$FORCE" = "https" ] && [ -n "$TOKEN" ]; then
  info "推送 GitHub（HTTPS + ${TOKEN_KIND}，HTTP/1.1）…"
  for i in 1 2 3; do
    if push_https; then pushed=1; PUSH_MODE="https"; break; fi
    if grep -qi 'workflow.*scope' /tmp/ufo-push.log; then break; fi
    if grep -qE 'Authentication failed|Invalid username or password|\b401\b' /tmp/ufo-push.log; then
      warn "token 无效或已过期"; break
    fi
    warn "第 $i 次失败（HTTPS 在此链路上不稳定），3 秒后重试"; sleep 3
  done
  [ "$pushed" = 1 ] || die "HTTPS 推送失败"
else
  info "推送 GitHub（SSH over 443，复用连接）…"
  for i in 1 2 3; do
    if push_ssh; then pushed=1; PUSH_MODE="ssh"; break; fi
    warn "第 $i 次失败，5 秒后重试"; sleep 5
  done

  if [ "$pushed" != 1 ]; then
    tail -6 /tmp/ufo-push.log
    if grep -qi "Permission denied (publickey)" /tmp/ufo-push.log; then
      printf '\n\033[33m部署密钥失效\033[0m —— GitHub 不再认识这把 key（被删或从未添加）。\n'
      printf '把下面公钥加到 https://github.com/%s/settings/keys ，勾 Allow write access：\n\n' "$SLUG"
      sed 's/^/  /' ~/.ssh/id_ed25519.pub
      printf '\n加完重跑本脚本，本地提交还在，不会丢。\n'
      exit 2
    fi
    die "SSH 推送失败"
  fi
fi

ok "推送成功   $(git rev-parse --short HEAD)   [$PUSH_MODE]"
[ -n "$SCOPES" ] && info "token scopes: $SCOPES"

[ "$WAIT" = 1 ] || exit 0

# 只改脚本 / 文档 / workflow 时，Vite 产出的 asset hash 不会变，
# 用签名判据会白等到超时。先看这次到底动没动前端。
APP_TOUCHED=$(git diff --name-only "$BASE..HEAD" 2>/dev/null \
              | grep -E '^(src/|index\.html|package\.json|vite\.config|public/|tailwind|postcss)' || true)
if [ -z "$APP_TOUCHED" ]; then
  ok "本次未触及前端源码，Cloudflare 仍会重建但无需等待"
  printf '  %s\n' "$SITE"
  exit 0
fi

# ---------------- 等部署 ----------------
info "等待 Cloudflare Pages 构建（通常 40–90 秒）…"
t0=$(date +%s)
while [ $(( $(date +%s) - t0 )) -lt "$MAX_WAIT" ]; do
  sleep 6
  if [ "$(sig)" != "$BEFORE" ]; then
    ok "已上线  用时 $(( $(date +%s) - t0 ))s"
    printf '  %s\n' "$SITE"
    exit 0
  fi
done

warn "等待 ${MAX_WAIT}s 未见变化，可能仍在构建"
printf '  https://github.com/%s/actions\n' "$SLUG"
printf '  https://dash.cloudflare.com → Workers & Pages → ufo\n'
exit 0
