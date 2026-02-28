export interface Label {
  text: string;
  label: string;
}

export interface LabelText {
  text: string;
  labels: Label;
}

export class Task {
  type: string = '';
  indent: number = 0;
  line: number | undefined = undefined;
  checked: boolean = false;
  description: string = '';
  labels: LabelText[] = [];
  comments: string[] = [];
  subtasks: Task[] = [];

  constructor(payload: any) {
    for (const key in payload) {
      if (this.hasOwnProperty(key)) {
        (this as any)[key] = payload[key];
      }
    }
  }

  toString() {
    var result = '';
    for (var i = 0; i < this.indent; i++) {
      result += '  ';
    }
    if (this.checked) {
      result += '- [x]';
    } else {
      result += '- [ ]';
    }

    if (this.description !== '') {
      result += ' ' + this.description;
    }

    //comments
    if (this.comments !== null && this.comments.length !== 0) {
      this.comments.forEach((comment) => {
        result += '\n';
        for (var i = 0; i < this.indent + 1; i++) {
          result += '  ';
        }
        result += '>' + comment;
      });
    }

    if (this.subtasks !== null && this.subtasks.length > 0) {
      this.subtasks.forEach((task) => {
        if (task instanceof Task) {
          result += `\n` + task.toString();
        } else {
          let taskClass = new Task(task);
          result += `\n` + taskClass.toString();
        }
      });
    }
    return result;
  }
}

export interface Comment {
  type: 'comment';
  indent: number;
  text: string;
}

// export interface ParsedElement {
// }
