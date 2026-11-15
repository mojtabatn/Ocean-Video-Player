# Third-party components

- **Electron**, **React**, **Vite** — MIT.
- **FFmpeg** (LGPL build by BtbN) is downloaded at build time (`scripts/fetch-ffmpeg.mjs`) and shipped next to the app.
  Source and license: https://ffmpeg.org · https://github.com/BtbN/FFmpeg-Builds
- **FFmpeg for macOS** is compiled from the official FFmpeg source by `scripts/build-ffmpeg-mac.sh` (LGPL configuration,
  Apple VideoToolbox/AudioToolbox) with **dav1d** (BSD 2-clause, https://code.videolan.org/videolan/dav1d) linked in.
  The LGPL text is shipped next to the binaries.
- **Manrope** (UI) and **Vazirmatn** (subtitles) via Fontsource — SIL Open Font License.
- **Settings and home icons** (title bar): “Interface Setting Cog” and “Interface Home 5” from Streamline Core, https://www.streamlinehq.com — CC BY 4.0.
- **OMDb API** — IMDb ratings, https://www.omdbapi.com
- Online catalogue and links are read from Film2Media (tejaratban.top); Ocean is not affiliated with it.
