# YouTube Question Gate

A Chrome and Firefox WebExtension that blocks YouTube until the user answers a question. It asks again when a different YouTube video, Short, or embed is opened.

## Features

- Blocks YouTube with a clean monochrome question overlay.
- Uses configurable JSON question sheets.
- Includes built-in sheets for maths, AI maths, probability, and general knowledge.
- Lets users upload, enable, disable, and delete sheets from the toolbar popup.
- Handles YouTube single-page navigation, recommended-video clicks, Shorts, and embeds.
- Supports numeric answers, decimals, fractions such as `1/4`, and short exact text answers.
- Uses system light/dark mode.
- Stores all uploaded sheets locally in browser extension storage.

## Install for Development

### Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository folder.
5. Click the extension icon in the toolbar to manage question sheets.

### Firefox

1. Open Firefox.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `manifest.json` from this repository.
5. Click the extension icon in the toolbar to manage question sheets.

Temporary add-ons are removed when Firefox restarts.

## Build

No external dependencies are required.

```sh
npm test
npm run validate
npm run package
```

The package command writes a zip file to `dist/`.

## Release Checklist

1. Update `manifest.json`, `package.json`, and `CHANGELOG.md` to the same version.
2. Run `npm run validate`.
3. Run `npm run package`.
4. Upload the generated `dist/youtube-question-gate-<version>.zip` to the GitHub release.

Generated archives in `dist/` are ignored by Git.

## Question Sheets

Question sheets are JSON files that match `question-sheet.schema.json`. A file can contain one sheet object or an array of sheet objects.

```json
{
  "schemaVersion": 1,
  "title": "Study Practice",
  "questions": [
    {
      "question": "What CSS property changes text color?",
      "answer": "color"
    },
    {
      "question": "What is P(all heads) for 3 fair coin flips?",
      "answer": "1/8",
      "tolerance": 0.005
    }
  ]
}
```

Use `sample-sheet.json` as a starting point. `tolerance` is optional and only applies to numeric answers.

## Built-In Sheets

Built-in sheets live in `sheets/` and are listed in `built-in-sheets.json`.

- Linear Algebra
- Calculus
- Probability
- AI Maths
- General Knowledge

Users can toggle each built-in sheet from the toolbar popup.

## Privacy

YouTube Question Gate does not send uploaded sheets, answers, or browsing data to a server. Settings and uploaded sheets are stored locally with browser extension `storage.local`.

See `PRIVACY.md` for the full privacy policy.

## License

MIT. See `LICENSE`.
