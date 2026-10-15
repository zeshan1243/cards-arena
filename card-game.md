# CardArena — Online Card Games Platform

## Complete Product, UI, Frontend, Backend & Database Specification

---

# 1. Project Overview

CardArena is a modern browser-based online card-game platform inspired by traditional card-game websites but designed with a much more polished, interactive, gaming-focused experience.

The platform will support:

- Single-player games against AI bots
- Real-time multiplayer games
- Private rooms
- Public matchmaking
- Player profiles
- Statistics
- Leaderboards
- Achievements
- Game history
- Responsive mobile gameplay
- SEO-friendly game pages
- Advertising monetization
- Multiple classic and regional card games

The primary differentiator is the combination of:

> **Modern gaming UI + smart bots + multiplayer + regional card games + strong SEO**

---

# 2. Product Vision

The platform should feel like a modern casual gaming platform rather than a traditional card-game website.

The experience should be:

- Fast
- Smooth
- Responsive
- Interactive
- Mobile-first
- Visually polished
- Easy to understand
- SEO friendly
- Accessible

The primary product goal is:

> Make browser-based card games feel like a real mobile/console game while requiring no installation.

---

# 3. Technology Stack

## Frontend

- Angular
- TypeScript
- HTML5
- SCSS
- RxJS
- Angular Signals
- Angular Router

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- WebSockets
- JWT Authentication

## Database

- PostgreSQL

## Real-Time

- FastAPI WebSockets
- Redis in future for distributed game rooms

## Deployment

Initial:

- Render

Future:

- Cloudflare
- AWS / Google Cloud
- Docker
- Redis
- CDN

---

# 4. High-Level Architecture

```text
                         INTERNET
                            |
                            v
                  +--------------------+
                  |   Angular Client   |
                  |                    |
                  | TypeScript / SCSS  |
                  +---------+----------+
                            |
                     HTTPS / REST
                            |
                            v
                  +--------------------+
                  |      FastAPI       |
                  |      Backend       |
                  +---------+----------+
                            |
             +--------------+--------------+
             |                             |
             v                             v
      +-------------+              +-------------+
      | PostgreSQL  |              |    Redis    |
      | Persistent  |              | Future      |
      | Data        |              | Real-time   |
      +-------------+              +-------------+
```

For multiplayer:

```text
Angular Client
      |
      | WebSocket
      |
      v
FastAPI WebSocket Server
      |
      +---- Game Room
      |
      +---- Game State
      |
      +---- Turn Management
      |
      +---- Validation
      |
      v
   PostgreSQL
```

---

# 5. Initial Game Strategy

The platform should launch with a small number of high-quality games rather than many unfinished games.

## Phase 1

Focus on regional games with relatively lower competition.

- Bhabhi Thulla
- Court Piece
- 29
- Seep
- Call Break

## Phase 2

Add:

- Hokm
- Tarneeb
- Baloot
- Spades
- Hearts

## Phase 3

Add:

- Rummy
- Teen Patti
- Solitaire
- FreeCell
- Spider Solitaire
- Gin Rummy
- Crazy Eights
- Euchre
- Go Fish
- War

---

# 6. MVP

The first release should contain:

## Frontend

- Homepage
- Games catalog
- Bhabhi Thulla
- AI gameplay
- Login
- Registration
- Profile
- Statistics
- Responsive game UI
- Dark gaming design

## Backend

- FastAPI
- PostgreSQL
- JWT authentication
- User management
- Game sessions
- Statistics
- Game history

## Real-Time

Do not implement multiplayer initially.

The first version should focus on:

> Excellent single-player gameplay against AI.

Multiplayer should be added after the game engine is stable.

---

# 7. User Experience Flow

A new visitor should be able to play with minimal friction.

```text
Open Website
     |
     v
Homepage
     |
     v
Choose Game
     |
     v
Game Landing Page
     |
     v
Play Now
     |
     v
Choose:
   - Play vs AI
   - Multiplayer
     |
     v
Game
```

Users should be able to play AI games without creating an account.

Registration should be encouraged after the game.

---

# 8. Guest Mode

Guest users can:

- Play AI games
- View game rules
- Explore games
- View game pages

Registered users unlock:

- Game history
- Statistics
- XP
- Achievements
- Leaderboards
- Multiplayer
- Friends
- Saved preferences

After completing a guest game:

```text
+-----------------------------------+
|           YOU WIN!                |
|                                   |
| Create a free account to save     |
| your statistics and achievements. |
|                                   |
|       [ CREATE ACCOUNT ]          |
|                                   |
|       [ CONTINUE AS GUEST ]       |
+-----------------------------------+
```

---

# 9. Angular Project Structure

```text
src/
|
+-- app/
|   |
|   +-- core/
|   |   |
|   |   +-- guards/
|   |   |   +-- auth.guard.ts
|   |   |   +-- guest.guard.ts
|   |   |
|   |   +-- interceptors/
|   |   |   +-- auth.interceptor.ts
|   |   |
|   |   +-- services/
|   |       +-- api.service.ts
|   |       +-- auth.service.ts
|   |       +-- game.service.ts
|   |       +-- player.service.ts
|   |       +-- statistics.service.ts
|   |       +-- websocket.service.ts
|   |       +-- storage.service.ts
|   |
|   +-- shared/
|   |   |
|   |   +-- components/
|   |   |   +-- navbar/
|   |   |   +-- footer/
|   |   |   +-- game-card/
|   |   |   +-- playing-card/
|   |   |   +-- card-hand/
|   |   |   +-- player-avatar/
|   |   |   +-- player-status/
|   |   |   +-- game-table/
|   |   |   +-- game-timer/
|   |   |   +-- scoreboard/
|   |   |   +-- game-controls/
|   |   |   +-- modal/
|   |   |   +-- toast/
|   |   |   +-- loader/
|   |   |
|   |   +-- models/
|   |       +-- user.model.ts
|   |       +-- game.model.ts
|   |       +-- card.model.ts
|   |       +-- player.model.ts
|   |
|   +-- pages/
|   |   |
|   |   +-- home/
|   |   +-- games/
|   |   +-- login/
|   |   +-- register/
|   |   +-- profile/
|   |   +-- leaderboard/
|   |   +-- statistics/
|   |   +-- game-history/
|   |   +-- settings/
|   |
|   +-- games/
|   |   |
|   |   +-- bhabhi-thulla/
|   |   |   |
|   |   |   +-- components/
|   |   |   |   +-- game-table/
|   |   |   |   +-- player-hand/
|   |   |   |   +-- opponent/
|   |   |   |   +-- trick-area/
|   |   |   |   +-- scoreboard/
|   |   |   |   +-- game-controls/
|   |   |   |   +-- game-result/
|   |   |   |
|   |   |   +-- engine/
|   |   |   |   +-- bhabhi-thulla.engine.ts
|   |   |   |   +-- bhabhi-thulla.rules.ts
|   |   |   |   +-- bhabhi-thulla.bot.ts
|   |   |
|   |   +-- court-piece/
|   |   +-- twenty-nine/
|   |   +-- seep/
|   |   +-- call-break/
|   |   +-- hokm/
|   |   +-- tarneeb/
|   |   +-- baloot/
|   |
|   +-- app.component.ts
|   +-- app.routes.ts
|   +-- app.config.ts
|
+-- assets/
|   +-- cards/
|   +-- avatars/
|   +-- icons/
|   +-- sounds/
|   +-- images/
|
+-- styles.scss
```

