// Skjema for innholdsfilene (YAML). Feil i en fil gir en tydelig melding ved bygg og i testene.
import { z } from 'zod';

const NumOrExpr = z.union([z.number(), z.string()]);
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'Id kan bare inneholde små bokstaver a–z, tall og bindestrek');

const VarSpec = z.union([
  z.object({ min: z.number(), max: z.number(), step: z.number().positive() }).strict(),
  z.object({ choices: z.array(z.number()).min(1) }).strict(),
]);

const Tolerance = z
  .object({
    abs: NumOrExpr.optional(),
    rel: z.number().min(0).optional(),
  })
  .strict();

const BalanceFigure = z
  .object({
    kind: z.literal('balance'),
    title: z.string().optional(),
    assets: z.array(z.object({ label: z.string(), value: NumOrExpr }).strict()).min(1),
    claims: z
      .array(z.object({ label: z.string(), value: NumOrExpr, type: z.enum(['ek', 'gjeld']) }).strict())
      .min(1),
  })
  .strict();

const TimelineFigure = z
  .object({
    kind: z.literal('timeline'),
    title: z.string().optional(),
    flows: z.union([z.array(z.number()), z.string()]),
    /** Rente som desimaltall, vises som «r = 7 %». */
    rate: NumOrExpr.optional(),
  })
  .strict();

const CvpFigure = z
  .object({
    kind: z.literal('cvp'),
    title: z.string().optional(),
    price: NumOrExpr,
    vc: NumOrExpr,
    fc: NumOrExpr,
    /** Budsjettert mengde (valgfritt) – viser sikkerhetsmarginen. */
    volume: NumOrExpr.optional(),
  })
  .strict();

export const Figure = z.discriminatedUnion('kind', [BalanceFigure, TimelineFigure, CvpFigure]);

const Base = {
  id: Id,
  skillLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  verified: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  figure: Figure.optional(),
  /** Vis figuren sammen med oppgaven, eller først i tilbakemeldingen. */
  figureShow: z.enum(['prompt', 'feedback']).default('feedback'),
  // Tilfeldige tall: brukes av alle oppgavetyper unntatt flashcards.
  vars: z.record(VarSpec).default({}),
  derived: z.record(z.string()).default({}),
  constraints: z.array(z.string()).default([]),
};

const Flashcard = z
  .object({ ...Base, type: z.literal('flashcard'), front: z.string(), back: z.string() })
  .strict();

const Mcq = z
  .object({
    ...Base,
    type: z.literal('mcq'),
    prompt: z.string(),
    options: z
      .array(
        z
          .object({
            text: z.string(),
            /** true/false, eller en formel som gir 1 (riktig) eller 0. */
            correct: z.union([z.boolean(), z.string()]).default(false),
            feedback: z.string().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(6),
    explanation: z.string().optional(),
  })
  .strict();

const Numeric = z
  .object({
    ...Base,
    type: z.literal('numeric'),
    prompt: z.string(),
    answer: z
      .object({
        expr: NumOrExpr,
        unit: z.string().optional(),
        decimals: z.number().int().min(0).max(6).default(0),
      })
      .strict(),
    tolerance: Tolerance.optional(),
    steps: z.array(z.string()).default([]),
    explanation: z.string().optional(),
    misconceptions: z.array(z.object({ expr: z.string(), feedback: z.string() }).strict()).default([]),
  })
  .strict();

const TrueFalse = z
  .object({
    ...Base,
    type: z.literal('truefalse'),
    statement: z.string(),
    answer: z.union([z.boolean(), z.string()]),
    explanation: z.string(),
  })
  .strict();

export const Item = z.discriminatedUnion('type', [Flashcard, Mcq, Numeric, TrueFalse]);

export const IntroCard = z
  .object({
    id: Id,
    title: z.string(),
    body: z.string(),
    figure: Figure.optional(),
    /** Vis kortet rett før denne oppgaven første gang. Uten: før temaets første oppgave. */
    before: Id.optional(),
  })
  .strict();

export const Topic = z
  .object({
    id: Id,
    title: z.string(),
    summary: z.string().optional(),
    prerequisites: z.array(Id).default([]),
    intro: z.array(IntroCard).default([]),
    items: z.array(Item).min(1),
  })
  .strict();

export const Course = z
  .object({
    id: Id,
    code: z.string(),
    title: z.string(),
    description: z.string().optional(),
    delemner: z
      .array(
        z
          .object({
            id: Id,
            title: z.string(),
            topics: z.array(Id),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type FigureSpec = z.infer<typeof Figure>;
export type ItemSpec = z.infer<typeof Item>;
export type IntroSpec = z.infer<typeof IntroCard>;
export type TopicSpec = z.infer<typeof Topic>;
export type CourseSpec = z.infer<typeof Course>;
