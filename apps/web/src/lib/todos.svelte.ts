import type { Priority, Todo, List } from './types.js';

function createTodosStore() {
	const today = new Date().toISOString().split('T')[0];
	const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
	const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

	const defaultLists: List[] = [
		{ id: 'personal', name: 'Personal', color: 'blue' },
		{ id: 'work', name: 'Work', color: 'purple' },
		{ id: 'shopping', name: 'Shopping', color: 'green' }
	];

	const defaultTodos: Todo[] = [
		{
			id: '1',
			title: 'Set up the project',
			completed: true,
			priority: 'high',
			dueDate: null,
			listId: 'work',
			createdAt: new Date().toISOString(),
			notes: 'Done! Shadcn-svelte is configured.'
		},
		{
			id: '2',
			title: 'Build the todo app',
			completed: false,
			priority: 'high',
			dueDate: today,
			listId: 'work',
			createdAt: new Date().toISOString(),
			notes: ''
		},
		{
			id: '3',
			title: 'Review pull requests',
			completed: false,
			priority: 'medium',
			dueDate: today,
			listId: 'work',
			createdAt: new Date().toISOString(),
			notes: ''
		},
		{
			id: '4',
			title: 'Plan Q1 roadmap',
			completed: false,
			priority: 'high',
			dueDate: tomorrow,
			listId: 'work',
			createdAt: new Date().toISOString(),
			notes: ''
		},
		{
			id: '5',
			title: 'Buy groceries',
			completed: false,
			priority: 'medium',
			dueDate: tomorrow,
			listId: 'shopping',
			createdAt: new Date().toISOString(),
			notes: 'Milk, eggs, bread, coffee'
		},
		{
			id: '6',
			title: 'Schedule dentist appointment',
			completed: false,
			priority: 'low',
			dueDate: nextWeek,
			listId: 'personal',
			createdAt: new Date().toISOString(),
			notes: ''
		},
		{
			id: '7',
			title: 'Read "Atomic Habits"',
			completed: false,
			priority: 'low',
			dueDate: null,
			listId: 'personal',
			createdAt: new Date().toISOString(),
			notes: ''
		}
	];

	let todos = $state<Todo[]>(defaultTodos);
	let lists = $state<List[]>(defaultLists);
	let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all');
	let activeListId = $state<string | null>(null);

	function addTodo(title: string, listId: string = 'personal', priority: Priority = 'medium') {
		todos.push({
			id: crypto.randomUUID(),
			title,
			completed: false,
			priority,
			dueDate: null,
			listId,
			createdAt: new Date().toISOString(),
			notes: ''
		});
	}

	function toggleTodo(id: string) {
		const todo = todos.find((t) => t.id === id);
		if (todo) todo.completed = !todo.completed;
	}

	function deleteTodo(id: string) {
		const index = todos.findIndex((t) => t.id === id);
		if (index !== -1) todos.splice(index, 1);
	}

	function updateTodo(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) {
		const todo = todos.find((t) => t.id === id);
		if (todo) Object.assign(todo, updates);
	}

	function addList(name: string, color: string = 'slate') {
		lists.push({ id: crypto.randomUUID(), name, color });
	}

	function deleteList(id: string) {
		const index = lists.findIndex((l) => l.id === id);
		if (index !== -1) lists.splice(index, 1);
		for (let i = todos.length - 1; i >= 0; i--) {
			if (todos[i].listId === id) todos.splice(i, 1);
		}
		if (activeListId === id) activeListId = null;
	}

	const filteredTodos = $derived.by(() => {
		const now = new Date().toISOString().split('T')[0];
		let result = [...todos];

		if (activeListId) {
			result = result.filter((t) => t.listId === activeListId);
		}

		switch (activeFilter) {
			case 'today':
				result = result.filter((t) => !t.completed && t.dueDate === now);
				break;
			case 'upcoming':
				result = result.filter((t) => !t.completed && t.dueDate != null && t.dueDate > now);
				break;
			case 'completed':
				result = result.filter((t) => t.completed);
				break;
			default:
				// Sort: incomplete first, then completed
				result = [
					...result.filter((t) => !t.completed),
					...result.filter((t) => t.completed)
				];
		}

		return result;
	});

	const counts = $derived({
		all: todos.filter((t) => !t.completed).length,
		today: todos.filter((t) => {
			const now = new Date().toISOString().split('T')[0];
			return !t.completed && t.dueDate === now;
		}).length,
		upcoming: todos.filter((t) => {
			const now = new Date().toISOString().split('T')[0];
			return !t.completed && t.dueDate != null && t.dueDate > now;
		}).length,
		completed: todos.filter((t) => t.completed).length
	});

	return {
		get todos() {
			return todos;
		},
		get lists() {
			return lists;
		},
		get filteredTodos() {
			return filteredTodos;
		},
		get counts() {
			return counts;
		},
		get activeFilter() {
			return activeFilter;
		},
		set activeFilter(v: 'all' | 'today' | 'upcoming' | 'completed') {
			activeFilter = v;
			activeListId = null;
		},
		get activeListId() {
			return activeListId;
		},
		setActiveList(id: string | null) {
			activeListId = id;
			activeFilter = 'all';
		},
		addTodo,
		toggleTodo,
		deleteTodo,
		updateTodo,
		addList,
		deleteList
	};
}

export const todosStore = createTodosStore();
