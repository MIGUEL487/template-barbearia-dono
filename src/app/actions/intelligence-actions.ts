'use server';
import {loadIntelligence} from '@/lib/saas2/source';
export async function analyticsAction(filter:unknown){try{const {current,previous,source,generatedAt}=await loadIntelligence(filter);return {ok:true as const,current,previous,barbers:source.barbers,generatedAt}}catch(error){console.error('[Análises]',error instanceof Error?error.message:'Erro');return {ok:false as const,error:error instanceof Error?error.message:'Não foi possível consultar as análises.'}}}
