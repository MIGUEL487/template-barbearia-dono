import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

/**
 * Remove qualquer caractere estranho ou mojibake (dupla codificação UTF-8/Latin1)
 * transformando em texto limpo em português.
 */
export function fixMojibake(text: string | null | undefined): string {
  if (!text) return "";
  let clean = text;

  try {
    if (/[\xC2\xC3]/.test(clean)) {
      clean = decodeURIComponent(escape(clean));
    }
  } catch {
    // continua
  }

  return clean
    .replace(/Ã§/g, "ç")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ã£/g, "ã")
    .replace(/Ãƒ/g, "Ã")
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "Á")
    .replace(/Ã©/g, "é")
    .replace(/Ã‰/g, "É")
    .replace(/Ãª/g, "ê")
    .replace(/ÃŠ/g, "Ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã /g, "Í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã•/g, "Õ")
    .replace(/Ã´/g, "ô")
    .replace(/Ã”/g, "Ô")
    .replace(/Ãº/g, "ú")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã /g, "à")
    .replace(/Ã€/g, "À")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€˜/g, "'")
    .replace(/â€™/g, "'")
    .replace(/Â/g, "")
    .replace(/ǭ/g, "á")
    .replace(/ǜ/g, "ã")
    .replace(/Ǧ/g, "ê")
    .replace(/Ǹ/g, "é")
    .replace(/ǽ/g, "â");
}

/**
 * Formata um objeto Date para YYYY-MM-DD local sem sofrer desvio de fuso horário UTC
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
