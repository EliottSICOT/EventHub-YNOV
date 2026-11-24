import { buildConfirmationEmail, type ConfirmationEmailData } from './confirmation-email.js';

const data: ConfirmationEmailData = {
  user: { email: 'lea@test.dev', firstName: 'Léa', lastName: 'Dupont' },
  event: {
    title: 'Nuit du jazz',
    startsAt: new Date('2026-12-05T19:00:00.000Z'),
    venue: 'Le Transbordeur',
    address: '3 boulevard de Stalingrad',
    city: 'Lyon',
  },
  frontUrl: 'http://localhost:5173',
};

describe('buildConfirmationEmail', () => {
  it("s'adresse au participant, avec le titre de l'événement en objet", () => {
    const mail = buildConfirmationEmail(data);
    expect(mail.to).toEqual({ name: 'Léa Dupont', address: 'lea@test.dev' });
    expect(mail.subject).toBe('Inscription confirmée : Nuit du jazz');
  });

  it.each(['text', 'html'] as const)(
    "contient le titre, la date à l'heure de Paris, le lieu et le lien (%s)",
    (format) => {
      const body = buildConfirmationEmail(data)[format];
      expect(body).toContain('Nuit du jazz');
      expect(body).toMatch(/samedi 5 décembre 2026.*20:00/);
      expect(body).toContain('Le Transbordeur, 3 boulevard de Stalingrad, Lyon');
      expect(body).toContain('http://localhost:5173/me/registrations');
    },
  );

  it("omet l'adresse absente et la barre oblique finale de l'URL du Front", () => {
    const { text } = buildConfirmationEmail({
      ...data,
      event: { ...data.event, address: null },
      frontUrl: 'https://eventhub.test/',
    });
    expect(text).toContain('Lieu : Le Transbordeur, Lyon');
    expect(text).toContain(' https://eventhub.test/me/registrations');
  });

  it('échappe le contenu saisi par les utilisateurs dans le HTML', () => {
    const { html } = buildConfirmationEmail({
      ...data,
      user: { ...data.user, firstName: '<b>Léa</b>' },
      event: { ...data.event, title: '<script>alert("x")</script> & co' },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
  });
});
