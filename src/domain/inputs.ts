export interface CreateNoteInput {
  title: string;
  context?: string;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  context?: string | null;
}
