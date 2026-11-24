import type { Mail } from '../mail/mail.service.js';

export interface ConfirmationEmailData {
  user: { email: string; firstName: string; lastName: string };
  event: { title: string; startsAt: Date; venue: string; address: string | null; city: string };
  frontUrl: string;
}

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Titres, lieux et prénoms sont saisis par des utilisateurs : on les échappe dans le HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/** Compose l'e-mail de confirmation d'inscription (US11), en texte et en HTML. */
export function buildConfirmationEmail({ user, event, frontUrl }: ConfirmationEmailData): Mail {
  const date = dateTime.format(event.startsAt);
  const place = [event.venue, event.address, event.city].filter(Boolean).join(', ');
  const link = `${frontUrl.replace(/\/+$/, '')}/me/registrations`;

  return {
    to: { name: `${user.firstName} ${user.lastName}`, address: user.email },
    subject: `Inscription confirmée : ${event.title}`,
    text: [
      `Bonjour ${user.firstName},`,
      '',
      'Votre inscription est confirmée.',
      '',
      `Événement : ${event.title}`,
      `Date : ${date} (heure de Paris)`,
      `Lieu : ${place}`,
      '',
      `Voir ou annuler mes inscriptions : ${link}`,
      '',
      "L'équipe EventHub",
    ].join('\n'),
    html: `<!doctype html>
<html lang="fr">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1b1b2f">
    <p>Bonjour ${escapeHtml(user.firstName)},</p>
    <p>Votre inscription est confirmée.</p>
    <p>
      <strong>${escapeHtml(event.title)}</strong><br />
      ${escapeHtml(date)} (heure de Paris)<br />
      ${escapeHtml(place)}
    </p>
    <p><a href="${escapeHtml(link)}">Voir ou annuler mes inscriptions</a></p>
    <p>L'équipe EventHub</p>
  </body>
</html>
`,
  };
}
