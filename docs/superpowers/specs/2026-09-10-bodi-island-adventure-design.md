# Bodi Island Adventure Game Design

Date: 2026-09-10
Status: Direction approved in chat; pending written-spec review

## Goal

Create **Bodi Island**, a stylized 3D guided-open adventure game for C00lG@mes+ centered on exploration, mystery, light-to-moderate combat, character relationships, and a long-form story that connects to the older Stick Guy / Dark Matter King game universe.

Bodi Island should feel colorful, welcoming, playful, and easy to understand on the surface while becoming increasingly strange and mysterious as the player explores farther from the village and deeper into the island.

The player experience should prioritize:

- curiosity and discovery;
- clear story progression without forcing a strictly linear path;
- responsive third-person movement and combat;
- memorable characters and companions;
- strong visual identity without excessive render cost;
- dense exploration instead of a very large empty map;
- performance that remains playable on older or less powerful machines.

This document is the approved gameplay/story north star. It intentionally does not lock exact combat numbers, boss move sets, final map measurements, or a specific 3D engine. Those are implementation decisions to validate against the experience and performance requirements in this spec.

## High-level pitch

Bodi is a brave five-year-old boy who lives in a peaceful coastal village on Bodi Island. The island's common pets are unusual creatures called **TV-Cats**: cats with television heads.

One day, every TV-Cat on the island begins receiving the same strange signal at the same time. The villagers believe their TV-Cats are sick and panic. Bodi's own TV-Cat, **Captain**, sometimes seems able to sense where the signal is coming from.

While the adults gather at Town Hall, Bodi decides to investigate. Nobody thinks he is ready. Bob tries to stop him, and Blaze the blacksmith realizes Bodi will leave no matter what, so Blaze gives him a simple metal sword for protection.

Bodi and Captain enter the forest, where they discover shadow creatures and Dark Matters. The mystery eventually leads to an ancient temple network, a giant dormant robot hidden inside part of the island's biggest mountain, and the return of the **Dark Matter King**.

The story takes place **1,000 years after the Stick Guy defeated the Dark Matter King**. Almost all knowledge of the Stick Guy has disappeared. Bob knows only fragments of an old story. During some TV-Cat signals, the screens show a crude image or drawing of the Stick Guy defeating the Dark Matter King, providing the first clue that the present danger is connected to a forgotten event from 1,000 years earlier.

## Player character: Bodi

Bodi is the player character.

### Identity

- Name: **Bodi**
- Age: **5**
- Gender: boy
- Hair: blonde
- Skin: tan, consistent with the other villagers
- Shirt: blue T-shirt
- Pants: dark tan
- Shoes: brown

Bodi begins as an ordinary village kid, not a trained warrior, legendary hero, or chosen one.

His defining motivation is simple: **he wants to help even though nobody thinks he is ready**.

That motivation should remain central to his character arc. Bodi becomes capable because he keeps learning, helping others, exploring, and facing danger, not because the game reveals that he was secretly powerful from the beginning.

### Starting equipment

Blaze gives Bodi his first weapon immediately before Bodi leaves the village:

- a simple metal sword;
- sized appropriately for Bodi;
- visually ordinary, without magical glow or ancient decoration.

Blaze is not encouraging Bodi to seek danger. He gives Bodi the sword because he realizes Bodi is determined to leave and wants him to have some protection.

The same sword may be upgraded later rather than being treated as disposable starter equipment.

## Captain: Bodi's TV-Cat

Captain is Bodi's pet and first companion.

### Appearance

- cat body;
- television head;
- dark green screen;
- neon-green symbols, icons, and expressions displayed on the screen.

### Personality

Captain is funny, playful, curious, loyal, and brave.

Captain provides comic relief during exploration. He can react with silly screen faces, become distracted, celebrate victories, or make playful movements.

When a real mysterious signal arrives, Captain's behavior changes noticeably. The playfulness stops, the screen becomes focused, and the signal feels important.

### Gameplay role

Captain follows Bodi into the forest and throughout the adventure.

Captain is primarily an exploration and communication companion rather than a combat unit. Useful behaviors may include:

