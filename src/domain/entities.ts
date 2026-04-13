// -- Entity interfaces ------------------------------------------------------

export interface Note {
  id: string;
  title: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

// -- Summary types (projections for list responses) -------------------------

export interface NoteSummary {
  id: string;
  title: string;
  has_context: boolean;
  created_at: string;
  updated_at: string;
}

// -- Summary mappers --------------------------------------------------------

export function toNoteSummary(n: Note): NoteSummary {
  return {
    id: n.id,
    title: n.title,
    has_context: n.context != null,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}
