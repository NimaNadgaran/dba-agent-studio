import assert from "node:assert/strict";
import { test } from "node:test";
import { demoChoice, demoDesign } from "../src/lib/demo";
import { designDocumentNames, designTextOutputs } from "../src/lib/design-documents";
import { writeDesign } from "../src/lib/artifacts";
import { newSession } from "../src/lib/workflow";

function sessionWithDesign() {
  const session = newSession("", { provider: "demo", model: "", baseUrl: "" });
  session.design = demoDesign(); session.choice = structuredClone(demoChoice); session.designVersion = 1;
  return session;
}

test("all four design outputs are explanatory text without embedded diagrams, images or tables", () => {
  const session = sessionWithDesign();
  const before = JSON.stringify(session.design);
  const outputs = designTextOutputs(session);
  assert.deepEqual(outputs.map(output => output.name), designDocumentNames);
  for (const output of outputs) {
    assert.match(output.content, /This text explains/);
    assert.doesNotMatch(output.content, /```|erDiagram|<svg|<img|!\[|^\|/m);
    assert.ok(output.content.length > 200);
  }
  for (const table of session.design!.tables) {
    for (const column of table.columns) {
      assert.ok(outputs[0].content.includes(column.name));
      assert.ok(outputs[1].content.includes(column.name));
    }
    assert.ok(outputs[2].content.includes(table.normalization));
  }
  assert.equal(JSON.stringify(session.design), before);
  writeDesign(session);
  for (const output of outputs) assert.equal(session.artifacts[output.name].content, output.content);
  assert.deepEqual(JSON.parse(session.artifacts["design.json"].content), session.design);
});

test("text explanations distinguish optional one-to-one links from required many-to-one links", () => {
  const session = sessionWithDesign();
  const members = session.design!.tables.find(table => table.name === "members")!;
  members.indexes.push({ name: "members_preferred_unique", columns: ["preferred_space_id"], unique: true });
  const text = designTextOutputs(session)[0].content;
  assert.match(text, /Each members record may reference zero or one spaces record/);
  assert.match(text, /Each spaces record can have zero or one related members records/);
  assert.match(text, /Each bookings record must reference exactly one members record/);
  assert.match(text, /Each members record can have zero or many related bookings records/);
});

test("text outputs wait for a canonical design and database choice", () => {
  const session = newSession("", { provider: "demo", model: "", baseUrl: "" });
  assert.deepEqual(designTextOutputs(session), []);
  session.design = demoDesign();
  assert.deepEqual(designTextOutputs(session), []);
});
