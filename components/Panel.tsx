const SECTIONS = [
  "Search",
  "Alignment",
  "Chainage settings",
  "Project & export",
] as const;

export default function Panel() {
  return (
    <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-zinc-200 p-4 md:max-h-none md:w-80 md:border-b-0 md:border-r dark:border-zinc-800">
      <h1 className="text-lg font-semibold tracking-tight">Map Chainage Tool</h1>
      {SECTIONS.map((title) => (
        <section key={title} className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Coming soon.</p>
        </section>
      ))}
    </aside>
  );
}
