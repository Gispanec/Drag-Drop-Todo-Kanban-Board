export function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDeadline(value: string): string {
  if (value === today()) return 'Сегодня';
  return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function pluralTasks(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'задач' : last === 1 ? 'задача' : last >= 2 && last <= 4 ? 'задачи' : 'задач'}`;
}

export const tagColor = (name: string) => ['purple', 'blue', 'green', 'orange'][Array.from(name).reduce((hash, char) => hash + char.charCodeAt(0), 0) % 4];

export function exportData(data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `flow-backup-${today()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
