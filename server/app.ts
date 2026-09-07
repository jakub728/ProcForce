import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractForMessage, extractRequestSchema } from "./ai.js";
import { prisma } from "./db.js";
import { z } from "zod";
import type { Lead } from "../src/types.js";
import { v4 as uuid } from "uuid";

const app = express();
const clientDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "client",
);

const createLeadSchema = z.object({
  id: z.string().optional(),
  sourceMessageId: z.string().min(1),
  product: z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().min(1)), //odrzucać pusty po trimie `product`
  quantity: z.number().int().positive(), //wymagać dodatniej liczby całkowitej `quantity
  material: z.string().nullable().optional().or(z.literal("")), //przyjmować opcjonalny `material` jako tekst, `null` albo pustą wartość
  budget: z.number().finite().nonnegative().nullable().optional(), //przyjmować opcjonalny, skończony i nieujemny `budget`;
});

app.use(express.json());

app.use(
  (
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (
      request.path.startsWith("/api/") &&
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response.status(400).json({ error: "invalid_json" });
      return;
    }
    next(error);
  },
);

function serializeMessage(message: {
  id: string;
  senderName: string;
  senderEmail: string;
  company: string;
  subject: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: message.id,
    senderName: message.senderName,
    senderEmail: message.senderEmail,
    company: message.company,
    subject: message.subject,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

async function handleMessages(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const records = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
    });
    const messages = records.map(serializeMessage);
    response.json(messages);
  } catch (error) {
    next(error);
  }
}

app.get("/api/messages", handleMessages);
app.get("/api/messages/:messageId", async (request, response, next) => {
  try {
    const record = await prisma.message.findUnique({
      where: { id: request.params.messageId },
    });
    if (!record) {
      response.status(404).json({ error: "message_not_found" });
      return;
    }
    response.json(serializeMessage(record));
  } catch (error) {
    next(error);
  }
});

app.get("/api/leads", async (_request, response, next) => {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "asc" } });
    response.json(
      leads.map((lead: Omit<Lead, "createdAt"> & { createdAt: Date }) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai/extract", async (request, response, next) => {
  try {
    const parsed = extractRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response
        .status(400)
        .json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }

    const message = await prisma.message.findUnique({
      where: { id: parsed.data },
    });
    if (!message) {
      response.status(404).json({ error: "message_not_found" });
      return;
    }

    if (parsed.data === "message-failure") {
      response.status(500).json({ error: "EXTRACTION_FAILED" });
      return;
    }

    const extraction = extractForMessage(parsed.data);
    if (!extraction) {
      response.json({});
      return;
    }
    response.json(extraction);
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads", async (request, response, next) => {
  try {
    // zwracać błąd 4xx bez tworzenia rekordu, gdy payload jest niepoprawny
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid payload" });
      return;
    }

    const { sourceMessageId, product, quantity, material, budget } =
      parsed.data;

    // wymagać istniejącego `sourceMessageId`
    const messageExists = await prisma.message.findUnique({
      where: { id: sourceMessageId },
    });

    if (!messageExists) {
      response.status(400).json({ error: "Source message not found" });
      return;
    }

    const newLead = await prisma.lead.create({
      data: {
        id: uuid(), // pozwalać wielu leadom wskazywać tę samą wiadomość; (unikalne id)
        product,
        quantity,
        material: material || null,
        budget: budget ?? null,
        status: "NEW", // ignorować albo odrzucać próbę ustawienia statusu przez klienta, ale nigdy nie zapisywać statusu innego niż `NEW`;
        sourceMessage: {
          connect: { id: sourceMessageId },
        },
      },
    });

    response.status(201).json({
      ...newLead,
      createdAt: newLead.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/leads/:leadId/status", async (request, response, next) => {
  try {
    const { status } = request.body;
    const updatedLead = await prisma.lead.update({
      where: { id: request.params.leadId },
      data: { status },
    });
    response.json(updatedLead);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDir));

app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api/")) {
    response.status(404).json({ error: "not_found" });
    return;
  }
  response.sendFile(path.join(clientDir, "index.html"), (error) =>
    error ? next(error) : undefined,
  );
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({ error: "internal_server_error" });
  },
);

export { app };
