---
tags: [iprop-asset]
max_turns: 150
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

I'm making a top-down dungeon crawler and need a procedural wall tile as an Infinite Props asset, 64x64 px: irregular stones of different sizes with mortar between them, a few cracked, and moss in some seeds. Medium variety is enough. When a bomb hits the wall the game switches it to a broken version, and I want to spawn the rubble pieces of that broken version as physics debris, so the game needs those pieces. Put it in a `wall/` folder in the current directory and compile it to `wall/wall.iprop`.
