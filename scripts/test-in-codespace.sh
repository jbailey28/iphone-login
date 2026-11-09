#!/bin/sh
# Runs this component's tests in a GitHub codespace, never on this computer.
#
# It tests the files in the folder it's run from, exactly as they are: they're
# packed up and sent to the codespace, so a library copy is tested as itself.
# Supabase runs inside the codespace and is thrown away after. The exit code is
# the tests' exit code, so the component library records pass or fail.
#
# Nothing is ever deleted: each run unpacks into a brand-new folder under /tmp
# in the codespace, and leftover containers from an earlier run are stopped,
# not removed.
#
# Needs: the GitHub CLI signed in with the "codespace" permission.
# Takes several minutes; the library's test timeout must allow about 15.
set -u
REPO="${LOGIN_TEST_REPO:-jbailey28/login-component}"
NAME="login-tests"
KEY="${LOGIN_TEST_SSH_KEY:-$HOME/.component-library/keys/codespace_ed25519}"

say() { printf '%s\n' "$*" >&2; }

# A key used only to reach this codespace. Made once, kept outside any project.
if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")" && chmod 700 "$(dirname "$KEY")"
  ssh-keygen -q -t ed25519 -N "" -C "login-component tests" -f "$KEY" || { say "Couldn't make the SSH key."; exit 2; }
fi

CS="$(gh codespace list -R "$REPO" --json name,displayName -q ".[] | select(.displayName==\"$NAME\") | .name" 2>/dev/null | head -n 1)"
if [ -z "$CS" ]; then
  say "Creating the test codespace (first time only)..."
  CS="$(gh codespace create -R "$REPO" -b main -m standardLinux32gb --idle-timeout 30m --display-name "$NAME" 2>/dev/null | tail -n 1)"
  [ -n "$CS" ] || { say "Couldn't create a codespace for $REPO."; exit 2; }
fi

run() { gh codespace ssh -c "$CS" -- -i "$KEY" "$@"; }

say "Waiting for codespace $CS..."
i=0
until run 'command -v docker >/dev/null && docker info >/dev/null 2>&1 && echo up' 2>/dev/null | grep -q up; do
  i=$((i + 1)); [ "$i" -gt 60 ] && { say "The codespace didn't come up."; exit 2; }
  sleep 10
done

# A fresh folder for this run, inside the codespace.
RUN_DIR="/tmp/login-run-$(date +%s)-$$"

say "Sending the files to test..."
COPYFILE_DISABLE=1 tar --no-xattrs -czf - --exclude node_modules --exclude "._*" --exclude .git --exclude .supabase-status.json . | base64 \
  | run "mkdir -p '$RUN_DIR' && base64 -d | tar xzf - -C '$RUN_DIR'" || { say "Couldn't send the files."; exit 2; }

say "Running the tests in the codespace..."
run "cd '$RUN_DIR'"' \
  && export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=test-only.apps.googleusercontent.com SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=test-only-not-a-secret \
  && npm ci --legacy-peer-deps --no-audit --no-fund >/dev/null \
  && (npx supabase stop --no-backup >/dev/null 2>&1; true) \
  && (docker ps -q | xargs -r docker stop >/dev/null 2>&1; true) \
  && npx supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta >/dev/null \
  && npx supabase status -o json > .supabase-status.json \
  && npx vitest run; code=$?; npx supabase stop --no-backup >/dev/null 2>&1; exit $code'
code=$?

gh codespace stop -c "$CS" >/dev/null 2>&1
exit $code
