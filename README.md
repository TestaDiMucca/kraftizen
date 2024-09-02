# Kraftizen

A bunch of dumb-as-rocks Minecraft bots to boss around and get into trouble.

<picture>
	<img alt="Some Kraftizens running about." src="https://github.com/TestaDiMucca/kraftizen/blob/main/assets/banner.png?raw=true">
</picture>

Inspired by all the posts of "I have my two-week Minecraft phase right now but nobody wants to join me or I have no friends." Sadly this doesn't really solve that problem, but will at least make the illusion that the minecraft world is a little less lonely. If you try hard enough.

## Supported versions

Built on `mineflayer` and supports versions supported by the used version of that library. It may be possible to proxy it into another version with [ViaProxy](https://github.com/ViaVersion/ViaProxy), but haven't tested this yet.

## Project Goals

See the [issues board](https://github.com/TestaDiMucca/kraftizen/issues), but from a high level, goals include having some basic utility functions for each Kraftizen so they can guard areas, farm, or do a repetitive task like digging a long tunnel.

It is also a goal to make a wrapper around the server, so that non-technical users (or lazy technical users like me) can fire up the bot server any time.

## Install and run

```bash
# In this directory
npm i
npm start

# Or, for dev with watcher
npm run dev
```
To create custom chat messages add a `chats.json` in `src/character`. See the example for format. The example adds some lines for "default" as well as custom lines for any character named "Kazuma".

### Project structure and logic

This stuff is a bit of a mess currently, because the project is still in hacky stages. Sorry about that.

- `src/actions` : Logic for executing actions or deciding what actions to execute.
- `src/utils` : Utilities, helpers, and objects used to assist in creating behaviors.
- `src/personas` : Mostly tests scripts that are applied to a bot. Most of these are default examples provided by mineflayer and not actually run in the project.
- `src/character` : To give kraftizens some character. Mostly chat-related.

### Kraftizens behavior

- In general, bots have an **event loop**. Actions will be queued and processed in this loop, besides some commands and "persona" functions which we want to execute immediately or inline for finer control.
- "**Personas**" are akin to jobs and roles for the kraftizens, and their choice of actions will use their persona as a base. For example if they were under the "follow" persona they'll try and follow the player, or if they are under the "farm" persona, they'll attempt to look for crops to harvest and plant.
- They take **commands** through in-game chat, with the format `[command], [name]`. For example if the kraftizen's name is Carlos, you would tell Carlos to go sleep with `sleep, Carlos`.
- Most kraftizens will base their operations around a "**home**" point, which can be set with `home, [name]`. They will try and do their tasks around this home point.
- Kraftizens love **chests** around their home point. Commands like `deposit` or `withdraw` will have them visiting nearby chests to get what they need and deposit what they don't.

### Recommended setup in world

Since `mineflayer-pathfinder` is not very good with doors at the time of this project's development, it is recommended to have kraftizens set up in areas with few doors, or with areas where access to important key areas are not behind doors.

This of course puts them in danger of threats, so it would be good to have chests which provide weapons and armor, then instruct them to grab the items with `stock up, [name]`. Also provide food so they can heal up.

## Other notes

- [Mineflayer API Reference](https://prismarinejs.github.io/mineflayer/#/api)
- [Bot examples](https://github.com/PrismarineJS/mineflayer/tree/master/examples)
