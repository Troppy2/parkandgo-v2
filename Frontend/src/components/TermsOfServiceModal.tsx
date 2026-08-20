import LegalModal, { LegalSection } from "./LegalModal"
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_REPO_URL } from "./legalMeta"

interface TermsOfServiceModalProps {
  onClose: () => void
}

/**
 * The in-app Terms of Service.
 *
 * The reviewable source of truth is `docs/legal/terms-of-service.md`, which
 * carries the full text including the sections a court would care about and
 * this summary compresses. Change both together.
 */
export default function TermsOfServiceModal({ onClose }: TermsOfServiceModalProps) {
  return (
    <LegalModal title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED} onClose={onClose}>
      <p>
        By using Park &amp; Go you accept these terms. If you do not accept them, do not use
        the app.
      </p>

      <LegalSection heading="What Park & Go is">
        <p>
          An independent, open source app that helps UMN students find parking and walk to
          campus buildings, provided free of charge, as is, by an individual maintainer.
        </p>
        <p>
          <strong className="text-text1">
            It is not affiliated with, endorsed by, or operated by the University of Minnesota.
          </strong>{" "}
          Park &amp; Go does not own, operate, reserve, or sell parking, and has no authority
          over any parking facility, enforcement decision, or fee.
        </p>
      </LegalSection>

      <LegalSection heading="Who may use it">
        <p>
          You must be at least 13. If you are under the age of majority where you live, you may
          use the app only with a parent or guardian who accepts these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts">
        <p>
          Signing in is optional, and uses Google. Keep that account secure. You are
          responsible for activity under your account, and for giving accurate profile
          information. Do not impersonate anyone.
        </p>
        <p>
          You can delete your account at any time from Settings. We may suspend or remove an
          account that violates these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Information in the app is not guaranteed">
        <p>
          Parking locations, prices, availability, hours, restrictions, walk and travel times,
          routes, building details, and events may be incomplete, inaccurate, or out of date.
          Much of it comes from other users or public data, and none of it is verified
          continuously. A spot marked verified was reviewed at some point, which is not a
          promise about its current state, price, or legality.
        </p>
        <p>
          Recommendations are suggestions from a scoring rubric. They are not advice, and not a
          statement that a spot is available, legal, or safe.
        </p>
        <p>
          <strong className="text-text1">You are responsible for where you park.</strong> Check
          posted signs, meters, permits, and time limits, and follow them over anything the app
          shows you.
        </p>
      </LegalSection>

      <LegalSection heading="Use the app safely">
        <p>
          Do not interact with the app while driving. Turn by turn guidance and voice prompts
          are aids, not a substitute for attention to the road, traffic, and weather. Obey
          traffic laws, and use your own judgment about personal safety when walking to or from
          a parking location.
        </p>
      </LegalSection>

      <LegalSection heading="Content you contribute">
        <p>
          You keep ownership of what you submit. By submitting content that is shared with
          others, meaning spot submissions and reviews, you grant a non exclusive, worldwide,
          royalty free license to store, display, reproduce, adapt, and distribute it within
          Park &amp; Go and its open source repository. For content already shared publicly
          that license survives account deletion, which is why submitted spots remain after
          deletion with authorship removed.
        </p>
        <p>
          Do not submit anything false, unlawful, infringing, harassing, hateful, threatening,
          obscene, or that targets a private individual. Contributed content may be edited,
          refused, or removed at any time.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>Do not:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Break the law with the app, or help anyone else do so</li>
          <li>Scrape or bulk extract data beyond ordinary personal use</li>
          <li>Attack, overload, or disrupt the service or the third party services it relies on</li>
          <li>Bypass authentication, rate limits, or consent controls, or try to reach other users' data</li>
          <li>Submit malicious code, or automate account or content creation</li>
          <li>Present Park &amp; Go as affiliated with the University of Minnesota or anyone else</li>
        </ul>
        <p>Reading the public source code is fine. Attacking the hosted service is not.</p>
      </LegalSection>

      <LegalSection heading="Third party services and availability">
        <p>
          The app depends on Google, OpenFreeMap, Esri, Project OSRM, OpenStreetMap, Nominatim,
          Neon, Render, and Vercel. Your use of those is subject to their terms, we do not
          control them, and if one fails, parts of the app may stop working.
        </p>
        <p>
          This is a personal project, not a service with a support commitment. It may be
          unavailable, changed, or discontinued at any time, without notice. Do not rely on it
          as the only record of anything that matters to you.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty">
        <p>
          Park &amp; Go is provided as is and as available, without warranties of any kind,
          express or implied, including merchantability, fitness for a particular purpose, non
          infringement, accuracy, and availability. It is not warranted to be uninterrupted,
          secure, or error free.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, the maintainer is not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost data, profits,
          or opportunities.
        </p>
        <p>
          In particular, the maintainer is{" "}
          <strong className="text-text1">
            not responsible for parking tickets, fines, booting, towing, impound charges,
            parking fees, vehicle damage, theft, injury, traffic accidents, missed events, or
            other losses
          </strong>{" "}
          arising from where you parked, how you traveled there, a route the app drew, or a
          recommendation it made.
        </p>
        <p>
          Total liability for all claims will not exceed twenty five US dollars, reflecting
          that the app is free. Some jurisdictions do not allow these limits, so parts of this
          may not apply to you, and nothing here limits liability that cannot be limited by
          law.
        </p>
      </LegalSection>

      <LegalSection heading="Changes, termination, and governing law">
        <p>
          These terms may change. When they change materially, the updated version appears here
          and the date above changes. Continuing to use the app means you accept them.
        </p>
        <p>
          You may stop using Park &amp; Go and delete your account at any time. Access may be
          suspended for violation of these terms.
        </p>
        <p>
          These terms are governed by the laws of the State of Minnesota, with disputes brought
          in the courts of Hennepin County, Minnesota, except where the law where you live
          gives you the right to bring a claim elsewhere.
        </p>
      </LegalSection>

      <LegalSection heading="Open source">
        <p>
          The source code is published at{" "}
          <a
            href={LEGAL_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            github.com/Troppy2/parkandgo-v2
          </a>{" "}
          under the license in that repository. That license covers the code. These terms cover
          your use of the hosted app.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms:{" "}
          <span className="text-text1">{LEGAL_CONTACT_EMAIL}</span>
        </p>
      </LegalSection>
    </LegalModal>
  )
}
