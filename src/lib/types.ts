export type InterviewType="technical"|"behavioural";
export type Dimension="relevance"|"star_structure"|"specificity"|"evidence"|"technical_correctness"|"filler_hedging";
export type Evaluation={scores:Record<Dimension,number|null>;applicable_dimensions:Dimension[];strengths:string[];weaknesses:string[];suggestions:string[];follow_up_question:string|null;overall_score:number};
export const dimensions: {key:Dimension;label:string}[]=[
 {key:"relevance",label:"Relevance"},{key:"star_structure",label:"STAR structure"},{key:"specificity",label:"Specificity"},{key:"evidence",label:"Evidence"},{key:"technical_correctness",label:"Technical correctness"},{key:"filler_hedging",label:"Filler & hedging"}];