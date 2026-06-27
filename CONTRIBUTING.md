# Contributing

Thanks for improving YouTube Question Gate.

## Development

1. Load the extension from `manifest.json` with `about:debugging#/runtime/this-firefox`.
2. Make changes.
3. Run `npm test`.
4. Run `npm run validate`.
5. Reload the temporary add-on in Firefox.

## Pull requests

- Keep changes focused.
- Update `README.md` when behavior or setup changes.
- Add or update sample question sheets when schema behavior changes.
- Avoid adding build dependencies unless they remove real maintenance cost.
- Do not commit generated archives from `dist/`.
