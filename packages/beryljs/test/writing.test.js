import { beforeEach, describe, it, assert, expect, test } from 'vitest';

import { parseProject, printProject } from '../dist/index.js';
import { Task } from '../dist/types.js';

describe('writing', () => {
  it('prints empty task', () => {
    const result = printProject([new Task({ indent: 0, checked: true })]);
    assert.equal(result, '- [x]\n');
  });
  it('prints empty task', () => {
    const result = printProject([new Task({ indent: 0, checked: false })]);
    assert.equal(result, '- [ ]\n');
  });
  it('prints task with words', () => {
    const result = printProject([new Task({ indent: 0, checked: false, description: 'stuff' })]);
    assert.equal(result, '- [ ] stuff\n');
  });

  it('prints complicated task', () => {
    const hard = [
      new Task({
        indent: 0,
        checked: false,
        description: '1',
        labels: [],
        subtasks: [
          new Task({
            indent: 1,
            checked: false,
            description: '2',
            labels: [],
            subtasks: [new Task({ indent: 2, checked: false, description: '3', labels: [] })],
            comments: '',
          }),
          new Task({ indent: 1, checked: false, description: '4', labels: [] }),
        ],
        comments: '',
      }),
      new Task({ indent: 0, checked: false, description: '5', labels: [] }),
      new Task({
        indent: 0,
        checked: false,
        description: '6',
        labels: [],
        subtasks: [
          new Task({
            indent: 1,
            checked: false,
            description: '7',
            labels: [],
            subtasks: [new Task({ indent: 2, checked: false, description: '8', labels: [] })],
            comments: '',
          }),
        ],
        comments: '',
      }),
    ];

    const tasks = `- [ ] 1
  - [ ] 2
    - [ ] 3
  - [ ] 4
- [ ] 5
- [ ] 6
  - [ ] 7
    - [ ] 8\n`;
    const result = printProject(hard);
    assert.equal(result, tasks);
  });

  it('prints complicated task with comment', () => {
    const hard = [
      new Task({
        indent: 0,
        checked: false,
        description: '1',
        labels: [],
        subtasks: [
          new Task({
            indent: 1,
            checked: false,
            description: '2',
            labels: [],
            subtasks: [
              new Task({
                indent: 2,
                checked: false,
                description: '3',
                labels: [],
                comments: ['comment3'],
              }),
            ],
            comments: ['comment2'],
          }),
          new Task({ indent: 1, checked: false, description: '4', labels: [] }),
        ],
        comments: ['comment'],
      }),
      new Task({ indent: 0, checked: false, description: '5', labels: [] }),
      new Task({
        indent: 0,
        checked: false,
        description: '6',
        labels: [],
        subtasks: [
          new Task({
            indent: 1,
            checked: false,
            description: '7',
            labels: [],
            subtasks: [new Task({ indent: 2, checked: false, description: '8', labels: [] })],
          }),
        ],
      }),
    ];

    const tasks = `- [ ] 1
  >comment
  - [ ] 2
    >comment2
    - [ ] 3
      >comment3
  - [ ] 4
- [ ] 5
- [ ] 6
  - [ ] 7
    - [ ] 8\n`;
    const result = printProject(hard);
    assert.equal(result, tasks);
  });

  it('correctly parses complicated with comments', () => {
    const input = `- [ ] 1
  >comment
  - [ ] 2
    >comment2
    - [ ] 3
  - [ ] 4
- [ ] 5
- [ ] 6
  - [ ] 7
    - [ ] 8\n`;

    const parsed = parseProject(input);
    // const output = printProject(parsed);

    // console.log(input,parsed,output)

    assert.equal(parsed.length, 3);
  });

  it('identical after parsing and unparsing comments', () => {
    const input = `- [ ] 1
  >comment
  - [ ] 2
    >comment2
    - [ ] 3
      >comment3
  - [ ] 4
- [ ] 5
- [ ] 6
  - [ ] 7
    - [ ] 8\n`;

    const parsed = parseProject(input);
    const output = printProject(parsed);

    // console.log(input,parsed,output)

    assert.equal(output, input);
  });

  it('identical after parsing and unparsing multiline comments', () => {
    const input = `- [ ] 1
  >comment
  >comment2\n`;

    const parsed = parseProject(input);
    const output = printProject(parsed);

    assert.equal(output, input);
  });

  it('can parse from raw json', () => {
    const input = `[
    {
      "description": "create root file test",
      "tags": {},
      "completed": false,
      "comment": "",
      "subtasks": null
    },
    {
      "description": "update go portion to just parse file contents and grab rev"
    },
    {
      "completed": false,
      "description": "parse on my end"
    },
    {
      "description": "when saving file send only couchdb object"
    },
    {
      "completed": false,
      "description": "update go side to save rev"
    }
  ]`;

    const obj = JSON.parse(input);
    const output = printProject(obj);

    assert.equal(output.includes('- [ ] create root file test'), true);
  });

  it('can parse from raw json with subtask', () => {
    const input = `[
    {
      "description": "create root file test",
      "tags": {},
      "completed": false,
      "comment": "",
      "subtasks": [
    {
      "description": "update go portion to just parse file contents and grab rev",
      "indent": 1
    },
    {
      "completed": false,
      "indent": 1,
      "description": "parse on my end"
    },
    {
      "description": "when saving file send only couchdb object",
      "indent": 1
    }
      ]
    },
    {
      "completed": false,
      "description": "update go side to save rev",
      "indent": 1
    }
  ]`;

    const obj = JSON.parse(input);
    const output = printProject(obj);

    assert.equal(output.includes('- [ ] parse on my end'), true);
    assert.equal(output.includes('  - [ ] parse on my end'), true);
  });
});
