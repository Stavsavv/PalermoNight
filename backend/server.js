import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

// --- Constants ---

const PORT = process.env.PORT || 8080;

const ROLES = {
  RED_J: "Red J",
  BLACK_J: "Black J",
  POLICEMAN: "Policeman",
  SNITCH: "Snitch",
  DOCTOR: "Doctor",
  BUTCHER: "Butcher",
  MAYOR: "Mayor",
  CITIZEN: "Citizen",
};

// Optional roles toggle default
const DEFAULT_ENABLED_ROLES = {
  doctor: true,
};

// --- Game data structures ---

class Player {
  constructor(id, ws, nickname) {
    this.id = id;
    this.ws = ws;
    this.nickname = nickname;
    this.role = null;
    this.isAlive = true;
    this.isMuted = false; // by Butcher
    this.isSilenced = false; // by Butcher
    this.vote = null;
    this.protected = false; // by Doctor
    this.usedMayorOverride = false;
  }
}

class GameRoom {
  constructor(roomId, hostId) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.players = new Map(); // id -> Player
    this.phase = "lobby"; // lobby, night, day, ended
    this.rolesEnabled = { ...DEFAULT_ENABLED_ROLES };
    this.gameData = null; // for current game state, assigned roles, votes, etc
  }

  broadcast(data) {
    const json = JSON.stringify(data);
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(json);
      }
    }
  }

  broadcastExcept(exceptId, data) {
    const json = JSON.stringify(data);
    for (const player of this.players.values()) {
      if (player.id !== exceptId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(json);
      }
    }
  }
}

// --- In-memory store for rooms ---

const rooms = new Map(); // roomId -> GameRoom

// --- Helper Functions ---

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

// Assign roles according to player count and enabled roles
function assignRoles(players, rolesEnabled) {
  // Always 2 murderers (Red J and Black J)
  const assignedRoles = [];

  assignedRoles.push(ROLES.RED_J);
  assignedRoles.push(ROLES.BLACK_J);

  // Add other roles if enabled
  if (rolesEnabled.doctor) assignedRoles.push(ROLES.DOCTOR);
  assignedRoles.push(ROLES.POLICEMAN);
  assignedRoles.push(ROLES.SNITCH);
  assignedRoles.push(ROLES.BUTCHER);
  assignedRoles.push(ROLES.MAYOR);

  // Remove roles if too many players
  // If players < roles, remove extras starting from doctor, mayor, etc.
  // Else assign Citizens to extras

  const numPlayers = players.length;
  const uniqueRoles = assignedRoles.slice(0, numPlayers);

  // If more players than roles, fill with Citizens
  while (uniqueRoles.length < numPlayers) {
    uniqueRoles.push(ROLES.CITIZEN);
  }

  return shuffle(uniqueRoles);
}

// --- Game Logic Functions ---

// Generate private info for players (their role etc)
function generatePrivateRoleInfo(player, room) {
  // Role name
  const role = player.role;

  // Extra info depending on role for night phase
  // e.g. Red J & Black J see each other; Policeman sees Red J; Snitch sees Black J

  const players = Array.from(room.players.values());

  const murderers = players.filter(
    (p) => [ROLES.RED_J, ROLES.BLACK_J].includes(p.role) && p.isAlive
  );

  let visibleMurderers = [];

  if (role === ROLES.RED_J) {
    visibleMurderers = murderers
      .filter((p) => p.role === ROLES.RED_J)
      .map((p) => p.nickname);
  } else if (role === ROLES.BLACK_J) {
    visibleMurderers = murderers
      .filter((p) => p.role === ROLES.BLACK_J)
      .map((p) => p.nickname);
  } else if (role === ROLES.POLICEMAN) {
    visibleMurderers = murderers
      .filter((p) => p.role === ROLES.RED_J)
      .map((p) => p.nickname);
  } else if (role === ROLES.SNITCH) {
    visibleMurderers = murderers
      .filter((p) => p.role === ROLES.BLACK_J)
      .map((p) => p.nickname);
  }

  return {
    role,
    visibleMurderers,
    isAlive: player.isAlive,
    nickname: player.nickname,
  };
}