- reacting more strongly as Bodi approaches a signal source;
- displaying warning symbols;
- detecting strange or hidden symbols;
- drawing Bodi's attention to environmental clues;
- participating in puzzles where a TV-Cat signal or screen matters.

Captain should help guide the player without replacing exploration with a permanent quest arrow.

## TV-Cats and the signal

TV-Cats are the normal pets of Bodi Island. There are no ordinary household cats or other common pets in the village concept.

When the mysterious signal occurs:

- **all TV-Cats on Bodi Island receive it at the same time**;
- villagers become frightened;
- villagers initially believe the TV-Cats are sick;
- screens may flicker, show symbols, display static, or present brief images;
- Bodi and Captain can sometimes determine the direction or source of the signal, but not every time.

Some signals show a drawing or image of the forgotten **Stick Guy defeating the Dark Matter King** 1,000 years earlier.

The signal is a storytelling and exploration mechanic. It should create questions before it creates answers.

## Bodi Island

Bodi Island is a **medium-sized, dense 3D world**.

It should feel large enough to support adventure and discovery without relying on long stretches of empty traversal.

### World structure

The village sits near the beach. Exploration pushes inland toward progressively stranger and more dangerous areas.

The approved broad progression is:

1. coastal village and beach;
2. forest;
3. cliffs / mountain approaches;
4. caves and ancient ruins;
5. the island's large mountain;
6. hidden temple and machine spaces beneath or within the island.

Additional optional paths and secrets may connect these regions, but the village remains the emotional home base.

### Traversal

Bodi's traversal capabilities should eventually include:

- running and jumping;
- swimming;
- climbing;
- gliding;
- special gadget-assisted traversal where appropriate.

Some abilities unlock over time so the player can see unreachable places early and return later with new capabilities.

The world should reward revisiting earlier locations after upgrades.

### Guided-open structure

Bodi Island is not a fully linear corridor and not an unrestricted sandbox.

Use a **guided-open** structure:

- maintain a clear main story goal;
- open multiple quests, secrets, caves, puzzles, and optional paths within regions;
- allow the player to explore without frequently losing the main narrative thread;
- use traversal upgrades and story events to open new areas naturally.

## Visual and camera direction

### Visual style

Use a stylized adventure aesthetic:

- colorful and friendly village and daytime island spaces;
- expressive characters;
- readable silhouettes;
- warmer, brighter environments near home;
- darker, stranger forests, caves, ruins, machine spaces, and temple areas as the mystery deepens.

The game should not pursue photorealism.

Visual polish matters, but effects should be deliberate and scalable. The experience should remain smooth on modest hardware.

### Camera

Use a **third-person camera behind Bodi** for normal exploration and combat.

Allow occasional close-up or first-person-like presentation for:

- examining clues;
- TV-Cat broadcasts;
- important temple discoveries;
- cinematic story moments.

These moments should support storytelling rather than change the game's normal control model.

## Village

The village is Bodi's safe hub and contains **12 buildings**.

Approved buildings:

1. Bodi's house
2. Bob's house
3. Blake's house
4. Blaze's blacksmith/home
5. Bill's house
6. Bane's house
7. Bart's house
8. Ben's house
9. Brandon's house
10. Andrew's house
11. Bobo's family house
12. Town Hall

### Bodi's house

Bodi's house is enterable and includes:

- couch;
- TV;
- blue bed;
- Captain, Bodi's TV-Cat.

The house should establish Bodi's ordinary life before the adventure begins.

### Town Hall

Town Hall is the village's emergency gathering point.

When all TV-Cats begin glitching, the adults gather at Town Hall because they believe the animals are sick. This gathering creates the opening for Bodi to leave the village and investigate.

Town Hall can remain useful later for village reactions and story updates.

## Villagers

The village has ten named villagers:

- **Blake**
- **Bobo** — the baby
- **Bob** — the oldest villager
- **Andrew** — generally disliked by the others
- **Blaze** — the blacksmith
- **Bill**
- **Bane**
- **Bart**
- **Ben**
- **Brandon**

### Bob

Bob is the oldest villager and knows a small amount about the forgotten Stick Guy story.

