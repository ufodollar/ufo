#!/usr/bin/env bash
# UFO 站点一键发布
#
#   ./deploy.sh <提交信息>            提交并推送，等部署完成
#   ./deploy.sh <提交信息> --no-wait  推完就返回
#   ./deploy.sh <提交信息> --ssh      强制走 SSH（跳过 HTTPS）
#   ./deploy.sh <提交信息> --https    强制走 HTTPS（失败不回落）
#   ./deploy.sh --status              只看两条通道的连通性与权限，不推送
#
# 通道（同一沙箱实测，各三次采样）：
#   HTTPS + PAT        约 1.0s   支持 .github/workflows/*，权限可到账号级
#   SSH over 443 复用  约 1.3s   **推不了 workflow 文件**，只能动这一个仓库
#   SSH over 22        被阻断
#
# 为什么 HTTPS 更快：SSH 每次重做密钥协商（TCP 仅 0.09s，其余 3–4s 全在握手）；
# HTTPS 复用 TLS 会话，1 秒内走完。SSH 侧已配 ControlMaster，把 4.6s 压到 1.3s，
# 作为兜底够用。
#
# 凭据查找顺序（均不落盘、不进 argv）：
#   $GH_TOKEN / $GITHUB_TOKEN  →  ~/.config/ufo/github-token  →  gh auth token
#
# 要推 workflow 就必须是 classic PAT，scopes：
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
    t1=$(date +%s%N); ok "HTTPS 读写可达   $(( (t1-t0)/1000000 ))ms"
  else
    warn "HTTPS 不可达（会自动回落 SSH）"
  fi

  t0=$(date +%s%N)
  if ssh -o ConnectTimeout=10 -T git@github.com >/dev/null 2>&1 || [ $? = 1 ]; then
    t1=$(date +%s%N); ok "SSH 443 可达     $(( (t1-t0)/1000000 ))ms"
  else
    warn "SSH 443 不可达"
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

# ---------------- workflow 预检 ----------------
# Deploy Key 与“缺 workflow scope 的 PAT”都会被 GitHub 拒绝，而且是在传完 pack
# 之后才拒。这里在传之前就拦住，省一次白等。
WF_FILES=$(git diff --name-only --diff-filter=ACMR origin/main..HEAD 2>/dev/null \
           | grep -E '^\.github/workflows/' || true)

if [ -n "$WF_FILES" ] && [ "$WF_SCOPE" = 0 ]; then
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

# ---------------- 推送 ----------------
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

# token 只经环境变量传给 askpass：不写 remote url、不进 argv、不落 .git/config
push_https() {
  make_askpass
  GIT_ASKPASS="$ASKPASS" UFO_GH_TOKEN="$TOKEN" GIT_TERMINAL_PROMPT=0 \
    timeout 90 git -c credential.helper= -c protocol.version=2 \
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

if [ -n "$TOKEN" ] && [ "$FORCE" != "ssh" ]; then
  info "推送 GitHub（HTTPS + ${TOKEN_KIND}）…"
  for i in 1 2 3; do
    if push_https; then pushed=1; PUSH_MODE="https"; break; fi
    if grep -qi 'workflow.*scope' /tmp/ufo-push.log; then break; fi
    if grep -qE 'Authentication failed|Invalid username or password|\b401\b' /tmp/ufo-push.log; then
      warn "token 无效或已过期"; break
    fi
    warn "第 $i 次失败，3 秒后重试"; sleep 3
  done
fi

if [ "$pushed" != 1 ]; then
  if grep -qi 'workflow.*scope' /tmp/ufo-push.log 2>/dev/null; then
    printf '\n\033[31m✗ 令牌缺少 workflow scope\033[0m\n'
    tail -4 /tmp/ufo-push.log | sed 's/^/    /'
    printf '\n  重新生成并勾上 workflow：\n  %s\n\n' "$NEW_TOKEN_URL"
    exit 3
  fi

  [ "$FORCE" = "https" ] && die "HTTPS 推送失败（--https 指定不回落）"
  [ -n "$WF_FILES" ] && die "workflow 文件只能经 HTTPS + PAT 推送，SSH 必定被拒"

  if [ -n "$TOKEN" ] && grep -qE 'Authentication failed|\b401\b' /tmp/ufo-push.log 2>/dev/null; then
    warn "HTTPS 认证失败，回落 SSH over 443"
  fi

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
    die "两种通道均推送失败"
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
