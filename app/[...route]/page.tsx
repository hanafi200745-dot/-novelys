import Client from '../client';
export default async function Page({params}:{params:Promise<{route:string[]}>}){const {route}=await params;return <Client path={'/'+route.join('/')}/>;}
