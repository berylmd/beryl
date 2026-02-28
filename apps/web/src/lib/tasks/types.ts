export type Priority = 'low' | 'medium' | 'high';

export type Todo = {
	id: string;
	title: string;
	completed: boolean;
	priority: Priority;
	dueDate: string | null;
	listId: string;
	createdAt: string;
	notes: string;
};

export type List = {
	id: string;
	name: string;
	color: string;
};
