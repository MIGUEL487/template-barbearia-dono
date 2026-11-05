import { localDate, shiftDate } from "@/lib/saas2/analytics";
export function cleanQuestion(text: string) {
  return text
    .trim()
    .slice(0, 1000)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[e-mail omitido]")
    .replace(
      /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/g,
      "[contato omitido]",
    );
}
export function questionRange(
  question: string,
  today = localDate(),
  previous?: { start: string; end: string },
) {
  const q = question.toLowerCase();
  let start = today,
    end = today,
    explicit = true;
  const iso = q.match(/\b(20\d{2}-\d{2}-\d{2})\b/),
    br = q.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (iso) start = end = iso[1];
  else if (br) start = end = `${br[3]}-${br[2]}-${br[1]}`;
  else if (/amanh[ãa]/.test(q)) start = end = shiftDate(today, 1);
  else if (/ontem/.test(q)) start = end = shiftDate(today, -1);
  else if (/30 dias/.test(q)) start = shiftDate(today, -29);
  else if (/7 dias/.test(q)) start = shiftDate(today, -6);
  else if (/m[êe]s/.test(q)) start = today.slice(0, 8) + "01";
  else if (/semana/.test(q)) {
    const weekday = new Date(today + "T12:00Z").getUTCDay();
    start = shiftDate(today, -((weekday + 6) % 7));
    if (/semana (passada|anterior)/.test(q)) {
      end = shiftDate(start, -1);
      start = shiftDate(start, -7);
    }
  } else if (!/hoje|dia/.test(q)) {
    explicit = false;
    if (previous) {
      start = previous.start;
      end = previous.end;
    }
  }
  return {
    start,
    end,
    explicit,
    scope: /hor[aá]rio|vaga|agenda/.test(q)
      ? "availability"
      : /despesa|sa[ií]da|caixa|fatur|receita/.test(q)
        ? "finance"
        : /meta/.test(q)
          ? "goal"
          : /retorno|reten|client/.test(q)
            ? "retention"
            : /servi[cç]o|vend/.test(q)
              ? "services"
              : "overview",
  };
}