// Determine winner
function checkWinCondition(room) {
  const players = Array.from(room.players.values()).filter((p) => p.isAlive);
  const murderers = players.filter((p) =>
    [ROLES.RED_J, ROLES.BLACK_J].includes(p.role)
  );
  const citizens = players.filter(
    (p) => ![ROLES.RED_J, ROLES.BLACK_J].includes(p.role)
  );

  if (murderers.length === 0) {
    return { winner: "Citizens" };
  }

  if (murderers.length >= citizens.length) {
    return { winner: "Murderers" };
  }

  return null;
}

// Reset votes and butcher effects
function resetDayVotes(room) {
  for (const player of room.players.values()) {
    player.vote = null;
    player.isMuted = false;
    player.isSilenced = false;
    player.protected = false;
  }
  room.gameData.butcherTarget = null;
  room.gameData.doctorTarget = null;
  room.gameData.mayorUsed = false;
  room.gameData.votesCount = {};
  room.gameData.overrideUsedBy = null;
}

// --- WebSocket Server Setup ---

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", function connection(ws) {
  let currentRoom = null;
  let currentPlayer = null;

  ws.on("message", function incoming(message) {
    try {
      const data = JSON.parse(message);
      handleMessage(data);
    } catch (err) {
      console.error("Invalid message:", message);
    }
  });

  ws.on("close", () => {
    if (currentRoom && currentPlayer) {
      currentRoom.players.delete(currentPlayer.id);
      currentRoom.broadcast({
        type: "player-left",
        playerId: currentPlayer.id,
        nickname: currentPlayer.nickname,
      });

      if (currentRoom.players.size === 0) {
        rooms.delete(currentRoom.roomId);
      }
    }
  });

  function send(data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function handleMessage(data) {
    switch (data.type) {
      case "create-room": {
        const roomId = uuidv4().slice(0, 6);
        const nickname =
          data.nickname || `Player_${Math.floor(Math.random() * 1000)}`;
        const room = new GameRoom(roomId, null);

        rooms.set(roomId, room);

        const playerId = uuidv4();
        const player = new Player(playerId, ws, nickname);
        room.players.set(playerId, player);
        room.hostId = playerId;

        currentRoom = room;
        currentPlayer = player;

        send({
          type: "room-created",
          roomId,
          playerId,
          host: true,
          players: getPlayersList(room),
        });
        break;
      }

      case "join-room": {
        const roomId = data.roomId;
        const nickname =
          data.nickname || `Player_${Math.floor(Math.random() * 1000)}`;
        if (!rooms.has(roomId)) {
          send({ type: "error", message: "Room not found" });
          return;
        }
        const room = rooms.get(roomId);
        if (room.phase !== "lobby") {
          send({ type: "error", message: "Game already started" });
          return;
        }
        const playerId = uuidv4();
        const player = new Player(playerId, ws, nickname);
        room.players.set(playerId, player);

        currentRoom = room;
        currentPlayer = player;

        // Notify joining player
        send({
          type: "joined-room",
          roomId,
          playerId,
          host: playerId === room.hostId,
          players: getPlayersList(room),
        });

        // Notify others
        room.broadcastExcept(playerId, {
          type: "player-joined",
          playerId,
          nickname,
        });

        break;
      }

      case "start-game": {
        if (!currentRoom || !currentPlayer) return;
        if (currentPlayer.id !== currentRoom.hostId) {
          send({ type: "error", message: "Only host can start game" });
          return;
        }
        if (currentRoom.phase !== "lobby") {
          send({ type: "error", message: "Game already started" });
          return;
        }
        startGame(currentRoom);
        break;
      }

      case "player-action": {
        // For night actions (Butcher, Doctor, Mayor override)
        if (!currentRoom || !currentPlayer) return;
        if (currentRoom.phase === "night") {
          handleNightAction(currentRoom, currentPlayer, data);
        } else if (currentRoom.phase === "day") {
          handleDayAction(currentRoom, currentPlayer, data);
        }
        break;
      }

      case "vote": {
        if (!currentRoom || !currentPlayer) return;
        if (currentRoom.phase !== "day") return;

        const targetId = data.targetId;
        if (!currentRoom.players.has(targetId)) {
          send({ type: "error", message: "Invalid vote target" });
          return;
        }
        if (!currentPlayer.isAlive) {
          send({ type: "error", message: "Dead players cannot vote" });
          return;
        }
        if (currentPlayer.isMuted || currentPlayer.isSilenced) {
          send({
            type: "error",
            message: "You cannot vote due to Butcher effect",
          });
          return;
        }

        currentPlayer.vote = targetId;

        // Count votes
        countVotes(currentRoom);

        break;
      }

      case "chat": {
        // Broadcast chat if alive and not silenced
        if (!currentRoom || !currentPlayer) return;
        if (!currentPlayer.isAlive) return;
        if (currentPlayer.isMuted) return;
        if (currentRoom.phase !== "day") return;

        const msg = data.message.trim();
        if (msg.length === 0) return;

        currentRoom.broadcast({
          type: "chat",
          playerId: currentPlayer.id,
          nickname: currentPlayer.nickname,
          message: msg,
        });

        break;
      }

      case "toggle-role": {
        if (!currentRoom || !currentPlayer) return;
        if (currentPlayer.id !== currentRoom.hostId) return;

        const roleName = data.role;
        if (!(roleName in currentRoom.rolesEnabled)) {
          send({ type: "error", message: "Invalid role to toggle" });
          return;
        }
        currentRoom.rolesEnabled[roleName] =
          !currentRoom.rolesEnabled[roleName];

        currentRoom.broadcast({
          type: "roles-updated",
          rolesEnabled: currentRoom.rolesEnabled,
        });
        break;
      }

      case "restart-game": {
        if (!currentRoom || !currentPlayer) return;
        if (currentPlayer.id !== currentRoom.hostId) return;

        currentRoom.phase = "lobby";
        currentRoom.gameData = null;
        for (const player of currentRoom.players.values()) {
          player.isAlive = true;
          player.role = null;
          player.isMuted = false;
          player.isSilenced = false;
          player.vote = null;
          player.protected = false;
          player.usedMayorOverride = false;
        }
        currentRoom.broadcast({
          type: "game-restarted",
          players: getPlayersList(currentRoom),
          phase: currentRoom.phase,
          rolesEnabled: currentRoom.rolesEnabled,
        });
        break;
      }
    }
  }

  function getPlayersList(room) {
    return Array.from(room.players.values()).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isAlive: p.isAlive,
      role: room.phase === "lobby" ? null : p.role, // no roles before start or after game ended
      isHost: p.id === room.hostId,
    }));
  }

  // Start game: assign roles, change phase to night, notify players
  function startGame(room) {
    room.phase = "night";

    const playersArr = Array.from(room.players.values());
    const assignedRoles = assignRoles(playersArr, room.rolesEnabled);

    playersArr.forEach((player, i) => {
      player.role = assignedRoles[i];
      player.isAlive = true;
      player.isMuted = false;
      player.isSilenced = false;
      player.vote = null;
      player.protected = false;
      player.usedMayorOverride = false;
    });

    room.gameData = {
      phase: "night",
      votesCount: {},
      butcherTarget: null,
      doctorTarget: null,
      mayorOverride: null,
      mayorUsed: false,
      overrideUsedBy: null,
      eliminatedPlayer: null,
    };

    // Send roles privately
    for (const player of playersArr) {
      player.ws.send(
        JSON.stringify({
          type: "role-assignment",
          role: player.role,
        })
      );
    }

    // Send game started notification + player list without roles
    room.broadcast({
      type: "game-started",
      players: getPlayersList(room),
      rolesEnabled: room.rolesEnabled,
      phase: room.phase,
    });

    // Notify Night Phase start
    room.broadcast({ type: "phase-change", phase: "night" });
  }

  function handleNightAction(room, player, data) {
    if (!player.isAlive) return;
    const role = player.role;

    switch (role) {
      case ROLES.BUTCHER:
        if (data.action === "choose-target" && data.targetId) {
          if (!room.players.has(data.targetId)) return;
          room.gameData.butcherTarget = {
            targetId: data.targetId,
            mute: data.mute || false,
            silence: data.silence || false,
          };
          room.broadcast({
            type: "butcher-action",
            targetId: data.targetId,
            mute: data.mute,
            silence: data.silence,
          });
        }
        break;

      case ROLES.DOCTOR:
        if (data.action === "choose-target" && data.targetId) {
          if (!room.players.has(data.targetId)) return;
          room.gameData.doctorTarget = data.targetId;
          room.broadcast({ type: "doctor-action", targetId: data.targetId });
        }
        break;

      case ROLES.MAYOR:
        // Mayor can override only in day phase
        break;

      default:
        // No night action
        break;
    }
  }

  function handleDayAction(room, player, data) {
    if (!player.isAlive) return;

    if (
      player.role === ROLES.MAYOR &&
      data.action === "override-vote" &&
      data.targetId
    ) {
      if (player.usedMayorOverride) {
        send({ type: "error", message: "Mayor override already used" });
        return;
      }
      if (!room.players.has(data.targetId)) {
        send({ type: "error", message: "Invalid override target" });
        return;
      }
      room.gameData.mayorOverride = data.targetId;
      player.usedMayorOverride = true;
      room.gameData.overrideUsedBy = player.id;
      room.broadcast({
        type: "mayor-override",
        playerId: player.id,
        targetId: data.targetId,
      });
      tallyVotes(room); // Immediately evaluate votes with override
    }
  }

  // Count votes, check majority, eliminate if possible
  function countVotes(room) {
    const votes = {};
    for (const player of room.players.values()) {
      if (
        player.vote &&
        player.isAlive &&
        !player.isMuted &&
        !player.isSilenced
      ) {
        votes[player.vote] = (votes[player.vote] || 0) + 1;
      }
    }
    room.gameData.votesCount = votes;

    // Check if all alive players voted
    const alivePlayers = Array.from(room.players.values()).filter(
      (p) => p.isAlive && !p.isMuted && !p.isSilenced
    );
    const allVoted = alivePlayers.every((p) => p.vote !== null);

    if (!allVoted) {
      // Wait for all votes
      return;
    }

    // Determine elimination
    tallyVotes(room);
  }

  function tallyVotes(room) {
    const votes = room.gameData.votesCount;
    let maxVotes = 0;
    let candidates = [];

    for (const [playerId, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [playerId];
      } else if (count === maxVotes) {
        candidates.push(playerId);
      }
    }

    if (candidates.length === 1) {
      let eliminatedId = candidates[0];

      // Apply Mayor override if any
      if (room.gameData.mayorOverride) {
        eliminatedId = room.gameData.mayorOverride;
      }

      eliminatePlayer(room, eliminatedId);
    } else {
      // Tie or no votes: no elimination this round
      room.broadcast({
        type: "no-elimination",
        message: "No player eliminated due to tie or no votes",
      });
      // Move to next phase: Night again or End game check
      startNextPhase(room);
    }
  }

  function eliminatePlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) return;

    if (!player.isAlive) return;

    // Check if player protected by doctor
    if (room.gameData.doctorTarget === playerId) {
      room.broadcast({
        type: "player-protected",
        playerId,
        nickname: player.nickname,
      });
      // No elimination, next phase
      startNextPhase(room);
      return;
    }

    // Eliminate player
    player.isAlive = false;
    room.gameData.eliminatedPlayer = player;

    // Reveal if Innocent or Guilty
    const isGuilty = [ROLES.RED_J, ROLES.BLACK_J].includes(player.role);
    room.broadcast({
      type: "player-eliminated",
      playerId: player.id,
      nickname: player.nickname,
      verdict: isGuilty ? "Guilty" : "Innocent",
    });

    // If mayor override used and eliminated player was innocent, eliminate mayor too
    if (room.gameData.overrideUsedBy && !isGuilty) {
      const mayor = room.players.get(room.gameData.overrideUsedBy);
      if (mayor && mayor.isAlive) {
        mayor.isAlive = false;
        room.broadcast({
          type: "mayor-penalty",
          playerId: mayor.id,
          nickname: mayor.nickname,
          message: "Mayor eliminated for wrong override",
        });
      }
    }

    // Check win condition
    const win = checkWinCondition(room);

    if (win) {
      room.phase = "ended";
      room.broadcast({
        type: "game-ended",
        winner: win.winner,
        players: getPlayersList(room),
      });
    } else {
      startNextPhase(room);
    }
  }

  // Switch phases night<->day
  function startNextPhase(room) {
    if (room.phase === "night") {
      room.phase = "day";

      // Apply butcher effect
      if (room.gameData.butcherTarget) {
        const targetPlayer = room.players.get(
          room.gameData.butcherTarget.targetId
        );
        if (targetPlayer && targetPlayer.isAlive) {
          if (room.gameData.butcherTarget.mute) {
            targetPlayer.isMuted = true;
          }
          if (room.gameData.butcherTarget.silence) {
            targetPlayer.isSilenced = true;
          }
        }
      }

      room.broadcast({ type: "phase-change", phase: "day" });
    } else if (room.phase === "day") {
      resetDayVotes(room);
      room.phase = "night";
      room.broadcast({ type: "phase-change", phase: "night" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
