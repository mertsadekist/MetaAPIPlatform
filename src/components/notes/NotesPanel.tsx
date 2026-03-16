"use client";

import { useState, useEffect, useRef } from "react";

interface Note {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string | null; email: string };
}

interface NotesPanelProps {
  clientId: string;
  entityType: string;
  entityId: string;
  title?: string;
}

export default function NotesPanel({ clientId, entityType, entityId, title = "Notes" }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function load() {
    fetch(`/api/notes?clientId=${clientId}&entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => { setNotes(d.notes ?? []); setLoading(false); });
  }

  useEffect(() => { load(); }, [clientId, entityType, entityId]);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  async function handleAdd() {
    if (!content.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, entityType, entityId, content }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => [data.note, ...prev]);
      setContent("");
    }
    setSubmitting(false);
  }

  async function handleEdit(noteId: string) {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => prev.map((n) => n.id === noteId ? data.note : n));
      setEditing(null);
    }
  }

  async function handleDelete(noteId: string) {
    setDeleting(noteId);
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setDeleting(null);
  }

  async function handlePin(noteId: string, isPinned: boolean) {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !isPinned }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => {
        const updated = prev.map((n) => n.id === noteId ? data.note : n);
        return [...updated].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {notes.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{notes.length}</span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Add note */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <textarea
              ref={textareaRef}
              rows={2}
              placeholder="Add a note…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
              }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-xs text-gray-400">Ctrl+Enter to submit</span>
              <button
                onClick={handleAdd}
                disabled={submitting || !content.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {submitting ? "Adding…" : "Add Note"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-xs">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs">No notes yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className={`px-4 py-3 ${note.isPinned ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                  {editing === note.id ? (
                    <div>
                      <textarea
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => handleEdit(note.id)}
                          className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-2.5 py-1 border border-gray-200 text-xs text-gray-600 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          {note.isPinned && <span className="text-yellow-500">📌</span>}
                          <span>{note.author.displayName ?? note.author.email}</span>
                          <span>·</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePin(note.id, note.isPinned)}
                            className={`text-xs ${note.isPinned ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}
                            title={note.isPinned ? "Unpin" : "Pin"}
                          >
                            📌
                          </button>
                          <button
                            onClick={() => { setEditing(note.id); setEditContent(note.content); }}
                            className="text-xs text-gray-400 hover:text-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            disabled={deleting === note.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            {deleting === note.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