He does not know the full truth and should not function as an exposition machine. His knowledge is fragmentary enough that he is uncertain what is real.

Bob is the first adult who seriously tries to stop Bodi from leaving because he suspects the TV-Cat signals may connect to something old and dangerous.

### Blaze

Blaze is the village blacksmith and an important progression character.

Early role:

- gives Bodi the simple metal sword because he knows Bodi will leave anyway.

Later role:

- examines strange materials Bodi brings back;
- creates useful adventure gear;
- crafts the Shadow Boots from Dark Fuzz.

### Andrew

Andrew exaggerates, annoys people, and often makes things up. Because of that, nobody takes him seriously.

However, Andrew genuinely knows a few pieces of the truth about the ancient temple and the island's mystery.

The intended effect is that the player initially cannot tell which Andrew statements are nonsense and which contain real clues. Later discoveries can cause earlier Andrew dialogue to take on new meaning.

## Opening sequence

The opening should establish ordinary village life, Captain's personality, the TV-Cat mystery, and Bodi's motivation quickly.

Approved flow:

1. Bodi begins at home with Captain.
2. Every TV-Cat on Bodi Island receives a strange signal at the same time.
3. The villagers believe the TV-Cats are sick and panic.
4. The adults gather at Town Hall.
5. Bodi decides to investigate because he wants to help.
6. Bob realizes what Bodi intends to do and tries to stop him.
7. Blaze realizes Bodi will go anyway and gives him a simple metal sword.
8. Bodi leaves the village with Captain.
9. They enter the forest.
10. Captain begins reacting to the signal more strongly as they move closer to its source.
11. Bodi encounters a Shadow Bug early, establishing the basic combat tutorial.

The opening should make it clear that nobody believes Bodi is ready, but Bodi is determined to try.

## Forest: first adventure region

The forest is the first substantial adventure area.

It should begin relatively bright and recognizable near the village and become darker and more corrupted deeper inside.

### First combat encounter

Bodi encounters a **Shadow Bug** early in the forest.

The encounter introduces the basic combat vocabulary without being punishing.

Bodi's combat animation should reflect that he is a five-year-old using a sword for the first time. He can become more confident through progression, but should not move like a trained adult warrior at the beginning.

Captain can provide a playful reaction after the first victory.

### Signal guidance

Captain helps Bodi follow the signal through proximity-based reactions. The closer they get, the more strongly Captain reacts.

Avoid relying entirely on giant directional arrows or constant waypoint markers. Environmental readability and Captain's behavior should support navigation.

## Early enemies

### Shadow Bugs

Shadow Bugs are small, fast, creepy early enemies.

They may use quick movement, dark patches, or lunging behavior to teach the player timing and dodging.

Shadow Bugs drop **nothing**.

### Dark Matters

Dark Matters are common enemies directly associated with the Dark Matter King.

Appearance:

- fuzzy black ball body;
- three legs;
- two googly eyes.

Tone:

- strange and dangerous, but intentionally funny;
- make funny noises while moving and attacking;
- wobble or move in an exaggerated way.

When defeated, a Dark Matter **explodes into a puff of black fuzz**.

It drops one piece of **Dark Fuzz** until the Shadow Boots progression requirement is complete.

Because Dark Matters are common enemies, Dark Fuzz is intentionally not a general crafting currency.

## Shadow Boots

Bodi must collect **10 pieces of Dark Fuzz** and return to Blaze.

Blaze uses the material to craft the **Shadow Boots**.

The boots provide two approved abilities:

- faster movement;
- the ability to safely walk across dangerous shadowy ground.

Dark Fuzz is used only for the Shadow Boots. It should not become an endless upgrade currency or farming system.

### First traversal gate

Deep in the forest, Bodi and Captain discover a wide area of shadowy ground that Bodi cannot safely cross.

Captain warns Bodi through his screen.

This establishes an early return-later loop:

**explore forest -> defeat Dark Matters -> collect 10 Dark Fuzz -> return to Blaze -> craft Shadow Boots -> return to forest -> cross shadowy ground -> continue deeper**.

This pattern can establish the broader game language of revisiting earlier spaces with new abilities.

## Combat direction