---

# 10. Game Architecture

Each game must be treated as an independent module.

```text
games/
|
+-- bhabhi-thulla/
+-- court-piece/
+-- twenty-nine/
+-- seep/
+-- call-break/
+-- hokm/
+-- tarneeb/
+-- baloot/
```

Each game contains:

- UI
- Rules
- Game Engine
- Bot AI
- Models
- Services
- Tests

This allows additional games to be added without rewriting the entire platform.

---

# 11. Reusable Card Game Engine

Do not build each game completely from scratch.

Create a common architecture.

```text
                    CardArena Core
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
   Bhabhi Thulla     Court Piece          29
        |                |                |
      Rules            Rules            Rules
        |                |                |
       Bot              Bot              Bot
```

---

# 12. Card Model

```ts
export interface Card {
    id: string;
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: string;
}
```

---

# 13. Player Model

```ts
export interface Player {
    id: string;
    name: string;
    avatar: string;
    cards: Card[];
    score: number;
    isBot: boolean;
    isCurrentTurn: boolean;
    connected: boolean;
}
```

---

# 14. Game State

```ts
export interface GameState {
    gameId: string;
    sessionId: string;

    players: Player[];

    currentPlayerId: string;

    deck: Card[];

    tableCards: Card[];

    round: number;

    status: 'waiting' | 'playing' | 'finished';

    winnerId?: string;
}
```

---

# 15. Game Engine Interface

Every game should implement a similar interface.

```ts
export interface CardGameEngine {

    initializeGame(): void;

    createDeck(): void;

    shuffleDeck(): void;

    dealCards(): void;

    getValidMoves(playerId: string): Card[];

    playCard(
        playerId: string,
        cardId: string
    ): void;

    isGameOver(): boolean;

    calculateScore(): void;

    getWinner(): string | null;
}
```

---

# 16. Bhabhi Thulla Engine

The first game should be Bhabhi Thulla.

Recommended engine: `BhabhiThullaEngine`

```text
initializeGame()

createDeck()

shuffleDeck()

dealCards()

findStartingPlayer()

getValidCards()

playCard()

resolveTrick()

checkBhabhi()

removePlayer()

calculateScore()

isGameOver()

getWinner()
```

Game rules must be completely separate from the UI.

---

# 17. Regional Rules

Some card games can have regional rule variations.

Therefore rules should be configurable.

```ts
export interface GameRules {
    playerCount: number;
    deckSize: number;
    scoring: object;
    specialCards: object;
}
```

Example:

```text
Bhabhi Thulla
|
+-- Pakistan Rules
+-- India Rules
+-- Custom Rules
```

The exact rules shown to users must be clearly documented for each supported variation.

---

# 18. Bot System

Bots should not simply randomly select cards.

Bot decision-making:

```text
Game State
    |
    v
Available Moves
    |
    v
Bot Strategy
    |
    v
Evaluate Moves
    |
    v
Select Move
    |
    v
Execute Move
```

---

# 19. Bot Difficulty

Support:

- Easy
- Normal
- Hard
- Expert

| Difficulty | Description                         |
|------------|-------------------------------------|
| Easy       | Basic decisions and limited strategy |
| Normal     | Reasonable gameplay                 |
| Hard       | Uses advanced game strategy         |
| Expert     | Uses deeper game analysis           |

---

# 20. Bot Personalities

Possible bots:

- Friendly
- Aggressive
- Strategic
- Random
- Expert

Example model:

```ts
export interface BotProfile {
    id: string;
    name: string;
    difficulty: string;
    personality: string;
    avatar: string;
}
```

---

# 21. Gaming UI Design

The website should **NOT** look like a standard business application.

The UI should feel like a modern casual gaming platform.

## Design Principles

- Dark gaming interface
- Large game artwork
- Rounded cards
- Smooth transitions
- Glowing highlights
- Strong visual hierarchy
- Large touch targets
- Responsive layout
- Minimal clutter
- Clear game state

---

# 22. Color System

Use CSS variables.

```css
:root {
    --bg-primary: #0B1020;
    --bg-secondary: #12182A;
    --bg-card: #171E32;

    --color-primary: #6C5CE7;
    --color-secondary: #00D4FF;

    --color-success: #22C55E;
    --color-warning: #F59E0B;
    --color-danger: #EF4444;

    --text-primary: #FFFFFF;
    --text-secondary: #94A3B8;

    --border-color: rgba(255, 255, 255, 0.08);
}
```

---

# 23. Typography

Use a modern gaming-friendly font.

Recommended characteristics:

- Bold headings
- Medium body text
- Large buttons
- High readability
- Strong contrast

Example:

```text
H1: 48px - 64px
H2: 32px - 42px
H3: 22px - 28px
Body: 15px - 18px
Button: 14px - 16px
```

Use responsive typography with `clamp()`.

---

# 24. Homepage

The homepage should contain:

```text
HEADER

HERO

FEATURED GAMES

POPULAR GAMES

REGIONAL GAMES

WHY PLAY CARD ARENA

HOW IT WORKS

SEO CONTENT

FOOTER
```

---

# 25. Homepage Header

Desktop:

```text
+------------------------------------------------------------+
| CARD ARENA | Games | Multiplayer | Leaderboard | Search   |
|                                              Login [PLAY] |
+------------------------------------------------------------+
```

Mobile:

```text
+--------------------------------+
| CARD ARENA       Search   Menu |
+--------------------------------+
```

---

# 26. Homepage Hero

Recommended:

```text
PLAY CARD GAMES
YOUR WAY

Classic favorites and regional card games,
right in your browser.

[ PLAY NOW ]

[ EXPLORE GAMES ]
```

Hero should include attractive card/game artwork.

---

# 27. Featured Games

Game cards:

