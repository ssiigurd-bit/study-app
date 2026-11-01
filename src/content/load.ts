// Leser alle emner fra content/courses/<emne>/. Et nytt emne er bare en ny mappe.
import { parse as parseYaml } from 'yaml';
import { Course, Topic, type CourseSpec, type IntroSpec, type ItemSpec, type TopicSpec } from './schema';

export type LoadedItem = ItemSpec & {
  /** Globalt unik nøkkel: «emne:oppgave». Brukes i lagringen. */
  key: string;
  courseId: string;
  topicId: string;
  /** Plass i temaets fil – rekkefølgen nytt stoff introduseres i. */
  index: number;
};

export type LoadedTopic = Omit<TopicSpec, 'items'> & {
  courseId: string;
  delemneId: string;
  items: LoadedItem[];
  /** Introkort gruppert etter hvilken oppgave de skal vises før. */
  introBefore: Map<string, IntroSpec[]>;
};

export interface LoadedCourse {
  spec: CourseSpec;
  delemner: { id: string; title: string; topics: LoadedTopic[] }[];
  topics: LoadedTopic[];
  topicById: Map<string, LoadedTopic>;
  itemByKey: Map<string, LoadedItem>;
}

export class ContentError extends Error {}

function formatZodError(file: string, err: { issues: { path: (string | number)[]; message: string }[] }) {
  return `${file}:\n` + err.issues.map((i) => `  • ${i.path.join('.') || '(rot)'}: ${i.message}`).join('\n');
}

/** files: filsti → YAML-tekst. Stien må inneholde «/courses/<emne>/». */
export function buildCourses(files: Record<string, string>): LoadedCourse[] {
  const byCourse = new Map<string, { course?: [string, string]; topics: [string, string][] }>();
  for (const [path, text] of Object.entries(files)) {
    const m = /\/courses\/([^/]+)\/(.+)$/.exec(path);
    if (!m) continue;
    const entry = byCourse.get(m[1]) ?? { topics: [] };
    if (m[2] === 'course.yaml') entry.course = [path, text];
    else entry.topics.push([path, text]);
    byCourse.set(m[1], entry);
  }

  const courses: LoadedCourse[] = [];
  for (const [folder, entry] of [...byCourse.entries()].sort()) {
    if (!entry.course) throw new ContentError(`Emnemappen «${folder}» mangler course.yaml`);
    const [cPath, cText] = entry.course;
    const cParsed = Course.safeParse(parseYaml(cText));
    if (!cParsed.success) throw new ContentError(formatZodError(cPath, cParsed.error));
    const spec = cParsed.data;

    const topicSpecs = new Map<string, TopicSpec>();
    for (const [path, text] of entry.topics) {
      const parsed = Topic.safeParse(parseYaml(text));
      if (!parsed.success) throw new ContentError(formatZodError(path, parsed.error));
      if (topicSpecs.has(parsed.data.id)) throw new ContentError(`${path}: temaet «${parsed.data.id}» finnes fra før`);
      topicSpecs.set(parsed.data.id, parsed.data);
    }

    const itemByKey = new Map<string, LoadedItem>();
    const topicById = new Map<string, LoadedTopic>();
    const delemner: LoadedCourse['delemner'] = [];
    const topics: LoadedTopic[] = [];

    for (const d of spec.delemner) {
      const dTopics: LoadedTopic[] = [];
      for (const tid of d.topics) {
        const t = topicSpecs.get(tid);
        if (!t) throw new ContentError(`${cPath}: delemnet «${d.id}» viser til temaet «${tid}», som ikke finnes`);
        if (topicById.has(tid)) throw new ContentError(`${cPath}: temaet «${tid}» står i flere delemner`);
        const items: LoadedItem[] = t.items.map((it, index) => {
          const key = `${spec.id}:${it.id}`;
          if (itemByKey.has(key)) throw new ContentError(`Oppgave-id «${it.id}» brukes flere ganger i emnet ${spec.id}`);
          const li = { ...it, key, courseId: spec.id, topicId: t.id, index } as LoadedItem;
          itemByKey.set(key, li);
          return li;
        });
        const introBefore = new Map<string, IntroSpec[]>();
        for (const intro of t.intro) {
          const target = intro.before ?? t.items[0].id;
          if (!t.items.some((i) => i.id === target)) {
            throw new ContentError(`Introkortet «${intro.id}» i «${t.id}» viser til oppgaven «${target}», som ikke finnes i temaet`);
          }
          introBefore.set(target, [...(introBefore.get(target) ?? []), intro]);
        }
        const lt: LoadedTopic = { ...t, courseId: spec.id, delemneId: d.id, items, introBefore };
        topicById.set(tid, lt);
        dTopics.push(lt);
        topics.push(lt);
      }
      delemner.push({ id: d.id, title: d.title, topics: dTopics });
    }

    for (const t of topicSpecs.values()) {
      if (!topicById.has(t.id)) throw new ContentError(`Temaet «${t.id}» er ikke lagt inn i noe delemne i ${cPath}`);
      for (const p of t.prerequisites) {
        if (!topicSpecs.has(p)) throw new ContentError(`Temaet «${t.id}» har forkunnskapen «${p}», som ikke finnes`);
      }
    }

    courses.push({ spec, delemner, topics, topicById, itemByKey });
  }
  return courses;
}

const rawFiles = import.meta.glob('/content/courses/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const courses: LoadedCourse[] = buildCourses(rawFiles);

export function getCourse(id: string | undefined): LoadedCourse {
  return courses.find((c) => c.spec.id === id) ?? courses[0];
}