Combat is present but should not dominate the adventure.

The approved balance is:

- exploration and mystery first;
- some regular enemy combat;
- meaningful boss fights;
- simple, responsive controls rather than a highly technical combat system.

Bodi's eventual combat/tool kit can combine:

- sword combat;
- magic learned during the adventure;
- unusual gadgets created by Blaze from discovered materials.

Gadgets should ideally serve both exploration/puzzles and combat where that makes sense, avoiding tools that exist only as menu clutter.

## Enemy families

Bodi Island can use a mix of enemy types so regions have distinct identities:

- magical or corrupted island creatures;
- ancient robots;
- shadow creatures;
- Dark Matters associated with the Dark Matter King.

Introduce enemy families progressively rather than mixing everything immediately.

The forest should establish shadow corruption first. Ancient robots become more prominent as Bodi reaches ruins, caves, and mountain machinery.

## First boss and Luma

The first major boss is a **Shadow Monster**.

The fight should be a meaningful escalation from Shadow Bugs and Dark Matters and establish that the island's problem is much more serious than sick TV-Cats.

After Bodi defeats the Shadow Monster, he discovers an injured dragon named **Luma**.

## Luma

Luma is Bodi's dragon friend and later an important ally.

### Appearance

- white and gold;
- dragon body;
- no wings.

### Flight

Luma flies using **magic**, not wings.

Magical flight is part of her visual identity. Effects should become stronger and steadier as she heals.

### Personality

Luma is cautious and shy with Bodi at first. Once she trusts him, she becomes:

- playful;
- brave;
- loyal.

### Relationship with Bodi

Luma is injured when Bodi finds her after the first boss. Bodi helps her, and she thanks him. That act is why she wants to help Bodi later.

Her friendship with Bodi should grow over time rather than becoming instant unquestioned loyalty.

### Recovery arc

Luma does not fully recover immediately.

Her healing is a visible story progression. She can gradually regain mobility and magical flight capability as the adventure continues.

Near the end of the game, while Bodi continues toward the final boss, **Luma remains in a cave healing**.

The player must proceed without her for that late-game section.

By the final battle, Luma is fully healed and ready to help Bodi.

Her arrival should feel like the payoff to the friendship and recovery arc, not a random last-minute power-up.

## Ancient history: Stick Guy and the Dark Matter King

Bodi Island takes place **1,000 years after** the Stick Guy defeated the Dark Matter King.

In the present day:

- almost nobody knows the Stick Guy existed;
- the Stick Guy is not a famous legend in normal village culture;
- Bob knows only a little about him through fragments of an old story;
- Bodi initially has no meaningful knowledge of him.

The TV-Cat broadcasts occasionally show an image or drawing of the Stick Guy defeating the Dark Matter King.

These images should be confusing at first. They are evidence that the signal is connected to a forgotten event, not immediate exposition explaining the whole history.

## Dark Matter King and the mountain robot

The **Dark Matter King himself** remains the central threat 1,000 years later.

For most of the game, Bodi does not see him directly.

### Giant robot

A large ancient robot has been hidden inside part of Bodi Island's biggest mountain.

The robot is not island-sized. It is dramatically larger than ordinary enemies and Bodi, but still a physical boss-scale machine that can emerge from the mountain and fight.

Across the adventure, pieces of ancient machinery activate. The player should initially believe these are separate machines or temple mechanisms.

Later, Bodi discovers that many of them connect to the larger robot hidden in the mountain.

### Corruption transformation

The robot begins as an ancient machine.

When the Dark Matter King takes full control, the robot transforms into a **dark corrupted version** of itself. Its original design should remain recognizable underneath the corruption.

Potential visual language includes dark armor, glowing cracks, shadow energy, altered eyes, and corrupted machine effects, provided these remain performant.

### Reveal

The Dark Matter King is not clearly seen by Bodi until near the end.

The robot and its corruption serve as his visible presence for much of the game.

After the robot sequence, Bodi eventually encounters the Dark Matter King himself, who still looks as he did 1,000 years earlier.

## Final boss direction

The Dark Matter King ultimately transforms himself into a **giant dragon**.

