@preprocessor esmodule
@preprocessor typescript
@builtin "string.ne"


whitespace 
	-> input {% id %}
	| anyWhitespace {% id %}
	| newline newline:* input {% (data) => {return data[2]} %}

anyWhitespace -> _ newline:* _  {% () => {return []} %}

input -> multiTask newline:? {% id %}

multiTask 
	-> taskComment {% (data) => {return [data[0]]} %}
	| taskComment newline multiTask {% (data) => {return [data[0], ...data[2]]}%}

taskComment
	-> task {%id%}
	| comment {%id%}

task -> indent checkbox body:? {% (data) => {
	var desc = "";
	var lab = "";
	if (data[2] !== null) {
		desc += data[2].text
		lab = data[2].labels
	}
	return {indent: data[0], checked: data[1], description: desc, labels: lab}
}%}

comment -> tab indent ">" [^\n]:* {% (data) => {return {indent: data[1]+1, text: data[3].join(""), type:"comment"}} %}

# this type of tab parsing allows any number of tabs on any line.
indent -> tab:* {% (data) => {return data[0].length} %}

body -> __ _ labelText {% (data) => {
	var tmp = "";
	if (data[1] !== undefined){
		tmp += data[1];
	}
	return {text:tmp+data[2].text, labels:data[2].labels}
}%}

labelText 
	-> _ {% (data) => {return {text:data[0], labels:[]}} %}
	| label {% id %}
	| text {% (data) => {return {text:data[0], labels:[]}} %}
	| label ___ labelText {% (data) => {return {text:data[0].text + data[1] + data[2].text, labels:[...data[0].labels, ...data[2].labels]}} %}
	| text ___ labelText {% (data) => {return {text:data[0] + data[1] + data[2].text, labels:data[2].labels}} %}

# get labels both as raw text and as a label object.  preserve exact text, and also extract labels as objext
label -> characters ":" characters {% (data) => {return {text:data[0] + ":" + data[2], labels:[{label:data[0], value:data[2]}]}} %}

text -> characters {% id %}


checkbox 
	-> unchecked {% id %}
	| checked {% id %}
unchecked -> "- [ ]" {% () => {return false}%}
checked -> "- [x]" {% () => {return true}%}


characters 
	-> character {% id %}
	| character characters {% (data) => {return data[0] + data[1]} %}

# character -> [^_]
character -> [^:[-\] \n\t] {% id %}
# character -> [a-zA-Z] {% id %}

___ -> __ _ {% (data) => {return data[0]+data[1]} %} # at least one whitespace
__ -> " " {% (data) => {return " "} %} # exactly one space
_ -> __:* {% (data) => {return data[0].join("")} %} # 0 or more spaces
newline -> "\n"
tab 
	-> "\t" 
	| "  "
