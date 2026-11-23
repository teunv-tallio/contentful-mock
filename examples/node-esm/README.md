# Node ESM example

A plain Node.js ES module (`"type": "module"`, `module: NodeNext`) that imports the
built package. It checks that `dist/index.js` type-checks and loads under Node's
native ESM loader, without a bundler or Vitest in between.

```bash
# from the repo root: build the mock so the example can import it
npm install && npm run build

cd examples/node-esm
npm install
npm test   # tsc, then node dist/index.js
```
