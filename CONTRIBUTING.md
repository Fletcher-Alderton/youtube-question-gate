# Contributing

Thanks for improving YouTube Question Gate.

## Development

1. Load the repository folder with Chrome `Load unpacked` or Firefox `Load Temporary Add-on...`.
2. Make changes.
3. Run `npm test`.
4. Run `npm run validate`.
5. Reload the extension in the browser.

## GitHub Releases

Run `npm run package` and upload the generated `dist/youtube-question-gate-<version>.zip` and `dist/youtube-question-gate-<version>.xpi` to the GitHub release.

## Pull requests

- Keep changes focused.
- Update `README.md` when behavior or setup changes.
- Add or update sample question sheets when schema behavior changes.
- Avoid adding build dependencies unless they remove real maintenance cost.
- Do not commit generated archives from `dist/`.
