import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy — Spine" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      intro="Spine is a place to rank the books you read and see what your friends think. This explains what we collect, who can see it, and how to get it deleted. Short version: we keep what the app needs to work, we don’t run ads, and we don’t sell your data."
    >
      <h2>Who we are</h2>
      <p>
        Spine (readspine.app) is run by {LEGAL.operator}. If you have a question about your data, email{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>What we collect</h2>
      <h3>Things you give us</h3>
      <ul>
        <li><strong>Your email address</strong>, to sign you in. We never show it to other readers.</li>
        <li><strong>Your profile:</strong> username, display name, yearly reading goal, and whether your shelf is private.</li>
        <li><strong>Your shelf:</strong> the books you add, how you rank and score them, quick tags, notes and reviews (and whether they contain spoilers), the dates you started and finished, and reading check-ins with your progress, vibe and notes.</li>
        <li><strong>What you import:</strong> if you upload a Goodreads or StoryGraph export, we read it in your browser and save the books, star ratings, shelves, dates read and reviews from it. We don’t keep the file itself.</li>
        <li><strong>Social activity:</strong> who you follow, hearts, comments, people you block, and reports you file.</li>
      </ul>
      <h3>Things we collect automatically</h3>
      <ul>
        <li><strong>Sign-in session:</strong> your browser stores a sign-in token so you stay signed in.</li>
        <li><strong>Small preferences on your device</strong>, like whether you dismissed the “add to home screen” tip. These stay in your browser.</li>
        <li><strong>Server logs</strong> that our hosting and database providers keep for security and reliability (for example IP address, browser type and request times).</li>
      </ul>
      <p>We don’t use advertising trackers or third-party analytics, and we don’t build advertising profiles.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>By default your shelf is public to signed-in readers:</strong> your rankings, scores, notes, tags, check-ins and the books you’re reading. That’s what makes the feed, taste match and recommendations work.</li>
        <li><strong>You can make your shelf private</strong> (You → Edit → Private shelf). Then only you can see it, you won’t appear in anyone’s feed, and your scores aren’t used in community scores, taste match, or anyone’s recommendations.</li>
        <li><strong>Your username and display name are visible</strong> to signed-in readers even when your shelf is private, so friends can find you.</li>
        <li><strong>Comments and hearts</strong> are visible to anyone who can see the post they’re on.</li>
        <li><strong>Blocking</strong> hides your shelf, posts and comments from that person and theirs from you, and ends follows between you.</li>
        <li><strong>Community scores and predictions</strong> combine many readers’ scores. They never reveal who scored what.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run Spine: sign you in, store your shelf, show your feed, work out scores, taste match and recommendations.</li>
        <li>To send sign-in emails. We don’t send marketing email.</li>
        <li>To keep Spine safe: stop bots, investigate reports, and enforce our <Link href="/terms">terms</Link>.</li>
      </ul>
      <p>We don’t sell your personal information or share it for advertising.</p>

      <h2>Services we rely on</h2>
      <p>These companies process data for us to run Spine:</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Service</th><th>What for</th><th>What it handles</th></tr></thead>
          <tbody>
            <tr><td>Supabase</td><td>Database and sign-in</td><td>Your account and everything on your shelf</td></tr>
            <tr><td>Netlify</td><td>Hosting the website</td><td>Standard web request data</td></tr>
            <tr><td>Resend</td><td>Sending sign-in emails</td><td>Your email address and the email it sends</td></tr>
            <tr><td>Cloudflare Turnstile</td><td>Bot protection on sign-in</td><td>Browser and device signals used to tell people from bots</td></tr>
            <tr><td>Open Library (Internet Archive)</td><td>Book search and cover images</td><td>Your searches and scanned ISBNs, and your IP address when covers load</td></tr>
            <tr><td>Google Fonts</td><td>The app’s typefaces</td><td>Your IP address when fonts load</td></tr>
          </tbody>
        </table>
      </div>
      <p>Book details we look up are stored in Spine’s shared book catalog, which isn’t linked to who searched for them.</p>

      <h2>The camera</h2>
      <p>The barcode scanner uses your camera only while it’s open, and only to read the barcode on your device. Video is never uploaded or saved.</p>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>We keep your data while you have an account.</li>
        <li><strong>You can delete your account any time</strong> (You → Edit → Delete account). That permanently deletes your profile, shelf, rankings, notes, check-ins, follows, hearts, comments and notifications. Copies in our providers’ backups expire on their normal schedule.</li>
        <li>Books you added stay in the shared catalog, without any link to you.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <p>
        You can see and edit most of your data in the app, make your shelf private, or delete your account. To ask for a copy
        of your data, or to exercise rights you have under laws like the GDPR or California’s CCPA (access, correction, deletion,
        portability, objection), email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We’ll answer within 30 days.
      </p>

      <h2>Where data is stored</h2>
      <p>Spine’s data is stored with our providers in {LEGAL.dataRegion}. If you use Spine from elsewhere, your data is transferred there.</p>

      <h2>Security</h2>
      <p>
        Every request is checked against who you are, so readers can only change their own data, and private shelves stay private.
        Connections are encrypted. No system is perfectly secure, so please don’t put sensitive personal information in notes or comments.
      </p>

      <h2>Children</h2>
      <p>Spine isn’t for children under {LEGAL.minimumAge}. If you believe a child under {LEGAL.minimumAge} has an account, email us and we’ll delete it.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above. For significant changes, we’ll also let you know in the app or by email before they take effect.</p>
    </LegalPage>
  );
}
