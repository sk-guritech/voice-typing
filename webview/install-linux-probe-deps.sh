set -eu

set -- ca-certificates curl gcc pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev \
  xvfb xauth dbus-x11 pulseaudio gstreamer1.0-plugins-base gstreamer1.0-pulseaudio
apt-get update
apt-get --print-uris -y --no-install-recommends install "$@" \
  | awk '/^\047/ {gsub(/\047/, "", $1); print $1, $2, $4}' \
  | xargs -r -n 3 -P 12 bash -c \
    '/usr/lib/apt/apt-helper download-file "$1" "/var/cache/apt/archives/$2" "$3"' _
apt-get install -y --no-install-recommends "$@"
