import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Layout from "../components/Layout";
import CardItem from "../components/CardItem";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

function FilterBar({ filters, setFilters, members, labels }) {
  return (
    <div className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
      <select className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2" value={filters.assigneeId} onChange={e => setFilters({ ...filters, assigneeId: e.target.value })}>
        <option value="">All assignees</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2" value={filters.label} onChange={e => setFilters({ ...filters, label: e.target.value })}>
        <option value="">All labels</option>
        {labels.map(label => <option key={label} value={label}>{label}</option>)}
      </select>
      <select className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2" value={filters.deadline} onChange={e => setFilters({ ...filters, deadline: e.target.value })}>
        <option value="">Any deadline</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="week">Due this week</option>
      </select>
    </div>
  );
}

export default function BoardPage({ me }) {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({ assigneeId: "", label: "", deadline: "" });

  async function load() {
    const [{ data }, { data: membersData }] = await Promise.all([
      api.get(`/boards/${boardId}`),
      api.get("/users"),
    ]);
    setBoard(data.board);
    setMembers(membersData.users);
  }

  useEffect(() => { load(); }, [boardId]);

  useEffect(() => {
    const socket = getSocket();
    const handleBoardUpdate = (payload) => {
      if (payload.boardId === boardId) load();
    };
    socket.on("board.updated", handleBoardUpdate);
    return () => socket.off("board.updated", handleBoardUpdate);
  }, [boardId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const labels = useMemo(() => {
    const set = new Set();
    board?.lists.forEach(list => list.cards.forEach(card => card.label && set.add(card.label)));
    return [...set];
  }, [board]);

  const filteredBoard = useMemo(() => {
    if (!board) return board;
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);
    return {
      ...board,
      lists: board.lists.map(list => ({
        ...list,
        cards: list.cards.filter(card => {
          if (filters.assigneeId && card.assigneeId !== filters.assigneeId) return false;
          if (filters.label && card.label !== filters.label) return false;
          if (filters.deadline === "overdue" && !(card.deadline && new Date(card.deadline) < now && card.status !== "DONE")) return false;
          if (filters.deadline === "today" && !(card.deadline && new Date(card.deadline).toDateString() === now.toDateString())) return false;
          if (filters.deadline === "week" && !(card.deadline && new Date(card.deadline) <= endOfWeek)) return false;
          return true;
        }),
      })),
    };
  }, [board, filters]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;
    const activeCard = active.data.current?.card;
    const overCard = over.data.current?.card;
    if (!activeCard || !overCard) return;

    await api.patch(`/cards/${activeCard.id}/move`, {
      sourceListId: activeCard.listId,
      targetListId: overCard.listId,
      targetCardId: overCard.id,
    });
    load();
  }

  if (!board) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Loading board…</div>;
  }

  return (
    <Layout
      me={me}
      title={board.name}
      subtitle={`${board.workspace.name} • ${board.lists.length} lists`}
      onLogout={() => { localStorage.clear(); navigate("/login"); }}
      actions={<button onClick={() => navigate("/")} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">Back</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} members={members} labels={labels} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {filteredBoard.lists.map(list => (
            <section key={list.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{list.name}</h2>
                <span className="rounded-full bg-slate-950 px-2 py-1 text-xs text-slate-400">{list.cards.length}</span>
              </div>
              <SortableContext items={list.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {list.cards.map(card => <CardItem key={card.id} card={card} />)}
                </div>
              </SortableContext>
            </section>
          ))}
        </div>
      </DndContext>
    </Layout>
  );
}