This is his final major form.

Luma is much smaller than this giant dragon, though Luma herself is not tiny. She is simply small relative to the Dark Matter King's enormous dragon form.

By this point, Luma has finished healing in the cave and returns to help Bodi.

The final encounter should capitalize on Luma's magical flight and Bodi's accumulated abilities. It can include aerial movement and moments where Luma enables Bodi to reach or engage the giant dragon, while preserving Bodi as the primary playable hero.

The precise final-boss phases and controls are intentionally deferred to implementation design so they can be prototyped for fun, readability, and performance.

## Story progression summary

The approved macro arc is:

1. Peaceful life in the coastal village.
2. All TV-Cats receive the strange signal.
3. Adults panic and gather at Town Hall.
4. Bodi decides to investigate despite everyone believing he is too young and not ready.
5. Bob tries to stop him.
6. Blaze gives Bodi his first metal sword.
7. Bodi and Captain enter the forest.
8. Early Shadow Bug and Dark Matter encounters teach combat and collection.
9. Bodi collects 10 Dark Fuzz.
10. Bodi returns to Blaze and receives Shadow Boots.
11. Bodi returns to the forest and crosses previously impassable shadowy ground.
12. Bodi eventually fights the first Shadow Monster boss.
13. Bodi discovers and helps injured Luma.
14. Exploration expands through more of Bodi Island, including ruins, caves, cliffs, mountains, and ancient machine spaces.
15. TV-Cat signals reveal fragments of the Stick Guy / Dark Matter King history.
16. Ancient machinery increasingly activates.
17. Bodi learns that a large robot is hidden within part of the big mountain.
18. The Dark Matter King takes control and transforms the robot into its dark corrupted form.
19. Bodi continues toward the Dark Matter King while Luma remains in a cave healing.
20. Bodi finally sees the Dark Matter King himself.
21. The Dark Matter King transforms into a giant dragon.
22. Fully healed Luma returns to help Bodi in the final battle.

The exact number of chapters, dungeons, intermediate bosses, and optional quests is not defined by this initial game-design spec.

## Progression principles

Progression should come from useful capabilities, relationships, and discovery rather than excessive currencies or stat systems.

Preferred progression types:

- traversal abilities;
- sword improvement;
- magic;
- Blaze-built gadgets;
- access to new island regions;
- Captain signal/puzzle interactions;
- Luma's recovery and relationship arc.

Avoid unnecessary crafting currencies or item bloat unless later gameplay proves they add meaningful choices.

The Dark Fuzz / Shadow Boots loop is the first concrete example of this philosophy: one recognizable enemy material, one clear requirement, one meaningful ability unlock.

## Player guidance

The game should guide without constantly taking control away from the player.

Use a combination of:

- Captain's reactions;
- environmental landmarks;
- NPC dialogue;
- visible unreachable spaces;
- signal strength;
- readable paths and region composition;
- occasional explicit quest text where clarity requires it.

Avoid making the default experience depend on a permanent glowing line or oversized waypoint arrow.

## Tone

Bodi Island combines:

- humor;
- wonder;
- mystery;
- mild creepiness;
- adventure;
- emotional friendship moments;
- high-stakes late-game action.

Captain and enemies such as Dark Matters keep the world playful. Shadow areas, TV-Cat broadcasts, ancient machines, and the Dark Matter King provide tension.

The game should be exciting for a younger audience without relying on graphic violence or horror.

## Technical architecture direction

Bodi Island is a 3D game entering a repository whose current game stack is React, TypeScript, Vite, and Phaser.

Do **not** force the 3D runtime into Phaser solely for consistency with existing 2D games.

The implementation should preserve the C00lG@mes+ game/runtime boundary:

```text
application shell
    -> game page / viewport boundary
        -> Bodi Island runtime adapter
            -> Bodi Island 3D engine + simulation
```

The 3D runtime should remain isolated under a game-specific area such as:

```text
src/games/bodi-island/
```

Bodi Island must not make the global application shell depend on its chosen 3D engine.

If the mobile-first arcade-shell design in PR #5 lands, Bodi Island should integrate through the proposed typed game catalog, lazy route loading, `GamePageShell`, and `GameViewport` boundaries instead of inventing a parallel launch architecture.

