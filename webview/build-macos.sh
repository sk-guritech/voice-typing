#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
case $(go env GOARCH) in
  arm64) arch=arm64 ;;
  amd64) arch=x64 ;;
  *) echo 'Unsupported Mac CPU' >&2; exit 1 ;;
esac

app="../dist/macos-$arch/Voice Typing.app"
archive="../release/Voice-Typing-1.0.0-macos-$arch.zip"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" ../release
cp Info.plist "$app/Contents/Info.plist"
cp assets/icon.icns "$app/Contents/Resources/icon.icns"
plutil -lint "$app/Contents/Info.plist"
CGO_ENABLED=1 MACOSX_DEPLOYMENT_TARGET=13.0 \
  CGO_LDFLAGS='-framework UniformTypeIdentifiers -mmacosx-version-min=13.0' \
  go build -tags production -trimpath -ldflags '-s -w' -o "$app/Contents/MacOS/voice-typing" .
codesign --force --sign - "$app"
codesign --verify --strict "$app"
ditto -c -k --keepParent "$app" "$archive.tmp"
mv -f "$archive.tmp" "$archive"
