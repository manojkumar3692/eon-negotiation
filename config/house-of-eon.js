// Fictional sandbox values only. Never import this fixture into live services.
export const houseOfEon = {
  name: 'House of EON', domain: 'houseofeon.in', currency: 'INR', mode: 'sandbox',
  products: [
    {sku:'AW-TEST',name:'Arctic Wave',publicMinor:100000,targetMinor:95000,floorMinor:88000,costMinor:40000,stock:30},
    {sku:'TRIAL-TEST',name:'Trial Pack',publicMinor:30000,targetMinor:29000,floorMinor:27000,costMinor:15000,stock:20}
  ],
  policy: {enabled:true,strategy:'balanced',maxDiscountBps:1200,minContributionMinor:10000,maxQuantity:5,
    allowed:['price','shipping','sample','quantity','prepaid','credit'], sampleCostMinor:1500,creditMinor:1000,
    maxRounds:3,ttlSeconds:900,dailyBudgetMinor:200000},
  trigger: {enabled:true,minVisits:3,minDwellSeconds:120,minCartMinor:50000,lowStock:2,excludeNewLaunch:true},
  live: {approvedPrices:false,verifiedConnector:false,paidOrderVerified:false,consentConfigured:false,experimentConfigured:false}
};
