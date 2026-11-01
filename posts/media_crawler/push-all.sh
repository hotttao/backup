#!/usr/bin/env bash
# Push the seven code repositories; deploy/ and .github/ are excluded.
set -uo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
REPOS=(
  MediaCrawlerPro-ContentRemixAgent
  MediaCrawlerPro-CookieBridge
  MediaCrawlerPro-Downloader
  MediaCrawlerPro-Golang
  MediaCrawlerPro-Python
  MediaCrawlerPro-SignSrv
  PicTacticAgent
)
SUCCEEDED=()
FAILED=()

for repo in "${REPOS[@]}"; do
  printf '\n===== %s =====\n' "$repo"
  repo_dir="$ROOT_DIR/$repo"

  if ! remote_url="$(git -C "$repo_dir" remote get-url --push origin)"; then
    FAILED+=("$repo")
    continue
  fi
  case "$remote_url" in
    git@gitee.com:media-ai/*.git) ;;
    *)
      printf '跳过：origin 的推送地址不是 media-ai 的 Gitee SSH 地址：%s\n' "$remote_url" >&2
      FAILED+=("$repo")
      continue
      ;;
  esac

  if ! worktree_status="$(git -C "$repo_dir" status --porcelain)"; then
    FAILED+=("$repo")
    continue
  fi
  if [[ -n "$worktree_status" ]]; then
    printf '提示：存在未提交修改，下面的 push 仅包含已有提交：\n%s\n' "$worktree_status"
  fi

  if git -C "$repo_dir" push --set-upstream origin main; then
    SUCCEEDED+=("$repo")
  else
    FAILED+=("$repo")
  fi
done

printf '\n推送结束：成功 %d，失败 %d。\n' "${#SUCCEEDED[@]}" "${#FAILED[@]}"
if (( ${#FAILED[@]} > 0 )); then
  printf '失败仓库：\n'
  printf '  %s\n' "${FAILED[@]}"
  exit 1
fi
