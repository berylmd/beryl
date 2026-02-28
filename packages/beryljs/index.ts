import grammer from "./grammar.js";
import pkg from 'nearley';
const { Parser, Grammar } = pkg;

import { Task, Comment, Label, LabelText } from "./types.js"
export type { LabelText, Label } from "./types.js"


export function initParser(){
	return new Parser(Grammar.fromCompiled(grammer));
}

export function parseProject(project: string) {

	if (project == "" || project == null){
		return []
	}


	const parser = initParser();
	parser.feed(project)

	const result = new taskList(parser.results[0]);
	return result.collectAllSubtasks();
}

interface collectionResult {
	task: Task | Comment;
	index: number;
}

class taskList {
	inputArr: Task[];
	outputArr: Task[];

	constructor(list: Task[]) {
		this.inputArr = list;
		this.outputArr = [];
	}

	//rename to not subtask
	collectAllSubtasks(){
		if (this.inputArr.length == 0) {
			return []
		}

		let index = 0;

		do {
			var result = this.collectSubtasks(index);
			this.outputArr.push(new Task(result.task)); 
			index = result.index;
		} while (index < this.inputArr.length);
		return this.outputArr;
	}

	collectSubtasks(index: number): collectionResult {
		const currentTask: Task | Comment = this.inputArr[index];
		currentTask.line = index + 1;
		if (currentTask.type == "comment") {
			return {task: currentTask, index: index+1}
		}
		if (index+1 >= this.inputArr.length) {
			//we have reached the last elm of the array, cannot have any subtasks
			return {task: currentTask, index:index+1};
		}

		const compTask = this.inputArr[index+1]	

		//next task is sibling or an anut
		if (currentTask.indent >= compTask.indent) {
			return {task: currentTask, index: index+1};
		}

		const isChild = (index: number) => {
			if (this.inputArr[index].type == "comment") {
				return currentTask.indent +1 == this.inputArr[index].indent
			} else {
				return currentTask.indent +1 == this.inputArr[index].indent
			}
		}
			
		//if current task indent is exactly one higher than the next task, then it is a child
		if (isChild(index+1)) {
			currentTask.subtasks = [];
			currentTask.comments = [];
			index += 1
			do {
				var result = this.collectSubtasks(index);
				index = result.index;

				if (result.task.type == "comment") {
					currentTask.comments.push((result.task as Comment).text)
				} else {
					currentTask.subtasks.push(new Task(result.task) as Task); 
				}

				//weve reached the end of the file, end
				if (index == this.inputArr.length){
					return {task: currentTask, index: index};
				}
			} while (isChild(index));


			return {task: currentTask, index}
		}


		//handle invalid

		throw "invalid subtask"
		// index +=1;
		// return {task: currentTask, index};
	}
}

export function printProject(project: Task[]){
	var result = ""; 
	project.forEach(task => {
		if (task instanceof Task) {
			result += task.toString() + "\n";
		} else {
			let taskClass = new Task(task)
			result += taskClass.toString() + "\n";
		}
	})
	return result;
}

