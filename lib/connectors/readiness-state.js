export function capabilityCheckStatus(previousStatus,capabilities={}) {
 const supported=['inventory','economics','checkout','reconciliation','events'].every(k=>capabilities[k]===true);
 return previousStatus==='ready'&&supported?'ready':'read_only';
}
export function catalogSyncStatus(previousStatus) {
 // Sync is not an exact-cart test and must neither promote nor erase one.
 return previousStatus==='ready'?'ready':'read_only';
}
