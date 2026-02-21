import { beforeEach, describe, it, assert } from 'vitest'
import { initParser, parseProject } from '../dist/index.js'

var parser;

beforeEach(() => {
  parser = initParser()
});

describe('checkbox', () => {
  it('focus should parse empty checkbox', () => {
    assert.ok(parser.feed("- [ ]"));
    const results = parser.results.length
    assert.equal(parser.results.length, 1);
  });
  it('should allow caps', () => {
    assert.ok(parser.feed("- [ ] TEXT"));
  });
  it('should allow numbers', () => {
    assert.ok(parser.feed("- [ ] text2"));
  });
  it('should allow emoji', () => {
    assert.ok(parser.feed("- [ ] 💩"));
  });
  it('should organize empty checkbox', () => {
    assert.ok(parser.feed("- [ ]"));
    const results = parser.results
    assert.equal(parser.results.length, 1);
    assert.equal(results[0][0].checked, false)
  });
  it('should parse checked checkbox', () => {
    assert.ok(parser.feed("- [x]"));
    assert.equal(parser.results.length, 1);
    assert.equal(parser.results[0][0].checked, true)
  });
  it('should parse checkbox with space', () => {
    assert.ok(parser.feed("- [x] "));
    assert.equal(parser.results.length, 1);
  });
  it('should parse checkbox with space', () => {
    assert.ok(parser.feed("- [ ] "));
    assert.equal(parser.results.length, 1);
  });
  it('should fail typo checkbox', () => {
    assert.throws(() => {parser.feed("- [X]")});
    assert.throws(() => {parser.feed("- []")});
    assert.throws(() => {parser.feed("- [  ]")});
    assert.throws(() => {parser.feed("- [blarg]")});
    assert.throws(() => {parser.feed("-[x]")});
    assert.throws(() => {parser.feed(" - [x]")});
  });
  it('should fail touching checkbox', () => {
    assert.throws(() => {parser.feed("- [x]d")});
  });
  it('should actually parse checkbox', () => {
    const result = parseProject("- [ ] test");
    assert.deepEqual(result[0].checked, false)
  });
  it('should actually parse checkbox', () => {
    const result = parseProject("- [x] test");
    assert.deepEqual(result[0].checked, true)
  });
});



describe('text', () => {
  it('should allow some free text', () => {
    assert.ok(parser.feed("- [ ] text"));
  });
  it('exists', () => {
    assert.ok(parser.feed("- [ ] text"));
    assert.equal(parser.results.length, 1);
    const result = parser.results[0][0]
    assert.equal(result.description, "text")
  });
  it('exists with multi word', () => {
    assert.ok(parser.feed("- [ ] text text"));
    assert.equal(parser.results.length, 1);
    const result = parser.results[0][0]
    assert.equal(result.description, "text text")
  });

  it('preserves spaces', () => {
    assert.ok(parser.feed("- [ ] text  text"));
    const result = parser.results[0][0]
    assert.equal(result.description, "text  text")
  });
  it('preserves spaces', () => {
    assert.ok(parser.feed("- [ ] text   text"));
    const result = parser.results[0][0]
    assert.equal(result.description, "text   text")
  });
  it('preserves spaces', () => {
    assert.ok(parser.feed("- [ ] text    text"));
    const result = parser.results[0][0]
    assert.equal(result.description, "text    text")
  });

  it('preserves leading spaces', () => {
    assert.ok(parser.feed("- [ ]  text    text"));
    const result = parser.results[0][0]
    assert.equal(result.description, " text    text")
  });

  it('preserves labels', () => {
    assert.ok(parser.feed("- [ ] text label:stuff label:other more text"));
    const result = parser.results[0][0]
    assert.equal(result.description, "text label:stuff label:other more text")
  });
});


describe('label', () => {
  it('should allow a label', () => {
    assert.ok(parser.feed("- [ ] label:test"));
  });


  it('should allow a label and text', () => {
    assert.ok(parser.feed("- [ ] text label:test"));
  });

  it('should allow a label right after checkbox', () => {
    assert.ok(parser.feed("- [ ] label:test"));
  });

  it('should allow a couple of lables', () => {
    assert.ok(parser.feed("- [ ] blarg label:test blarg label:blarg"));
  });

  it('should actually parse labels', () => {
    assert.ok(parser.feed("- [ ] blarg label:test blarg context:blarg"));
    assert.deepEqual(parser.results[0][0].labels, [{label:"label", value:"test"}, {label:"context", value:"blarg"}])
  });

  it('should actually parse labels', () => {
    const result = parseProject("- [ ] blarg label:test blarg context:blarg");
    assert.deepEqual(result[0].labels, [{label:"label", value:"test"}, {label:"context", value:"blarg"}])
  });

  it('https', () => {
    assert.throws(() => {parser.feed("- [ ] link:https://google.com")});
  });

});


