set -eu

probe=${1:-/usr/local/bin/voice-typing}
key_script=$2
scratch=$(mktemp -d)
export VOICE_PROBE_BIN="$probe" VOICE_PROBE_RESULT="$scratch/result.txt"
export VOICE_PROBE_LOG="$scratch/webview.log" VOICE_PROBE_KEY_SCRIPT="$key_script"
stat -c 'Binary size: %s bytes' "$probe"
status=0
dbus-run-session -- bash -c '
  pulseaudio --start --exit-idle-time=-1
  exec timeout --kill-after=3s 20s xvfb-run -a bash -c "\
    \"\$VOICE_PROBE_BIN\" --self-test \"\$VOICE_PROBE_RESULT\" >\"\$VOICE_PROBE_LOG\" 2>&1 &\
    child=\$!;\
    for attempt in \$(seq 1 100); do\
      if grep -Fq \"Ready for Page Down\" \"\$VOICE_PROBE_LOG\"; then\
        python3 \"\$VOICE_PROBE_KEY_SCRIPT\" || exit 1;\
        break;\
      fi;\
      if ! kill -0 \"\$child\" 2>/dev/null; then break; fi;\
      sleep 0.1;\
    done;\
    wait \"\$child\""
' || status=$?
cat "$VOICE_PROBE_LOG"
test "$status" -eq 0
grep -F 'final result passed' "$VOICE_PROBE_RESULT"
