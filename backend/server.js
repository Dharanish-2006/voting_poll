const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

let polls = [
  {
    id: "p1",
    question: "Which AI tool do you use most in your workflow?",
    options: ["ChatGPT", "GitHub Copilot", "Claude", "Gemini"],
    votes: [0, 0, 0, 0],
    voterIds: [],
    active: true,
    timer: 60,
    anonymous: true,
    type: "single",
    code: "NOVA42",
    createdAt: Date.now(),
  },
  {
    id: "p2",
    question: "How satisfied are you with today's seminar content?",
    options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"],
    votes: [0, 0, 0, 0],
    voterIds: [],
    active: false,
    timer: 45,
    anonymous: true,
    type: "single",
    code: "NOVA42",
    createdAt: Date.now() - 60000,
  },
  {
    id: "p3",
    question: "Should we adopt AI-based grading in universities?",
    options: ["Yes", "No"],
    votes: [0, 0],
    voterIds: [],
    active: false,
    timer: 30,
    anonymous: false,
    type: "yesno",
    code: "NOVA42",
    createdAt: Date.now() - 120000,
  },
];

const sanitize = (poll) => {
  const { voterIds, ...safe } = poll;
  return safe;
};

const broadcastPolls = () => {
  io.emit("polls:update", polls.map(sanitize));
};

app.get("/api/polls", (req, res) => res.json(polls.map(sanitize)));

app.get("/api/polls/:id", (req, res) => {
  const poll = polls.find((p) => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  res.json(sanitize(poll));
});

app.post("/api/polls", (req, res) => {
  const { question, options, anonymous, timer } = req.body;
  if (!question || !options || options.length < 2)
    return res.status(400).json({ error: "Invalid poll data" });
  const newPoll = {
    id: uuidv4(),
    question, options,
    votes: options.map(() => 0),
    voterIds: [],
    active: true,
    timer: timer || 60,
    anonymous: anonymous !== false,
    type: options.length === 2 ? "yesno" : "single",
    code: "NOVA42",
    createdAt: Date.now(),
  };
  polls = polls.map((p) => ({ ...p, active: false }));
  polls.unshift(newPoll);
  broadcastPolls();
  res.status(201).json(sanitize(newPoll));
});

app.patch("/api/polls/:id/activate", (req, res) => {
  if (!polls.find((p) => p.id === req.params.id))
    return res.status(404).json({ error: "Not found" });
  polls = polls.map((p) => ({ ...p, active: p.id === req.params.id }));
  broadcastPolls();
  res.json({ success: true });
});

app.patch("/api/polls/:id/close", (req, res) => {
  polls = polls.map((p) => p.id === req.params.id ? { ...p, active: false } : p);
  broadcastPolls();
  res.json({ success: true });
});

app.delete("/api/polls/:id", (req, res) => {
  polls = polls.filter((p) => p.id !== req.params.id);
  broadcastPolls();
  res.json({ success: true });
});

app.get("/api/polls/:id/export", (req, res) => {
  const poll = polls.find((p) => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: "Not found" });
  const total = poll.votes.reduce((a, b) => a + b, 0);
  const rows = [
    ["Option", "Votes", "Percentage"],
    ...poll.options.map((opt, i) => [
      opt, poll.votes[i],
      total === 0 ? "0%" : `${Math.round((poll.votes[i] / total) * 100)}%`,
    ]),
    ["TOTAL", total, "100%"],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="poll-${poll.id}.csv"`);
  res.send(csv);
});

app.get("/health", (req, res) => res.json({ status: "ok", polls: polls.length }));

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit("polls:update", polls.map(sanitize));

  socket.on("vote:cast", ({ pollId, optionIndex, voterId }) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return socket.emit("vote:error", { message: "Poll not found" });
    if (!poll.active) return socket.emit("vote:error", { message: "Poll is closed" });
    if (optionIndex < 0 || optionIndex >= poll.options.length)
      return socket.emit("vote:error", { message: "Invalid option" });
    if (poll.voterIds.includes(voterId))
      return socket.emit("vote:error", { message: "Already voted" });
    poll.votes[optionIndex] += 1;
    poll.voterIds.push(voterId);
    socket.emit("vote:success", { pollId, optionIndex });
    broadcastPolls();
  });

  socket.on("poll:create", (data) => {
    const { question, options, anonymous, timer } = data;
    if (!question || !options || options.length < 2)
      return socket.emit("poll:error", { message: "Invalid data" });
    const newPoll = {
      id: uuidv4(), question, options,
      votes: options.map(() => 0),
      voterIds: [],
      active: true,
      timer: timer || 60,
      anonymous: anonymous !== false,
      type: options.length === 2 ? "yesno" : "single",
      code: "NOVA42",
      createdAt: Date.now(),
    };
    polls = polls.map((p) => ({ ...p, active: false }));
    polls.unshift(newPoll);
    broadcastPolls();
    socket.emit("poll:created", sanitize(newPoll));
  });

  socket.on("poll:activate", ({ pollId }) => {
    polls = polls.map((p) => ({ ...p, active: p.id === pollId }));
    broadcastPolls();
  });

  socket.on("poll:close", ({ pollId }) => {
    polls = polls.map((p) => p.id === pollId ? { ...p, active: false } : p);
    broadcastPolls();
  });

  socket.on("poll:delete", ({ pollId }) => {
    polls = polls.filter((p) => p.id !== pollId);
    broadcastPolls();
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`VoteNova backend running on http://localhost:${PORT}`);
});