import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { format } from "date-fns";

export default function CardItem({ card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: card.id, data: { type: "card", listId: card.listId, card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = card.deadline && new Date(card.deadline) < new Date() && card.status !== "DONE";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{card.title}</div>
        <span className={`rounded-full px-2 py-1 text-xs ${card.status === "DONE" ? "bg-emerald-500/15 text-emerald-300" : "bg-indigo-500/15 text-indigo-300"}`}>
          {card.status}
        </span>
      </div>
      {card.description && <p className="mt-2 text-sm text-slate-400 line-clamp-3">{card.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {card.label && <span className="rounded-full bg-fuchsia-500/15 px-2 py-1 text-fuchsia-300">{card.label}</span>}
        {card.assignee && <span className="rounded-full bg-sky-500/15 px-2 py-1 text-sky-300">{card.assignee.name}</span>}
        {card.deadline && (
          <span className={`rounded-full px-2 py-1 ${overdue ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>
            {format(new Date(card.deadline), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}
