import {depositBreakdown} from '../src/lib/saas2/money.ts';
import assert from 'node:assert/strict';
for(const [total,pct,deposit] of [[50,50,25],[50,0,0],[50,100,50],[99.99,33.33,33.33],[0.03,50,0.02],[110,50,55],[149.97,25,37.49]]){const result=depositBreakdown(total,pct);assert.equal(result.deposit,deposit);assert.equal(Math.round((result.remaining+result.deposit)*100),Math.round(total*100));}
for(const pct of [-1,101,NaN,Infinity])assert.throws(()=>depositBreakdown(50,pct));
console.log('Money: 7 financial cases + 4 invalid inputs passed');