```text
+-------------------------+
|                         |
|       GAME ART          |
|                         |
+-------------------------+
| Bhabhi Thulla           |
| Classic card game       |
|                         |
| 4 Players  | AI         |
|                         |
|       [ PLAY ]          |
+-------------------------+
```

---

# 28. Games Catalog

The Games page should support:

**Filters**

- All
- Popular
- Regional
- Multiplayer
- Single Player
- Classic

**Sorting**

- Popular
- Newest
- A-Z
- Most Played

**Search**

```text
Search games...
```

---

# 29. Game Card Component

Reusable component: `app-game-card`

Inputs:

- `game`

Outputs:

- `play`

The card should show:

- Image
- Name
- Description
- Player count
- AI availability
- Multiplayer availability
- Play button

---

# 30. Bhabhi Thulla Game Screen

Desktop layout:

```text
+---------------------------------------------------------+
| Bhabhi Thulla              Round 2             Settings |
+---------------------------------------------------------+
|                                                         |
|                       BOT 2                             |
|                      [Avatar]                           |
|                      Cards                              |
|                                                         |
|                                                         |
| BOT 1              GAME TABLE              BOT 3        |
| [Avatar]             [Cards]             [Avatar]      |
|                                                         |
|                                                         |
|                     YOUR HAND                           |
|                                                         |
|        [Card] [Card] [Card] [Card] [Card]              |
|                                                         |
+---------------------------------------------------------+
| YOUR TURN                           TIMER 00:15         |
|                                                         |
|                   [ PLAY CARD ]                         |
+---------------------------------------------------------+
```

---

# 31. Mobile Game Screen

```text
+---------------------------+
| Bhabhi Thulla        ⚙    |
+---------------------------+
|                           |
|          BOT              |
|         Avatar            |
|                           |
|                           |
| Avatar           Avatar   |
|                           |
|         GAME TABLE        |
|            Cards          |
|                           |
|                           |
|       YOUR HAND           |
|                           |
| [C] [C] [C] [C] [C] [C] |
|                           |
+---------------------------+
| YOUR TURN         00:15   |
+---------------------------+
```

---

# 32. Playing Card Component

Create: `app-playing-card`

Responsibilities:

- Render card
- Selected state
- Hover state
- Click interaction
- Animation
- Disabled state

Example:

```html
<app-playing-card
    [card]="card"
    [selected]="selected"
    (cardClick)="playCard(card)">
</app-playing-card>
```

---

# 33. Card Selection

Normal:

```text
[ CARD ]
```

Selected:

```text
     [ CARD ]
        ↑
     Selected
```

Example:

```css
.card.selected {
    transform: translateY(-18px);
}
```

Use animation around **150ms – 400ms**.

---

# 34. Card Animations

Cards should animate when:

- Dealt
- Selected
- Played
- Captured
- Flipped
- Removed
- Returned

Animations should communicate game state and not become distracting.

---

# 35. Player UI

Each player displays:

- Avatar
- Username
- Cards remaining
- Score
- Connection status
- Turn state

Example:

```text
+----------------+
|     Avatar     |
|     Ahmed      |
|    5 cards     |
|      ●         |
+----------------+
```

---

# 36. Turn Indicator

The active player should be visually obvious.

Use:

- Glowing border
- Pulse animation
- Highlight
- Timer
- "YOUR TURN" indicator

Example:

```text
+----------------------+
|      YOUR TURN       |
|         00:15        |
+----------------------+
```

---

# 37. Timer

Timer should display:

```text
YOUR TURN

00:15
```

When time is low, the interface should provide a visual warning.

---

# 38. Game Controls

Desktop:

```text
[ Hint ]
[ Auto Play ]
[ Sound ]
[ Settings ]
[ Leave Game ]
```

Mobile:

Use a compact bottom control bar or bottom sheet.

---

# 39. Game Result

```text
+--------------------------------+
|                                |
|          🎉 YOU WIN!           |
|                                |
|            +120 XP             |
|                                |
|            Score: 15           |
|                                |
|  🥇 You                       |
|  🥈 Ahmed                     |
|  🥉 Ali                       |
|                                |
|       [ PLAY AGAIN ]            |
|                                |
|       [ BACK TO GAMES ]         |
|                                |
+--------------------------------+
```

---

# 40. Sound Effects

Optional sounds:

- `card-deal.mp3`
- `card-play.mp3`
- `card-select.mp3`
- `turn.mp3`
- `win.mp3`
- `lose.mp3`
- `button.mp3`

Users should be able to disable:

- Sound
- Music
- Effects

---

# 41. Loading Screen

When a game starts:

```text
Preparing Table...

Shuffling Cards...

Dealing Cards...

Starting Game...
```

Keep the loading sequence short.

---

# 42. Connection State

For multiplayer:

Connected:

```text
● Connected
```

Disconnected:

```text
● Reconnecting...
```

Connection failure:

```text
Connection lost.

Trying to reconnect...

[ RETRY ]
```

---

# 43. Backend Project Structure

```text
backend/
|
+-- app/
|   |
|   +-- main.py
|   |
|   +-- core/
|   |   +-- config.py
|   |   +-- database.py
|   |   +-- security.py
|   |
|   +-- models/
|   |   +-- user.py
|   |   +-- game.py
|   |   +-- game_session.py
|   |   +-- game_player.py
|   |   +-- game_result.py
|   |   +-- achievement.py
|   |   +-- leaderboard.py
|   |
|   +-- schemas/
|   |   +-- user.py
|   |   +-- auth.py
|   |   +-- game.py
|   |   +-- session.py
|   |
|   +-- api/
|   |   +-- auth.py
|   |   +-- users.py
|   |   +-- games.py
|   |   +-- sessions.py
|   |   +-- statistics.py
|   |   +-- leaderboard.py
|   |
|   +-- websocket/
|   |   +-- manager.py
|   |   +-- game_socket.py
|   |
|   +-- services/
|   |   +-- auth_service.py
|   |   +-- game_service.py
|   |   +-- player_service.py
|   |   +-- statistics_service.py
|   |
|   +-- games/
|   |   +-- base_game.py
|   |   |
|   |   +-- bhabhi_thulla/
|   |   |   +-- engine.py
|   |   |   +-- rules.py
|   |   |   +-- bot.py
|   |   |
|   |   +-- court_piece/
|   |   +-- twenty_nine/
|   |   +-- seep/
|   |   +-- call_break/
|   |
|   +-- utils/
|
+-- alembic/
|
+-- tests/
|
+-- requirements.txt
|
+-- Dockerfile
|
+-- .env
```

---

# 44. FastAPI Application

