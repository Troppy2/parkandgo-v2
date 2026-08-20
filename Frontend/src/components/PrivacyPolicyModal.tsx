import LegalModal, { LegalSection } from "./LegalModal"
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "./legalMeta"

interface PrivacyPolicyModalProps {
  onClose: () => void
}

/**
 * The in-app Privacy Policy.
 *
 * The reviewable source of truth is `docs/legal/privacy-policy.md`. This is the
 * version users actually see, so the two must be changed together. Claims here
 * are deliberately specific (which services, which fields, what deletion does)
 * because each one is enforced by named code, and a vague policy would be
 * describing less than the app already guarantees.
 */
export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  return (
    <LegalModal title="Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED} onClose={onClose}>
      <p>
        Park &amp; Go is an independent, open source app for UMN students. It is not
        affiliated with, endorsed by, or operated by the University of Minnesota.
      </p>

      <LegalSection heading="The short version">
        <ul className="list-disc pl-4 space-y-1">
          <li>Location is used while the app is open, to rank parking and draw routes.</li>
          <li>Signing in is optional. Guests can browse without an account.</li>
          <li>Analytics are off until you turn them on, and the server enforces that.</li>
          <li>Analytics events record ids, settings, and counts, never your coordinates.</li>
          <li>Recommendations use a published point system, not a machine learning model.</li>
          <li>You can delete your account and its data from Settings, at any time.</li>
          <li>We do not sell your information. There are no ads and no ad tracking.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Location">
        <p>
          With your permission, the app watches your position while it is open so it can rank
          nearby parking, estimate travel and walk times, draw routes, and show nearby campus
          buildings. Coordinates are used for those requests and held in memory for the session.
        </p>
        <p>
          The app does not keep a history of where you have been. The exception is data you
          create on purpose: a private spot you save stores the coordinates you chose, plus its
          name and note. Positions are rounded to about 11 meters before being reused as a
          request key, so a precise position is not repeated in caches or analytics triggers.
        </p>
      </LegalSection>

      <LegalSection heading="Account and profile">
        <p>
          Signing in is optional and uses Google. If you sign in, we store your Google account
          id, email, name, and profile photo URL. You can optionally add a preferred name,
          major, grade level, graduation year, housing type, and preferred parking types.
        </p>
      </LegalSection>

      <LegalSection heading="What you create">
        <p>
          Saved spots and buildings, private spots with their coordinates and notes, parking
          history, ratings and reviews, parking spots you submit, and your app preferences.
          Spot submissions and reviews are visible to other users, so keep anything private
          out of them.
        </p>
      </LegalSection>

      <LegalSection heading="Analytics, only if you allow it">
        <p>
          Analytics are off by default. Guests cannot be opted in at all, because there is no
          account on which to record the decision. Consent is read from the server, never from
          what the app sends, so a client cannot opt itself in. Every change is written to an
          append only audit trail, so it is always possible to tell whether consent was in
          place when a given record was collected.
        </p>
        <p>
          <strong className="text-text1">Analytics events never contain your location.</strong>{" "}
          An event is an action name plus a few ids, flags, and counts: how many results a list
          had, whether a location was available as a true or false flag, which spot or building
          you tapped, the travel mode, and the reason navigation ended.
        </p>
        <p>
          Your parking history is stored either way, since it is a feature rather than
          analytics. Each entry records whether it may also be used for analytics.
        </p>
      </LegalSection>

      <LegalSection heading="How recommendations work">
        <p>
          There is no machine learning model, no profile inferred about you, and nothing about
          you is used to train anything. Every spot is scored by the same fixed rubric: cost up
          to 40 points, travel time up to 15, a match with your preferred parking type 10, a
          spot on the campus tied to your major 5, verified status 5, and up to 15 bonus points
          for being near an event you are heading to.
        </p>
        <p>
          Only two profile fields affect it: preferred parking types and major category.
          Leaving them blank simply scores those factors at zero. Because the rubric is fixed
          and published, the app can show you the score breakdown behind each suggestion, and
          the same inputs always give the same result.
        </p>
      </LegalSection>

      <LegalSection heading="Services the app talks to">
        <p>
          These are run by other organizations under their own privacy policies, which we do
          not control.
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-text1">Google</strong> for optional sign in, which returns your id, email, name, and photo URL.</li>
          <li><strong className="text-text1">OpenFreeMap</strong> and, in satellite style, <strong className="text-text1">Esri ArcGIS</strong> for map tiles. They see the map area you are viewing and your IP address.</li>
          <li><strong className="text-text1">Project OSRM</strong> for driving routes and <strong className="text-text1">OpenStreetMap routing</strong> for walking and cycling. These receive your start and destination coordinates. This is the one place precise coordinates leave your device to someone other than our own server.</li>
          <li><strong className="text-text1">Nominatim</strong> for turning a typed address into coordinates, when you submit or edit a spot. It receives the address text.</li>
          <li><strong className="text-text1">jsDelivr</strong> for an icon font stylesheet.</li>
          <li><strong className="text-text1">Neon</strong> hosts the database, <strong className="text-text1">Render</strong> the backend, and <strong className="text-text1">Vercel</strong> the web app, all in the United States.</li>
          <li><strong className="text-text1">UMN public event calendars</strong> are fetched by our server on its own schedule. Nothing about you is sent.</li>
        </ul>
        <p>
          Campus building data comes from OpenStreetMap but is stored in our own database, so
          browsing buildings does not contact them. Spoken directions use your own device's
          speech capability, and no audio is sent to us.
        </p>
      </LegalSection>

      <LegalSection heading="Deleting your account">
        <p>
          You can delete your account from Settings at any time. It is immediate, permanent,
          and either succeeds completely or changes nothing.
        </p>
        <p>
          Removed outright: your account and Google details, saved spots and buildings, private
          spots, parking history, your reviews, your preferences, and your consent history.
        </p>
        <p>
          Kept, with the link to you erased: parking spots you submitted, because other people's
          saved spots and recommendations point at them, and analytics events, which are left
          holding only ids, flags, and counts once the user id is removed. Email us if you want
          those removed too.
        </p>
      </LegalSection>

      <LegalSection heading="Accuracy and safety">
        <p>
          Parking information, pricing, availability, routes, walk times, and event details may
          be incomplete, wrong, or out of date. Always follow posted signs, campus rules, local
          laws, and payment requirements, and use your own judgment. Do not interact with the
          app while driving.
        </p>
        <p>
          Park &amp; Go is not responsible for tickets, towing, fees, theft, damage, injuries,
          accidents, missed events, or other losses that happen while you park, travel to,
          leave from, or use a location suggested by the app.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          Park &amp; Go is intended for university students and is not directed at children
          under 13, and we do not knowingly collect their information.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions, requests, or concerns: <span className="text-text1">{LEGAL_CONTACT_EMAIL}</span>
        </p>
      </LegalSection>
    </LegalModal>
  )
}
