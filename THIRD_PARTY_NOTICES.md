# Third-party notices

## Lucide icons

The interface icon sprite (`src/renderer/index.html`, `<symbol id="i-…">`) uses
paths from, or redrawn after, Lucide Icons: `minimize-2`, `scaling`,
`arrow-left-right`, `case-sensitive`, `shield-check`, `upload`, `folder`,
`folder-open`, `plus`, `x`, `trash-2`, `check`, `triangle-alert`, `info`,
`search`, `lock`, `lock-open`, `refresh-cw`, `map-pin`, `camera`, `sparkles`,
`image`, `copy`, `pencil`, `arrow-right`, `download`, `zap`, `file`, `wifi`,
`smartphone`, and `qr-code`.

Lucide is distributed under the ISC License. Some Lucide icons are derived from
Feather and remain available under the MIT License. All icons are stored inline
and require no network access at runtime. One stroke style is used everywhere
(24 px grid, 1.75 stroke, round caps and joins).

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Source: https://github.com/lucide-icons/lucide

## QRCode

The local Wi-Fi receiver uses `qrcode` 1.5.4 to generate the session QR Code.
The QR image is created locally and no data is sent to an external service.

Copyright (c) 2012 Ryan Day

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Source: https://github.com/soldair/node-qrcode

## Local fonts

Inter is bundled locally in `src/renderer/assets/fonts/` (SIL Open Font
License 1.1; see `INTER-LICENSE.txt` beside the font file). No font is fetched
at runtime. Sora and Manrope were bundled by an earlier revision and have been
removed because the interface no longer uses them.

## Animation assets

No LottieFiles, Motion, or other animation assets are used. All motion is
authored with local CSS transitions, CSS `linear()` spring easings, and SVG.
The legacy generated GIF files are kept for compatibility but are not
referenced by the renderer.