```python
from fastapi import FastAPI

app = FastAPI(
    title="CardArena API",
    version="1.0.0"
)


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }
```

---

# 45. API Base URL

```text
/api/v1
```

---

# 46. Authentication API

```text
POST /api/v1/auth/register

POST /api/v1/auth/login

POST /api/v1/auth/refresh

POST /api/v1/auth/logout

GET /api/v1/auth/me
```

---

# 47. Users API

```text
GET /api/v1/users/me

PUT /api/v1/users/me

GET /api/v1/users/{username}

GET /api/v1/users/{username}/statistics
```

---

# 48. Games API

```text
GET /api/v1/games

GET /api/v1/games/{slug}

GET /api/v1/games/{slug}/rules

GET /api/v1/games/{slug}/statistics
```

Example:

```text
GET /api/v1/games/bhabhi-thulla
```

Response:

```json
{
    "id": 1,
    "name": "Bhabhi Thulla",
    "slug": "bhabhi-thulla",
    "players": 4,
    "bot_available": true,
    "multiplayer_available": false
}
```

---

# 49. Game Session API

```text
POST /api/v1/sessions

GET /api/v1/sessions/{session_id}

POST /api/v1/sessions/{session_id}/join

POST /api/v1/sessions/{session_id}/leave

POST /api/v1/sessions/{session_id}/finish
```

---

# 50. Multiplayer API

```text
POST /api/v1/rooms

GET /api/v1/rooms/{room_code}

POST /api/v1/rooms/{room_code}/join

POST /api/v1/rooms/{room_code}/leave
```

---

# 51. WebSocket API

Endpoint:

```text
/ws/game/{room_id}
```

Client connects:

```text
Angular
   |
   | WebSocket
   v
FastAPI
```

---

# 52. WebSocket Events

**Client → Server**

```text
join_room
leave_room
ready
play_card
chat_message
request_rematch
```

**Server → Client**

```text
player_joined
player_left
game_started
turn_changed
card_played
game_state_updated
player_disconnected
game_finished
error
```

---

# 53. WebSocket Example

Client:

```json
{
    "type": "play_card",
    "card_id": "hearts-A"
}
```

Server flow:

```text
Receive Action
     |
     v
Authenticate Player
     |
     v
Check Room
     |
     v
Check Turn
     |
     v
Check Card Ownership
     |
     v
Check Game Rules
     |
     v
Execute Move
     |
     v
Broadcast Updated State
```

---

# 54. Server Authority

The backend must be authoritative for multiplayer games.

Never trust frontend game state.

The frontend may request `play_card`, but the backend decides whether the move is legal.

The server must validate:

- Player identity
- Room membership
- Current turn
- Card ownership
- Game phase
- Valid move
- Action timing

---

# 55. Hidden Information

Never send hidden player cards to other players.

**Bad:**

```json
{
    "player1_cards": [],
    "player2_cards": [],
    "player3_cards": [],
    "player4_cards": []
}
```

Instead send only information that each player is allowed to know.

---

# 56. PostgreSQL Database

Database name: `cardarena`

---

# 57. Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,

    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 58. Games Table

```sql
CREATE TABLE games (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    slug VARCHAR(100) UNIQUE NOT NULL,

    description TEXT,

    min_players INTEGER NOT NULL,

    max_players INTEGER NOT NULL,

    bot_enabled BOOLEAN DEFAULT TRUE,

    multiplayer_enabled BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 59. Game Sessions Table

```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY,

    game_id INTEGER REFERENCES games(id),

    room_code VARCHAR(20),

    mode VARCHAR(20) NOT NULL,

    status VARCHAR(20) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    started_at TIMESTAMP,

    finished_at TIMESTAMP
);
```

---

# 60. Game Players Table

```sql
CREATE TABLE game_players (
    id UUID PRIMARY KEY,

    session_id UUID REFERENCES game_sessions(id),

    user_id UUID REFERENCES users(id),

    seat_number INTEGER,

    is_bot BOOLEAN DEFAULT FALSE,

    bot_name VARCHAR(100),

    score INTEGER DEFAULT 0,

    result VARCHAR(20),

    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 61. Game Results Table

```sql
CREATE TABLE game_results (
    id UUID PRIMARY KEY,

    session_id UUID REFERENCES game_sessions(id),

    winner_id UUID REFERENCES users(id),

    score JSONB,

    game_data JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 62. Player Statistics

```sql
CREATE TABLE player_statistics (
    id UUID PRIMARY KEY,

    user_id UUID REFERENCES users(id),

    game_id INTEGER REFERENCES games(id),

    games_played INTEGER DEFAULT 0,

    games_won INTEGER DEFAULT 0,

    games_lost INTEGER DEFAULT 0,

    total_score INTEGER DEFAULT 0,

    win_rate DECIMAL(5,2) DEFAULT 0,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, game_id)
);
```

---

# 63. Achievements

```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    icon VARCHAR(255),

    requirement JSONB
);
```

---

# 64. User Achievements

```sql
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id),

    achievement_id INTEGER REFERENCES achievements(id),

    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(user_id, achievement_id)
);
```

---

# 65. Database Indexes

```sql
CREATE INDEX idx_users_username
ON users(username);

CREATE INDEX idx_game_sessions_room
ON game_sessions(room_code);

CREATE INDEX idx_game_players_session
ON game_players(session_id);

CREATE INDEX idx_statistics_user
ON player_statistics(user_id);

CREATE INDEX idx_statistics_game
ON player_statistics(game_id);
```

---

# 66. SQLAlchemy

Use SQLAlchemy as the database abstraction layer.

Recommended:

- SQLAlchemy 2.x
- Async PostgreSQL driver
- asyncpg

Database flow:

```text
FastAPI
   |
   v
Service
   |
   v
SQLAlchemy
   |
   v
PostgreSQL
```

---

# 67. Database Migrations

Use Alembic.

Initialize:

```bash
alembic init alembic
```

Create migration:

```bash
alembic revision --autogenerate -m "create users table"
```

Apply:

```bash
alembic upgrade head
```

---

# 68. Authentication

Use:

- JWT Access Token
- JWT Refresh Token

Flow:

```text
Login
   |
   v
FastAPI
   |
   v
Validate Credentials
   |
   v
Generate JWT
   |
   v
Angular
```

Prefer secure HTTP-only cookies for refresh tokens.

---

# 69. Password Security

Never store plain-text passwords.

Use `bcrypt`.

Database field: `password_hash`

Never: `password`

---

# 70. Environment Variables

Backend:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/cardarena

JWT_SECRET_KEY=CHANGE_THIS_SECRET

JWT_ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30

REFRESH_TOKEN_EXPIRE_DAYS=30

CORS_ORIGINS=http://localhost:4200

ENVIRONMENT=development
```

