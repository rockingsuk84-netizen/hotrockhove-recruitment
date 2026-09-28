/**
 * Renders admin-edited plain text: blank lines separate blocks, and a short
 * first line followed by more text becomes a heading.
 */
export function TextBlocks({ text }: { text: string }) {
  return (
    <div className="space-y-6 text-[1.05rem] leading-relaxed text-ink/80">
      {text.split(/\n{2,}/).map((block, i) => {
        const [first, ...rest] = block.split("\n");
        if (rest.length && first.length < 80) {
          return (
            <section key={i}>
              <h2 className="font-display text-2xl text-ink">{first}</h2>
              <p className="mt-2 whitespace-pre-line">{rest.join("\n")}</p>
            </section>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
