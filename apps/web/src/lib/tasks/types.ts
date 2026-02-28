export type Todo = {
  id: string;
  title: string;
  completed: boolean;
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