Never commit `.env`.

---

# 71. Backend Dependencies

Example:

```text
fastapi
uvicorn
sqlalchemy
asyncpg
alembic
pydantic
pydantic-settings
python-jose
passlib
bcrypt
python-multipart
```

Future:

```text
redis
pytest
httpx
```

---

# 72. API Response Format

Success:

```json
{
    "success": true,
    "data": {},
    "message": null
}
```

Error:

```json
{
    "success": false,
    "data": null,
    "message": "Invalid move"
}
```

---

# 73. HTTP Status Codes

Use standard HTTP status codes.

| Code | Meaning               |
|------|-----------------------|
| 200  | OK                    |
| 201  | Created               |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 422  | Validation Error      |
| 429  | Too Many Requests     |
| 500  | Internal Server Error |

---

# 74. CORS

Development:

```text
http://localhost:4200
```

Production:

```text
https://your-domain.com
```

Do not use unrestricted origins in production when credentials are involved.

---

# 75. Multiplayer Room System

Create room:

```text
CREATE GAME

Game:
Bhabhi Thulla

Players:
4

Mode:
Private

[ CREATE ROOM ]
```

Server returns:

```text
Room Code:

AB72K

Shareable URL:

/join/AB72K
```

---

# 76. Multiplayer Flow

```text
Player A
    |
    v
Create Room
    |
    v
Room Code
    |
    +----------------+
    |                |
    v                v
Player B          Player C
    |                |
    +-------+--------+
            |
            v
       Player D
            |
            v
        All Ready
            |
            v
       Game Starts
```

---

# 77. Public Matchmaking

Future feature:

```text
PLAY ONLINE
```

Flow:

```text
Find Match
    |
    v
Searching...
    |
    v
Players Found
    |
    v
Room Created
    |
    v
Game Starts
```

---

# 78. Reconnection

If a player disconnects:

```text
Player Disconnects
       |
       v
Server Detects
       |
       v
Wait For Reconnection
       |
       v
Player Reconnects
       |
       v
Restore Session
       |
       v
Send Current Game State
```

The game should not immediately end when a player temporarily disconnects.

---

# 79. Redis

Initially:

- One FastAPI server
- In-memory rooms

Later:

```text
Multiple FastAPI servers
        |
        v
      Redis
        |
        v
Shared Room State
```

Redis should be used for temporary real-time data, not as the primary permanent database.

---

# 80. Persistent vs Temporary Data

## PostgreSQL

Store:

- Users
- Profiles
- Statistics
- Achievements
- Game history
- Leaderboards
- Final game results

## Redis (Future)

- Active rooms
- Temporary game state
- Player connections
- Matchmaking
- Temporary session data

Do not write every card movement to PostgreSQL.

---

# 81. Game History

Store after a game finishes:

- Game
- Players
- Winner
- Scores
- Duration
- Date
- Mode

Optional:

- Replay Data

---

# 82. Replay System

Future feature.

Store actions:

```json
[
    {
        "player": "1",
        "action": "play_card",
        "card": "AH"
    },
    {
        "player": "2",
        "action": "play_card",
        "card": "AD"
    }
]
```

The game can then be replayed from the action sequence.

---

# 83. Player Profile

Profile should display:

- Avatar
- Username
- Level
- XP
- Games Played
- Games Won
- Win Rate
- Achievements
- Favorite Games
- Game Statistics

Example:

```text
+----------------------------+
|          Avatar            |
|          Ahmed             |
|         Level 18           |
|                            |
| Games Played       324     |
| Games Won          211     |
| Win Rate           65.1%   |
|                            |
| ACHIEVEMENTS               |
| 🏆 🏆 🏆                   |
+----------------------------+
```

---

# 84. XP System

Example:

| Action       | Reward  |
|--------------|---------|
| Game Played  | +10 XP  |
| Game Won     | +30 XP  |
| Win Streak   | +20 XP  |
| Achievement  | +100 XP |

Do not make progression pay-to-win.

---

# 85. Achievements

Examples:

- First Victory
- First Multiplayer Game
- 10 Games Played
- 50 Games Played
- 100 Games Won
- 10 Win Streak
- Bhabhi Thulla Master
- Court Piece Master
- Regional Card Champion

---

# 86. Leaderboards

Example:

```text
GLOBAL LEADERBOARD

#1   Ahmed       5,420 XP
#2   Ali         5,110 XP
#3   Hassan      4,980 XP
#4   Bilal       4,720 XP
```

Filters:

- Daily
- Weekly
- Monthly
- All Time

---

# 87. Game Statistics

Per game:

- Games Played
- Games Won
- Games Lost
- Win Rate
- Best Score
- Longest Win Streak
- Average Game Time

---

# 88. Daily Challenges

Future feature:

```text
DAILY CHALLENGE

Win 3 games

Reward:
+100 XP

[ PLAY ]
```

Daily challenges can improve retention.

---

# 89. Social Features

Future features:

- Friend system
- Player profiles
- Friend invites
- Private rooms
- Game invitations
- Chat
- Rematch
- Share game

---

# 90. Chat

Multiplayer rooms can have simple text chat.

Example:

```text
Ahmed:
Good game!

Ali:
Nice move!
```

Before public launch, implement:

- Rate limiting
- Basic moderation
- Report functionality
- Message filtering

---

# 91. SEO Strategy

Every game should have its own indexable page.

Examples:

```text
/games/bhabhi-thulla
/games/court-piece
/games/29
/games/seep
/games/call-break
/games/hokm
/games/tarneeb
/games/baloot
```

---

# 92. Game SEO Page

Each game page should contain:

- H1
- Game Description
- Play Button
- Game Information
- Rules
- How to Play
- Strategy
- FAQ
- Related Games

Example:

```markdown
# Bhabhi Thulla Online

## How to Play Bhabhi Thulla

## Bhabhi Thulla Rules

## Bhabhi Thulla Strategy

## Play Bhabhi Thulla Against AI

## Bhabhi Thulla Multiplayer

## Frequently Asked Questions
```

---

# 93. SEO URL Structure

Good:

```text
/games/bhabhi-thulla
/games/court-piece
/games/call-break
/games/teen-patti
```

Avoid:

```text
/game?id=123
/play?game=abc
```

---

# 94. Metadata

Every game page should dynamically generate:

- Title
- Description
- Canonical URL
- Open Graph
- Social sharing metadata

Example title:

```text
Bhabhi Thulla Online – Play Free Card Game Against AI
```

---

# 95. Structured Data

Potential structured data:

