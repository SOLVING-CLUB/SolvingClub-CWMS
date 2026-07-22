import type { Client } from "@solvingclub/core";

export function filterClients(clients: Client[], query: string): Client[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return clients;
  return clients.filter((client) => `${client.name} ${client.email}`.toLocaleLowerCase().includes(normalized));
}

export function resolveTaskAssignee(isAdmin: boolean, currentUid: string, selectedUid?: string): string | undefined {
  return isAdmin ? selectedUid || undefined : currentUid;
}

export function canEditTask(isAdmin: boolean, currentUid: string, assigneeUid?: string): boolean {
  return isAdmin || assigneeUid === currentUid;
}