### 3D engine selection

This product design intentionally does not select the engine.

The first technical implementation plan should begin with a focused rendering/gameplay spike that compares viable browser-3D options against these requirements:

- TypeScript integration quality;
- third-person character/camera support;
- animation pipeline;
- collision/physics needs;
- asset loading and compression;
- mobile browser support;
- bundle impact and lazy loading;
- adaptive quality controls;
- memory use;
- stable performance on modest hardware;
- maintainability inside the existing React/Vite application.

The spike should select the simplest engine capable of delivering the approved experience. Existing Phaser usage is not, by itself, a reason to choose or reject an engine.

## Performance contract

Performance is a first-class design requirement.

Bodi Island should look polished while remaining playable on older or less powerful machines.

### Rendering principles

Prefer:

- stylized geometry over expensive photorealistic assets;
- strong art direction over brute-force effects;
- baked or inexpensive lighting where it provides sufficient quality;
- LODs for larger environment assets where useful;
- frustum/distance culling;
- instancing for repeated foliage or props where appropriate;
- texture compression and disciplined texture resolution;
- capped/adaptive device pixel ratio;
- pooled particles and effects where repeated frequently;
- bounded shadow-casting lights;
- region/asset streaming or staged loading if full-island residency becomes expensive;
- scalable quality tiers.

Avoid assuming high-end desktop GPU capability.

### Experience targets

Use these as engineering targets rather than guarantees:

- target stable 60 FPS on capable hardware;
- prefer a stable 30+ FPS degraded mode over unstable high settings;
- maintain low and predictable input latency;
- pause or reduce nonessential simulation/effects when hidden or paused;
- avoid large allocation churn in frame loops;
- load Bodi Island lazily so its 3D engine/assets do not inflate normal C00lG@mes+ discovery cost.

### Adaptive presentation

Expensive effects should degrade gracefully.

Examples:

- reduce foliage density or draw distance;
- lower shadow resolution or disable secondary shadows;
- reduce particle counts;
- reduce post-processing;
- cap DPR;
- simplify reflections or water effects.

Core gameplay readability, controls, enemy telegraphs, and Captain signal cues must survive quality reduction.

## Input and mobile-first requirements

Although Bodi Island is a 3D adventure, it must be designed for the site's mobile-first direction as well as keyboard/mouse play.

The final control scheme should support the semantic actions needed by the game rather than exposing device-specific controls to game logic.

Expected input intents include:

- move;
- camera/look;
- jump;
- attack;
- dodge/block as finalized;
- interact;
- use magic/gadget;
- traversal actions such as climb, swim, or glide.

Touch controls must be evaluated for thumb reach, screen obstruction, camera control, and combat readability rather than added as an afterthought.

## Save and persistence direction

This design does not require accounts or server persistence.

Bodi Island will eventually need local progress persistence appropriate for a longer adventure game, including enough state to resume story and ability progression. Exact save schema and checkpoint rules belong in implementation design.

A save system must fail safely and should not couple the Bodi Island simulation to global application state.

## Testing and validation direction

Automated checks are necessary but not sufficient for this game.

Implementation should eventually cover:

- deterministic progression rules where practical;
- material counts and one-time unlocks such as 10 Dark Fuzz -> Shadow Boots;
- save/load behavior;
- quest-state transitions;
- input mapping;
- Captain signal-state logic;
- traversal gates;
- boss state transitions;
- asset/load failure recovery.

Manual play validation is required for:

- third-person camera comfort;
- movement responsiveness;
- sword feel;
- mobile controls;
- exploration readability;
- boss telegraphs;
- Captain guidance clarity;
- traversal feel;
- frame stability on representative lower-end hardware;
- quality-tier transitions;
- resize/orientation/pause-resume behavior.

A passing build alone is not sufficient evidence that Bodi Island is fun or performant.

## First implementation slice recommendation

Do not attempt to build the complete island in one PR.

After this design is approved, the first implementation plan should target a **small vertical slice** that proves the hard parts before large content production begins.

Recommended slice:

