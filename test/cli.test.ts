import test from "node:test";
import assert from "node:assert/strict";

import { resolveCommandRoute } from "../src/cli.js";

test("resolveCommandRoute abre browse por padrao sem subcomando", () => {
  assert.equal(resolveCommandRoute(undefined), "browse");
});

test("resolveCommandRoute normaliza aliases conhecidos", () => {
  assert.equal(resolveCommandRoute("tui"), "browse");
  assert.equal(resolveCommandRoute("ls"), "list");
  assert.equal(resolveCommandRoute("rm"), "remove");
  assert.equal(resolveCommandRoute("uninstall"), "remove");
});

test("resolveCommandRoute preserva ui para a Web UI", () => {
  assert.equal(resolveCommandRoute("ui"), "ui");
  assert.equal(resolveCommandRoute("browse"), "browse");
});
