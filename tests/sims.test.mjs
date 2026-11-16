// Ejecutar con: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cases, smoke } from './cases.mjs';

for (const [name, fn] of [...cases, ...smoke]) {
  test(name, () => assert.doesNotThrow(fn));
}
