import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";

export default function CardItem({ card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card }
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`rounded-3xl border border-white/10 bg-slate-950/70 p-4 ${isDragging ? "opacity-60" : "opacity-100"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{card.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{card.description || "No description"}</p>
        </div>
        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">{card.label || "General"}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-white/5 px-2 py-1">{card.assignee?.name || "Unassigned"}</span>
        <span className="rounded-full bg-white/5 px-2 py-1">{card.deadline ? format(new Date(card.deadline), "MMM d") : "No deadline"}</span>
        <span className="rounded-full bg-white/5 px-2 py-1">{card.status}</span>
      </div>
    </article>
  );
}
