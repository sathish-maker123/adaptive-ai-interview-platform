import { supabase } from "./supabase";
export async function invoke<T>(name:string,body:unknown):Promise<T>{
 if(!supabase) throw new Error("Supabase is not configured. Copy .env.example to .env and add your project credentials.");
 const {data:{session}}=await supabase.auth.getSession();
 if(!session) throw new Error("Please sign in first.");
 const {data,error}=await supabase.functions.invoke(name,{body});
 if(error) throw new Error(error.message);
 return data as T;
}
