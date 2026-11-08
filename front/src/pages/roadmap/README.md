# Updating the roadmap

Edit `roadmap-data.ts` to publish changes with the application:

- Each item has a stable `id`, category, title, description, status and task list.
- Use `planned`, `in-progress` or `done` for status.
- Mark individual tasks `done: true` after delivery. The UI counts these tasks.
- Set the item to `done` when its scope is delivered; keep its tasks consistent.
- Reorder items in the array to change the order within a topic and the home preview.
  The preview shows up to three unfinished items, prioritizing work in progress.
- Contact details and the repository URL live in `projectLinks` in the same file.

The page and home preview are read-only. No clicks modify the list, contact the
maintainer or create an issue automatically. GitHub links open its issue form;
email links open the user's mail client. No database or roadmap API is involved.

The starting list records the author's proposed work. It sets no delivery dates.
Private models/libraries are explicitly included as an existing completed feature;
the other items are planned. Overall counts describe this list, not the completion
percentage of the whole application.

The roadmap groups topics into a responsive overview: three columns on desktop,
two on tablet and one on mobile. Selecting an item opens the existing ShadCN Sheet
with its full description, task list and links. The item ID remains in the URL
hash, so links from the home preview open the corresponding detail directly.
Closing the panel clears the hash and restores keyboard focus to the selected
item (or the page heading for a direct link). Filters remain selected.
