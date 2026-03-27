import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Layout from "../components/Layout";
import CardItem from "../components/CardItem";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAppStore } from "../store/useAppStore";

function FilterBar({ filters, setFilters, members, labels }) {
  return (
    <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/10 p-4 md:grid-cols-4">
      <select className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2" value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
        <option value="">All assignees</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <select className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2" value={filters.label} onChange={(e) => setFilters({ ...filters, label: e.target.value })}>
        <option value="">All labels</option>
        {labels.map((label) => <option key={label} value={label}>{label}</option>)}
      </select>
      <select className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2" value={filters.deadline} onChange={(e) => setFilters({ ...filters, deadline: e.target.value })}>
        <option value="">Any deadline</option>
        <option value="overdue">Overdue</option>
        <option value="week">Due this week</option>
      </select>
      <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2" placeholder="Quick add card title" value={filters.quickTitle} onChange={(e) => setFilters({ ...filters, quickTitle: e.target.value })} />
    </div>
  );
}

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const me = useAppStore((state) => state.me);
  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({ assigneeId: "", label: "", deadline: "", quickTitle: "" });
  const [saving, setSaving] = useState(false);
  const canEdit = me?.role !== "VIEWER";

  async function load() {
    const [{ data }, { data: usersData }] = await Promise.all([api.get(`/boards/${boardId}`), api.get("/users")]);
    setBoard(data.board);
    setMembers(usersData.users);
  }

  useEffect(() => { load(); }, [boardId]);

  useEffect(() => {
    const socket = getSocket();
    const reloadBoard = (payload) => {
      if (payload.boardId === boardId) {
        load();
      }
    };
    socket.on("board.updated", reloadBoard);
    socket.on("card.created", reloadBoard);
    if (!socket.connected && localStorage.getItem("accessToken")) {
      socket.auth = { token: localStorage.getItem("accessToken") };
      socket.connect();
    }
    return () => {
      socket.off("board.updated", reloadBoard);
      socket.off("card.created", reloadBoard);
    };
  }, [boardId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const labels = useMemo(() => {
    const set = new Set();
    board?.lists.forEach((list) => list.cards.forEach((card) => card.label && set.add(card.label)));
    return [...set];
  }, [board]);

  const filteredBoard = useMemo(() => {
    if (!board) return board;
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);
    return {
      ...board,
      lists: board.lists.map((list) => ({
        ...list,
        cards: list.cards.filter((card) => {
          if (filters.assigneeId && card.assigneeId !== filters.assigneeId) return false;
          if (filters.label && card.label !== filters.label) return false;
          if (filters.deadline === "overdue" && !(card.deadline && new Date(card.deadline) < now && card.status !== "DONE")) return false;
          if (filters.deadline === "week" && !(card.deadline && new Date(card.deadline) <= endOfWeek)) return false;
          return true;
        })
      }))
    };
  }, [board, filters]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id || !canEdit) return;
    const activeCard = active.data.current?.card;
    const overCard = over.data.current?.card;
    if (!activeCard || !overCard) return;

    const previous = structuredClone(board);
    setBoard((current) => {
      const next = structuredClone(current);
      const sourceList = next.lists.find((list) => list.id === activeCard.listId);
      const targetList = next.lists.find((list) => list.id === overCard.listId);
      if (!sourceList || !targetList) return current;
      sourceList.cards = sourceList.cards.filter((card) => card.id !== activeCard.id);
      const moved = { ...activeCard, listId: targetList.id };
      const targetIndex = targetList.cards.findIndex((card) => card.id === overCard.id);
      targetList.cards.splice(targetIndex, 0, moved);
      return next;
    });

    try {
      await api.patch(`/cards/${activeCard.id}/move`, {
        targetListId: overCard.listId,
        targetCardId: overCard.id
      });
    } catch {
      setBoard(previous);
    }
  }

  async function createQuickCard() {
    if (!canEdit || !filters.quickTitle || !board?.lists?.[0]) return;
    setSaving(true);
    try {
      await api.post("/cards", {
        title: filters.quickTitle,
        boardId: board.id,
        listId: board.lists[0].id,
        status: "TODO"
      });
      setFilters({ ...filters, quickTitle: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!filteredBoard) return <LoadingSkeleton label="Loading board" />;

  return (
    <Layout title={filteredBoard.name} subtitle={`${filteredBoard.workspace.name} · ${filteredBoard.lists.length} lists`} actions={<button onClick={() => navigate("/")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">Back</button>}>
      <FilterBar filters={filters} setFilters={setFilters} members={members} labels={labels} />
      <div className="mt-4 flex items-center justify-between rounded-3xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-[color:var(--muted)]">
        <span>{canEdit ? "You can move and create cards." : "Viewer role: read-only board access."}</span>
        <button disabled={!canEdit || saving} onClick={createQuickCard} className="rounded-2xl bg-[color:var(--accent)] px-4 py-2 font-medium text-slate-950 disabled:opacity-50">{saving ? "Saving..." : "Add card"}</button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {filteredBoard.lists.map((list) => (
            <section key={list.id} className="rounded-3xl border border-white/10 bg-black/10 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{list.name}</h2>
                <span className="rounded-full bg-slate-950/70 px-2 py-1 text-xs text-slate-400">{list.cards.length}</span>
              </div>
              <SortableContext items={list.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {list.cards.map((card) => <CardItem key={card.id} card={card} />)}
                </div>
              </SortableContext>
            </section>
          ))}
        </div>
      </DndContext>
    </Layout>
  );
}
