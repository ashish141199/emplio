import { z } from "zod";
import { recent, type PollTrigger } from "./index";

export const todoist: Record<string, PollTrigger> = {
  new_task: {
    description: "A task is added in Todoist (checked every 5 minutes by default). Optionally only tasks with certain labels or in one project.",
    config: z.object({
      labels: z.array(z.string()).optional().describe('Only tasks with at least one of these label names, e.g. ["aayush", "parth"]'),
      project_id: z.string().optional().describe("Only tasks in this project"),
    }),
    output: [{ name: "task", type: "object", required: true, description: "The Todoist task: id, content, description, labels, project_id, due, priority, added_at" }],
    every: 5,
    min: 1,
    async poll({ labels, project_id }, run) {
      const tasks: any[] = [];
      let cursor: string | undefined;
      // ponytail: 5 pages of 200 active tasks; past that, new tasks on later pages are missed (filter by "created after" then)
      for (let page = 0; page < 5; page++) {
        const out = (await run("todoist.get_all_tasks", { limit: 200, ...(cursor && { cursor }) })) as { tasks?: any[]; next_cursor?: string | null };
        tasks.push(...(out.tasks ?? []));
        cursor = out.next_cursor ?? undefined;
        if (!cursor) break;
      }
      return tasks
        .filter((t) => recent(t.added_at))
        .filter((t) => !project_id || t.project_id === project_id)
        .filter((t) => !labels?.length || t.labels?.some((l: string) => labels.includes(l)))
        .map((task) => ({ id: String(task.id), item: { task } }));
    },
  },
};
