// src/Chat.tsx
import { useState } from "react";
import axios from "axios";

type Msg = {
  id: number;
  role: "user" | "bot";
  text: string;
  sources: string[];
};

export default function Chat({ onLogout }: { onLogout: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    if (!input.trim() || pending) return;
    const id = Date.now();
    setMsgs(m => [...m, { id, role: "user", text: input, sources: [] }]);
    setInput("");
    setPending(true);

    try {
      const { data } = await axios.post("/chat", {
        message: input,
        location: "SW1A 1AA",
      });
      setMsgs(m => [
        ...m,
        {
          id: id + 1,
          role: "bot",
          text: data.response,
          sources: data.sources,
        },
      ]);
    } catch (e) {
      setMsgs(m => [
        ...m,
        {
          id: id + 1,
          role: "bot",
          text: "⚠️ error contacting server",
          sources: [],
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="p-3 bg-blue-600 text-white flex justify-between">
        <span className="font-semibold">Kyra test</span>
        <button onClick={onLogout} className="underline text-sm">
          Log out
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {msgs.map(m => (
          <div
            key={m.id}
            className={`max-w-lg ${
              m.role === "user" ? "ml-auto text-right" : ""
            }`}
          >
            <p
              className={`px-3 py-2 rounded ${
                m.role === "user"
                  ? "bg-blue-100"
                  : "bg-gray-100 border border-gray-300"
              }`}
            >
              {m.text}
            </p>
            {m.sources.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs text-blue-600 text-left">
                {m.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s} target="_blank" rel="noopener noreferrer">
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </main>

      {/* Input box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
        className="p-3 border-t flex gap-2"
      >
        <input
          className="flex-1 border rounded p-2"
          placeholder="Ask a question…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
