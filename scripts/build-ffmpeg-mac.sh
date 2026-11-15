#!/usr/bin/env bash
# Builds FFmpeg (ffmpeg + ffprobe) for macOS into vendor/ffmpeg/darwin-<arch>, bundled by electron-builder.
# Runs on a Mac (the CI uses GitHub's macOS runners). LGPL build, like the Windows one: no x264/x265.
#   - VideoToolbox: hardware H.264/HEVC encoding for on-the-fly conversion, hardware decoding
#   - AudioToolbox, Secure Transport (https), zlib/bzip2/iconv from macOS itself
#   - dav1d (BSD) for AV1, built here and linked statically
# The binaries are self-contained: they only link to libraries every Mac has. No capture devices, except lavfi
# (generated test input; Ocean uses it to find a working H.264 encoder).
#
# Usage: scripts/build-ffmpeg-mac.sh [arm64|x64]     (default: this Mac's architecture; the other one cross-compiles)
# Needs: Xcode command line tools, nasm, pkg-config, meson, ninja  (brew install nasm pkgconf meson ninja)
set -euo pipefail

FFMPEG_VERSION=9.0.2
DAV1D_VERSION=1.5.4
MIN_MACOS=12.0 # same as Electron 38

arch=${1:-$(uname -m)}
[ "$arch" = x86_64 ] && arch=x64
case "$arch" in
  arm64) cpu=arm64 ;;
  x64) cpu=x86_64 ;;
  *) echo "Unknown architecture: $arch" >&2; exit 1 ;;
esac
host=$(uname -m)
cross=0
[ "$host" != "$cpu" ] && cross=1

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/vendor/ffmpeg/darwin-$arch"
work="$root/vendor/ffmpeg/build-darwin-$arch"
prefix="$work/prefix"

if [ -x "$out/ffmpeg" ] && [ -x "$out/ffprobe" ] && [ "${FORCE:-0}" != 1 ]; then
  echo "FFmpeg already present in $out"
  exit 0
fi

jobs=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
export MACOSX_DEPLOYMENT_TARGET=$MIN_MACOS
flags="-arch $cpu -mmacosx-version-min=$MIN_MACOS"
rm -rf "$work"
mkdir -p "$work" "$prefix" "$out"
cd "$work"

# Source archive → $dir (first URL that answers; the GitHub mirrors are the fallback).
unpack() {
  local dir=$1; shift
  for url in "$@"; do
    if curl -fsSL --retry 3 --retry-delay 5 -o src.tar.gz "$url"; then
      mkdir -p "$dir" && tar -xf src.tar.gz -C "$dir" --strip-components=1 && rm src.tar.gz && return 0
    fi
    echo "Could not download $url" >&2
  done
  return 1
}

# --- dav1d -----------------------------------------------------------------------------------------------------
echo "Building dav1d $DAV1D_VERSION for $arch"
unpack dav1d \
  "https://code.videolan.org/videolan/dav1d/-/archive/$DAV1D_VERSION/dav1d-$DAV1D_VERSION.tar.gz" \
  "https://github.com/videolan/dav1d/archive/refs/tags/$DAV1D_VERSION.tar.gz"
cat > cross.txt <<EOF
[binaries]
c = ['clang', '-arch', '$cpu']
cpp = ['clang++', '-arch', '$cpu']
ar = 'ar'
strip = 'strip'
nasm = 'nasm'
pkg-config = 'pkg-config'

[built-in options]
c_args = ['-mmacosx-version-min=$MIN_MACOS']
c_link_args = ['-mmacosx-version-min=$MIN_MACOS']

[host_machine]
system = 'darwin'
cpu_family = '$cpu'
cpu = '$cpu'
endian = 'little'
EOF
(
  cd dav1d
  opts=(--prefix="$prefix" --libdir=lib --buildtype=release --default-library=static
    -Denable_tools=false -Denable_tests=false -Denable_examples=false)
  if [ $cross = 1 ]; then
    meson setup build --cross-file "$work/cross.txt" "${opts[@]}"
  else
    CFLAGS="$flags" LDFLAGS="$flags" meson setup build "${opts[@]}"
  fi
  ninja -C build install
)

# --- FFmpeg ----------------------------------------------------------------------------------------------------
echo "Building FFmpeg $FFMPEG_VERSION for $arch"
unpack ffmpeg \
  "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.gz" \
  "https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n$FFMPEG_VERSION.tar.gz"
crossopts=()
[ $cross = 1 ] && crossopts=(--enable-cross-compile)
(
  cd ffmpeg
  # Only our own .pc files: nothing from Homebrew may end up linked into the binaries.
  PKG_CONFIG_LIBDIR="$prefix/lib/pkgconfig" ./configure \
    --prefix="$prefix" \
    --arch="$cpu" --target-os=darwin --cc="clang -arch $cpu" --cxx="clang++ -arch $cpu" ${crossopts[@]+"${crossopts[@]}"} \
    --extra-cflags="-mmacosx-version-min=$MIN_MACOS" \
    --extra-ldflags="-mmacosx-version-min=$MIN_MACOS" \
    --extra-libs=-liconv \
    --pkg-config-flags=--static \
    --disable-debug --disable-doc --disable-ffplay \
    --disable-autodetect \
    --enable-videotoolbox --enable-audiotoolbox --enable-securetransport \
    --enable-zlib --enable-bzlib --enable-iconv \
    --enable-libdav1d \
    --disable-indevs --enable-indev=lavfi --disable-outdevs
  make -j"$jobs"
  make install
)

cp "$prefix/bin/ffmpeg" "$prefix/bin/ffprobe" "$out/"
for b in ffmpeg ffprobe; do
  # Must not depend on anything a fresh Mac lacks.
  if otool -L "$out/$b" | tail -n +2 | grep -vE '^[[:space:]]+(/usr/lib/|/System/Library/)'; then
    echo "$b links to a library outside macOS (listed above)" >&2
    exit 1
  fi
  codesign --force --sign - "$out/$b" # ad-hoc signature (Apple Silicon refuses to run unsigned code)
done
lipo -info "$out/ffmpeg"
cp ffmpeg/COPYING.LGPLv2.1 "$out/LICENSE-ffmpeg.txt"
rm -rf "$work"
echo "FFmpeg $FFMPEG_VERSION (LGPL) ready in $out"
