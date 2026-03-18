/**
 * Google Calendar Client — OAuth2 + Calendar Events + Google Meet.
 *
 * Uses googleapis SDK. Each reclutador connects their own Google account.
 * Tokens stored per-user in google_tokens table.
 */

import { google, calendar_v3 } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  ?? `${process.env.NEXTAUTH_URL || process.env.APP_URL || ''}/api/auth/google/callback`;

export function crearClienteOAuth(accessToken: string, refreshToken?: string) {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return oauth2;
}

export function getAuthUrl(state: string): string {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
  });
}

export async function intercambiarCodigo(code: string) {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const userInfo = await oauth2Api.userinfo.get();

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
    email: userInfo.data.email ?? null,
    name: userInfo.data.name ?? null,
  };
}

export async function crearEventoCalendar(params: {
  accessToken: string;
  refreshToken?: string;
  titulo: string;
  descripcion?: string;
  fechaInicio: Date;
  fechaFin: Date;
  invitados: string[];
  zonaHoraria?: string;
  generarMeet?: boolean;
}): Promise<{ eventId: string; htmlLink: string; hangoutLink?: string }> {
  const auth = crearClienteOAuth(params.accessToken, params.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const event: calendar_v3.Schema$Event = {
    summary: params.titulo,
    description: params.descripcion,
    start: { dateTime: params.fechaInicio.toISOString(), timeZone: params.zonaHoraria ?? 'America/Bogota' },
    end: { dateTime: params.fechaFin.toISOString(), timeZone: params.zonaHoraria ?? 'America/Bogota' },
    attendees: params.invitados.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 1440 },
      ],
    },
  };

  if (params.generarMeet !== false) {
    event.conferenceData = {
      createRequest: {
        requestId: `hirely-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: params.generarMeet !== false ? 1 : 0,
    sendUpdates: 'all',
  });

  return {
    eventId: response.data.id!,
    htmlLink: response.data.htmlLink!,
    hangoutLink: response.data.hangoutLink ?? undefined,
  };
}

export async function actualizarEventoCalendar(params: {
  accessToken: string;
  refreshToken?: string;
  eventId: string;
  titulo?: string;
  descripcion?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  invitados?: string[];
}): Promise<void> {
  const auth = crearClienteOAuth(params.accessToken, params.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const patch: calendar_v3.Schema$Event = {};
  if (params.titulo) patch.summary = params.titulo;
  if (params.descripcion) patch.description = params.descripcion;
  if (params.fechaInicio) patch.start = { dateTime: params.fechaInicio.toISOString(), timeZone: 'America/Bogota' };
  if (params.fechaFin) patch.end = { dateTime: params.fechaFin.toISOString(), timeZone: 'America/Bogota' };
  if (params.invitados) patch.attendees = params.invitados.map(email => ({ email }));

  await calendar.events.patch({
    calendarId: 'primary',
    eventId: params.eventId,
    requestBody: patch,
    sendUpdates: 'all',
  });
}

export async function cancelarEventoCalendar(params: {
  accessToken: string;
  refreshToken?: string;
  eventId: string;
}): Promise<void> {
  const auth = crearClienteOAuth(params.accessToken, params.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: params.eventId,
    sendUpdates: 'all',
  });
}

export async function refrescarToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2.refreshAccessToken();
  return {
    accessToken: credentials.access_token!,
    expiresAt: new Date(credentials.expiry_date!),
  };
}