- WebSite
- BreadcrumbList
- FAQPage

Structured data must accurately represent visible content.

---

# 96. Sitemap

Generate `/sitemap.xml`.

Include:

```text
/
/games
/games/bhabhi-thulla
/games/court-piece
/games/29
/games/seep
/games/call-break
```

---

# 97. Robots.txt

```text
User-agent: *
Allow: /

Sitemap: https://your-domain.com/sitemap.xml
```

Replace the domain before production.

---

# 98. Internal Linking

Each game page should link to:

- Related games
- Rules
- Strategy
- Regional games
- Multiplayer games
- Other relevant content

Example:

```text
Bhabhi Thulla
      |
      +-- Court Piece
      |
      +-- 29
      |
      +-- Seep
```

---

# 99. Content Strategy

Create informational content around each game.

Examples:

- How to Play Bhabhi Thulla
- Bhabhi Thulla Rules
- Bhabhi Thulla Strategy
- Bhabhi Thulla Card Game
- Bhabhi Thulla Multiplayer
- Court Piece Rules
- 29 Card Game Rules
- Seep Card Game Guide

---

# 100. Blog

Future: `/blog`

Articles:

- Best Card Games to Play Online
- How to Play Bhabhi Thulla
- Best South Asian Card Games
- Court Piece Rules
- 29 Card Game Rules
- Seep Card Game Guide

---

# 101. Performance

Target:

- Fast initial load
- Lazy-loaded games
- Optimized images
- Compressed assets
- Minimal JavaScript on informational pages
- Efficient animations
- CDN delivery

Angular game modules should be lazy loaded.

---

# 102. Mobile Optimization

Minimum supported width: **320px**

Support:

- Mobile
- Tablet
- Laptop
- Desktop
- Large Screens

Card dimensions should use responsive CSS.

Example:

```css
.card {
    width: clamp(45px, 12vw, 90px);
}
```

---

# 103. PWA

Future PWA support:

- Installable website
- App-like experience
- Offline AI games
- Fast loading
- Cached assets

Offline support should initially be limited to single-player games.

---

# 104. Accessibility

Support:

- Keyboard navigation
- Visible focus
- ARIA labels
- Screen readers
- Reduced motion
- Sufficient contrast
- Large touch targets

---

# 105. Error Handling

Handle:

- API unavailable
- WebSocket disconnected
- Invalid game move
- Session expired
- Game not found
- Server error

Example:

```text
Connection lost.

Trying to reconnect...

[ RETRY ]
```

---

# 106. Security

Production checklist:

- [ ] HTTPS
- [ ] Secure cookies
- [ ] JWT expiration
- [ ] Password hashing
- [ ] CORS restrictions
- [ ] Rate limiting
- [ ] Input validation
- [ ] SQL injection protection
- [ ] WebSocket authentication
- [ ] Server-side game validation
- [ ] Environment secrets
- [ ] Database backups

---

# 107. Anti-Cheat

For multiplayer:

```text
Frontend
    |
    | Request Action
    v
Backend
    |
    | Validate
    v
Game Engine
    |
    | Execute
    v
New Game State
```

Never allow the browser to decide:

- Whether a card is legal
- Whether it is a player's turn
- Whether a player owns a card
- Who wins

The backend must decide.

---

# 108. Rate Limiting

Rate-limit:

- Login
- Registration
- Room creation
- Room joining
- Chat
- WebSocket actions
- API requests

---

# 109. Analytics

Track useful product events:

```text
game_started
game_finished
game_abandoned
game_replayed
game_shared
room_created
room_joined
multiplayer_started
```

Do not collect unnecessary personal information.

---

# 110. Monitoring

Monitor:

- API response time
- Error rate
- Active users
- Active games
- WebSocket connections
- Database connections
- CPU
- Memory

---

# 111. Testing

## Frontend

Test:

- Components
- Services
- Card selection
- Game interactions
- Navigation
- Responsive layout

## Backend

Test:

- Authentication
- API endpoints
- Database
- Game sessions
- WebSockets
- Game rules

---

# 112. Game Engine Testing

Every game engine must have unit tests.

Example:

```text
test_deck_contains_52_cards()

test_cards_are_dealt_correctly()

test_invalid_move_is_rejected()

test_valid_move_is_accepted()

test_turn_changes()

test_game_ends_correctly()

test_winner_is_calculated()
```

The game engine should be testable without Angular.

---

# 113. Development Environment

| Service    | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:4200        |
| Backend    | http://localhost:8000        |
| Swagger    | http://localhost:8000/docs   |
| PostgreSQL | localhost:5432               |

---

# 114. Frontend Setup

```bash
npm install

ng serve
```

---

# 115. Backend Setup

Create virtual environment:

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run:

```bash
uvicorn app.main:app --reload
```

---

# 116. Docker

Backend should support Docker.

Production architecture:

```text
Docker
    |
    +-- FastAPI
    |
    +-- Uvicorn
    |
    +-- Application
```

---

# 117. Render Deployment

Initial deployment:

```text
Angular
    |
    v
Static Hosting / CDN

FastAPI
    |
    v
Render Web Service

PostgreSQL
    |
    v
Managed PostgreSQL
```

For production, use an appropriate persistent PostgreSQL service.

Do not rely on temporary development databases for production data.

---

# 118. Production Architecture

```text
                       INTERNET
                           |
                           v
                    +-------------+
                    | Cloudflare  |
                    | CDN / DNS   |
                    +------+------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
       Angular Frontend             FastAPI
                                       |
                         +-------------+-------------+
                         |                           |
                         v                           v
                    PostgreSQL                    Redis
                                                  |
                                                  v
                                           Active Game Rooms
```

---

# 119. Logging

Backend should log:

- Requests
- Errors
- Game events
- WebSocket connections
- Database errors
- Authentication failures

Never log:

- Passwords
- JWT secrets
- Private tokens
- Sensitive user information

---

# 120. Design System Components

Reusable components:

- GameCard
- PlayingCard
- CardHand
- PlayerAvatar
- PlayerStatus
- GameTable
- GameTimer
- ScoreBoard
- GameControls
- GameResult
- GameHeader
- Modal
- Toast
- Loader
- Button
- Input
- Dropdown
- Tabs

---

# 121. Navigation

Recommended:

```text
/
|
+-- games
|
+-- games/bhabhi-thulla
+-- games/court-piece
+-- games/29
+-- games/seep
+-- games/call-break
|
+-- play/bhabhi-thulla
|
+-- multiplayer
|
+-- leaderboard
|
+-- profile
|
+-- login
|
+-- register
|
+-- rules
|
+-- blog
|
+-- settings
```

---

