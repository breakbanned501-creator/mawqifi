# General UI copy update

App-wide copy now describes a community service across institutions and places. Institution names in the place picker, college/branch metadata, scope IDs, and existing user-provided profile names remain unchanged. No database schema or handoff behavior changed.

## Exact Arabic and English copy

| Translation key | Arabic | English |
|---|---|---|
| app.tagline | مشاركة المواقف بين المستخدمين | Community parking coordination |
| app.documentTitle | موقفي \| مشاركة المواقف بين المستخدمين | Mawqifi \| Community parking coordination |
| app.documentDescription | تطبيق مجتمعي لتنسيق مشاركة المواقف بين المستخدمين في جهات وأماكن متعددة. | A community app for coordinating parking spot sharing across institutions and places. |
| home.subtitle | شارك موقفك أو احجز موقفاً في مكانك | Share your spot or find parking in your place |
| home.map | خريطة المكان | Place map |
| home.emptyBody | كن أول من يشارك موقفاً متاحاً مع المستخدمين | Be the first to share an available spot with other users |
| map.title | خريطة المكان | Place map |
| map.notice | موقفي تطبيق مجتمعي يساعد المستخدمين على تنسيق مشاركة المواقف بينهم. لا يوفّر حجزاً رسمياً للمواقف، ولا يتبع أي جهة تعليمية بشكل رسمي. | Mawqifi is a community app that helps users coordinate parking spot sharing. It does not provide official parking reservations and is not officially affiliated with any educational institution. |
| chat.location | الموقع الحالي للمستخدم | User current location |
| settings.importantNotice | تنبيه مهم | Important Notice |
| settings.communityNotice | موقفي تطبيق مجتمعي يساعد المستخدمين على تنسيق مشاركة المواقف بينهم. لا يوفّر حجزاً رسمياً للمواقف، ولا يتبع أي جهة تعليمية بشكل رسمي. | Mawqifi is a community app that helps users coordinate parking spot sharing. It does not provide official parking reservations and is not officially affiliated with any educational institution. |
| whatsapp.channelDescription | انضم للقناة لتصلك تحديثات موقفي والتنبيهات المهمة أولاً بأول. | Join the channel to receive Mawqifi updates and important alerts. |
| notifications.topParkingContributorBody | مساهمتك المستمرة في نشر المواقف قاعد تساعد مستخدمي موقفي بشكل فعلي. وعشان جذي عطيناك شارة مساهم مواقف مميز 🚗⭐ استمر، وجودك يصنع فرق. | Your continued parking contributions are helping Mawqifi users in a real way. We’ve awarded you the Top Parking Contributor 🚗⭐ badge. Keep it up — your contribution makes a difference. |
| tutorial.welcomeBody | موقفي يساعد المستخدمين في جهات وأماكن متعددة على مشاركة المواقف المتاحة والعثور عليها بسرعة. | Mawqifi helps users across institutions and places share and find available parking spots quickly. |
| tutorial.shareBody | انشر موقفك خلال ثواني وساعد مستخدماً آخر. | Post it in seconds and help another user. |
| auth.guest | مستخدم | User |
| privacy.parkingBody | تُحفظ منشورات المواقف في Supabase وتظهر للحسابات داخل التطبيق، بما فيها حسابات الضيوف. تُخفى من قائمة المواقف المتاحة عند انتهاء وقتها، وقد تبقى محفوظة لسجل المحادثات وتشغيل الخدمة. لا نتحقق من هوية المستخدم. | Parking posts are stored in Supabase and visible to in-app accounts, including guests. Expired posts disappear from the available feed but may remain stored for conversation history and service operation. User identity is not verified. |
| privacy.analyticsBody | قد يحتفظ مزودو الاستضافة وقاعدة البيانات بسجلات تقنية لتشغيل الخدمة وأمانها. لا يتطلب الحساب الضيف كشف هويتك الحقيقية، ولا نتحقق من انتمائك لأي جهة تعليمية. | Hosting and database providers may retain technical logs for service operation and security. Guest accounts do not require your real identity, and institutional affiliation is not verified. |
| terms.communityTitle | تطبيق مجتمعي | A community app |
| terms.communityBody | موقفي تطبيق مجتمعي لتنسيق مشاركة المواقف بين المستخدمين في جهات وأماكن متعددة. لا يوفّر حجزاً رسمياً للمواقف، ولا يتبع أي جهة تعليمية بشكل رسمي. | Mawqifi is a community app for coordinating parking spot sharing across institutions and places. It does not provide official parking reservations and is not officially affiliated with any educational institution. |
| terms.complianceBody | يجب على جميع المستخدمين الالتزام بالقوانين والأنظمة المعمول بها في دولة الكويت، وبقواعد الجهة والموقع الذي يستخدمونه. | All users must follow the laws and regulations in force in the State of Kuwait and the rules of the institution and location they use. |
| map.gatesAlt | خريطة بوابات الدخول والمواقف | Campus entrance gates and parking map |
| map.zonesAlt | خريطة المنطقة أ والمنطقة ب والكليات | Zone A, Zone B, and colleges map |

## Other visible copy

- Initial document/Open Graph/Twitter title: `موقفي - Mawqifi | مشاركة المواقف بين المستخدمين`.
- Initial description/Open Graph/Twitter description: `تطبيق مجتمعي لتنسيق مشاركة المواقف بين المستخدمين في جهات وأماكن متعددة.`
- Social image alt: `موقفي - تطبيق مجتمعي لمشاركة المواقف`.
- Search keywords: `موقفي`, `مواقف`, `مشاركة مواقف`, `تنسيق مجتمعي`, `Mawqifi`, `community parking`, `parking`.
- PWA install name: `موقفي | Mawqifi — Community parking coordination`.
- New default profile name and missing-name post/conversation fallbacks: `مستخدم` (replaces `طالب`). Existing profile names are not rewritten.
- Chat push missing-sender fallback: `مستخدم` / `User`. Push authentication, filtering, and delivery behavior are unchanged; no push delivery was tested.

## Coverage

Settings Important Notice, PWA splash, Home subtitle/empty state, document/share/install metadata, onboarding, anonymous-account label/default name, chat location labels, contributor notification text, Privacy Policy, and Terms were generalized. Legacy map strings were also generalized without restoring guidance-map UI.

Publish, place selection, scope helpers, report/blocked-user controls, legal links, footer, and ordinary alerts were audited; copy that was already neutral was preserved. Kuwait University, PAAET, and GUST remain selectable institutions. KU-specific verified parking metadata remains institution-scoped.
