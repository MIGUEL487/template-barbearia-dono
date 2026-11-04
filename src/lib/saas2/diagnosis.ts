import type {Analysis} from './analytics';
import {money} from './analytics';
export function diagnose(c:Analysis,p:Analysis,goal:number|null){const lines:string[]=[];
 if(!c.bookings)lines.push('Nenhum agendamento registrado na data selecionada.');
 if(c.pending)lines.push(`${c.pending} pré-reserva(s) válida(s) aguardam confirmação. Sinal solicitado não é pagamento recebido.`);
 if(c.cancelled)lines.push(`${c.cancelled} cancelamento(s) registrado(s) para a data. Confira a fila de espera antes de oferecer um encaixe.`);
 if(c.noShow)lines.push(`${c.noShow} falta(s) registrada(s).`);
 const morning=c.hourly.filter(h=>Number(h.hour.slice(0,2))<12),afternoon=c.hourly.filter(h=>Number(h.hour.slice(0,2))>=12);const ratio=(xs:typeof morning)=>{const minutes=xs.reduce((n,h)=>n+h.minutes,0);return minutes?xs.reduce((n,h)=>n+h.occupied,0)/minutes:null};const m=ratio(morning),a=ratio(afternoon);if(m!==null&&a!==null&&Math.abs(m-a)>.05)lines.push(`A ocupação é maior ${a>m?'à tarde':'pela manhã'} (${Math.round(Math.max(m,a)*100)}% da capacidade desse período).`);
 if(c.freeMinutes)lines.push(`${Math.round(c.freeMinutes)} minutos livres no expediente. A quantidade de inícios disponíveis depende do serviço e é consultada separadamente.`);
 if(c.services[0])lines.push(`Serviço mais realizado: ${c.services[0].name}, com ${c.services[0].count} item(ns) em atendimentos concluídos.`);
 if(p.income)lines.push(`Recebimentos ${c.income>=p.income?'aumentaram':'diminuíram'} ${Math.abs((c.income/p.income-1)*100).toFixed(1)}% frente ao dia anterior.`);else lines.push('O dia anterior não tem recebimentos suficientes para comparação percentual.');
 if(goal!==null&&goal>0)lines.push(`Meta atingida em ${(c.income/goal*100).toFixed(1)}% pelos recebimentos registrados. Faltam ${money(Math.max(0,goal-c.income))}.`);
 if(c.retention.some(r=>r.category==='Retorno atrasado'))lines.push('Há clientes com retorno além do intervalo histórico. Veja a retenção; isso não indica intenção de abandonar a barbearia.');
 return lines;
}
