'use strict';
// Transparent prototype ML: logistic regression trained locally on SYNTHETIC routine examples.
// Labels indicate a need for a caregiver follow-up in fictional scenarios, NOT medical harm.
const examples=[];
for(let hour of [7,9,12,15,19,21])for(let ratio of [0,0.25,0.5,0.75,1])for(let recent of [0,1]){
 const x=[1,ratio, hour>=19?1:0, recent];
 const score=-2.1+3*ratio+0.7*x[2]+0.55*recent;
 examples.push({x,y:score>0?1:0});
}
function train(){let w=[0,0,0,0];const lr=0.22;for(let epoch=0;epoch<1800;epoch++){let g=[0,0,0,0];for(const e of examples){const z=w.reduce((s,v,i)=>s+v*e.x[i],0),pred=1/(1+Math.exp(-z));g=g.map((v,i)=>v+(pred-e.y)*e.x[i]/examples.length)} w=w.map((v,i)=>v-lr*g[i])}return w}
const weights=train();
function predict({time='09:00',taken=0,missed=0,recentMiss=false}){const h=Number(time.slice(0,2)),ratio=(taken+missed)?missed/(taken+missed):0;const x=[1,ratio,h>=19?1:0,recentMiss?1:0];const p=1/(1+Math.exp(-weights.reduce((s,v,i)=>s+v*x[i],0)));
return {riskScore:Math.round(p*100),label:p>=0.6?'FOLLOW-UP SUGGESTED':p>=0.35?'CHECK ROUTINE':'LOW DEMO SIGNAL',features:{recordedMissRate:Math.round(ratio*100),eveningTime:h>=19,recentMiss},training:'Synthetic scenarios only; not clinically validated',meaning:'Likelihood of fictional follow-up label, not medication adherence probability or clinical risk'};
}
module.exports={predict,trainingExamples:examples.length};
