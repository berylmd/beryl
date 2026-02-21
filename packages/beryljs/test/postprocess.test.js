import { describe, it, assert } from 'vitest'
import { parseProject } from '../dist/index.js'

describe("post process", () => {
  it('doesnt crash', () => {
    const sub = "- [ ] blarg\n\t- [ ] blarg"
    assert.ok(parseProject(sub));
  });
  it('errors on bad format', () => {
    const sub = `\t\t- [ ] blarg\n\t\t\t\t- [ ] blarg`
    assert.throws(() => {parseProject(sub)});
  });
  it('no subtasks works', () => {
    const result = parseProject(`- [ ] nosubs\n- [ ] bleg`);
    assert.equal(result.length, 2)
    assert.equal(result[0].description, "nosubs")
    assert.equal(result[1].description, "bleg")
  });
  it('one subtask works', () => {
    const result = parseProject(`- [ ] task\n\t- [ ] subtask`);
    assert.equal(result.length, 1)
    assert.equal(result[0].description, "task")
    assert.equal(result[0].subtasks[0].description, "subtask")
  });
  it('two subtask works', () => {
    const result = parseProject(`- [ ] task\n\t- [ ] subtask\n\t- [ ] subtask2`);
    assert.equal(result.length, 1)
    assert.equal(result[0].description, "task")
    assert.equal(result[0].subtasks[0].description, "subtask")
    assert.equal(result[0].subtasks[1].description, "subtask2")
  });
  it('one subtask and aunt', () => {
    const result = parseProject(`- [ ] task\n\t- [ ] subtask\n- [ ] aunt`);
    assert.equal(result.length, 2)
    assert.equal(result[0].description, "task")
    assert.equal(result[0].subtasks[0].description, "subtask")
    assert.equal(result[1].description, "aunt")
  });
  it('hard', () => {
    const tasks = `- [ ] 1
  - [ ] 2
    - [ ] 3
  - [ ] 4
- [ ] 5
- [ ] 6
  - [ ] 7
    - [ ] 8`
    const result = parseProject(tasks);
    assert.equal(result.length, 3)
    assert.equal(result[0].description, "1")
    assert.equal(result[0].subtasks[0].description, "2")
    assert.equal(result[0].subtasks[0].subtasks[0].description, "3")
    assert.equal(result[1].description, "5")
    assert.equal(result[2].description, "6")
    assert.equal(result[2].subtasks[0].description, "7")
    assert.equal(result[2].subtasks[0].subtasks[0].description, "8")
  });
})
