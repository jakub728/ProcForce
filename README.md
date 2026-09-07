# InboxIQ starter

Minimalny starter zadania rekrutacyjnego: React + Vite + TypeScript po stronie UI oraz Express + Prisma SQLite po stronie serwera. UI pokazuje inbox, szczegóły wiadomości i pusty pipeline; formularz ekstrakcji pozostaje zadaniem dla kandydata.

## Uruchomienie

```bash
npm install
npm run db:reset
npm run dev
```

Tryb developerski wystawia Vite pod `http://localhost:5173` i API Express pod `http://localhost:3001`. Proxy Vite przekazuje `/api` do Expressa. Dla zbudowanej wersji:

```bash
npm run build
PORT=4000 npm start
```

Express serwuje wtedy frontend i API z tego samego originu. `PORT` jest honorowany przez serwer.

## Widoki

- `/inbox` — lista dokładnie czterech wiadomości seed.
- `/inbox/:messageId` — sender, company, subject, body oraz placeholder `Lead extraction not implemented yet.`; kandydat dodaje formularz.
- `/pipeline` — pusty stan `No leads yet.`; seed nie tworzy leadów.

## Model danych

`Message` ma wyłącznie: `id`, `senderName`, `senderEmail`, `company`, `subject`, `body`, `createdAt`.

`Lead` ma: `id`, `sourceMessageId` (relacja do `Message` bez unique), `product`, `quantity` (`Int`), `material` (`String?`), `budget` (`Float?`), `status` (domyślnie `NEW`) i `createdAt`.

## API

- `GET /api/messages` — surowa tablica `Message[]`.
- `GET /api/messages/:messageId` — surowy obiekt `Message`.
- `GET /api/leads` — surowa tablica `Lead[]`, początkowo `[]`.
- `POST /api/leads` — celowo nie istnieje w starterze; kandydat dodaje endpoint z walidacją `sourceMessageId` i statusem `NEW` zgodnie z `TASK.md`.
- `POST /api/ai/extract` z `{ "messageId": "..." }` — deterministyczny fixture: `message-perfect` zwraca `{ product: "Desk", quantity: 30, material: "Oak", budget: 50000 }`, `message-partial` zwraca `{ product: "Ergonomic Chair", quantity: null, material: "Black", budget: 12000 }`, `message-failure` HTTP 500, a `message-empty` dokładnie `{}`.

`npm run db:reset` odtwarza bazę z wersjonowanej migracji Prisma, usuwa stare dane i seeduje dokładnie cztery wiadomości o ID `message-perfect`, `message-partial`, `message-failure`, `message-empty`. `DATABASE_URL` z procesu ma pierwszeństwo przed lokalnym fallbackiem `.env`.

## Kontrole

```bash
npm run typecheck
npm test
npm run build
```

`npm test` resetuje bazę i uruchamia testy Vitest przez Supertest.

## Git i sposób oddania

Pracuj jak w normalnym projekcie:

- utwórz osobny branch zamiast pracować bezpośrednio na `main`;
- podziel rozwiązanie na małe, logiczne commity zgodne z Conventional Commits, na przykład `feat: add lead creation endpoint`, `fix: preserve manual form edits` albo `test: cover lead validation`;
- nie oddawaj jednego zbiorczego commita typu `task done`;
- otwórz pull request do `main` i opisz zakres, najważniejsze decyzje oraz wykonane testy;
- do zgłoszenia dołącz link do repozytorium i pull requestu.




## 🚀 Podsumowanie Implementacji

Wszystkie wymagania zawarte w specyfikacji zadania zostały pomyślnie zaimplementowane, otypowane oraz zweryfikowane za pomocą dostarczonych testów automatycznych.

### 💻 Frontend (React + Vite + TypeScript)
- **Przepływ ekstrakcji:** Do widoku szczegółów wiadomości (`/inbox/:messageId`) dodano komponent `ExtractForm` z przyciskami o dokładnych nazwach `Extract with AI` oraz `Save lead`. Pola formularza posiadają precyzyjne etykiety: `Product`, `Quantity`, `Material` oraz `Budget`.
- **Inteligentne uzupełnianie danych:** Zaimplementowano logikę bezpiecznego scalania stanu. Ponowne kliknięcie `Extract with AI` uzupełnia wyłącznie puste pola – ręcznie wpisane lub poprawione przez użytkownika dane nigdy nie są nadpisywane.
- **Zarządzanie stanem w Pipeline:** Zintegrowano widok `/pipeline`. Kliknięcie przycisku `Mark as contacted` przy leadzie ze statusem `NEW` wysyła żądanie `PATCH` i natychmiast aktualizuje interfejs użytkownika w locie, całkowicie bez przeładowania strony.
- **Dostępność i UX (a11y):** Formularz w pełni obsługuje nawigację z klawiatury (wysyłka przez Enter). Przyciski akcji otrzymują stan `disabled` na czas trwania zapytań sieciowych, a wszelkie błędy walidacji i sieci są renderowane w elementach z atrybutem `role="alert"`, zapewniając pełne wsparcie dla czytników ekranu.

### ⚙️ Backend (Express + Prisma ORM + Zod)
- **POST `/api/leads`:** Bezpieczeństwo danych na granicy HTTP zapewnia walidacja Zod. Serwer automatycznie oczyszcza nazwę produktu (`.trim()`) i odrzuca puste wpisy, wymaga dodatniej liczby całkowitej dla `quantity` oraz skończonego, nieujemnego budżetu. Endpoint weryfikuje istnienie `sourceMessageId` w bazie oraz ignoruje próby ustawienia statusu przez klienta – każdy nowy lead jest twardo zapisywany jako `NEW`.
- **PATCH `/api/leads/:leadId/status`:** Restrykcyjnie przyjmuje wyłącznie payload `{ "status": "CONTACTED" }` i pozwala na zmianę stanu tylko wtedy, gdy aktualny status leada w bazie to `NEW`. W przypadku błędów lub prób ponownej zmiany, serwer bezpiecznie zwraca kod błąd 4xx bez modyfikacji rekordu.

### 🪟 Kompatybilność z systemem Windows i PowerShell
Oryginalna deklaracja zmiennych środowiskowych w jednej linii (`RUST_LOG=info`), przygotowana pod systemy Unix (Linux/macOS), powoduje błędy wykonania w systemie Windows. Aby zapewnić płynne uruchamianie i testowanie projektu na maszynach z systemem Windows bez modyfikowania oryginalnych skryptów rekrutera, do pliku `package.json` jawnie dodano dwa dedykowane skrypty:
- `npm run db:reset:powershell` — Uruchamia natywne migracje Prisma, generuje klienta i bezbłędnie zasila bazę SQLite danymi startowymi (seed) w środowisku PowerShell/CMD.
- `npm run test:powershell` — Sekwencyjnie czyści środowisko, uruchamia powyższy reset bazy danych, a następnie bezpiecznie odpala całą suitę testową w środowisku Vitest na Windowsie.