import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Lead, Message, FormData } from "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home">
          <span className="brand-mark">IQ</span>
          <span>InboxIQ</span>
        </a>
        <nav aria-label="Primary navigation">
          <a
            className={!isPipeline ? "nav-link active" : "nav-link"}
            href="/inbox"
            aria-current={!isPipeline ? "page" : undefined}
          >
            Inbox
          </a>
          <a
            className={isPipeline ? "nav-link active" : "nav-link"}
            href="/pipeline"
            aria-current={isPipeline ? "page" : undefined}
          >
            Pipeline
          </a>
        </nav>
        <span className="status-pill">
          <span className="status-dot" /> Local workspace
        </span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .listMessages()
      .then((result) => {
        if (active) {
          setMessages(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Sales workspace</p>
          <h1>Inbox</h1>
          <p className="muted">
            Review inbound conversations and decide what deserves a follow-up.
          </p>
        </div>
        <div className="metric-card">
          <strong>{messages.length}</strong>
          <span>messages</span>
        </div>
      </section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading">
          <h2 id="messages-heading">Latest messages</h2>
          <span className="muted">Deterministic demo data</span>
        </div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && (
          <StateMessage>
            Could not load the inbox. Check that the API is running.
          </StateMessage>
        )}
        {state === "ready" && (
          <ul className="message-list">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta">
            <strong>{message.senderName}</strong>
            <span>{formatDate(message.createdAt)}</span>
          </span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">
            {message.company} · {message.body}
          </span>
        </span>
        <span className="row-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </li>
  );
}

function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .getMessage(messageId)
      .then((result) => {
        if (active) {
          setMessage(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [messageId]);

  if (state === "loading")
    return (
      <main className="page-container">
        <StateMessage>Loading message…</StateMessage>
      </main>
    );
  if (state === "error" || !message)
    return (
      <main className="page-container">
        <StateMessage>Message not found.</StateMessage>
      </main>
    );

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">
        ← Back to inbox
      </a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div>
              <dt>Sender</dt>
              <dd>
                {message.senderName} · {message.senderEmail}
              </dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{message.company}</dd>
            </div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>
        <aside className="panel" aria-label="Lead extraction status">
          <ExtractForm messageId={messageId} />
        </aside>
      </section>
    </main>
  );
}

function ExtractForm({ messageId }: { messageId: string }) {
  const [formData, setFormData] = useState<FormData>({
    product: "",
    quantity: "",
    material: "",
    budget: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // "Extract with AI"
  const handleExtractWithAI = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      });

      if (!response.ok) {
        throw new Error(
          "Extraction by AI failed. Please fill the form manually",
        );
      }

      const aiResult = await response.json();

      const aiProduct = aiResult.product ? String(aiResult.product) : "";
      const aiQuantity = aiResult.quantity ? String(aiResult.quantity) : "";
      const aiMaterial = aiResult.material ? String(aiResult.material) : "";
      const aiBudget = aiResult.budget ? String(aiResult.budget) : "";

      setFormData((prev) => ({
        product: prev.product.trim() !== "" ? prev.product : aiProduct,
        quantity: prev.quantity.trim() !== "" ? prev.quantity : aiQuantity,
        material: prev.material.trim() !== "" ? prev.material : aiMaterial,
        budget: prev.budget.trim() !== "" ? prev.budget : aiBudget,
      }));
    } catch (err: any) {
      setError(
        err.message ||
          "Extraction failed. You can still fill the form manually.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // "Save lead" (POST /api/leads)
  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = {
      sourceMessageId: messageId,
      product: formData.product,
      quantity: parseInt(formData.quantity, 10),
      material: formData.material.trim() === "" ? null : formData.material,
      budget:
        formData.budget.trim() === "" ? null : parseFloat(formData.budget),
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (errorData.error && typeof errorData.error === "object") {
          throw new Error("Invalid form data. Please check your inputs.");
        }

        throw new Error(errorData.error || "Failed to save lead.");
      }

      setSuccess(true);
      setFormData({ product: "", quantity: "", material: "", budget: "" });
    } catch (err: any) {
      setError(err.message || "Wystąpił błąd podczas zapisywania leadu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="extraction-container">
      {/* Extract with AI */}
      <button
        type="button"
        onClick={handleExtractWithAI}
        disabled={loading}
        className="btn-extract"
      >
        {loading ? "Processing..." : "Extract with AI"}
      </button>

      {/* FORM */}
      <form onSubmit={handleSaveLead} className="extraction-form">
        <div className="form-group">
          <label className="form-label">Product</label>
          <input
            type="text"
            name="product"
            value={formData.product}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Material</label>
          <input
            type="text"
            name="material"
            value={formData.material}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Budget</label>
          <input
            type="number"
            step="any"
            name="budget"
            value={formData.budget}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        {error && (
          <p className="message-error" role="alert">
            {error}
          </p>
        )}
        {success && <p className="message-success">Lead saved successfully!</p>}

        {/* Save lead */}
        <button type="submit" disabled={loading} className="btn-save">
          Save lead
        </button>
      </form>
    </div>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .listLeads()
      .then((result) => {
        if (active) {
          setLeads(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  // STATE UPDATE FUNCTION
  const handleLeadStatusChange = (updatedLead: Lead) => {
    setLeads((prevLeads) =>
      prevLeads.map((l) => (l.id === updatedLead.id ? updatedLead : l)),
    );
  };

  return (
    <main className="page-container">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Revenue view</p>
          <h1>Pipeline</h1>
          <p className="muted">Saved leads will appear here.</p>
        </div>
        <div className="metric-card">
          <strong>{leads.length}</strong>
          <span>leads</span>
        </div>
      </section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading">
          <h2 id="pipeline-heading">Leads</h2>
        </div>
        {state === "loading" && (
          <div aria-busy="true" aria-live="polite">
            <StateMessage>Loading pipeline…</StateMessage>
          </div>
        )}

        {state === "error" && (
          <div role="alert">
            <StateMessage>Could not load the pipeline.</StateMessage>
          </div>
        )}
        {state === "ready" &&
          (leads.length === 0 ? (
            <p className="state-message">No leads yet.</p>
          ) : (
            <ul className="lead-list">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onStatusUpdated={handleLeadStatusChange} // Przekazujemy funkcję w dół
                />
              ))}
            </ul>
          ))}
      </section>
    </main>
  );
}

function LeadCard({
  lead,
  onStatusUpdated,
}: {
  lead: Lead;
  onStatusUpdated: (updatedLead: Lead) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<boolean>(false);

  const handleMarkAsContacted = async () => {
    setUpdating(true);
    setError(false);

    try {
      // PATCH /api/leads/${lead.id}/status
      const response = await fetch(`/api/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "CONTACTED" }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const updatedLead = await response.json();

      onStatusUpdated(updatedLead);
    } catch (err) {
      setError(true);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <li className="lead-card">
      <div className="lead-card-content">
        <h3>Product: {lead.product}</h3>
        <div>
          <p>
            Quantity: {lead.quantity} unit{lead.quantity === 1 ? "" : "s"}
          </p>
          <p>Material: {lead.material ? ` ${lead.material}` : ""}</p>
          <p>
            Bundget:{" "}
            {lead.budget === null ? "Budget unknown" : `${lead.budget}`}
          </p>
        </div>
        <span className="muted">Status: {lead.status}</span>
        {error && <p className="error-text">Failed to update</p>}
      </div>

      {/* Status 'NEW' */}
      {lead.status === "NEW" && (
        <button
          type="button"
          onClick={handleMarkAsContacted}
          disabled={updating}
          className="btn-contacted"
        >
          {updating ? "Updating..." : "Mark as contacted"}
        </button>
      )}
    </li>
  );
}

export function App() {
  const content =
    path === "/pipeline" ? (
      <PipelinePage />
    ) : path.startsWith("/inbox/") ? (
      <DetailPage
        messageId={decodeURIComponent(path.slice("/inbox/".length))}
      />
    ) : (
      <InboxPage />
    );
  return <Layout>{content}</Layout>;
}
