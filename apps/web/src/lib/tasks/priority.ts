import type { Priority } from './types.js';

export const priorityConfig: Record<
	Priority,
	{ label: string; variant: 'default' | 'secondary' | 'outline'; dotClass: string }
> = {
	high: { label: 'High', variant: 'default', dotClass: 'bg-primary' },
	medium: { label: 'Medium', variant: 'secondary', dotClass: 'bg-orange-400' },
	low: { label: 'Low', variant: 'outline', dotClass: 'bg-muted-foreground/40' }
};
