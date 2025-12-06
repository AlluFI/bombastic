Developer 3 – Detailed Plan (NPC AI, Difficulty Modes, Bomb Logic, Powerups)

Primary Responsibility:
Build virtual opponents (NPCs) that closely mimic human players, implement difficulty levels, handle AI movement, bomb placement logic, collision logic, powerup handling, and ensure compatibility with multiplayer server logic.

Developer 3 works on the logic layer, not rendering — Developer 1 handles visuals, Developer 2 handles network layer.

🧩 PART 1 — NPC Framework & Architecture
1.1 Create NPC Controller System

Tasks

Create /npc module containing:

NPC class

Difficulty profiles

Behavior trees or state machines

Utility functions (pathfinding, danger detection, item evaluation)

NPC “looks” like a real player to the rest of the system via a unified interface:

npc.getNextCommand() → { type: "MOVE" | "BOMB", direction: "UP" }

1.2 Integrate With Server

NPCs added to the server via Developer 2’s API

NPCs treated identically to human players (except they cannot pause/quit)

Testing Criteria

NPC spawns successfully

NPC receives same world state as players

No crashes or infinite loops in NPC logic

NPC responds every tick with actions

Time Estimate: 1 day
Learning Resources

Overview of AI in games: https://gameprogrammingpatterns.com/state.html

Behavior trees intro: https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work

🧩 PART 2 — Pathfinding, Avoidance, and Map Awareness
2.1 Implement Basic Pathfinding

Tasks

Use grid-based BFS (Bomberman map is small, A* unnecessary but optional)

NPC can navigate around walls and blocks

Maintain a navigation grid updated each frame

2.2 Bomb Avoidance Algorithm

Tasks

Compute “danger zones” from:

Active bombs

Predicted explosion times

NPC prioritizes:

Escape danger

Move toward target

Place bombs only when safe

2.3 Safety Check

NPC should NEVER:

Trap itself

Walk into active flames

Stand still in an explosion path (unless Hard difficulty purposely takes risks)

Testing Criteria

NPC successfully avoids bombs >95% of the time in easy mode

NPC never loops in circles

NPC never freezes due to unavailable paths

Danger zones update instantly when a bomb is placed

Time Estimate: 2 days

Learning Resources

BFS pathfinding (simple and fast): https://www.redblobgames.com/pathfinding/a-star/introduction.html

Working with 2D grid movement patterns

🧩 PART 3 — NPC Behavior System (Easy, Medium, Hard)
3.1 Difficulty Profiles

Create 3 modes:

Easy

Moves slower (random delays)

Avoids bombs but sometimes makes mistakes

Low aggression; rarely places bombs

Random wandering allowed

Medium

Smarter targeting

Good avoidance behavior

Reasonably aggressive but sometimes cautious

Hard

Predictive bomb avoidance

Advanced target selection

Efficient pathfinding

Rarely makes mistakes

Uses optimal bomb placement strategies

Prioritizes powerups aggressively

3.2 Behavior Conditions

NPC makes decisions every 100–200ms:

Should I move?

Where to move?

Should I chase?

Should I run away?

Should I place a bomb?

Is it safe to place a bomb?

3.3 Avoid Infinite Loops

Add randomization tolerance

Allow “fallback routines” when stuck

Implement target switching

Testing Criteria

NPCs feel distinctly different in each difficulty

No infinite loops in:

Bomb avoidance

Target chasing

Block destruction routines

NPCs never spam bombs uncontrollably

Hard AI can beat Easy AI consistently

Time Estimate: 2.5 days

Learning Resources

AI difficulty scaling: https://www.gamedeveloper.com/programming/designing-ai-difficulty

🧩 PART 4 — Bomb Placement Logic
4.1 NPC Offensive Logic

NPC should place bombs when:

A player is within kill-zone

A destructible block is strategically beneficial

Escape route exists

4.2 Bomb Timing

NPC evaluates:

Explosion time

Walk-back distance

Path safety

Player movement predictions

4.3 No Suicide Logic

Hard rule:

If cannot escape danger radius → do NOT place bomb.


Testing Criteria

NPC places bombs that destroy blocks

NPC occasionally kills players

NPC rarely suicides in Medium/Hard

Chain reactions do not crash behavior loops

Time Estimate: 1.5 days
Learning Resources

Finite State Machines for AI:
https://gameprogrammingpatterns.com/state.html

🧩 PART 5 — Power-Up Logic
5.1 Recognizing Powerups

NPC should:

See powerups on map

Pathfind toward beneficial ones

Prioritize differently per difficulty:

Easy: occasionally collects

Medium: tries to collect

Hard: aggressively collects

5.2 Powerup Strategy

Different powerups require different strategies:

Bomb Range Up → encourages offensive play

Speed Up → increases NPC movement frequency

5.3 Avoiding Dangerous Pickups

If powerups cause risk, NPC should not walk into danger.

Testing Criteria

NPC correctly moves toward powerups

Hard difficulty collects first before players

NPC doesn’t suicide to get powerups

Time Estimate: 1 day
Learning Resources

Items & pickup logic in AI:
https://aiandgames.com/

🧩 PART 6 — NPC Interaction With Game Events

NPC must react to:

Player movements

Bomb placement

Block destruction

Explosion expansions

Timer events

Lives update

Win/loss detection

This includes maintaining an internal representation of the world state.

Tasks

Create event listeners for server updates

Maintain NPC decision queue

Ensure NPC behaves exactly like a real human player

NPC never uses menus or pause/resume

Testing Criteria

NPC never attempts to pause the game

NPC re-evaluates its decisions instantly when something changes

NPC does not desync during explosions

Time Estimate: 1 day

🧩 PART 7 — NPC Multiplayer Simulation (NPC vs NPC vs Human)
Tasks

Simulate matches with 2–3 NPCs

Ensure NPCs:

Compete

Fight each other

Do not cooperate

Do not collide or get stuck

Verify Hard > Medium > Easy consistently

Testing Criteria

No two NPCs repeatedly collide and stall

Winning logic works with multiple NPCs

Game ends properly when NPC wins

Time Estimate: 0.5 day

🧩 PART 8 — NPC/Server Communication (Developer 2 Integration)
Tasks

Use unified command interface:

server.sendAction(npcId, action)


Receive:

Map grid updates

Bomb placement notifications

Player positions

Powerup spawns

Timer ticks

Testing Criteria

NPC reacts within 200ms of events

NPC submits valid commands

Server never rejects NPC action as malformed

Time Estimate: 0.5 day

🧩 PART 9 — Debug Tools for Developer 3
Tasks

Add logging toggle (verbose NPC debug mode)

Visual overlays for:

Danger zones

Pathfinding routes

NPC target selection

Optional: NPC brain inspector for testing

Testing Criteria

Debug mode does not slow game below 60 FPS

All overlays can be turned on/off

Time Estimate: 0.5 day

⏱ TOTAL ESTIMATED TIME

Developer 3 workload estimate:
~10–11 days

Matches Developer 2’s complexity and ensures parallel workflow.