# React example

A minimal React app that fetches one entry.

- **App code** ([src/contentful.ts](src/contentful.ts)) uses the real `contentful` client.
- **Tests** ([tests/App.test.tsx](tests/App.test.tsx)) `vi.mock` that module and swap in
  `createDeliveryClient` from `@tallio/contentful-mock`, seeded with an in-memory entry.

## Setup

```bash
# from the repo root: build the mock so the example can import it
npm install && npm run build

cd examples/react-app
npm install
npm test                 # runs against the mock, no network
cp .env.example .env     # add real credentials to use `npm run dev`
npm run dev
```
