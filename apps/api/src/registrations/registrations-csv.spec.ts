import {
  contentDisposition,
  type CsvRegistration,
  REGISTRATIONS_CSV_HEADER,
  toRegistrationsCsv,
} from './registrations-csv.js';

const BOM = String.fromCharCode(0xfeff);
const CRLF = '\r\n';

const event = { title: 'Nuit du jazz', startsAt: new Date('2026-12-05T19:00:00.000Z') };

function registration(
  user: Partial<CsvRegistration['user']>,
  createdAt = '2026-11-20T09:15:00.000Z',
): CsvRegistration {
  return {
    createdAt: new Date(createdAt),
    user: { lastName: 'Dupont', firstName: 'Léa', email: 'lea@test.dev', ...user },
  };
}

/** Lignes du fichier, sans le BOM ni la fin de ligne finale. */
function lines(content: string): string[] {
  return content.slice(BOM.length).split(CRLF).slice(0, -1);
}

describe('toRegistrationsCsv', () => {
  it("commence par le BOM UTF-8 et la ligne d'en-tête séparée par des ;", () => {
    const { content } = toRegistrationsCsv(event, [registration({})]);
    expect(content.startsWith(BOM)).toBe(true);
    expect(REGISTRATIONS_CSV_HEADER).toBe("Nom;Prénom;Email;Date d'inscription");
    expect(lines(content)[0]).toBe(REGISTRATIONS_CSV_HEADER);
  });

  it('termine chaque ligne par CRLF, y compris la dernière', () => {
    const { content } = toRegistrationsCsv(event, [registration({})]);
    expect(content.endsWith(CRLF)).toBe(true);
    expect(content.replaceAll(CRLF, '')).not.toMatch(/[\r\n]/);
  });

  it("écrit nom, prénom, email et date d'inscription en JJ/MM/AAAA HH:mm, heure de Paris", () => {
    const { content } = toRegistrationsCsv(event, [
      registration({}, '2026-11-20T09:15:00.000Z'), // hiver : UTC+1
      registration({ lastName: 'Martin', email: 'm@test.dev' }, '2026-07-01T22:05:00.000Z'), // été : UTC+2, jour suivant
    ]);
    expect(lines(content).slice(1)).toEqual([
      'Martin;Léa;m@test.dev;02/07/2026 00:05',
      'Dupont;Léa;lea@test.dev;20/11/2026 10:15',
    ]);
  });

  it("trie les inscrits par date d'inscription, la plus ancienne d'abord", () => {
    const { content } = toRegistrationsCsv(event, [
      registration({ lastName: 'C' }, '2026-11-03T10:00:00.000Z'),
      registration({ lastName: 'A' }, '2026-11-01T10:00:00.000Z'),
      registration({ lastName: 'B' }, '2026-11-02T10:00:00.000Z'),
    ]);
    expect(
      lines(content)
        .slice(1)
        .map((line) => line.split(';')[0]),
    ).toEqual(['A', 'B', 'C']);
  });

  it('garde les accents tels quels', () => {
    const { content } = toRegistrationsCsv(event, [
      registration({ lastName: 'Lefèvre-Çelik', firstName: 'Éloïse Noël', email: 'é@test.dev' }),
    ]);
    expect(lines(content)[1]).toBe('Lefèvre-Çelik;Éloïse Noël;é@test.dev;20/11/2026 10:15');
  });

  it('met entre guillemets une valeur qui contient ; " ou un saut de ligne, et double les guillemets', () => {
    const { content } = toRegistrationsCsv(event, [
      registration({ lastName: 'O"Neil; Jr', firstName: 'Jean\nPaul' }),
    ]);
    expect(content).toContain(`"O""Neil; Jr";"Jean\nPaul";lea@test.dev;`);
  });

  it.each([
    ['=', '=HYPERLINK("http://pirate.test")', `"'=HYPERLINK(""http://pirate.test"")"`],
    ['+', '+33612345678', "'+33612345678"],
    ['-', '-2+3', "'-2+3"],
    ['@', '@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['une tabulation', '\t=1+1', "'\t=1+1"],
    ['un retour chariot', '\r=1+1', `"'\r=1+1"`],
  ])(
    "neutralise une formule qui commence par %s en la préfixant d'une apostrophe",
    (_, value, cell) => {
      const { content } = toRegistrationsCsv(event, [registration({ firstName: value })]);
      expect(content).toContain(`${BOM}${REGISTRATIONS_CSV_HEADER}${CRLF}Dupont;${cell};`);
    },
  );

  it("ne touche pas une valeur qui contient ces caractères ailleurs qu'en tête", () => {
    const { content } = toRegistrationsCsv(event, [
      registration({ lastName: 'Saint-Exupéry', email: 'a+b@test.dev' }),
    ]);
    expect(lines(content)[1]).toBe('Saint-Exupéry;Léa;a+b@test.dev;20/11/2026 10:15');
  });

  it("renvoie seulement la ligne d'en-tête pour un événement sans inscrit", () => {
    const { content } = toRegistrationsCsv(event, []);
    expect(content).toBe(`${BOM}${REGISTRATIONS_CSV_HEADER}${CRLF}`);
  });

  describe('nom du fichier', () => {
    const festival = {
      title: 'Fête de la musique : édition 2026 !',
      startsAt: new Date('2026-06-21T16:00:00.000Z'),
    };

    it("vaut inscrits-<titre-en-slug>-<AAAA-MM-JJ de l'événement>.csv, accents gardés", () => {
      expect(toRegistrationsCsv(festival, []).filename).toBe(
        'inscrits-fête-de-la-musique-édition-2026-2026-06-21.csv',
      );
    });

    it('a une variante ASCII sans accents', () => {
      expect(toRegistrationsCsv(festival, []).asciiFilename).toBe(
        'inscrits-fete-de-la-musique-edition-2026-2026-06-21.csv',
      );
      expect(toRegistrationsCsv({ ...festival, title: 'Cœur & Âme' }, []).asciiFilename).toBe(
        'inscrits-coeur-ame-2026-06-21.csv',
      );
    });

    it("prend la date de l'événement à l'heure de Paris", () => {
      const nye = { title: 'Réveillon', startsAt: new Date('2026-12-31T23:30:00.000Z') };
      expect(toRegistrationsCsv(nye, []).filename).toBe('inscrits-réveillon-2027-01-01.csv');
    });

    it('se replie sur « evenement » si le titre ne contient ni lettre ni chiffre', () => {
      const { filename, asciiFilename } = toRegistrationsCsv({ ...festival, title: '★ !!! ★' }, []);
      expect(filename).toBe('inscrits-evenement-2026-06-21.csv');
      expect(asciiFilename).toBe('inscrits-evenement-2026-06-21.csv');
    });

    it('donne un Content-Disposition avec filename (ASCII) et filename* (UTF-8)', () => {
      expect(contentDisposition(toRegistrationsCsv(festival, []))).toBe(
        'attachment; filename="inscrits-fete-de-la-musique-edition-2026-2026-06-21.csv"; ' +
          "filename*=UTF-8''inscrits-f%C3%AAte-de-la-musique-%C3%A9dition-2026-2026-06-21.csv",
      );
    });
  });
});
