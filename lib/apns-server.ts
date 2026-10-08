import 'server-only';

import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';
import type { PushNotificationPayload } from '@/lib/push-server';

type ApnsConfiguration = {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
  host: string;
};

export type ApnsDeliveryResult = { accepted: boolean; stale: boolean; status: number; reason?: string };

let cachedProviderToken: { value: string; issuedAt: number; fingerprint: string } | null = null;

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

export function getApnsConfiguration(): ApnsConfiguration | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const configured = [keyId, teamId, privateKey].filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== 3) throw new Error('APNs server configuration is incomplete.');

  const environment = process.env.APNS_ENVIRONMENT?.trim() || 'production';
  if (environment !== 'production' && environment !== 'sandbox') {
    throw new Error('APNS_ENVIRONMENT must be production or sandbox.');
  }
  const topic = process.env.APNS_TOPIC?.trim() || 'com.mawqifi.app';
  if (topic !== 'com.mawqifi.app') throw new Error('Unexpected APNs topic.');

  return {
    keyId: keyId!,
    teamId: teamId!,
    privateKey: privateKey!,
    topic,
    host: environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com',
  };
}

function providerToken(configuration: ApnsConfiguration): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const fingerprint = `${configuration.teamId}:${configuration.keyId}`;
  if (cachedProviderToken && cachedProviderToken.fingerprint === fingerprint && issuedAt - cachedProviderToken.issuedAt < 50 * 60) {
    return cachedProviderToken.value;
  }

  const header = encode(JSON.stringify({ alg: 'ES256', kid: configuration.keyId }));
  const claims = encode(JSON.stringify({ iss: configuration.teamId, iat: issuedAt }));
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(configuration.privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  const value = `${unsigned}.${encode(signature)}`;
  cachedProviderToken = { value, issuedAt, fingerprint };
  return value;
}

function apnsPayload(payload: PushNotificationPayload): string {
  return JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
    },
    url: payload.url,
    type: payload.type,
    postId: payload.postId,
    chatId: payload.chatId,
    messageId: payload.messageId,
  });
}

export async function sendApnsNotification(
  configuration: ApnsConfiguration,
  deviceToken: string,
  payload: PushNotificationPayload,
): Promise<ApnsDeliveryResult> {
  return await new Promise<ApnsDeliveryResult>((resolve, reject) => {
    const client = connect(configuration.host);
    let settled = false;
    const finish = (result?: ApnsDeliveryResult, error?: Error) => {
      if (settled) return;
      settled = true;
      client.close();
      if (error) reject(error);
      else resolve(result!);
    };
    client.setTimeout(15_000, () => finish(undefined, new Error('APNs request timed out.')));
    client.once('error', (error) => finish(undefined, error));

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${encodeURIComponent(deviceToken)}`,
      authorization: `bearer ${providerToken(configuration)}`,
      'apns-topic': configuration.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    const chunks: Buffer[] = [];
    let status = 0;
    request.on('response', (headers) => { status = Number(headers[':status'] ?? 0); });
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', (error) => finish(undefined, error));
    request.on('end', () => {
      let reason: string | undefined;
      try { reason = JSON.parse(Buffer.concat(chunks).toString()).reason; } catch { /* APNs 200 has no body. */ }
      const stale = status === 410 || reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic' || reason === 'Unregistered';
      finish({ accepted: status === 200, stale, status, reason });
    });
    request.end(apnsPayload(payload));
  });
}
