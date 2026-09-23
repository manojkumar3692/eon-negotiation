import {z} from 'zod';
const money=z.number().int().min(0).max(100000000);
export const concessionNames={price:'Price discount',shipping:'Free shipping',sample:'Free sample / bundle',quantity:'Quantity discount',prepaid:'Prepaid terms',credit:'Store credit',approved_terms:'Other approved terms'};
export const surfaceNames={product:'Product page',chat:'Chat negotiator',cart:'Cart',exit_intent:'Exit intent',recovery_link:'Recovery link',dedicated_page:'Dedicated offer page',api:'API only'};
export function defaultConversion(){return {
 paymentFees:{prepaid:null,partial_cod:null,cod:null},audience:'testers',step:0,strategy:'balanced',shipping:{mode:'connector',costMinor:null,chargeMinor:0,thresholdMinor:0},
 concessions:{price:true,shipping:false,sample:false,quantity:false,prepaid:false,credit:false,approved_terms:false},
 sampleCostMinor:0,creditMinor:0,approvedTerm:{id:'',costMinor:0},minContributionMinor:0,maxQuantity:5,
 triggers:{match:'visits_and_dwell',enabled:true,minVisits:3,minDwellSeconds:120,minCartMinor:50000,lowStock:2,excludeNewLaunch:true,cooldownHours:24,checkoutHesitation:true,returningCustomer:true,recovery:true,campaign:''},
 surfaces:{product:true,chat:false,cart:false,exit_intent:false,recovery_link:false,dedicated_page:true,api:false},
 products:[],recovery:{enabled:false,channel:'email',delayHours:24,expiryHours:24,frequencyDays:7,consentRequired:true},
 experiment:{treatmentBps:1000,minOrders:100},conversation:{tone:'helpful',welcome:'Still deciding? Let’s see what we can offer.',numericFallback:true}
};}
export const conversionSchema=z.object({
 paymentFees:z.object({prepaid:money.nullable(),partial_cod:money.nullable(),cod:money.nullable()}).strict().default({prepaid:null,partial_cod:null,cod:null}),
 audience:z.enum(['testers','customers']).default('testers'),step:z.number().int().min(0).max(7),strategy:z.enum(['protect_margin','balanced','maximize_conversion','clear_inventory']),
 shipping:z.object({mode:z.enum(['connector','free','flat','threshold']),costMinor:money.nullable(),chargeMinor:money,thresholdMinor:money}).strict(),
 concessions:z.object(Object.fromEntries(Object.keys(concessionNames).map(k=>[k,z.boolean()]))).strict(),
 sampleCostMinor:money,creditMinor:money,approvedTerm:z.object({id:z.string().max(100),costMinor:money}).strict(),minContributionMinor:money,maxQuantity:z.number().int().min(1).max(20),
 triggers:z.object({match:z.enum(['any','visits_and_dwell']).default('visits_and_dwell'),enabled:z.boolean(),minVisits:z.number().int().min(2).max(100),minDwellSeconds:z.number().int().min(30).max(3600),minCartMinor:money,lowStock:z.number().int().min(0).max(10000),excludeNewLaunch:z.boolean(),cooldownHours:z.number().int().min(1).max(720),checkoutHesitation:z.boolean(),returningCustomer:z.boolean(),recovery:z.boolean(),campaign:z.string().max(100)}).strict(),
 surfaces:z.object(Object.fromEntries(Object.keys(surfaceNames).map(k=>[k,z.boolean()]))).strict(),
 products:z.array(z.object({id:z.string().uuid(),enabled:z.boolean(),targetMinor:money,floorMinor:money,costMinor:money.nullable(),newLaunch:z.boolean()}).strict()).max(500),
 recovery:z.object({enabled:z.boolean(),channel:z.enum(['email','whatsapp']),delayHours:z.number().int().min(1).max(168),expiryHours:z.number().int().min(1).max(24),frequencyDays:z.number().int().min(1).max(90),consentRequired:z.literal(true)}).strict(),
 experiment:z.object({treatmentBps:z.number().int().min(100).max(9000),minOrders:z.number().int().min(30).max(100000)}).strict(),
 conversation:z.object({tone:z.enum(['helpful','concise','premium']),welcome:z.string().trim().min(5).max(200),numericFallback:z.literal(true)}).strict()
}).strict().superRefine((v,ctx)=>{
 if(new Set(v.products.map(p=>p.id)).size!==v.products.length)ctx.addIssue({code:'custom',message:'A product may appear only once.'});
 for(const p of v.products)if(p.enabled&&(p.floorMinor<=0||p.targetMinor<p.floorMinor))ctx.addIssue({code:'custom',message:'Enabled products need a positive minimum below the preferred price.'});
 if(v.concessions.approved_terms&&!v.approvedTerm.id.trim())ctx.addIssue({code:'custom',message:'Describe the approved commercial term.'});
});
export const conversionTestSchema=z.object({productId:z.string().uuid(),message:z.string().trim().min(1).max(1000),scenario:z.enum(['new','returning','cart','hesitation','recovery','launch','out_of_stock']),quantity:z.number().int().min(1).max(20),paymentMethod:z.enum(['prepaid','cod']),shippingCostMinor:money,shippingChargeMinor:money,paymentFeeMinor:money}).strict();