- isolated Bodi Island 3D runtime;
- stylized test environment representing Bodi's house/village edge/forest entrance;
- third-person Bodi movement and camera;
- Captain follow behavior and screen-expression system;
- simple metal sword interaction;
- one Shadow Bug encounter;
- one Dark Matter encounter with funny movement/noise and black-fuzz defeat effect;
- representative mobile and desktop controls;
- performance instrumentation and at least two quality levels;
- integration through the existing game page/runtime boundary.

The slice should use placeholder-quality content only where needed to validate mechanics, but Bodi, Captain, and the environment should be visually coherent enough to judge game feel and art direction.

Do not implement the entire story, Luma, giant robot, mountain, or final boss before the core 3D movement, camera, combat, companion behavior, loading, and performance envelope are proven.

## Non-goals of the first implementation slice

The first slice does not need:

- full island map;
- every villager interior;
- complete quest system;
- Luma's full recovery arc;
- final boss;
- giant mountain robot;
- all magic/gadgets;
- all traversal powers;
- multiplayer;
- online accounts;
- procedural world generation;
- photorealistic art;
- broad crafting/economy systems.

## Success criteria for the game direction

Bodi Island is on the right path when:

1. Bodi feels responsive and enjoyable to control in third person.
2. The island feels dense, colorful, and worth exploring rather than large and empty.
3. Captain is funny and lovable during ordinary play but makes signal events feel meaningfully different.
4. A player can understand the early story without a large exposition dump.
5. Combat supports the adventure instead of overwhelming it.
6. The Shadow Boots demonstrate meaningful ability-gated exploration.
7. Luma's recovery creates a relationship payoff by the final battle.
8. The Stick Guy / Dark Matter King connection feels mysterious before it becomes explanatory.
9. The mountain robot reveal feels foreshadowed rather than random.
10. The Dark Matter King's giant-dragon form feels like a genuine final escalation.
11. The game remains smooth enough to play on modest hardware through adaptive visual quality.
12. Bodi Island remains isolated enough that its 3D technology does not complicate unrelated C00lG@mes+ games or the application shell.

## Approved decision summary

Bodi Island is a **stylized 3D guided-open adventure** about a five-year-old boy named Bodi who leaves his coastal village with his TV-Cat Captain to investigate a signal affecting every TV-Cat on the island.

The game combines exploration, puzzles, traversal upgrades, moderate combat, humor, mystery, and boss encounters.

The core approved elements are:

- Bodi: blonde, tan-skinned five-year-old boy in a blue T-shirt, dark tan pants, and brown shoes;
- Captain: funny/playful TV-Cat with a dark-green screen and neon-green symbols;
- ten named villagers and twelve village buildings including Town Hall;
- Bob's fragmentary knowledge of the forgotten Stick Guy;
- Blaze as blacksmith, first-sword giver, and Shadow Boots crafter;
- forest as the first adventure region;
- Shadow Bugs and common three-legged googly-eyed Dark Matters;
- Dark Matters explode into black fuzz and provide the 10 Dark Fuzz needed for Shadow Boots;
- Shadow Boots increase speed and allow Bodi to cross shadowy ground;
- first major boss: Shadow Monster;
- Luma: white-and-gold, wingless, magic-flying dragon friend found injured after the first boss;
- Luma recovers over the story and heals in a cave near the finale;
- events occur 1,000 years after Stick Guy defeated the Dark Matter King;
- all normal knowledge of Stick Guy has disappeared except for fragments known by Bob;
- TV-Cat broadcasts sometimes show Stick Guy defeating the Dark Matter King;
- ancient machinery eventually reveals a large robot hidden inside part of the big mountain;
- the Dark Matter King corrupts and controls that robot;
- Bodi does not clearly see the Dark Matter King until near the end;
- the Dark Matter King retains his old appearance, then transforms into a giant dragon;
- fully healed Luma returns to help Bodi in the final battle;
- third-person camera with occasional close-up investigation/story moments;
- swimming, climbing, gliding, and ability-gated revisiting;
- medium-sized dense world with guided-open progression;
- 3D runtime remains isolated from the application shell and is designed around explicit mobile/performance constraints.
