# Vite Plugin Emscripten

## Features

- [x] HMR
  - [x] Rebuild wasm module via cmake, on changes in select directories.
- [x] Minify
- [x] Patch
  - [x] Add electron support
  - [x] Inline worker file
  - [x] Disable inlining of .wasm file
- [x] Server
  - [x] Pass application/wasm mime type to served .wasm files
