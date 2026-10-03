# Official location/map sources

Retrieved **2026-10-02**. No newly downloaded institution imagery is embedded:
public availability does not establish a republication licence. Official
external links preserve the publisher's attribution, logos and legends.

| Institution | Exact location | Source title and URL | Use | Embedding decision |
|---|---|---|---|---|
| Kuwait University | Sabah Al-Salem University City, Shadadiya | [مدينة صباح السالم الجامعية — Faculty of Engineering](https://engineering.ku.edu.kw/ar/sabah-alsalem-university-city) | Official source link beside existing gallery; page provides its campus-map link | Link-only; no express embedding permission found |
| Kuwait University | Sabah Al-Salem University City | [SSUC map copyright/terms](https://gis.ssuc.ku.edu.kw/ssuccampus/server/copyrights/?language=en) | Research reference; informational/reference-only mapping | No new copy; respect map terms |
| PAAET | Multiple colleges/institutes at different physical locations | [Official contact/directions directory](https://www.paaet.edu.kw/ar/call/) | Publish/map guidance with a supported subset of directory locations | Official directions links only; not a unified campus map |
| PAAET | Basic Education College — Ardiya | [Directions linked from official directory](https://maps.app.goo.gl/3yVUsKXQWvufRLTS7) | Optional directions choice | Link-only; no Google tiles/screenshots copied |
| PAAET | Basic Education College — Jahra | [Directions linked from official directory](https://maps.app.goo.gl/Zt6p5bPZ9vCg6vrR9) | Optional directions choice | Link-only; destination not independently retrieved, publisher attribution verified on directory |
| PAAET | College of Nursing — Shuwaikh Educational | [Directions linked from official directory](https://maps.app.goo.gl/W4YkirMetQvqtMzk8) | Optional directions choice | Link-only; destination not independently retrieved, publisher attribution verified on directory |
| PAAET | Institution-wide historical sites/future projects | [2021/2022 annual report](https://www.paaet.edu.kw/media/qewbm1bw/terms20212022.pdf) | Research only; not used as current parking metadata | Historical overview, not a current parking map; not embedded |
| GUST | Mishref campus, Mubarak Al-Abdullah, West Mishref, Block 5, Building 1 | [GUST Campus Map](https://www.gust.edu.kw/about-us/gust-campus-map) | Official guidance/source link | Copyright reserved; no licence found to copy/embed |
| GUST | Same Mishref campus | [Official accessibility PDF linked by campus page](https://www.gust.edu.kw/static/e0d74832-2e51-4e8f-9ae5-f2dde6ae687d.pdf) | Accessibility guidance link, not a parking-zone selector | Link-only; preserve complete original PDF |
| GUST | Mishref campus | [Official MBA handbook](https://www.gust.edu.kw/static/6202ea70-1f81-433f-9a89-fc21a5b9f204.pdf) | Supporting research only | Not embedded; handbook is not a republication licence |

## Existing local KU gallery

public/map1.png and public/map2.png predate this task. The KU-only preview/lightbox
gallery is retained unchanged, as requested. Existing labels describe
gates/parking and KU zones. The original asset provenance/republication licence
is not established by the newly researched page; these images are not claimed
to have been downloaded from that page. No new image copies, fabricated legends,
gate numbers or zones were added.

The repository's kuColleges is retained as the **legacy client contract**, not
a new assertion that every listed college/gate is its current official location.
The official KU page distinguishes the city campus from the medical campus.
Existing choices remain for compatibility; other places do not reuse them.

## PAAET scope

PAAET is an institution family, not one campus. The official directory lists
sites in Ardiya, Jahra, Shuwaikh, Sabah Al-Salem, Hawally and other areas.
Displayed choices are explicitly a supported subset for directions, not new
database campus records or the entire institution. Publishing requires a useful
free-text location including the college/institute and area. No unverified
gate/branch/parking fields are created.

## GUST scope

The official page provides general campus and parking/access guidance.
No internal parking zones or gate numbers are inferred from prose or imagery.
Publishing uses a location description. Local signage takes precedence.

## Extensibility

Places are read from the active database catalogue. Future destinations use
descriptive publishing without a schema enum change. Destinations without a
reviewed map source show "Map not available yet". New structured metadata
requires separate source verification.

## Publish-flow integration re-check (2026-10-02)

| Place/source | Asset classification | In-app treatment | Local file added | Attribution/reuse note |
|---|---|---|---|---|
| KU existing gallery | Existing local images, public/map1.png and public/map2.png | Existing previews and tap-to-enlarge unchanged | None | Existing provenance limitation above remains; no replacement asset copied |
| PAAET official contact/directions directory, https://www.paaet.edu.kw/ar/call/ | Webpage with separate Google Maps directions links; displayed location icon is an SVG icon, not a campus map. No downloadable campus-map image/PDF found on this source | Prominent bilingual official-map card opens the directory until a location is selected; then it opens only that location's published directions. Official source link remains the institution directory | None | PAAET footer reserves rights; https://www.paaet.edu.kw/ar/privacypolicy/ provides publishing/usage rules, not a third-party map redistribution licence. No Google map tiles or screenshots copied |
| GUST campus page, https://www.gust.edu.kw/about-us/gust-campus-map | Official campus webpage includes public CDN imagery and campus/parking/access information | Bilingual campus guidance card opens the official page; no copied image preview | None | Page footer: Copyright 2026 GUST, All Rights Reserved. https://www.gust.edu.kw/privacy-policy contains data/privacy provisions, not an image reuse grant. No clear permission for bundling campus imagery in a third-party app |
| GUST accessibility PDF, https://www.gust.edu.kw/static/e0d74832-2e51-4e8f-9ae5-f2dde6ae687d.pdf | Direct downloadable application/pdf, 12 pages, titled GUST Map for Accessible Navigation, 2024; contains accessibility text/map pages | Dedicated bilingual PDF card opens the complete original document, with its official campus-page source link | None | The document discusses distributing accessibility information digitally/printed for students; that is not an unambiguous licence to extract, adapt, or bundle its imagery in Mawqifi. Keep complete original publisher content, notices and legends on its own host; not repurposed as verified parking-zone metadata |

Public GUST image asset URLs referenced by the official campus page:

- https://static.gust.edu.kw/cd2b0eda-3d79-4b27-9d46-8c0d6e4d4d55
- https://static.gust.edu.kw/51851c3d-bc37-425d-aaf0-2dc116f87111
- https://static.gust.edu.kw/4624ddc3-ee49-4f9a-9a27-27ed9a651d6c
- https://static.gust.edu.kw/4be0c924-95b0-4e2b-a266-c2ecd3dda28d

These URLs establish public availability, not reuse permission. They are not
embedded/hotlinked, downloaded into the repository, or assigned invented
parking legends. The last CDN asset could not be independently retrieved by
the research fetcher; its reference on the official page is verified.

PAAET's three existing directions choices retain their exact URLs recorded
above. No map is assigned to all PAAET colleges, and selecting a directions
location does not create database campus/gate metadata.

New UI code: components/OfficialMapCard.tsx. Updated PlaceGuidance and bilingual
translations expose View official map / عرض الخريطة الرسمية, Open official
source, document type, exact location, and browser-opening guidance. On web
the links open a new tab with noopener/noreferrer; in Capacitor the new
HTTPS/official-host-validated helper uses @capacitor/app-launcher 8.0.1 and
UIApplication.open on iOS to open the OS browser/installed map URL handler,
not an in-app Safari sheet. It never navigates the Capacitor asset origin
to a remote webpage. No new map image or PDF files were added.

Recheck outcome: all new PAAET/GUST sources remain **link-only** because the
reuse permission needed for local app bundling is unclear. Their cards are
available inside Publish and Map; KU keeps the existing local gallery.

Native integration: added lib/official-map-links.ts, @capacitor/app-launcher
8.0.1 (compatible with Capacitor 8), and its Swift Package Manager registration.
No additional device permissions, URL-scheme queries, remote server.url,
private keys, or schema changes are needed. Confirm OS browser/map handoff on
the physical iPhone during manual TestFlight validation.

## Integration validation

- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS; browser PWA build retained.
- npm run cap:ios:archive: PASS (local static assets, not a signed IPA).
- npx cap sync ios: PASS; AppLauncherPlugin registered in generated config
  and CapacitorAppLauncher included in Swift Package Manager.
- node scripts/test-official-map-links.cjs: PASS, 11 URL/browser contract
  assertions; rejects HTTP, credentials and non-official hosts before OS handoff.
- npm run test:release-hardening: PASS, 57 existing regression assertions.
- Arabic RTL at 390px and English LTR at 320px: cards render without horizontal
  overflow or browser errors. Ardiya/Jahra/Shuwaikh choices update the exact
  official directions URL and retain one card, without stale campus guidance.
- Native verification: staging Supabase/API origin, no private server material,
  no service worker, no server.url. Physical iPhone browser/app handoff and
  signed Xcode/TestFlight validation remain manual.
- KU assets unchanged; no database migration/schema changes. No production
  access/deployment or Codemagic build initiated.

## Parking handoff redesign (2026-10-02)
Guidance-map cards and galleries were removed from publishing and public navigation. Sources remain provenance documentation. Real matched parking locations use private system-map navigation; institution maps are not used to infer a parking stall.

## College/branch scoping (2026-10-03)

The no-typing GPS handoff now uses a tap-only sub-place selector. KU reuses all
11 labels in lib/university.ts; no gates/zones are inferred during GPS publishing.
PAAET supports only the three directory-confirmed locations recorded above:
Basic Education — Ardiya, Basic Education — Jahra, and Nursing — Shuwaikh
Educational. This is an incomplete subset; other PAAET colleges/institutes/sites
remain unsupported until their labels and locations are reviewed. Existing
Jahra/Shuwaikh destination-fetch limitations remain documented above.
GUST remains the single documented Mishref campus, with no sub-place selector.
These selections scope discovery, not precise GPS or institution membership.
Guidance-map UI remains removed; no new maps, imagery, gates or zones were added.

## Compact selector and verified catalogue update (2026-10-03)

This supersedes the earlier three-site PAAET subset. The complete **educational-location list in the official contact directory** is now represented: 5 college groups and 7 institute groups, 15 location entries. The two industrial institutes are grouped for selection, with their explicitly named sites retained. Headquarters and future projects are excluded. This does not assert that every possible PAAET facility is listed by the directory.

Source: https://www.paaet.edu.kw/ar/call/ (retrieved 2026-10-03), entries from Basic Education through Vocational Training. Cross-check: https://www.paaet.edu.kw/ar/الكليات-والمعاهد/. Labels and locations are metadata only; no imagery, copied maps or invented gates.

| College / institute | Officially named sites |
|---|---|
| كلية التربية الأساسية / Basic Education | العارضية / Ardiya; الجهراء / Jahra |
| كلية التمريض / Nursing College | الشويخ التعليمية / Shuwaikh Educational |
| كلية العلوم الصحية / Health Sciences | الشويخ التعليمية — بنات وبنين / Shuwaikh Educational — girls and boys |
| كلية الدراسات التكنولوجية / Technological Studies | الشويخ التعليمية / Shuwaikh Educational |
| كلية الدراسات التجارية / Business Studies | العارضية / Ardiya |
| المعهد العالي للاتصالات والملاحة / Higher Institute of Communications and Navigation | الشويخ التعليمية / Shuwaikh Educational |
| المعهد العالي للطاقة / Higher Institute of Energy | الشويخ التعليمية / Shuwaikh Educational |
| المعهد الصناعي / Industrial Training Institute | الشويخ التعليمية / Shuwaikh Educational; صباح السالم / Sabah Al-Salem |
| معهد التمريض / Nursing Institute | الشويخ التعليمية — شارع الجاحظ / Shuwaikh Educational — Al-Jahiz Street |
| المعهد العالي للخدمات الإدارية / Higher Institute of Administrative Services | حولي — بنات — شارع 133 / Hawally — girls — Street 133; حولي — بنين — شارع بيروت / Hawally — boys — Beirut Street |
| معهد التدريب الإنشائي / Construction Training Institute | جنوب الصباحية / South Sabahiya |
| معهد التدريب المهني / Vocational Training Institute | شرق / Sharq |

Health Sciences is one combined boys/girls directory entry: no fabricated separate branches. Administrative Services has two separately addressed entries and remains two scopes. Existing Basic Education and Nursing IDs are unchanged.

KU: https://oovpp.ku.edu.kw/ar/node/35526 records north/south **buildings** and campus-wide surface/multistorey parking, not a verified north/south parking choice per college. The existing 11 college scopes remain unchanged; every college uses the General parking-area fallback. No parking-side IDs are fabricated, persisted as gate values or used as filters. Additional reviewed evidence is required before enabling a split. GUST remains the single Mishref campus.

Guidance maps remain removed from the handoff UI. Private matched GPS/system-map navigation is unchanged.

## User-confirmed KU parking sides (2026-10-03)

The user explicitly confirmed North / الشمالي and South / الجنوبي for every college in the existing 11-college list. This supersedes the General fallback in the previous compact selector. Provenance is the user's confirmed local parking structure, not an inferred official map claim. No college labels or legacy zone/gate metadata changed; no guidance-map UI returned. Existing unclassified rows are not assigned a side.
