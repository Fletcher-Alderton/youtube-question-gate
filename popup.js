(function () {
  "use strict";

  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const Sheets = window.QuestionGateSheets;
  const fileInput = document.getElementById("sheet-file");
  const builtInList = document.getElementById("builtin-sheet-list");
  const userList = document.getElementById("user-sheet-list");
  const clearButton = document.getElementById("clear-sheets");
  const resetBuiltInsButton = document.getElementById("reset-builtins");
  const showCorrectAnswerInput = document.getElementById("show-correct-answer");
  const statusNode = document.getElementById("status");

  let builtInSheets = [];
  let userSheets = [];
  let sheetSettings = {};
  let options = Object.assign({}, Sheets.DEFAULT_OPTIONS);

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.dataset.error = isError ? "true" : "false";
  }

  function isSheetEnabled(sheet) {
    return Sheets.isSheetEnabled(sheet, sheetSettings);
  }

  async function saveUserSheets() {
    await extensionApi.storage.local.set({ [Sheets.USER_SHEETS_KEY]: userSheets });
  }

  async function saveSheetSettings() {
    await extensionApi.storage.local.set({ [Sheets.SHEET_SETTINGS_KEY]: sheetSettings });
  }

  async function saveOptions() {
    await extensionApi.storage.local.set({ [Sheets.OPTIONS_KEY]: options });
  }

  async function loadBuiltInSheets() {
    builtInSheets = await Sheets.loadBuiltInSheets(extensionApi);
  }

  async function loadSettings() {
    const settings = await Sheets.loadStoredSettings(extensionApi);
    userSheets = settings.userSheets;
    sheetSettings = settings.sheetSettings;
    options = settings.options;
  }

  function renderSheetList(container, sheets, options) {
    container.textContent = "";

    if (sheets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = options.emptyText;
      container.appendChild(empty);
      return;
    }

    sheets.forEach((sheet) => {
      const item = document.createElement("article");
      item.className = "sheet";

      const row = document.createElement("div");
      row.className = "sheet-row";

      const summary = document.createElement("div");
      const title = document.createElement("p");
      title.className = "sheet-title";
      title.textContent = sheet.title;

      const meta = document.createElement("p");
      meta.className = "sheet-meta";
      meta.textContent = `${sheet.questions.length} question${sheet.questions.length === 1 ? "" : "s"}${sheet.description ? ` - ${sheet.description}` : ""}`;

      summary.append(title, meta);

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "toggle";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = isSheetEnabled(sheet);
      toggle.addEventListener("change", async () => {
        sheetSettings[sheet.id] = toggle.checked;
        await saveSheetSettings();
        setStatus(`${sheet.title} ${toggle.checked ? "enabled" : "disabled"}.`, false);
      });
      const toggleText = document.createElement("span");
      toggleText.textContent = "Enabled";
      toggleLabel.append(toggle, toggleText);

      row.append(summary, toggleLabel);
      item.appendChild(row);

      if (options.canDelete) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "danger-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
          userSheets = userSheets.filter((candidate) => candidate.id !== sheet.id);
          delete sheetSettings[sheet.id];
          await saveUserSheets();
          await saveSheetSettings();
          renderSheets();
          setStatus(`${sheet.title} deleted.`, false);
        });
        item.appendChild(deleteButton);
      }

      container.appendChild(item);
    });
  }

  function renderSheets() {
    renderSheetList(builtInList, builtInSheets, {
      canDelete: false,
      emptyText: "No built-in sheets are available."
    });
    renderSheetList(userList, userSheets, {
      canDelete: true,
      emptyText: "No uploaded sheets yet."
    });
  }

  function renderOptions() {
    showCorrectAnswerInput.checked = options.showCorrectAnswer;
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file.")));
      reader.readAsText(file);
    });
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      const incomingSheets = Array.isArray(parsed)
        ? parsed.map((sheet) => Sheets.normalizeSheet(sheet))
        : [Sheets.normalizeSheet(parsed)];
      const incomingIds = new Set(incomingSheets.map((sheet) => sheet.id));
      userSheets = userSheets.filter((sheet) => !incomingIds.has(sheet.id)).concat(incomingSheets);
      incomingSheets.forEach((sheet) => {
        sheetSettings[sheet.id] = sheet.enabled !== false;
      });
      await saveUserSheets();
      await saveSheetSettings();
      renderSheets();
      setStatus(`${incomingSheets.length} sheet${incomingSheets.length === 1 ? "" : "s"} uploaded.`, false);
    } catch (error) {
      setStatus(error.message || "Could not upload sheet.", true);
    } finally {
      fileInput.value = "";
    }
  });

  clearButton.addEventListener("click", async () => {
    userSheets.forEach((sheet) => {
      delete sheetSettings[sheet.id];
    });
    userSheets = [];
    await saveUserSheets();
    await saveSheetSettings();
    renderSheets();
    setStatus("Uploaded sheets cleared.", false);
  });

  resetBuiltInsButton.addEventListener("click", async () => {
    builtInSheets.forEach((sheet) => {
      delete sheetSettings[sheet.id];
    });
    await saveSheetSettings();
    renderSheets();
    setStatus("Built-in sheets reset.", false);
  });

  showCorrectAnswerInput.addEventListener("change", async () => {
    options.showCorrectAnswer = showCorrectAnswerInput.checked;
    await saveOptions();
    setStatus(`Correct answers ${options.showCorrectAnswer ? "shown" : "hidden"} after wrong attempts.`, false);
  });

  Promise.all([loadBuiltInSheets(), loadSettings()])
    .then(() => {
      renderOptions();
      renderSheets();
    })
    .catch((error) => {
      setStatus(error.message || "Could not load settings.", true);
    });
})();
