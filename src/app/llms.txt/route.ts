import { LEGAL } from "@/lib/legal";
import { SITE_URL } from "@/lib/public";

/** A plain-text summary of readread for AI tools (https://llmstxt.org). */
export function GET() {
  const body = `# readread

> readread is a social book tracker and Goodreads alternative for English-speaking readers. Instead of star ratings, you rank each book you finish with a few quick head-to-heads against books you've already read, and it lands on an honest, ranked shelf with a score out of 10.

readread is a free web app at ${SITE_URL} (install it to your home screen from the browser). It's run independently by one person in the US.

## What you can do

- Rank books with head-to-heads: say whether you loved it, thought it was fine, or it wasn't for you, then answer a few "which was better?" matchups. Scores come from where a book lands on your shelf.
- Import your library from Goodreads or StoryGraph (CSV export), including ratings, reviews, dates read and want-to-read shelves.
- Follow friends (one-way, like Instagram), see what they're reading and ranking, heart and comment, and see your taste match with other readers.
- Read along with friends, check in on progress, keep a reading streak, earn badges, and get a yearly wrap.
- Shelves are visible to signed-in readers by default and can be made private. Public web profiles are opt-in.

## Pages

- [Home](${SITE_URL}/): what readread is and how ranking works
- [Privacy](${SITE_URL}/privacy): what readread collects and who can see it
- [Terms](${SITE_URL}/terms): rules for using readread
- Book pages (${SITE_URL}/book/<id>): a book's details and its readread community score
- Public profiles (${SITE_URL}/u/<username>): only for readers who turned them on

## Contact

${LEGAL.contactEmail}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
