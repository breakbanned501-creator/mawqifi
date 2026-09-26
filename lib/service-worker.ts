import { isStandaloneMode } from './pwa';
import { isNativeCapacitor } from './capacitor';

export const MAWQIFI_SERVICE_WORKER_PATH = '/sw.js';
export const MAWQIFI_SERVICE_WORKER_SCOPE = '/';

const SERVICE_WORKER_OPERATION_TIMEOUT_MS = 10_000;
const SERVICE_WORKER_ACTIVATION_TIMEOUT_MS = 15_000;
const SERVICE_WORKER_STATE_POLL_MS = 250;

type ServiceWorkerFailureReason = 'unsupported' | 'registration' | 'activation';

export class MawqifiServiceWorkerError extends Error {
  constructor(readonly reason: ServiceWorkerFailureReason) {
    super(
      reason === 'activation'
        ? 'The Mawqifi service worker did not activate in time.'
        : 'The Mawqifi service worker could not be registered.',
    );
    this.name = 'MawqifiServiceWorkerError';
  }
}

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

type ServiceWorkerDiagnostics = Record<string, boolean | number | string | null | undefined>;

function logServiceWorkerDiagnostic(phase: string, details: ServiceWorkerDiagnostics): void {
  // This intentionally records lifecycle metadata only. Never add tokens,
  // subscription endpoints, subscription keys, or user information here.
  console.info('[service-worker] diagnostic', { phase, ...details });
}

function logServiceWorkerFailure(phase: string, error: unknown): void {
  console.warn('[service-worker] operation failed', {
    phase,
    errorName: error instanceof Error ? error.name : 'unknown',
  });
}

function rootScopeUrl(): string {
  return new URL(MAWQIFI_SERVICE_WORKER_SCOPE, window.location.origin).href;
}

function isRootRegistration(registration: ServiceWorkerRegistration | undefined): registration is ServiceWorkerRegistration {
  return Boolean(registration && registration.scope === rootScopeUrl());
}

function hasActiveRootRegistration(registration: ServiceWorkerRegistration | undefined): boolean {
  return Boolean(isRootRegistration(registration) && registration.active?.state === 'activated');
}

function registrationState(registration: ServiceWorkerRegistration | undefined): ServiceWorkerDiagnostics {
  return {
    hasRegistration: Boolean(registration),
    scope: registration?.scope ?? null,
    hasInstallingWorker: Boolean(registration?.installing),
    installingState: registration?.installing?.state ?? null,
    hasWaitingWorker: Boolean(registration?.waiting),
    waitingState: registration?.waiting?.state ?? null,
    hasActiveWorker: Boolean(registration?.active),
    activeState: registration?.active?.state ?? null,
    hasController: Boolean(navigator.serviceWorker.controller),
  };
}

async function withServiceWorkerTimeout<T>(
  operation: () => Promise<T>,
  reason: ServiceWorkerFailureReason,
  timeoutMs = SERVICE_WORKER_OPERATION_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: number | undefined;

  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = window.setTimeout(() => reject(new MawqifiServiceWorkerError(reason)), timeoutMs);

      void operation().then(
        (value) => {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          timeoutId = undefined;
          resolve(value);
        },
        (error: unknown) => {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          timeoutId = undefined;
          reject(error);
        },
      );
    });
  } catch (error) {
    if (error instanceof MawqifiServiceWorkerError) throw error;
    logServiceWorkerFailure('lifecycle-operation', error);
    throw new MawqifiServiceWorkerError(reason);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

async function findRootRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const scopedRegistration = await withServiceWorkerTimeout(
    () => navigator.serviceWorker.getRegistration(MAWQIFI_SERVICE_WORKER_SCOPE),
    'registration',
  );

  let registrations: readonly ServiceWorkerRegistration[] = [];
  try {
    registrations = await withServiceWorkerTimeout(
      () => navigator.serviceWorker.getRegistrations(),
      'registration',
    );
  } catch (error) {
    // A scoped registration remains enough to safely use the root worker.
    // Keep the diagnostics useful without preventing a supported browser.
    logServiceWorkerFailure('registrations-list', error);
  }

  const registration = isRootRegistration(scopedRegistration)
    ? scopedRegistration
    : registrations.find((candidate) => isRootRegistration(candidate));

  logServiceWorkerDiagnostic('registration.lookup', {
    isStandalone: isStandaloneMode(),
    hasServiceWorkerSupport: 'serviceWorker' in navigator,
    registrationCount: registrations.length,
    ...registrationState(registration),
  });

  return registration;
}

