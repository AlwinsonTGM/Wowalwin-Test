# Audio files

Drop the presenters' audio files here. Nothing ships with the repository, so a
show with no files in this folder is silent and nothing else: a missing or
unreadable file degrades to silence, is named on the Backbone, and never stops a
question, a reveal, or the show.

| File | Plays when | What it is |
| --- | --- | --- |
| `tick.mp3` | Every second while the answer window is open | The clock the room hears. Short, dry, no melody. |
| `sting.mp3` | The moment the answer window closes | The suspense beat. It has to cut through a classroom. |
| `reveal.mp3` | The moment the Presenter reveals | The payoff. Must be clearly distinct from the sting. |
| `bokya.mp3` | The moment Bokya is revealed in the Kahon | The losing sound. Distinct from the win reveal. |

Names and paths are declared in `src/content/show.ts` under `showConfig.audio`,
so a file with another name only needs that one line changed.