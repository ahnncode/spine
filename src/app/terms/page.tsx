import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms · readread",
  description: "The rules for using readread, the social book tracker that ranks books instead of starring them.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms"
      intro="These are the rules for using readread. By creating an account or using readread.app, you agree to them. They’re written to be read, so please do."
    >
      <h2>The basics</h2>
      <ul>
        <li>readread is run by {LEGAL.operator} (“we”). You can reach us at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</li>
        <li>You must be at least {LEGAL.minimumAge} to use readread. If you’re under the age of majority where you live, a parent or guardian must agree to these terms.</li>
        <li>Keep access to your email account secure. Anyone who can get your sign-in emails can get into your readread account.</li>
        <li>Our <Link href="/privacy">privacy policy</Link> explains how we handle your data.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your rankings, notes, reviews, check-ins and comments are yours. To run readread, you give us a worldwide, non-exclusive,
        royalty-free license to store, display and process them: showing them on your shelf, in friends’ feeds, on book pages,
        and in community scores and recommendations, according to your privacy settings. The license ends when you delete the
        content or your account, except where others have already interacted with it (for example, comments other people left on your posts are removed with it).
      </p>
      <p>You’re responsible for what you post, and you confirm you have the right to post it.</p>

      <h2>Be decent</h2>
      <p>Don’t use readread to:</p>
      <ul>
        <li>Harass, threaten, bully or demean anyone, or post hateful content.</li>
        <li>Post anything illegal, sexual content involving minors, or other people’s private information.</li>
        <li>Spam, scam, advertise, or post misleading content.</li>
        <li>Pretend to be someone else, or create accounts to get around a block or a ban.</li>
        <li>Post large excerpts of copyrighted books or other works. Short quotes in a review are fine.</li>
        <li>Scrape the site, overload it, probe it for weaknesses, or get around its security or rate limits.</li>
      </ul>
      <p>You can block anyone and report content that breaks these rules. We review reports and may remove content or suspend accounts.</p>

      <h2>Copyright complaints</h2>
      <p>
        If you believe something on readread infringes your copyright, email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> with:
        the work you say is infringed; where the material appears on readread (a link); your name, address, phone and email; a statement that you
        believe in good faith the use isn&rsquo;t authorized by the owner, its agent or the law; a statement, under penalty of perjury, that your notice
        is accurate and that you&rsquo;re the owner or authorized to act for them; and your physical or electronic signature. We&rsquo;ll remove or
        disable the material and let the person who posted it know.
      </p>
      <p>
        If your content was removed and you believe that was a mistake, you can send a counter-notice to the same address with the removed
        material and where it was, a statement under penalty of perjury that it was removed by mistake or misidentification, your name, address
        and phone, consent to the jurisdiction of the federal court for your address (or, outside the US, any court where readread may be found),
        and your signature. We may restore it after 10 business days unless the complainant tells us they&rsquo;ve filed a lawsuit. We end the
        accounts of repeat infringers.
      </p>

      <h2>Book information</h2>
      <p>Book details, descriptions and cover images come from Open Library and Apple Books and are provided as-is. They may be incomplete or wrong. Covers and titles belong to their publishers and creators.</p>

      <h2>Ending things</h2>
      <p>
        You can delete your account any time from You → Edit. We may suspend or end accounts that break these terms or put others
        at risk. We may also change or stop parts of readread; if we shut readread down, we’ll give reasonable notice where we can.
      </p>

      <h2>No warranties</h2>
      <p>
        readread is provided “as is” and “as available.” We work to keep it running and your data safe, but we don’t promise it will
        always be available, error-free or secure, or that scores and recommendations will suit you.
      </p>

      <h2>Limits on liability</h2>
      <p>
        To the extent the law allows, we aren’t liable for indirect, incidental, special or consequential damages, or for lost
        data or content, arising from your use of readread. Our total liability for any claim about readread is limited to the greater
        of what you paid us in the past 12 months or $50. Some places don’t allow these limits, so they may not apply to you.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of the State of {LEGAL.governingState}, USA, except where the law where you live says otherwise.</p>

      <h2>Changes</h2>
      <p>If we change these terms, we’ll update the date above. For significant changes, we’ll also let you know in the app or by email before they take effect. If you keep using readread after that, the new terms apply.</p>
    </LegalPage>
  );
}