describe("indent", () => {
describe("single task", () => {
  it('no indent', () => {
    parser.feed("- [ ] text");
    const result = parser.results;
    assert.equal(result[0][0].indent, 0)
  })
  it('single tab', () => {
    parser.feed("\t- [ ] text");
    const result = parser.results;
    assert.equal(result[0][0].indent, 1)
  })
  it('double space', () => {
    parser.feed("  - [ ] text");
    const result = parser.results;
    assert.equal(result[0][0].indent, 1)
  })
  it('literal tab', () => {
    parser.feed(`\t- [ ] text`);
    const result = parser.results;
    assert.equal(result[0][0].indent, 1)
  })
})
})

describe("general parsing", () => {
  it('shouldnt be ambiguous', () => {
    parser.feed("- [ ] text");
    const result = parser.results;
    assert.equal(result.length, 1)
  })
})


// todo: support tasks not on the first line and empty space at end of text file
describe("whitespace", () => {
  it('shouldnt be ambiguous', () => {
    parser.feed("- [ ]   blarg");
    const result = parser.results;
    assert.equal(result.length, 1)
  });

  it('should allow only newline', () => {
    const parsed = parseProject("\n");
    assert.equal(parsed.length, 0)
  });

  it('should allow space then newline', () => {
    const parsed = parseProject(" \n");
    assert.equal(parsed.length, 0)
  });

  it('should allow newline then space', () => {
    const parsed = parseProject("\n ");
    assert.equal(parsed.length, 0)
  });

  it('should allow leading newline', () => {
    const parsed = parseProject("\n- [ ] something");
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].description, "something")
  });


  it('should allow multiple leading newline', () => {
    const parsed = parseProject("\n- [ ] something\n- [ ] something2");
    assert.equal(parsed.length, 2)
    assert.equal(parsed[1].description, "something2")
  });

  it('should return empty task list', () => {
    assert.ok(parser.feed("\n"));
    const result = parser.results;
    console.log("blarg", result)
    assert.equal(result.length, 1)
    assert.equal(result[0].length, 0)
  });

  //todo
  // it('focus should allow leading whitespace', function () {
  //   assert.ok(parser.feed("\n- [ ] blarg"));
  // });
})

describe("multi", () => {
  it('two tasks', () => {
    assert.ok(parser.feed(`- [ ] blarg\n- [ ] bleg`));
    const result = parser.results;
    assert.equal(result.length, 1)
    assert.equal(result[0][0].description, "blarg")
    assert.equal(result[0][1].description, "bleg")
  });

  it('three tasks', () => {
    assert.ok(parser.feed(`- [ ] blarg\n- [ ] bleg\n- [ ] blurng`));
    const result = parser.results;
    assert.equal(result.length, 1)
    assert.equal(result[0][0].description, "blarg")
    assert.equal(result[0][1].description, "bleg")
    assert.equal(result[0][2].description, "blurng")
  });

  it('two tasks on one line', () => {
    assert.throws(() => {parser.feed("- [ ] blarg - [ ] blarg")});
  });
})

