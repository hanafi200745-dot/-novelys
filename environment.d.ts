interface D1Database {prepare(query:string):any;batch(statements:any[]):Promise<any[]>;}
interface Fetcher {fetch(request:Request):Promise<Response>;}
declare module 'cloudflare:workers' {export const env: {DB:D1Database;BUCKET:any;[key:string]:any};}
