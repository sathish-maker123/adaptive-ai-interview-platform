import {db,cors,json,userFrom,askAI} from "../_shared/ai.ts";
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{const user=await userFrom(req);const b=await req.json();if(!["technical","behavioural"].includes(b.interview_type)||![5,10,15].includes(b.total_questions)||!b.job_role) return json({error:"Invalid interview configuration"},400);
const client=db();const {data:session,error}=await client.from("interview_sessions").insert({candidate_id:user.id,job_role:b.job_role,interview_type:b.interview_type,difficulty:b.difficulty,experience_level:b.experience_level,total_questions:b.total_questions,status:"in_progress"}).select().single();if(error)throw error;
const q=await askAI("Generate exactly one relevant first mock-interview question. Return JSON {question:string}. Do not include commentary.",{role:b.job_role,type:b.interview_type,difficulty:b.difficulty,experience:b.experience_level});
if(typeof q.question!=="string"||!q.question.trim())throw new Error("AI returned an invalid question");
const {error:qe}=await client.from("interview_questions").insert({session_id:session.id,question_text:q.question,question_type:b.interview_type,question_order:1,is_follow_up:false});if(qe)throw qe;return json({session,question:q.question});
}catch(e){return json({error:e instanceof Error?e.message:"Unexpected error"},400)}});