describe("comments", () => {
  it("should fail without indent", () => {
    const sub = `- [ ] blarg\ncomment`
    assert.throws(() => {parser.feed(sub)});
  });
  it("doesnt crash", () => {
    const sub = `- [ ] blarg\n\t>comment`
    assert.ok(parser.feed(sub));
    const result = parser.results[0];
    assert.equal(result.length, 2)
  });
  it("returns comment value", () => {
    const sub = `- [ ] value\n\t>comment`
    const result = parseProject(sub);
    assert.equal(result.length, 1)
    console.log(result)
    assert.equal(result[0].comments.length, 1)
    assert.equal(result[0].comments.join("\n"), "comment")
  });
  it("returns comment value for 2 comments", () => {
    const sub = `- [ ] value\n\t>comment\n\t>comment2`
    const result = parseProject(sub);
    assert.equal(result.length, 1)
    assert.equal(result[0].comments.join("\n"), "comment\ncomment2")
  });
  it("multiword comment", () => {
    const sub = `- [ ] value\n\t>comment words`
    const result = parseProject(sub);
    assert.equal(result.length, 1)
    assert.equal(result[0].comments, "comment words")
  });
  it("markdown comment", () => {
    const sub = `- [ ] value\n\t># comment:`
    const result = parseProject(sub);
    assert.equal(result.length, 1)
    assert.equal(result[0].comments, "# comment:")
  });
  it("handles multiline comments", () => {
    const input = 
`- [ ] 1
  >comment
  >comment2`
    const result = parseProject(input);
    assert.equal(result.length, 1)
    assert.equal(result[0].comments.join("\n"), "comment\ncomment2")
  });
  it("handles multiple comments", () => {
    const input = 
`- [ ] 1
  >comment
- [ ] 2
  >comment2`
    const result = parseProject(input);
    assert.equal(result.length, 2)
    assert.equal(result[0].comments, "comment")
    assert.equal(result[1].comments, "comment2")
  });
  it("handles multiple subcomments", () => {
    const input = `- [ ] 1\n\t>comment1\n\t- [ ] 2\n\t\t>comment2`
    const result = parseProject(input);
    assert.equal(result[0].subtasks[0].comments, "comment2")
    assert.equal(result[0].comments, "comment1")
    assert.equal(result.length, 1)
  });

  it("correctly parses subcomments", () => {
    const input = 
`- [ ] 1
\t- [ ] 2
\t\t>comment
\t\t- [ ] 3
  - [ ] 4
- [ ] 5`

    //test the raw parser
   
    const parser = initParser();
    parser.feed(input);

    const rawResult = parser.results[0];
    assert.equal(rawResult.length, 6)
    assert.equal(rawResult[0].indent, 0)
    assert.equal(rawResult[1].indent, 1)

    assert.equal(rawResult[2].text, "comment") // comment
    assert.equal(rawResult[2].indent, 2) // comment

    assert.equal(rawResult[3].indent, 2)
    assert.equal(rawResult[4].indent, 1)
    assert.equal(rawResult[5].indent, 0)

    const parsed = parseProject(input);
    assert.equal(parsed[0].subtasks[0].comments, "comment")

    // console.log(input,parsed,output)

    assert.equal(parsed.length, 2)
  })

  it("correctly parses subcomments with numbers", () => {
    const input = 
`- [ ] 1
\t- [ ] 2
\t\t>9
\t\t- [ ] 3
  - [ ] 4
- [ ] 5`

    //test the raw parser
   
    const parser = initParser();
    parser.feed(input);

    assert.equal(parser.results.length, 1)
    const rawResult = parser.results[0];

    assert.equal(rawResult[2].text, "9")


    assert.equal(rawResult.length, 6)
    assert.equal(rawResult[0].indent, 0)
    assert.equal(rawResult[1].indent, 1)
    assert.equal(rawResult[2].indent, 2) // comment
    assert.equal(rawResult[3].indent, 2)
    assert.equal(rawResult[4].indent, 1)
    assert.equal(rawResult[5].indent, 0)

    const parsed = parseProject(input);

    // console.log(input,parsed,output)

    assert.equal(parsed.length, 2)
  })
})


describe("subtask", () => {
  it('can parse subtask', () => {
    const sub = `- [ ] blarg \n\t- [ ] bleg`
    assert.ok(parser.feed(sub));
    const result = parser.results;
    assert.equal(result.length, 1)
  });

  it('can parse 2 subtasks', () => {
    const sub = `- [ ] blarg \n\t- [ ] bleg\n\t- [ ] bleg`
    assert.ok(parser.feed(sub));
    const result = parser.results;
    assert.equal(result.length, 1)
  });

  it('correctly gets indent value', () => {
    const sub = `\t- [ ] blarg`
    assert.ok(parser.feed(sub));
    const result = parser.results;
    assert.equal(result.length, 1)
    assert.equal(result[0][0].indent, 1)
  });
  it('correctly gets indent value', () => {
    const sub = `\t\t- [ ] blarg`
    assert.ok(parser.feed(sub));
    const result = parser.results;
    assert.equal(result.length, 1)
    assert.equal(result[0][0].indent, 2)
  });
  it('correctly gets indent value', () => {
    const sub = `\t\t- [ ] blarg\n\t\t\t\t- [ ] blarg`
    assert.ok(parser.feed(sub));
    const result = parser.results;
    assert.equal(result.length, 1)
    assert.equal(result[0][1].indent, 4)
  });
})




