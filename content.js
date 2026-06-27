(function () {
  "use strict";

  const STATE = {
    overlay: null,
    titleNode: null,
    questionNode: null,
    answerInput: null,
    messageNode: null,
    builtInSheets: [],
    userSheets: [],
    sheetSettings: {},
    currentGateKey: "",
    currentQuestion: null,
    lastObservedGateKey: "",
    lastObservedUrl: "",
    lastIntent: null,
    passedKeys: new Set()
  };

  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const Sheets = window.QuestionGateSheets;

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getEnabledQuestions() {
    return Sheets.getEnabledQuestions(STATE.builtInSheets.concat(STATE.userSheets), STATE.sheetSettings);
  }

  function makeQuestion() {
    const questions = getEnabledQuestions();
    return questions.length > 0 ? pick(questions) : null;
  }

  function getVideoIdFromUrl(value) {
    try {
      const url = new URL(value, window.location.origin);

      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || "";
      }

      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || "";
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function getVideoId() {
    return getVideoIdFromUrl(window.location.href);
  }

  function isYouTubeVideoHref(value) {
    return Boolean(getVideoIdFromUrl(value));
  }

  function getGateKey() {
    const videoId = getVideoId();
    return videoId ? `video:${videoId}` : "youtube:site";
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((video) => {
      video.pause();
      video.muted = true;
    });
  }

  function restoreVideos() {
    document.querySelectorAll("video").forEach((video) => {
      video.muted = false;
    });
  }

  function setMessage(text, isError) {
    if (!STATE.messageNode) return;
    STATE.messageNode.textContent = text;
    STATE.messageNode.dataset.error = isError ? "true" : "false";
  }

  function createOverlay() {
    if (STATE.overlay) return;

    const overlay = document.createElement("div");
    overlay.id = "yt-question-gate";
    overlay.innerHTML = `
      <form class="yqg-panel" autocomplete="off">
        <p class="yqg-eyebrow">Question Gate</p>
        <h1 class="yqg-title"></h1>
        <div class="yqg-question" aria-live="polite"></div>
        <label class="yqg-label" for="yqg-answer">Answer</label>
        <div class="yqg-row">
          <input id="yqg-answer" class="yqg-answer" type="text" inputmode="decimal" required />
          <button class="yqg-submit" type="submit">Unlock</button>
        </div>
        <p class="yqg-message" aria-live="polite"></p>
      </form>
    `;

    STATE.overlay = overlay;
    STATE.titleNode = overlay.querySelector(".yqg-title");
    STATE.questionNode = overlay.querySelector(".yqg-question");
    STATE.answerInput = overlay.querySelector(".yqg-answer");
    STATE.messageNode = overlay.querySelector(".yqg-message");
    overlay.querySelector("form").addEventListener("submit", submitAnswer);
  }

  function renderQuestion() {
    STATE.currentQuestion = makeQuestion();

    if (!STATE.currentQuestion) {
      hideGate();
      return;
    }

    STATE.titleNode.textContent = STATE.currentGateKey.startsWith("video:")
      ? "Answer to watch this video"
      : "Answer to use YouTube";
    STATE.questionNode.textContent = STATE.currentQuestion.text;
    STATE.answerInput.value = "";
    setMessage("", false);
    window.setTimeout(() => STATE.answerInput.focus(), 0);
  }

  function showGate(gateKey, options) {
    if (getEnabledQuestions().length === 0) {
      hideGate();
      return;
    }

    const forceNewQuestion = Boolean(options && options.forceNewQuestion);
    createOverlay();
    const previousGateKey = STATE.currentGateKey;
    STATE.currentGateKey = gateKey;

    if (!document.documentElement.contains(STATE.overlay)) {
      document.documentElement.appendChild(STATE.overlay);
    }

    document.documentElement.classList.add("yqg-is-locked");
    pauseVideos();

    if (forceNewQuestion || !STATE.currentQuestion || previousGateKey !== gateKey) {
      renderQuestion();
    } else {
      window.setTimeout(() => STATE.answerInput.focus(), 0);
    }
  }

  function hideGate() {
    if (STATE.overlay && STATE.overlay.parentNode) {
      STATE.overlay.parentNode.removeChild(STATE.overlay);
    }

    document.documentElement.classList.remove("yqg-is-locked");
    restoreVideos();
  }

  function unlockCurrentGate() {
    STATE.passedKeys.add(STATE.currentGateKey);
    STATE.passedKeys.add(getGateKey());
    hideGate();
  }

  function submitAnswer(event) {
    event.preventDefault();

    if (!STATE.currentQuestion) return;

    if (STATE.currentQuestion.answerType === "text") {
      if (Sheets.normalizeTextAnswer(STATE.answerInput.value) !== STATE.currentQuestion.answer) {
        setMessage(`Incorrect. Correct answer is ${STATE.currentQuestion.displayAnswer}.`, true);
        STATE.answerInput.select();
        return;
      }

      unlockCurrentGate();
      return;
    }

    const parsedAnswer = Sheets.parseAnswer(STATE.answerInput.value);
    if (!Number.isFinite(parsedAnswer)) {
      setMessage("Enter a number, decimal, or fraction.", true);
      return;
    }

    const tolerance = STATE.currentQuestion.tolerance || 0.000001;
    if (Math.abs(parsedAnswer - STATE.currentQuestion.answer) > tolerance) {
      const answerText = STATE.currentQuestion.displayAnswer || STATE.currentQuestion.answer;
      setMessage(`Incorrect. Correct answer is ${answerText}.`, true);
      STATE.answerInput.select();
      return;
    }

    unlockCurrentGate();
  }

  function shouldForceFromIntent(options) {
    if (!options || !options.forceFromIntent || !STATE.lastIntent) return false;
    return Boolean(STATE.lastIntent.videoId && STATE.lastIntent.videoId === getVideoId());
  }

  function evaluateGate(reason, options) {
    const gateKey = getGateKey();
    const url = window.location.href;
    const keyChanged = STATE.lastObservedGateKey !== gateKey;
    const urlChanged = STATE.lastObservedUrl !== url;
    const forceFromIntent = shouldForceFromIntent(options);
    const forceGate = Boolean(options && options.forceGate);

    STATE.lastObservedGateKey = gateKey;
    STATE.lastObservedUrl = url;

    if (getEnabledQuestions().length === 0) {
      hideGate();
      return;
    }

    if (STATE.passedKeys.has(gateKey) && !forceFromIntent && !forceGate) {
      hideGate();
      return;
    }

    if (
      forceGate ||
      forceFromIntent ||
      keyChanged ||
      urlChanged ||
      STATE.currentGateKey !== gateKey ||
      !STATE.overlay ||
      !document.documentElement.contains(STATE.overlay)
    ) {
      showGate(gateKey, { forceNewQuestion: STATE.currentGateKey !== gateKey || forceGate });
      return;
    }

    pauseVideos();
  }

  function scheduleEvaluations(reason, options) {
    [0, 50, 250, 750, 1500].forEach((delay) => {
      window.setTimeout(() => evaluateGate(`${reason}+${delay}ms`, options), delay);
    });
  }

  function recordNavigationIntent(reason, href, sourceText) {
    const videoId = getVideoIdFromUrl(href);
    STATE.lastIntent = {
      reason,
      href,
      videoId: videoId || null,
      sourceText: sourceText ? sourceText.slice(0, 120) : "",
      at: new Date().toISOString()
    };

    if (videoId) {
      scheduleEvaluations(reason, { forceFromIntent: true });
    }
  }

  async function loadBuiltInSheets() {
    try {
      STATE.builtInSheets = await Sheets.loadBuiltInSheets(extensionApi);
    } catch (error) {
      STATE.builtInSheets = [];
    }
  }

  async function loadQuestionSheets() {
    try {
      const settings = await Sheets.loadStoredSettings(extensionApi);
      STATE.userSheets = settings.userSheets;
      STATE.sheetSettings = settings.sheetSettings;
    } catch (error) {
      STATE.userSheets = [];
      STATE.sheetSettings = {};
    }
  }

  function patchHistoryMethod(methodName) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod() {
      const result = original.apply(this, arguments);
      window.dispatchEvent(new CustomEvent("yqg-location-change", {
        detail: {
          reason: `history.${methodName}`
        }
      }));
      return result;
    };
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", () => {
    window.dispatchEvent(new CustomEvent("yqg-location-change", {
      detail: {
        reason: "popstate"
      }
    }));
  });

  window.addEventListener("yqg-location-change", (event) => {
    scheduleEvaluations(event.detail.reason);
  });

  document.addEventListener("visibilitychange", () => {
    evaluateGate(`visibilitychange:${document.visibilityState}`);
  });

  document.addEventListener("click", (event) => {
    const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;

    const href = link.href || link.getAttribute("href");
    if (!href || !isYouTubeVideoHref(href)) return;

    recordNavigationIntent("capture-click-video-link", href, link.textContent || link.getAttribute("aria-label") || "");
  }, true);

  [
    "yt-navigate-start",
    "yt-navigate-finish",
    "yt-page-data-updated",
    "yt-page-type-changed",
    "yt-player-updated"
  ].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      scheduleEvaluations(`youtube-event:${eventName}`);
    }, true);
    document.addEventListener(eventName, () => {
      scheduleEvaluations(`youtube-document-event:${eventName}`);
    }, true);
  });

  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[Sheets.USER_SHEETS_KEY]) {
      STATE.userSheets = Sheets.normalizeStoredSheets(changes[Sheets.USER_SHEETS_KEY].newValue);
    }

    if (changes[Sheets.SHEET_SETTINGS_KEY]) {
      STATE.sheetSettings = changes[Sheets.SHEET_SETTINGS_KEY].newValue &&
        typeof changes[Sheets.SHEET_SETTINGS_KEY].newValue === "object" &&
        !Array.isArray(changes[Sheets.SHEET_SETTINGS_KEY].newValue)
        ? changes[Sheets.SHEET_SETTINGS_KEY].newValue
        : {};
    }

    evaluateGate("storage.onChanged", { forceGate: true });
  });

  const observer = new MutationObserver(() => {
    const gateKey = getGateKey();
    const url = window.location.href;

    if (gateKey !== STATE.lastObservedGateKey || url !== STATE.lastObservedUrl) {
      evaluateGate("mutation-observer-location-drift");
    } else if (STATE.overlay && document.documentElement.contains(STATE.overlay)) {
      pauseVideos();
    }
  });

  window.setInterval(() => {
    const gateKey = getGateKey();
    const url = window.location.href;

    if (gateKey !== STATE.lastObservedGateKey || url !== STATE.lastObservedUrl) {
      evaluateGate("polling-location-drift");
    }
  }, 1000);

  async function start() {
    await loadBuiltInSheets();
    await loadQuestionSheets();
    evaluateGate("startup");
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