# 122. Header Navigation

Desktop:

```text
CARD ARENA

Games
Multiplayer
Leaderboard

Search

Login

[ PLAY NOW ]
```

Mobile:

```text
CARD ARENA

Search
Menu
```

---

# 123. Search

Global search:

```text
Search games and players...
```

Results:

```text
GAMES

Bhabhi Thulla
Court Piece
29
Seep

PLAYERS

Ahmed
Ali
Hassan
```

---

# 124. Game Discovery

Filters:

- All
- Popular
- Regional
- Multiplayer
- Single Player
- Classic

Sorting:

- Popular
- New
- A-Z
- Most Played

---

# 125. Themes

Default: **Dark Gaming**

Future themes:

- Classic Green Table
- Blue Table
- Red Table
- Minimal

Themes should be cosmetic.

---

# 126. Localization

Prepare for:

- English
- Urdu
- Hindi
- Arabic
- Turkish
- Bengali

Initial version: **English**

---

# 127. Sharing

Add "Share Game":

- WhatsApp
- Facebook
- X
- Copy Link

Especially useful for multiplayer rooms.

---

# 128. Invite System

```text
INVITE FRIENDS

Room Code:

AB72K

[ COPY LINK ]

[ SHARE ]
```

---

# 129. Monetization

Primary monetization: **Advertising**

Potential platforms:

- Google AdSense
- Google H5 Games Ads

Potential advertising pages:

- Homepage
- Game catalog
- Game rules
- How-to-play pages
- Blog/content pages

Ads must not interfere with gameplay controls.

---

# 130. Future Premium Features

Possible future premium features:

- Remove Ads
- Premium Themes
- Card Skins
- Custom Tables
- Premium Avatars
- Advanced Statistics

Cosmetic features should not create pay-to-win mechanics.

---

# 131. No Real-Money Wagering

The platform should initially remain a free-to-play entertainment platform.

Avoid:

- Real-money betting
- Gambling mechanics
- Cash wagering
- Deposits
- Withdrawals

This keeps the product architecture and monetization strategy considerably simpler.

---

# 132. Product Differentiation

CardArena should compete through:

- Better UI
- Better animations
- Better mobile experience
- Regional games
- Smart bots
- Multiplayer
- Player progression
- SEO content

The objective is not to clone another card-game website.

The objective is:

> Build a better browser gaming experience.

---

# 133. Positioning

Recommended positioning:

> A modern home for classic and regional card games.

Avoid positioning the platform as only a Solitaire website.

Regional card games should be one of the major differentiators.

---

# 134. Bhabhi Thulla Positioning

Suggested landing-page positioning:

```text
BHABHI THULLA ONLINE

Play Bhabhi Thulla online against smart
AI opponents or challenge your friends.

[ PLAY NOW ]

Free to play • No download required
```

---

# 135. User Retention

Potential retention features:

- Daily Challenges
- XP
- Levels
- Achievements
- Win Streaks
- Leaderboards
- Statistics
- Friends
- Rematches
- Multiplayer Rooms

---

# 136. Game Loading Experience

Recommended flow:

```text
Click PLAY
    |
    v
Game Loading
    |
    +-- Preparing Table
    |
    +-- Shuffling Cards
    |
    +-- Dealing Cards
    |
    v
Game Starts
```

---

# 137. Game Completion

After the game:

```text
Game Finished
      |
      v
Calculate Result
      |
      v
Update Statistics
      |
      v
Award XP
      |
      v
Check Achievements
      |
      v
Save Game History
      |
      v
Show Result
```

---

# 138. Game Session Lifecycle

```text
WAITING
   |
   v
STARTING
   |
   v
PLAYING
   |
   v
FINISHED
```

Possible cancellation:

```text
WAITING
   |
   v
CANCELLED
```

---

# 139. Generic Game State Lifecycle

```text
Initialize
    |
    v
Create Deck
    |
    v
Shuffle
    |
    v
Deal
    |
    v
Determine Turn
    |
    v
Player Action
    |
    v
Validate
    |
    v
Execute
    |
    v
Update State
    |
    v
Next Turn
    |
    v
Check Game Over
    |
   / \
 No   Yes
 |     |
 +---> Finish
```

---

# 140. Architecture Principle

Game logic must never be tightly coupled to Angular UI.

**Bad:**

```text
Angular Component
       |
       +-- Game Rules
       +-- Bot Logic
       +-- Scoring
       +-- Animation
```

**Good:**

```text
Game Engine
     |
     v
Game State
     |
     v
Angular UI
```

---

# 141. Backend Game Engine

The backend should eventually contain the authoritative game implementation.

```text
FastAPI
   |
   v
Game Service
   |
   v
Game Engine
   |
   +-- Rules
   +-- State
   +-- Validation
   +-- Scoring
```

For AI-only games, the browser may initially run the game engine locally.

For multiplayer, the server must become authoritative.

---

# 142. AI-Only Architecture

Initial MVP:

```text
Angular
   |
   +-- Game Engine
   |
   +-- Bot AI
   |
   +-- Game State
```

This allows fast gameplay without requiring a server request for every move.

---

# 143. Multiplayer Architecture

Production multiplayer:

```text
Angular
   |
   | WebSocket
   v
FastAPI
   |
   v
Game Engine
   |
   v
Authoritative Game State
   |
   +-- Player A
   +-- Player B
   +-- Player C
   +-- Player D
```

---

# 144. Future AI Improvements

Bots can eventually use:

- Heuristics
- Probability
- Card Counting
- Monte Carlo Simulation
- Game-Specific Strategy

Do not use expensive AI models for simple card decisions unless there is a clear benefit.

Traditional algorithms will often be faster and cheaper.

---

# 145. Scalability

Initial:

- One FastAPI instance
- One PostgreSQL database
- In-memory rooms

Future:

```text
Load Balancer
      |
      +-- FastAPI Instance 1
      +-- FastAPI Instance 2
      +-- FastAPI Instance 3
             |
             v
           Redis
             |
             v
        PostgreSQL
```

---

# 146. Performance Goals

Target:

- Fast initial page load
- Low interaction latency
- Smooth card animations
- Minimal unnecessary API calls
- Efficient WebSocket messages
- Lazy-loaded games
- Optimized images

---

# 147. Development Phases

## Phase 1 — Foundation

Build: Angular, FastAPI, PostgreSQL, Docker, Authentication, Routing, Base UI

## Phase 2 — Design System

Build: Navbar, Buttons, Cards, Modals, Game cards, Avatars, Typography, Colors, Animations, Responsive layout

## Phase 3 — Bhabhi Thulla

