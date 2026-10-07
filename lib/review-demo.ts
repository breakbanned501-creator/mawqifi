export const APP_REVIEW_DEMO_PATH = '/review-demo';

export const REVIEW_DEMO_LOCATION = {
  latitude: 29.3759,
  longitude: 47.9774,
  labelAr: 'موقع تجريبي — مدينة الكويت',
  labelEn: 'Synthetic location — Kuwait City',
} as const;

export const REVIEW_DEMO_MAP_URL =
  `https://maps.apple.com/?ll=${REVIEW_DEMO_LOCATION.latitude},${REVIEW_DEMO_LOCATION.longitude}` +
  '&q=Mawqifi%20App%20Review%20Demo';

export type ReviewDemoPlace = 'kuwait_university' | 'paaet' | 'gust';

export type ReviewDemoMessage = {
  id: string;
  sender: 'reviewer' | 'counterpart';
  kind: 'text' | 'image';
  text?: string;
  imageUrl?: string;
};

export type ReviewDemoState = {
  selectedPlace: ReviewDemoPlace | null;
  published: boolean;
  claimed: boolean;
  arrived: boolean;
  closed: boolean;
  reported: boolean;
  blocked: boolean;
  accountDeleted: boolean;
  messages: ReviewDemoMessage[];
};

export const REVIEW_DEMO_PLACES: ReadonlyArray<{
  id: ReviewDemoPlace;
  ar: string;
  en: string;
}> = [
  { id: 'kuwait_university', ar: 'جامعة الكويت', en: 'Kuwait University' },
  { id: 'paaet', ar: 'التطبيقي', en: 'PAAET' },
  { id: 'gust', ar: 'GUST', en: 'GUST' },
];

export function createReviewDemoState(isArabic: boolean): ReviewDemoState {
  return {
    selectedPlace: null,
    published: false,
    claimed: false,
    arrived: false,
    closed: false,
    reported: false,
    blocked: false,
    accountDeleted: false,
    messages: [
      {
        id: 'demo-message-1',
        sender: 'counterpart',
        kind: 'text',
        text: isArabic
          ? 'مرحباً، هذا مستخدم تجريبي. الموقف ظاهر لك بعد الحجز فقط.'
          : 'Hello, this is a synthetic demo user. The parking location is visible only after claiming.',
      },
    ],
  };
}

export function appendReviewDemoText(
  state: ReviewDemoState,
  text: string,
): ReviewDemoState {
  const value = text.trim();
  if (!value || !state.claimed || state.closed || state.blocked || state.accountDeleted) return state;
  return {
    ...state,
    messages: [
      ...state.messages,
      { id: `demo-message-${state.messages.length + 1}`, sender: 'reviewer', kind: 'text', text: value },
    ],
  };
}

