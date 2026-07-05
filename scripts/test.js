const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  window: {}
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "shared/question-sheets.js"), "utf8"), context);

const Sheets = context.window.QuestionGateSheets;

assert.strictEqual(Sheets.parseAnswer("1/4"), 0.25);
assert.strictEqual(Sheets.parseAnswer("-3 / 2"), -1.5);
assert(Number.isNaN(Sheets.parseAnswer("1/0")));
assert.strictEqual(Sheets.normalizeTextAnswer("  Answer  "), "answer");

const normalizedSheet = Sheets.normalizeSheet({
  schemaVersion: 1,
  id: "demo",
  title: " Demo Sheet ",
  description: " Demo description ",
  enabled: true,
  questions: [
    {
      question: "  What is 2 + 2?  ",
      answer: "4",
      tolerance: 0,
      tags: [" maths ", "", 4],
      explanation: " Arithmetic "
    },
    {
      question: "Name the CSS color property.",
      answer: " Color "
    }
  ]
});

assert.strictEqual(normalizedSheet.title, "Demo Sheet");
assert.strictEqual(normalizedSheet.description, "Demo description");
assert.strictEqual(normalizedSheet.questions[0].question, "What is 2 + 2?");
assert.deepStrictEqual(normalizedSheet.questions[0].tags, ["maths"]);
assert.strictEqual(normalizedSheet.questions[0].explanation, "Arithmetic");

const enabledQuestions = Sheets.getEnabledQuestions([normalizedSheet], {});
assert.strictEqual(enabledQuestions.length, 2);
assert.strictEqual(enabledQuestions[0].answer, 4);
assert.strictEqual(enabledQuestions[0].tolerance, 0);
assert.strictEqual(enabledQuestions[1].answerType, "text");
assert.strictEqual(enabledQuestions[1].answer, "color");

assert.deepStrictEqual(Sheets.getEnabledQuestions([normalizedSheet], { demo: false }), []);
assert.deepStrictEqual(Sheets.normalizeStoredSheets([{ bad: true }, normalizedSheet]), [normalizedSheet]);
assert.strictEqual(Sheets.normalizeOptions({ showCorrectAnswer: false }).showCorrectAnswer, false);
assert.strictEqual(Sheets.normalizeOptions({}).showCorrectAnswer, true);
assert.throws(() => {
  Sheets.normalizeSheet({
    schemaVersion: 1,
    id: "bad id",
    title: "Bad",
    questions: [{ question: "Question?", answer: "Answer" }]
  });
}, /Sheet id/);

console.log("Tests passed.");
