// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }

interface NearleyToken {
  value: any;
  [key: string]: any;
};

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: never) => string;
  has: (tokenType: string) => boolean;
};

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
};

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
};

const grammar: Grammar = {
  Lexer: undefined,
  ParserRules: [
    {"name": "dqstring$ebnf$1", "symbols": []},
    {"name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "dqstring", "symbols": [{"literal":"\""}, "dqstring$ebnf$1", {"literal":"\""}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "sqstring$ebnf$1", "symbols": []},
    {"name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "sqstring", "symbols": [{"literal":"'"}, "sqstring$ebnf$1", {"literal":"'"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "btstring$ebnf$1", "symbols": []},
    {"name": "btstring$ebnf$1", "symbols": ["btstring$ebnf$1", /[^`]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "btstring", "symbols": [{"literal":"`"}, "btstring$ebnf$1", {"literal":"`"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "dstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "dstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": 
        function(d) {
            return JSON.parse("\""+d.join("")+"\"");
        }
        },
    {"name": "sstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "sstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": function(d) { return JSON.parse("\""+d.join("")+"\""); }},
    {"name": "sstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": (d) => d.join('')},
    {"name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function(d) {return "'"; }},
    {"name": "strescape", "symbols": [/["\\/bfnrt]/], "postprocess": id},
    {"name": "strescape", "symbols": [{"literal":"u"}, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/], "postprocess": 
        function(d) {
            return d.join("");
        }
        },
    {"name": "whitespace", "symbols": ["input"], "postprocess": id},
    {"name": "whitespace", "symbols": ["anyWhitespace"], "postprocess": id},
    {"name": "whitespace$ebnf$1", "symbols": []},
    {"name": "whitespace$ebnf$1", "symbols": ["whitespace$ebnf$1", "newline"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "whitespace", "symbols": ["newline", "whitespace$ebnf$1", "input"], "postprocess": (data) => {return data[2]}},
    {"name": "anyWhitespace$ebnf$1", "symbols": []},
    {"name": "anyWhitespace$ebnf$1", "symbols": ["anyWhitespace$ebnf$1", "newline"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "anyWhitespace", "symbols": ["_", "anyWhitespace$ebnf$1", "_"], "postprocess": () => {return []}},
    {"name": "input$ebnf$1", "symbols": ["newline"], "postprocess": id},
    {"name": "input$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "input", "symbols": ["multiTask", "input$ebnf$1"], "postprocess": id},
    {"name": "multiTask", "symbols": ["taskComment"], "postprocess": (data) => {return [data[0]]}},
    {"name": "multiTask", "symbols": ["taskComment", "newline", "multiTask"], "postprocess": (data) => {return [data[0], ...data[2]]}},
    {"name": "taskComment", "symbols": ["task"], "postprocess": id},
    {"name": "taskComment", "symbols": ["comment"], "postprocess": id},
    {"name": "task$ebnf$1", "symbols": ["body"], "postprocess": id},
    {"name": "task$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "task", "symbols": ["indent", "checkbox", "task$ebnf$1"], "postprocess":  (data) => {
        	var desc = "";
        	var lab = "";
        	if (data[2] !== null) {
        		desc += data[2].text
        		lab = data[2].labels
        	}
        	return {indent: data[0], checked: data[1], description: desc, labels: lab}
        }},
    {"name": "comment$ebnf$1", "symbols": []},
    {"name": "comment$ebnf$1", "symbols": ["comment$ebnf$1", /[^\n]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "comment", "symbols": ["tab", "indent", {"literal":">"}, "comment$ebnf$1"], "postprocess": (data) => {return {indent: data[1]+1, text: data[3].join(""), type:"comment"}}},
    {"name": "indent$ebnf$1", "symbols": []},
    {"name": "indent$ebnf$1", "symbols": ["indent$ebnf$1", "tab"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "indent", "symbols": ["indent$ebnf$1"], "postprocess": (data) => {return data[0].length}},
    {"name": "body", "symbols": ["__", "_", "labelText"], "postprocess":  (data) => {
        	var tmp = "";
        	if (data[1] !== undefined){
        		tmp += data[1];
        	}
        	return {text:tmp+data[2].text, labels:data[2].labels}
        }},
    {"name": "labelText", "symbols": ["_"], "postprocess": (data) => {return {text:data[0], labels:[]}}},
    {"name": "labelText", "symbols": ["label"], "postprocess": id},
    {"name": "labelText", "symbols": ["text"], "postprocess": (data) => {return {text:data[0], labels:[]}}},
    {"name": "labelText", "symbols": ["label", "___", "labelText"], "postprocess": (data) => {return {text:data[0].text + data[1] + data[2].text, labels:[...data[0].labels, ...data[2].labels]}}},
    {"name": "labelText", "symbols": ["text", "___", "labelText"], "postprocess": (data) => {return {text:data[0] + data[1] + data[2].text, labels:data[2].labels}}},
    {"name": "label", "symbols": ["characters", {"literal":":"}, "characters"], "postprocess": (data) => {return {text:data[0] + ":" + data[2], labels:[{label:data[0], value:data[2]}]}}},
    {"name": "text", "symbols": ["characters"], "postprocess": id},
    {"name": "checkbox", "symbols": ["unchecked"], "postprocess": id},
    {"name": "checkbox", "symbols": ["checked"], "postprocess": id},
    {"name": "unchecked$string$1", "symbols": [{"literal":"-"}, {"literal":" "}, {"literal":"["}, {"literal":" "}, {"literal":"]"}], "postprocess": (d) => d.join('')},
    {"name": "unchecked", "symbols": ["unchecked$string$1"], "postprocess": () => {return false}},
    {"name": "checked$string$1", "symbols": [{"literal":"-"}, {"literal":" "}, {"literal":"["}, {"literal":"x"}, {"literal":"]"}], "postprocess": (d) => d.join('')},
    {"name": "checked", "symbols": ["checked$string$1"], "postprocess": () => {return true}},
    {"name": "characters", "symbols": ["character"], "postprocess": id},
    {"name": "characters", "symbols": ["character", "characters"], "postprocess": (data) => {return data[0] + data[1]}},
    {"name": "character", "symbols": [/[^:[-\] \n\t]/], "postprocess": id},
    {"name": "___", "symbols": ["__", "_"], "postprocess": (data) => {return data[0]+data[1]}},
    {"name": "__", "symbols": [{"literal":" "}], "postprocess": (data) => {return " "}},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "__"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": (data) => {return data[0].join("")}},
    {"name": "newline", "symbols": [{"literal":"\n"}]},
    {"name": "tab", "symbols": [{"literal":"\t"}]},
    {"name": "tab$string$1", "symbols": [{"literal":" "}, {"literal":" "}], "postprocess": (d) => d.join('')},
    {"name": "tab", "symbols": ["tab$string$1"]}
  ],
  ParserStart: "whitespace",
};

export default grammar;
