/** A reader's blurb, set like the quote on the back of a book. */
export function Blurb({ text, name, onEdit }: { text: string; name: string; onEdit?: () => void }) {
  void name; // kept for callers; the blurb sits under their name already
  const body = (
    <>
      <span className="blurb__mark" aria-hidden="true">&ldquo;</span>
      <blockquote className="blurb__text">{text}</blockquote>
    </>
  );
  return onEdit ? (
    <button className="blurb blurb--editable" onClick={onEdit} aria-label={`Your blurb: ${text}. Edit`}>
      <figure style={{ margin: 0 }}>{body}</figure>
    </button>
  ) : (
    <figure className="blurb">{body}</figure>
  );
}