function waitForActiveRootRegistration(
  initialRegistration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: number | undefined;
    let intervalId: number | undefined;
    const observedRegistrations = new Map<ServiceWorkerRegistration, EventListener>();
    const observedWorkers = new Map<ServiceWorker, EventListener>();

    const cleanup = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      observedRegistrations.forEach((listener, registration) =>
        registration.removeEventListener('updatefound', listener),
      );
      observedWorkers.forEach((listener, worker) => worker.removeEventListener('statechange', listener));
    };

    const finish = (registration?: ServiceWorkerRegistration, error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (registration) {
        logServiceWorkerDiagnostic('registration.activated', registrationState(registration));
        resolve(registration);
      } else {
        reject(error || new MawqifiServiceWorkerError('activation'));
      }
    };

    const inspect = async () => {
      try {
        const registration = await findRootRegistration();
        if (!registration) return;
        observeRegistration(registration);
        if (hasActiveRootRegistration(registration)) finish(registration);
      } catch (error) {
        logServiceWorkerFailure('registration.inspect', error);
      }
    };

    const observeWorker = (worker: ServiceWorker | null) => {
      if (!worker || observedWorkers.has(worker)) return;
      const onStateChange: EventListener = () => {
        logServiceWorkerDiagnostic('worker.statechange', { state: worker.state });
        void inspect();
      };
      observedWorkers.set(worker, onStateChange);
      worker.addEventListener('statechange', onStateChange);
    };

    const observeRegistration = (registration: ServiceWorkerRegistration) => {
      if (!observedRegistrations.has(registration)) {
        const onUpdateFound: EventListener = () => {
          logServiceWorkerDiagnostic('registration.updatefound', registrationState(registration));
          observeWorker(registration.installing);
          void inspect();
        };
        observedRegistrations.set(registration, onUpdateFound);
        registration.addEventListener('updatefound', onUpdateFound);
      }

      observeWorker(registration.installing);
      observeWorker(registration.waiting);
      observeWorker(registration.active);
    };

    const onControllerChange: EventListener = () => {
      logServiceWorkerDiagnostic('controller.change', {
        hasController: Boolean(navigator.serviceWorker.controller),
      });
      void inspect();
    };

    timeoutId = window.setTimeout(() => {
      logServiceWorkerDiagnostic('registration.activation-timeout', registrationState(initialRegistration));
      finish(undefined, new MawqifiServiceWorkerError('activation'));
    }, SERVICE_WORKER_ACTIVATION_TIMEOUT_MS);
    intervalId = window.setInterval(() => void inspect(), SERVICE_WORKER_STATE_POLL_MS);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    observeRegistration(initialRegistration);
    void inspect();
  });
}

async function registerOrRepairRootWorker(): Promise<ServiceWorkerRegistration> {
  let registration = await findRootRegistration();

  if (!hasActiveRootRegistration(registration)) {
    logServiceWorkerDiagnostic('registration.register', {
      path: MAWQIFI_SERVICE_WORKER_PATH,
      scope: MAWQIFI_SERVICE_WORKER_SCOPE,
      ...registrationState(registration),
    });
    registration = await withServiceWorkerTimeout(
      () =>
        navigator.serviceWorker.register(MAWQIFI_SERVICE_WORKER_PATH, {
          scope: MAWQIFI_SERVICE_WORKER_SCOPE,
          updateViaCache: 'none',
        }),
      'registration',
    );
  }

  if (!isRootRegistration(registration)) {
    throw new MawqifiServiceWorkerError('registration');
  }

  if (hasActiveRootRegistration(registration)) {
    logServiceWorkerDiagnostic('registration.active', registrationState(registration));
    // An active worker is already safe for PushManager. Check for an upgrade
    // in the background so installed PWAs also receive the corrected worker
    // without delaying a notification action.
    void withServiceWorkerTimeout(() => registration.update(), 'registration')
      .then(() => logServiceWorkerDiagnostic('registration.background-update-requested', registrationState(registration)))
      .catch((error: unknown) => logServiceWorkerFailure('registration.background-update', error));
    return registration;
  }

  // This is a safe repair for a stale or interrupted installation. It checks
  // the same root registration and never unregisters a healthy active worker.
  try {
    await withServiceWorkerTimeout(() => registration.update(), 'registration');
    logServiceWorkerDiagnostic('registration.update-requested', registrationState(registration));
  } catch (error) {
    logServiceWorkerFailure('registration.update', error);
  }

  return waitForActiveRootRegistration(registration);
}

/**
 * Resolves Mawqifi's one root-scoped, active worker. This intentionally does
 * not use the browser's global readiness promise: it never rejects when an
 * install is stuck, which left the iOS notification action waiting forever.
 */
export function ensureMawqifiServiceWorker(): Promise<ServiceWorkerRegistration> {
  // Native Capacitor Push uses APNs device tokens. A browser worker would
  // compete with that path and can leave stale PWA shell state in the WebView.
  if (isNativeCapacitor()) {
    return Promise.reject(new MawqifiServiceWorkerError('unsupported'));
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.reject(new MawqifiServiceWorkerError('unsupported'));
  }

  if (!registrationPromise) {
    registrationPromise = registerOrRepairRootWorker().catch((error: unknown) => {
      registrationPromise = null;
      throw error;
    });
  }

  return registrationPromise;
}

export async function getMawqifiServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (isNativeCapacitor()) return undefined;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  return findRootRegistration();
}
