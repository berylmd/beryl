import { beforeEach, describe, it, assert, expect, test } from 'vitest'

import { initParser, parseProject, printProject } from '../dist/index.js'
import { Task } from '../dist/types.js'

describe("real world:",() => {
  it('should return empty on empty', () => {

    var result = parseProject("");
    assert.deepEqual(result, []);

    result = parseProject(null);
    assert.deepEqual(result, []);

    result = parseProject(undefined);
    assert.deepEqual(result, []);
  });

  // it('focus should return a meaningful error', function () {
  //
  //   var result = parseProject("bad");
  // });
})
// next step, check the parsed value and see if its right
