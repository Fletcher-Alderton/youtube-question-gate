(function () {
  "use strict";

  const USER_SHEETS_KEY = "gatekeeperUserSheets";
  const SHEET_SETTINGS_KEY = "gatekeeperSheetSettings";
  const OPTIONS_KEY = "gatekeeperOptions";
  const CURRENT_SCHEMA_VERSION = 1;
  const DEFAULT_NUMERIC_TOLERANCE = 0.000001;
  const SHEET_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
  const DEFAULT_OPTIONS = {
    showCorrectAnswer: true
  };

  function parseAnswer(value) {
    const trimmed = String(value).trim();
    const fractionMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);

    if (fractionMatch) {
      const numerator = Number(fractionMatch[1]);
      const denominator = Number(fractionMatch[2]);
      return denominator === 0 ? NaN : numerator / denominator;
    }

    return Number(trimmed);
  }

  function normalizeTextAnswer(value) {
    return String(value).trim().toLowerCase();
  }

  function makeId(title) {
    const base = String(title)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "sheet";
    const suffix = Date.now().toString(36);
    return `${base}-${suffix}`;
  }

  function assertString(value, label, maxLength) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${label} must be a non-empty string.`);
    }

    if (value.length > maxLength) {
      throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    }
  }

  function validateQuestion(question, index) {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`Question ${index + 1} must be an object.`);
    }

    assertString(question.question, `Question ${index + 1} text`, 500);

    const answerType = typeof question.answer;
    if (answerType !== "string" && answerType !== "number") {
      throw new Error(`Question ${index + 1} answer must be a string or number.`);
    }

    if (answerType === "string" && question.answer.trim() === "") {
      throw new Error(`Question ${index + 1} answer must not be empty.`);
    }

    if (
      question.tolerance !== undefined &&
      (typeof question.tolerance !== "number" || !Number.isFinite(question.tolerance) || question.tolerance < 0)
    ) {
      throw new Error(`Question ${index + 1} tolerance must be a positive number or zero.`);
    }
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function normalizeSheet(rawSheet, options) {
    if (!isPlainObject(rawSheet)) {
      throw new Error("Sheet must be a JSON object.");
    }

    if (rawSheet.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Sheet schemaVersion must be ${CURRENT_SCHEMA_VERSION}.`);
    }

    assertString(rawSheet.title, "Sheet title", 80);

    if (rawSheet.id !== undefined && (typeof rawSheet.id !== "string" || !SHEET_ID_PATTERN.test(rawSheet.id.trim()))) {
      throw new Error("Sheet id may contain only letters, numbers, dots, underscores, and hyphens.");
    }

    if (!Array.isArray(rawSheet.questions) || rawSheet.questions.length === 0) {
      throw new Error("Sheet questions must be a non-empty array.");
    }

    rawSheet.questions.forEach(validateQuestion);

    return {
      schemaVersion: 1,
      id: typeof rawSheet.id === "string" && rawSheet.id.trim() ? rawSheet.id.trim() : makeId(rawSheet.title),
      title: rawSheet.title.trim(),
      description: typeof rawSheet.description === "string" ? rawSheet.description.trim() : "",
      builtin: Boolean(options && options.builtin),
      enabled: rawSheet.enabled !== false,
      questions: rawSheet.questions.map((question) => ({
        question: question.question.trim(),
        answer: question.answer,
        tolerance: Number.isFinite(question.tolerance) ? question.tolerance : undefined,
        tags: Array.isArray(question.tags)
          ? question.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)
          : [],
        explanation: typeof question.explanation === "string" ? question.explanation.trim() : ""
      }))
    };
  }

  function normalizeStoredSheets(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map((sheet) => {
        try {
          return normalizeSheet(sheet);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  }

  function normalizeOptions(value) {
    if (!isPlainObject(value)) return Object.assign({}, DEFAULT_OPTIONS);

    return {
      showCorrectAnswer: value.showCorrectAnswer !== false
    };
  }

  function isSheetEnabled(sheet, sheetSettings) {
    if (Object.prototype.hasOwnProperty.call(sheetSettings, sheet.id)) {
      return sheetSettings[sheet.id] !== false;
    }

    return sheet.enabled !== false;
  }

  function normalizeSheetQuestion(sheet, question, index) {
    const answerAsNumber = typeof question.answer === "number"
      ? question.answer
      : parseAnswer(String(question.answer));

    if (Number.isFinite(answerAsNumber)) {
      return {
        text: `${sheet.title}\n${question.question}`,
        answer: answerAsNumber,
        displayAnswer: String(question.answer),
        tolerance: Number.isFinite(question.tolerance) ? question.tolerance : DEFAULT_NUMERIC_TOLERANCE,
        source: sheet.id,
        sourceIndex: index
      };
    }

    return {
      text: `${sheet.title}\n${question.question}`,
      answer: normalizeTextAnswer(question.answer),
      answerType: "text",
      displayAnswer: String(question.answer),
      source: sheet.id,
      sourceIndex: index
    };
  }

  function getEnabledQuestions(sheets, sheetSettings) {
    return sheets
      .filter((sheet) => isSheetEnabled(sheet, sheetSettings))
      .flatMap((sheet) => sheet.questions.map((question, index) => normalizeSheetQuestion(sheet, question, index)));
  }

  async function loadBuiltInSheets(extensionApi) {
    const indexUrl = extensionApi.runtime.getURL("built-in-sheets.json");
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      throw new Error(`Could not load built-in sheet index: ${indexResponse.status}`);
    }

    const sheetPaths = await indexResponse.json();
    if (!Array.isArray(sheetPaths)) {
      throw new Error("Built-in sheet index must be an array.");
    }

    const sheetResponses = await Promise.all(
      sheetPaths.map(async (sheetPath) => {
        const response = await fetch(extensionApi.runtime.getURL(sheetPath));
        if (!response.ok) {
          throw new Error(`Could not load built-in sheet ${sheetPath}: ${response.status}`);
        }
        return response.json();
      })
    );

    return sheetResponses.map((sheet) => normalizeSheet(sheet, { builtin: true }));
  }

  async function loadStoredSettings(extensionApi) {
    const result = await extensionApi.storage.local.get([USER_SHEETS_KEY, SHEET_SETTINGS_KEY, OPTIONS_KEY]);

    return {
      userSheets: normalizeStoredSheets(result[USER_SHEETS_KEY]),
      sheetSettings: isPlainObject(result[SHEET_SETTINGS_KEY])
        ? result[SHEET_SETTINGS_KEY]
        : {},
      options: normalizeOptions(result[OPTIONS_KEY])
    };
  }

  window.QuestionGateSheets = {
    DEFAULT_OPTIONS,
    OPTIONS_KEY,
    USER_SHEETS_KEY,
    SHEET_SETTINGS_KEY,
    getEnabledQuestions,
    isSheetEnabled,
    loadBuiltInSheets,
    loadStoredSettings,
    normalizeOptions,
    normalizeSheet,
    normalizeStoredSheets,
    normalizeTextAnswer,
    parseAnswer
  };
})();
