// The framework-free half of chessiro-canvas (FEN, geometry, move diffing,
// the motion model), shared with the web board. Imported by relative path and
// bundled into this package's build, so the native package never depends on
// the web package (and its react-dom peer) at runtime.
export * from '../../src/core';