Build: Deck, Cards, Shuffle, Deal, Game State, Rules, Player Hand, Bots, Turns, Animations, Scoring, Game Result

## Phase 4 — User System

Build: Register, Login, Profile, Statistics, Game History, XP, Achievements

## Phase 5 — SEO

Build: Game Landing Pages, Rules, FAQ, Metadata, Sitemap, Robots, Structured Data, Internal Links

## Phase 6 — Multiplayer

Build: WebSocket Server, Room Creation, Room Joining, Room Codes, Player Synchronization, Game Synchronization, Server Validation, Reconnection, Chat, Rematch

## Phase 7 — More Games

Add: Court Piece, 29, Seep, Call Break, Hokm, Tarneeb, Baloot, Spades, Hearts

## Phase 8 — Monetization

Implement: AdSense, H5 Games Ads where applicable, Remove Ads option, Premium cosmetics

## Phase 9 — Scaling

Add: Cloudflare, Redis, Multiple FastAPI instances, Database optimization, CDN, Background workers, Monitoring

---

# 148. Recommended Development Order

Do not build all games simultaneously.

Recommended:

1. Project Setup
2. Design System
3. Homepage
4. Games Catalog
5. Playing Card Component
6. Card Hand Component
7. Game Table
8. Bhabhi Thulla Engine
9. Bhabhi Thulla UI
10. Bot AI
11. Game Result
12. Authentication
13. Statistics
14. SEO
15. Deployment
16. Multiplayer
17. Court Piece
18. 29
19. Seep
20. Call Break

---

# 149. MVP Definition of Done

The MVP is complete when:

- [ ] Angular application works
- [ ] FastAPI backend works
- [ ] PostgreSQL works
- [ ] Database migrations work
- [ ] Registration works
- [ ] Login works
- [ ] Homepage completed
- [ ] Games page completed
- [ ] Bhabhi Thulla implemented
- [ ] Bhabhi Thulla rules tested
- [ ] AI bots work
- [ ] Card animations work
- [ ] Game result works
- [ ] Statistics work
- [ ] Mobile UI works
- [ ] SEO page exists
- [ ] Sitemap exists
- [ ] Production deployment works

---

# 150. Multiplayer Definition of Done

- [ ] WebSocket authentication
- [ ] Create room
- [ ] Join room
- [ ] Room code
- [ ] Player synchronization
- [ ] Game synchronization
- [ ] Server-side validation
- [ ] Turn synchronization
- [ ] Disconnect handling
- [ ] Reconnection
- [ ] Game completion
- [ ] Rematch
- [ ] Chat

---

# 151. Success Metrics

Track:

- Daily Active Users
- Monthly Active Users
- Games Started
- Games Completed
- Games Per User
- Average Session Duration
- Returning Users
- Bhabhi Thulla Plays
- Court Piece Plays
- 29 Plays
- Seep Plays
- Multiplayer Games
- Organic Search Traffic
- Game Page Traffic
- Ad Revenue

---

# 152. Long-Term Product Structure

```text
CardArena
|
+-- Classic Games
|   |
|   +-- Solitaire
|   +-- Spades
|   +-- Hearts
|   +-- Rummy
|
+-- Regional Games
|   |
|   +-- Bhabhi Thulla
|   +-- Court Piece
|   +-- 29
|   +-- Seep
|   +-- Call Break
|   +-- Hokm
|   +-- Tarneeb
|   +-- Baloot
|
+-- Multiplayer
|   |
|   +-- Public Matchmaking
|   +-- Private Rooms
|   +-- Friend Invites
|
+-- Player System
|   |
|   +-- Profiles
|   +-- XP
|   +-- Levels
|   +-- Achievements
|   +-- Statistics
|
+-- Competitive
|   |
|   +-- Leaderboards
|   +-- Rankings
|   +-- Tournaments
|
+-- Content
    |
    +-- Rules
    +-- Guides
    +-- Strategies
    +-- Blog
```

---

# 153. Final Architecture

```text
                         CARD ARENA
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
         ANGULAR                           FASTAPI
             |                                 |
             |                         REST + WebSocket
             |                                 |
             |                    +------------+------------+
             |                    |                         |
             |                    v                         v
             |               Game Engine                Services
             |                    |                         |
             |                    +------------+------------+
             |                                 |
             |                            SQLAlchemy
             |                                 |
             |                                 v
             |                            PostgreSQL
             |
             +-- Homepage
             +-- Games
             +-- Game UI
             +-- Profile
             +-- Leaderboard
             +-- Statistics
             +-- Multiplayer
```

---

# 154. Core Product Philosophy

CardArena should follow:

> Simple + Fast + Beautiful + Interactive + Competitive

The user should immediately understand:

- What game is this?
- How do I play?
- What should I click?
- Whose turn is it?
- What happens next?

---

# 155. Core Technical Philosophy

Follow:

- Clean Architecture
- SOLID Principles
- Strong Typing
- Reusable Components
- Game Engine Separation
- Server-Side Validation
- Unit Testing
- Responsive Design
- SEO Best Practices

Avoid:

- Huge Components
- Duplicated Game Logic
- Hardcoded API URLs
- Hardcoded Game Rules
- Global Mutable State
- Frontend-Only Multiplayer Authority

---

# 156. Final Product Goal

The final experience should combine:

- CardGames.io-style accessibility
- Modern gaming UI
- Regional card games
- Smart AI opponents
- Real-time multiplayer
- Player progression
- Leaderboards
- SEO content
- Mobile-first design

The goal is not to copy an existing website.

The goal is to build an original, more modern card-game platform with a strong regional-game identity.

---

# 157. First Technical Milestone

The first milestone should be:

> Angular + FastAPI + PostgreSQL + Bhabhi Thulla + 4-player AI + Modern gaming UI

Do not implement multiplayer until the following are stable and tested:

- Game rules
- Game state
- Bot logic
- UI
- Scoring
- Animations

---

# 158. Recommended First Release

The first public version should focus on quality rather than quantity.

Launch with:

```text
HOME
   |
   +-- Bhabhi Thulla
   |
   +-- Court Piece
   |
   +-- 29
   |
   +-- Seep
   |
   +-- Call Break
```

Each game should have:

- Game Page
- Rules
- How To Play
- AI Mode
- Statistics
- Mobile UI
- SEO Content

Multiplayer can then be introduced after the first games are stable.

---

# 159. Final Principle

Build one excellent card game first.

Build the reusable game architecture around it.

Then use that architecture to add more games.

Add multiplayer after the game engine is reliable.

Build SEO pages around every game.

Use the regional game catalog as a major competitive advantage.

---

**END OF PROJECT SPECIFICATION**